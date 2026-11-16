import { Router } from "express";
import { EmployeeAccountRequestStatus, Role } from "@prisma/client";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { allowRoles, requireAuth, type AuthRequest } from "../middleware/auth";
import { prisma } from "../shared/prisma";

export const accountRequestsRouter = Router();
accountRequestsRouter.use(requireAuth);

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

accountRequestsRouter.get(
  "/",
  allowRoles(Role.HR_ADMIN, Role.SUPER_ADMIN),
  async (req: AuthRequest, res, next) => {
    try {
      const { status } = z.object({
        status: z.nativeEnum(EmployeeAccountRequestStatus).optional()
      }).parse(req.query);
      const where = {
        ...(req.auth!.role === Role.HR_ADMIN ? { requestedById: req.auth!.id } : {}),
        ...(status ? { status } : {})
      };

      const requests = await prisma.employeeAccountRequest.findMany({
        where,
        include: {
          requestedBy: { select: { id: true, name: true } },
          reviewedBy: { select: { id: true, name: true } },
          createdUser: { select: { id: true, name: true, role: true } }
        },
        orderBy: { createdAt: "desc" }
      });

      return res.json({ requests });
    } catch (error) {
      next(error);
    }
  }
);

accountRequestsRouter.post(
  "/",
  allowRoles(Role.HR_ADMIN),
  async (req: AuthRequest, res, next) => {
    try {
      const input = z.object(requestFields).parse(req.body);
      const existingUser = await prisma.user.findUnique({
        where: { phone: input.phone },
        select: { id: true }
      });
      if (existingUser) {
        return res.status(409).json({ error: "Nomor telepon sudah terdaftar sebagai akun." });
      }

      const existingRequest = await prisma.employeeAccountRequest.findFirst({
        where: { phone: input.phone, status: EmployeeAccountRequestStatus.PENDING },
        select: { id: true }
      });
      if (existingRequest) {
        return res.status(409).json({ error: "Permohonan untuk nomor telepon ini masih menunggu persetujuan." });
      }

      const request = await prisma.employeeAccountRequest.create({
        data: {
          ...input,
          notes: input.notes || null,
          requestedById: req.auth!.id
        },
        include: {
          requestedBy: { select: { id: true, name: true } },
          reviewedBy: { select: { id: true, name: true } },
          createdUser: { select: { id: true, name: true, role: true } }
        }
      });

      return res.status(201).json({
        message: "Permohonan akun berhasil dikirim ke Superadmin untuk ditinjau.",
        request
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        return res.status(409).json({ error: "Nomor telepon sudah memiliki permohonan aktif." });
      }
      next(error);
    }
  }
);

accountRequestsRouter.patch(
  "/:requestId/decision",
  allowRoles(Role.SUPER_ADMIN),
  async (req: AuthRequest, res, next) => {
    try {
      const input = z.discriminatedUnion("decision", [
        z.object({
          decision: z.literal("APPROVED"),
          password: z.string().min(12).max(72)
            .refine((value) => Buffer.byteLength(value, "utf8") <= 72)
        }),
        z.object({
          decision: z.literal("REJECTED"),
          rejectionReason: z.string().trim().min(5).max(1000)
        })
      ]).parse(req.body);

      const requestId = String(req.params.requestId);
      const decision = input.decision === "APPROVED"
        ? { ...input, passwordHash: await bcrypt.hash(input.password, 12) }
        : input;

      const result = await prisma.$transaction(async (transaction) => {
        const accountRequest = await transaction.employeeAccountRequest.findUnique({
          where: { id: requestId }
        });
        if (!accountRequest) return { kind: "not_found" as const };
        if (accountRequest.status !== EmployeeAccountRequestStatus.PENDING) {
          return { kind: "already_decided" as const };
        }

        const email = `phone_${accountRequest.phone.replace(/\D/g, "")}@wellfora.internal`;
        if (decision.decision === "APPROVED") {
          const existingUser = await transaction.user.findFirst({
            where: { OR: [{ phone: accountRequest.phone }, { email }] },
            select: { id: true }
          });
          if (existingUser) return { kind: "duplicate" as const };
        }

        const reviewedAt = new Date();
        const updated = await transaction.employeeAccountRequest.updateMany({
          where: {
            id: requestId,
            status: EmployeeAccountRequestStatus.PENDING
          },
          data: {
            status: decision.decision,
            reviewedById: req.auth!.id,
            reviewedAt,
            rejectionReason: decision.decision === "REJECTED" ? decision.rejectionReason : null
          }
        });
        if (updated.count === 0) return { kind: "already_decided" as const };

        let createdUserId: string | null = null;
        if (decision.decision === "APPROVED") {
          const user = await transaction.user.create({
            data: {
              name: accountRequest.name,
              email,
              phone: accountRequest.phone,
              passwordHash: decision.passwordHash,
              role: Role.EMPLOYEE,
              department: accountRequest.department,
              position: accountRequest.position,
              isActive: true
            },
            select: { id: true }
          });
          createdUserId = user.id;
          await transaction.employeeAccountRequest.update({
            where: { id: requestId },
            data: { createdUserId }
          });
        }

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

      if (result.kind === "not_found") {
        return res.status(404).json({ error: "Permohonan akun tidak ditemukan." });
      }
      if (result.kind === "already_decided") {
        return res.status(409).json({ error: "Permohonan ini sudah pernah diputuskan." });
      }
      if (result.kind === "duplicate") {
        return res.status(409).json({ error: "Nomor telepon atau email akun sudah terdaftar. Permohonan tetap menunggu peninjauan." });
      }

      const message = decision.decision === "APPROVED"
        ? "Permohonan disetujui dan akun karyawan berhasil dibuat."
        : "Permohonan akun ditolak.";
      return res.json({ message, request: result.request });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        return res.status(409).json({ error: "Nomor telepon atau email sudah terdaftar. Permohonan tetap menunggu peninjauan." });
      }
      next(error);
    }
  }
);
