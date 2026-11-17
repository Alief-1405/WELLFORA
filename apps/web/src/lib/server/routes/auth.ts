import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { clearSessionCookies, requireAuth, setSessionCookie, type AuthUser } from "../auth";
import { json, readJson } from "../api-utils";
import { prisma } from "../prisma";

const demoPhoneByRole: Record<Role, string> = {
  EMPLOYEE: "081234567890",
  HR_ADMIN: "081298765432",
  PSYCHOLOGIST: "081311223344",
  LEGAL_COUNSEL: "081355667788",
  SUPER_ADMIN: "081122334455"
};

export async function authRoutes(request: NextRequest, parts: string[], user?: AuthUser) {
  const action = parts[1];
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

    const loginUser = await prisma.user.findUnique({
      where: { phone: input.phone },
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
    if (!loginUser) {
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
