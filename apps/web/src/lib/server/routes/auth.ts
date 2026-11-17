import bcrypt from "bcryptjs";
import { EmployeeAccountRequestStatus, Role } from "@prisma/client";
import jwt from "jsonwebtoken";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { clearSessionCookies, jwtSecret, requireAuth, setSessionCookie, type AuthUser } from "../auth";
import { isPrismaError, json, readJson } from "../api-utils";
import { prisma } from "../prisma";

const demoPhoneByRole: Record<Role, string> = {
  EMPLOYEE: "081234567890",
  HR_ADMIN: "081298765432",
  PSYCHOLOGIST: "081311223344",
  LEGAL_COUNSEL: "081355667788",
  SUPER_ADMIN: "081122334455"
};

function phoneLoginCandidates(phone: string) {
  const trimmedPhone = phone.trim();
  const digits = trimmedPhone.replace(/\D/g, "");
  const nationalNumber = digits.startsWith("62") ? `0${digits.slice(2)}` : digits;
  const internationalNumber = nationalNumber.startsWith("0")
    ? `62${nationalNumber.slice(1)}`
    : nationalNumber;

  return [...new Set([
    trimmedPhone,
    digits,
    nationalNumber,
    internationalNumber,
    `+${internationalNumber}`
  ])];
}

export async function authRoutes(request: NextRequest, parts: string[], user?: AuthUser) {
  const action = parts[1];
  if (action === "activate" && request.method === "POST") {
    const input = z.object({
      token: z.string().min(1).max(4096),
      password: z.string().min(12).max(72)
        .refine((value) => Buffer.byteLength(value, "utf8") <= 72)
    }).parse(await readJson(request));
    const secret = jwtSecret();
    let claims: jwt.JwtPayload;
    try {
      const verified = jwt.verify(input.token, secret, {
        audience: "wellfora-account-activation"
      });
      if (typeof verified === "string") {
        return json({ error: "Tautan aktivasi tidak valid atau sudah kedaluwarsa." }, 400);
      }
      claims = verified;
    } catch {
      return json({ error: "Tautan aktivasi tidak valid atau sudah kedaluwarsa." }, 400);
    }

    if (claims.tokenType !== "account-activation" || typeof claims.sub !== "string") {
      return json({ error: "Tautan aktivasi tidak valid atau sudah kedaluwarsa." }, 400);
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    try {
      const result = await prisma.$transaction(async (transaction) => {
        const accountRequest = await transaction.employeeAccountRequest.findUnique({
          where: { id: claims.sub }
        });
        if (!accountRequest || accountRequest.status !== EmployeeAccountRequestStatus.APPROVED) {
          return { kind: "not_approved" as const };
        }
        if (accountRequest.createdUserId) return { kind: "already_activated" as const };

        const email = `phone_${accountRequest.phone.replace(/\D/g, "")}@wellfora.internal`;
        const existingUser = await transaction.user.findFirst({
          where: { OR: [{ phone: accountRequest.phone }, { email }] },
          select: { id: true }
        });
        if (existingUser) return { kind: "duplicate" as const };

        const newUser = await transaction.user.create({
          data: {
            name: accountRequest.name,
            email,
            phone: accountRequest.phone,
            passwordHash,
            role: accountRequest.approvedRole ?? Role.EMPLOYEE,
            department: accountRequest.department,
            position: accountRequest.position,
            isActive: true
          },
          select: { id: true }
        });
        await transaction.employeeAccountRequest.update({
          where: { id: accountRequest.id },
          data: { createdUserId: newUser.id }
        });
        return { kind: "activated" as const };
      });

      if (result.kind === "not_approved") {
        return json({ error: "Permohonan akun belum disetujui atau tidak ditemukan." }, 409);
      }
      if (result.kind === "already_activated") {
        return json({ error: "Tautan aktivasi ini sudah pernah digunakan." }, 409);
      }
      if (result.kind === "duplicate") {
        return json({ error: "Nomor telepon sudah terdaftar pada akun lain." }, 409);
      }
      return json({ message: "Akun berhasil diaktifkan. Silakan masuk dengan password yang baru dibuat." });
    } catch (error) {
      if (isPrismaError(error, "P2002")) {
        return json({ error: "Akun ini sudah diaktifkan atau nomor telepon sudah terdaftar." }, 409);
      }
      throw error;
    }
  }

  if (action === "register" && request.method === "POST") {
    return json({
      error: "Pendaftaran mandiri tidak tersedia. Hubungi HRD perusahaan untuk mengajukan akun."
    }, 403);
  }

  if (action === "demo-login" && request.method === "POST") {
    if (process.env.NODE_ENV !== "development") {
      return json({ error: "Login demo hanya tersedia di lingkungan development." }, 404);
    }

    const { role } = z.object({ role: z.nativeEnum(Role) }).parse(await readJson(request));
    const demoUser = await prisma.user.findFirst({
      where: { role, phone: demoPhoneByRole[role] },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        position: true,
        phone: true,
        isActive: true
      }
    });
    if (!demoUser || !demoUser.isActive) {
      return json({ error: "Akun demo tidak tersedia. Jalankan seed pada database development." }, 404);
    }

    const response = json({ message: "Login demo berhasil.", user: demoUser });
    setSessionCookie(response, demoUser.id, demoUser.role);
    return response;
  }

  if (action === "login" && request.method === "POST") {
    const input = z.object({
      phone: z.string().trim().min(8).max(20),
      password: z.string().min(1).max(72).refine((value) => Buffer.byteLength(value, "utf8") <= 72)
    }).parse(await readJson(request));

    const loginUsers = await prisma.user.findMany({
      where: { phone: { in: phoneLoginCandidates(input.phone) } },
      take: 2,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        position: true,
        phone: true,
        isActive: true,
        passwordHash: true
      }
    });
    const [loginUser] = loginUsers;
    if (loginUsers.length !== 1 || !loginUser) {
      return json({ error: "Nomor telepon atau password tidak sesuai." }, 401);
    }
    if (!loginUser.isActive) {
      return json({ error: "Akun ini telah dinonaktifkan (karyawan resign/non-aktif). Hubungi Superadmin." }, 403);
    }
    if (!await bcrypt.compare(input.password, loginUser.passwordHash)) {
      return json({ error: "Nomor telepon atau password tidak sesuai." }, 401);
    }

    const safeUser = {
      id: loginUser.id,
      email: loginUser.email,
      name: loginUser.name,
      role: loginUser.role,
      department: loginUser.department,
      position: loginUser.position,
      phone: loginUser.phone,
      isActive: loginUser.isActive
    };
    const response = json({ message: "Login berhasil.", user: safeUser });
    setSessionCookie(response, loginUser.id, loginUser.role);
    return response;
  }

  if (action === "me" && request.method === "GET") {
    return json({ user: user ?? await requireAuth(request) });
  }

  if (action === "logout" && request.method === "POST") {
    const response = json({ message: "Kamu telah berhasil keluar dari akun Wellfora." });
    clearSessionCookies(response);
    return response;
  }

  return null;
}
