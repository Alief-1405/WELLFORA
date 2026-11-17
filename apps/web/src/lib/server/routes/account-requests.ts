import { EmployeeAccountRequestStatus, Role } from "@prisma/client";
import jwt from "jsonwebtoken";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { allowRoles, jwtSecret, type AuthUser } from "../auth";
import { json, isPrismaError, queryObject, readJson } from "../api-utils";
import { prisma } from "../prisma";

const phoneSchema = z.string().trim().regex(
  /^(\+62|62|0)[0-9]{8,13}$/,
  "Nomor telepon tidak valid. Gunakan format: 08xxx atau +62xxx"
);
const requestFields = {
  name: z.string().trim().min(2).max(100),
  phone: phoneSchema,
  department: z.string().trim().min(1).max(100),
  position: z.string().trim().min(1).max(100),
  notes: z.string().trim().max(1000).optional()
};

export async function accountRequestRoutes(
  request: NextRequest,
  parts: string[],
  user: AuthUser
) {
  if (parts.length === 1 && request.method === "GET") {
    allowRoles(user, Role.HR_ADMIN, Role.SUPER_ADMIN);
    const { status } = z.object({
      status: z.nativeEnum(EmployeeAccountRequestStatus).optional()
    }).parse(queryObject(request));
    const requests = await prisma.employeeAccountRequest.findMany({
      where: {
        ...(user.role === Role.HR_ADMIN ? { requestedById: user.id } : {}),
        ...(status ? { status } : {})
      },
      include: {
        requestedBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
        createdUser: { select: { id: true, name: true, role: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    return json({ requests });
  }

  if (parts.length === 3 && parts[2] === "activation-link" && request.method === "GET") {
    allowRoles(user, Role.HR_ADMIN, Role.SUPER_ADMIN);
    const accountRequest = await prisma.employeeAccountRequest.findUnique({
      where: { id: parts[1] },
      select: { id: true, requestedById: true, status: true, createdUserId: true }
    });
    if (!accountRequest || (user.role === Role.HR_ADMIN && accountRequest.requestedById !== user.id)) {
      return json({ error: "Permohonan akun tidak ditemukan." }, 404);
    }
    if (accountRequest.status !== EmployeeAccountRequestStatus.APPROVED || accountRequest.createdUserId) {
      return json({ error: "Permohonan ini belum siap untuk aktivasi akun." }, 409);
    }

    const token = jwt.sign(
      { tokenType: "account-activation" },
      jwtSecret(),
      { subject: accountRequest.id, audience: "wellfora-account-activation", expiresIn: "24h" }
    );
    const activationUrl = new URL("/activate-account", request.nextUrl.origin);
    activationUrl.hash = token;
    return json({ activationUrl: activationUrl.toString(), expiresInHours: 24 });
  }

  if (parts.length === 1 && request.method === "POST") {
    allowRoles(user, Role.HR_ADMIN);
    const input = z.object(requestFields).parse(await readJson(request));
    const existingUser = await prisma.user.findUnique({
      where: { phone: input.phone },
      select: { id: true }
    });
    if (existingUser) return json({ error: "Nomor telepon sudah terdaftar sebagai akun." }, 409);

    const existingRequest = await prisma.employeeAccountRequest.findFirst({
      where: { phone: input.phone, status: EmployeeAccountRequestStatus.PENDING },
      select: { id: true }
    });
    if (existingRequest) {
      return json({ error: "Permohonan untuk nomor telepon ini masih menunggu persetujuan." }, 409);
    }

    try {
      const accountRequest = await prisma.employeeAccountRequest.create({
        data: { ...input, notes: input.notes || null, requestedById: user.id },
        include: {
          requestedBy: { select: { id: true, name: true } },
          reviewedBy: { select: { id: true, name: true } },
          createdUser: { select: { id: true, name: true, role: true } }
        }
      });
      return json({
        message: "Permohonan akun berhasil dikirim ke Superadmin untuk ditinjau.",
        request: accountRequest
      }, 201);
    } catch (error) {
      if (isPrismaError(error, "P2002")) {
        return json({ error: "Nomor telepon sudah memiliki permohonan aktif." }, 409);
      }
      throw error;
    }
  }

  if (parts.length === 3 && parts[2] === "decision" && request.method === "PATCH") {
    allowRoles(user, Role.SUPER_ADMIN);
    const input = z.discriminatedUnion("decision", [
      z.object({ decision: z.literal("APPROVED") }),
      z.object({
        decision: z.literal("REJECTED"),
        rejectionReason: z.string().trim().min(5).max(1000)
      })
    ]).parse(await readJson(request));
    const requestId = parts[1];

    try {
      const result = await prisma.$transaction(async (transaction) => {
        const accountRequest = await transaction.employeeAccountRequest.findUnique({
          where: { id: requestId }
        });
        if (!accountRequest) return { kind: "not_found" as const };
        if (accountRequest.status !== EmployeeAccountRequestStatus.PENDING) {
          return { kind: "already_decided" as const };
        }

        const email = `phone_${accountRequest.phone.replace(/\D/g, "")}@wellfora.internal`;
        if (input.decision === "APPROVED") {
          const existingUser = await transaction.user.findFirst({
            where: { OR: [{ phone: accountRequest.phone }, { email }] },
            select: { id: true }
          });
          if (existingUser) return { kind: "duplicate" as const };
        }

        const reviewedAt = new Date();
        const updated = await transaction.employeeAccountRequest.updateMany({
          where: { id: requestId, status: EmployeeAccountRequestStatus.PENDING },
          data: {
            status: input.decision,
            reviewedById: user.id,
            reviewedAt,
            rejectionReason: input.decision === "REJECTED" ? input.rejectionReason : null
          }
        });
        if (updated.count === 0) return { kind: "already_decided" as const };

        const reviewedRequest = await transaction.employeeAccountRequest.findUniqueOrThrow({
          where: { id: requestId },
          include: {
            requestedBy: { select: { id: true, name: true } },
            reviewedBy: { select: { id: true, name: true } },
            createdUser: { select: { id: true, name: true, role: true } }
          }
        });
        return { kind: "updated" as const, request: reviewedRequest };
      });

      if (result.kind === "not_found") return json({ error: "Permohonan akun tidak ditemukan." }, 404);
      if (result.kind === "already_decided") return json({ error: "Permohonan ini sudah pernah diputuskan." }, 409);
      if (result.kind === "duplicate") {
        return json({ error: "Nomor telepon atau email akun sudah terdaftar. Permohonan tetap menunggu peninjauan." }, 409);
      }
      return json({
        message: input.decision === "APPROVED"
          ? "Permohonan disetujui. HRD dapat membagikan tautan aktivasi kepada karyawan."
          : "Permohonan akun ditolak.",
        request: result.request
      });
    } catch (error) {
      if (isPrismaError(error, "P2002")) {
        return json({ error: "Nomor telepon atau email sudah terdaftar. Permohonan tetap menunggu peninjauan." }, 409);
      }
      throw error;
    }
  }
  return null;
}
