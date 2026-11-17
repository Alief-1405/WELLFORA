import { LeaveStatus, LeaveType, Role, type Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { allowRoles, type AuthUser } from "../auth";
import { isPrismaError, json, queryObject, readJson } from "../api-utils";
import { prisma } from "../prisma";

const createLeaveSchema = z.object({
  type: z.nativeEnum(LeaveType),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reason: z.string().trim().min(5).max(1000),
  attachmentUrl: z.string()
    .max(5_000_000)
    .regex(/^data:(image\/jpeg|image\/png|application\/pdf);base64,[A-Za-z0-9+/]*={0,2}$/)
    .refine((value) => {
      const [, mimeType, encoded] = value.match(/^data:(image\/jpeg|image\/png|application\/pdf);base64,(.*)$/) || [];
      if (!mimeType || !encoded) return false;
      const bytes = Buffer.from(encoded, "base64");
      if (bytes.length > 3.5 * 1024 * 1024) return false;
      if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      if (mimeType === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
    }, "Lampiran harus berupa JPG, PNG, atau PDF yang valid dan maksimal 3.5 MB.")
    .optional()
});

export async function leaveRoutes(request: NextRequest, parts: string[], user: AuthUser) {
  if (parts.length === 1 && request.method === "POST") {
    allowRoles(user, Role.EMPLOYEE);
    const input = createLeaveSchema.parse(await readJson(request));
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    if (endDate < startDate) {
      return json({ error: "Tanggal berakhir tidak boleh sebelum tanggal mulai." }, 400);
    }
    let daysCount = 0;
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      const day = cursor.getUTCDay();
      if (day !== 0 && day !== 6) daysCount++;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    if (daysCount < 1) daysCount = 1;
    const leave = await prisma.leaveRequest.create({
      data: {
        userId: user.id,
        type: input.type,
        startDate,
        endDate,
        daysCount,
        reason: input.reason,
        attachmentUrl: input.attachmentUrl,
        status: LeaveStatus.PENDING
      },
      include: {
        user: { select: { id: true, name: true, email: true, department: true, position: true } }
      }
    });
    return json({
      message: "Surat izin berhasil diajukan dan masuk ke antrean verifikasi HRD.",
      leave
    }, 201);
  }

  if (parts.length === 2 && parts[1] === "summary" && request.method === "GET") {
    allowRoles(user, Role.HR_ADMIN);
    const [total, pending, approved, rejected, byType] = await Promise.all([
      prisma.leaveRequest.count(),
      prisma.leaveRequest.count({ where: { status: LeaveStatus.PENDING } }),
      prisma.leaveRequest.count({ where: { status: LeaveStatus.APPROVED } }),
      prisma.leaveRequest.count({ where: { status: LeaveStatus.REJECTED } }),
      prisma.leaveRequest.groupBy({ by: ["type"], _count: { id: true } })
    ]);
    return json({
      summary: {
        total,
        pending,
        approved,
        rejected,
        byType: Object.fromEntries(byType.map((entry) => [entry.type, entry._count.id]))
      }
    });
  }

  if (parts.length === 3 && parts[2] === "status" && request.method === "PATCH") {
    allowRoles(user, Role.HR_ADMIN);
    const input = z.object({
      status: z.nativeEnum(LeaveStatus),
      hrNotes: z.string().trim().max(1000).optional()
    }).parse(await readJson(request));
    try {
      const leave = await prisma.leaveRequest.update({
        where: { id: parts[1] },
        data: {
          status: input.status,
          hrNotes: input.hrNotes,
          reviewedBy: user.name,
          reviewedAt: new Date()
        },
        include: {
          user: { select: { id: true, name: true, email: true, department: true } }
        }
      });
      return json({ message: `Status surat izin berhasil diperbarui menjadi ${input.status}.`, leave });
    } catch (error) {
      if (isPrismaError(error, "P2025")) return json({ error: "Data surat izin tidak ditemukan." }, 404);
      throw error;
    }
  }

  if (parts.length === 1 && request.method === "GET") {
    if (user.role !== Role.EMPLOYEE && user.role !== Role.HR_ADMIN) {
      return json({ error: "Fitur ini hanya tersedia untuk karyawan dan HRD." }, 403);
    }
    const query = queryObject(request);
    const where: Prisma.LeaveRequestWhereInput = {};
    if (user.role === Role.EMPLOYEE) where.userId = user.id;
    if (query.status && Object.values(LeaveStatus).includes(query.status as LeaveStatus)) {
      where.status = query.status as LeaveStatus;
    }
    if (query.type && Object.values(LeaveType).includes(query.type as LeaveType)) {
      where.type = query.type as LeaveType;
    }
    const leaves = await prisma.leaveRequest.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, department: true, position: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    return json({ leaves });
  }
  return null;
}
