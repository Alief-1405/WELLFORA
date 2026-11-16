import { Router } from "express";
import { z } from "zod";
import { LeaveStatus, LeaveType, Role } from "@prisma/client";
import { prisma } from "../shared/prisma";
import { requireAuth, allowRoles, type AuthRequest } from "../middleware/auth";

export const leavesRouter = Router();
leavesRouter.use(requireAuth);

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

// Employee submits leave request
leavesRouter.post("/", allowRoles(Role.EMPLOYEE), async (req: AuthRequest, res, next) => {
  try {
    const input = createLeaveSchema.parse(req.body);
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);

    if (endDate < startDate) {
      return res.status(400).json({ error: "Tanggal berakhir tidak boleh sebelum tanggal mulai." });
    }

    // Hitung hari kerja otomatis (Senin–Jumat, exclude weekend)
    let daysCount = 0;
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      const day = cursor.getUTCDay(); // 0=Sun, 6=Sat
      if (day !== 0 && day !== 6) daysCount++;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    if (daysCount < 1) daysCount = 1;

    const leave = await prisma.leaveRequest.create({
      data: {
        userId: req.auth!.id,
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

    return res.status(201).json({ message: "Surat izin berhasil diajukan dan masuk ke antrean verifikasi HRD.", leave });
  } catch (error) {
    next(error);
  }
});

// List leaves: Employees get their own; HRD and Superadmin get all with filtering
leavesRouter.get("/", async (req: AuthRequest, res, next) => {
  try {
    if (req.auth!.role !== Role.EMPLOYEE && req.auth!.role !== Role.HR_ADMIN) {
      return res.status(403).json({ error: "Fitur ini hanya tersedia untuk karyawan dan HRD." });
    }
    const isHr = req.auth!.role === Role.HR_ADMIN;
    const { status, type } = req.query;

    const where: any = {};
    if (!isHr) {
      where.userId = req.auth!.id;
    }
    if (status && Object.values(LeaveStatus).includes(status as LeaveStatus)) {
      where.status = status as LeaveStatus;
    }
    if (type && Object.values(LeaveType).includes(type as LeaveType)) {
      where.type = type as LeaveType;
    }

    const leaves = await prisma.leaveRequest.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, department: true, position: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    return res.json({ leaves });
  } catch (error) {
    next(error);
  }
});

// HRD summary metrics
leavesRouter.get("/summary", allowRoles(Role.HR_ADMIN), async (_req, res, next) => {
  try {
    const [total, pending, approved, rejected, byType] = await Promise.all([
      prisma.leaveRequest.count(),
      prisma.leaveRequest.count({ where: { status: LeaveStatus.PENDING } }),
      prisma.leaveRequest.count({ where: { status: LeaveStatus.APPROVED } }),
      prisma.leaveRequest.count({ where: { status: LeaveStatus.REJECTED } }),
      prisma.leaveRequest.groupBy({
        by: ["type"],
        _count: { id: true }
      })
    ]);

    return res.json({
      summary: {
        total,
        pending,
        approved,
        rejected,
        byType: Object.fromEntries(byType.map((b) => [b.type, b._count.id]))
      }
    });
  } catch (error) {
    next(error);
  }
});

// HRD updates status (Approval / Review / Rejection)
leavesRouter.patch("/:id/status", allowRoles(Role.HR_ADMIN), async (req: AuthRequest, res, next) => {
  try {
    const input = z.object({
      status: z.nativeEnum(LeaveStatus),
      hrNotes: z.string().trim().max(1000).optional()
    }).parse(req.body);

    const leave = await prisma.leaveRequest.update({
      where: { id: String(req.params.id) },
      data: {
        status: input.status,
        hrNotes: input.hrNotes,
        reviewedBy: req.auth!.name,
        reviewedAt: new Date()
      },
      include: {
        user: { select: { id: true, name: true, email: true, department: true } }
      }
    });

    return res.json({ message: `Status surat izin berhasil diperbarui menjadi ${input.status}.`, leave });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return res.status(404).json({ error: "Data surat izin tidak ditemukan." });
    }
    next(error);
  }
});
