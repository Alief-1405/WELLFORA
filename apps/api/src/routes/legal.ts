import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { LegalCategory, LegalStatus, Role } from "@prisma/client";
import { prisma } from "../shared/prisma";
import { requireAuth, allowRoles, type AuthRequest } from "../middleware/auth";

export const legalRouter = Router();
legalRouter.use(requireAuth);

const createComplaintSchema = z.object({
  category: z.nativeEnum(LegalCategory),
  title: z.string().trim().min(5).max(255),
  description: z.string().trim().min(5).max(3000),
  incidentDate: z.string().datetime(),
  counselId: z.string().min(1).optional(),
  location: z.string().trim().max(255).optional(),
  isAnonymous: z.boolean().default(false),
  evidenceInfo: z.string().trim().max(1000).optional()
});

legalRouter.get("/staff", allowRoles(Role.EMPLOYEE), async (_req, res, next) => {
  try {
    const legalStaff = await prisma.user.findMany({
      where: { role: Role.LEGAL_COUNSEL, isActive: true },
      select: { id: true, name: true, department: true },
      orderBy: { name: "asc" }
    });

    return res.json({ legalStaff });
  } catch (error) {
    next(error);
  }
});

// Employee submits a legal complaint
legalRouter.post("/complaints", allowRoles(Role.EMPLOYEE), async (req: AuthRequest, res, next) => {
  try {
    const input = createComplaintSchema.parse(req.body);
    const incidentDate = new Date(input.incidentDate);
    if (incidentDate > new Date()) {
      return res.status(400).json({ error: "Tanggal kejadian tidak boleh di masa depan." });
    }

    // Random ticket identifiers avoid count-based collisions under concurrent submissions.
    const year = new Date().getFullYear();
    const ticketNumber = `WLF-LGL-${year}-${randomBytes(8).toString("hex").toUpperCase()}`;

    const selectedCounsel = input.counselId
      ? await prisma.user.findFirst({
          where: { id: input.counselId, role: Role.LEGAL_COUNSEL, isActive: true },
          select: { id: true }
        })
      : null;
    if (input.counselId && !selectedCounsel) {
      return res.status(400).json({ error: "Petugas legal yang dipilih tidak tersedia." });
    }

    const counsel = selectedCounsel ?? await prisma.user.findFirst({
      where: { role: Role.LEGAL_COUNSEL, isActive: true },
      select: { id: true },
      orderBy: { name: "asc" }
    });

    const complaint = await prisma.legalComplaint.create({
      data: {
        ticketNumber,
        userId: req.auth!.id,
        counselId: counsel?.id,
        category: input.category,
        title: input.title,
        description: input.description,
        incidentDate,
        location: input.location,
        isAnonymous: input.isAnonymous,
        evidenceInfo: input.evidenceInfo,
        status: LegalStatus.SUBMITTED,
        legalNotes: "Laporan telah tercatat dalam sistem perlindungan pekerja. Tim hukum akan memverifikasi dalam 1x24 jam."
      }
    });

    const {
      userId: _userId,
      counselId: _counselId,
      legalNotes: _legalNotes,
      investigationNotes: _investigationNotes,
      mediationNotes: _mediationNotes,
      ...employeeComplaint
    } = complaint;

    return res.status(201).json({
      message: `Laporan pengaduan berhasil dibuat dengan nomor tiket ${ticketNumber}.`,
      complaint: employeeComplaint
    });
  } catch (error) {
    next(error);
  }
});

// Get complaints: Employees get theirs; Legal & Admin get all
legalRouter.get("/complaints", async (req: AuthRequest, res, next) => {
  try {
    if (req.auth!.role !== Role.EMPLOYEE && req.auth!.role !== Role.LEGAL_COUNSEL) {
      return res.status(403).json({ error: "Fitur ini hanya tersedia untuk karyawan dan tim hukum." });
    }
    const isLegal = req.auth!.role === Role.LEGAL_COUNSEL;
    const { status, category } = req.query;

    const where: any = {};
    if (!isLegal) {
      where.userId = req.auth!.id;
    }
    if (status && Object.values(LegalStatus).includes(status as LegalStatus)) {
      where.status = status as LegalStatus;
    }
    if (category && Object.values(LegalCategory).includes(category as LegalCategory)) {
      where.category = category as LegalCategory;
    }

    const rawComplaints = await prisma.legalComplaint.findMany({
      where,
      include: {
        employee: {
          select: { id: true, name: true, email: true, department: true, position: true }
        },
        counsel: {
          select: { id: true, name: true, email: true, department: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const complaints = rawComplaints.map((c) => {
      if (req.auth!.role === Role.EMPLOYEE) {
        const {
          userId: _userId,
          counselId: _counselId,
          employee: _employee,
          counsel: _counsel,
          legalNotes: _legalNotes,
          investigationNotes: _investigationNotes,
          mediationNotes: _mediationNotes,
          ...employeeComplaint
        } = c;
        return employeeComplaint;
      }

      if (c.isAnonymous) {
        const { userId: _userId, employee: _employee, ...anonymousComplaint } = c;
        return {
          ...anonymousComplaint,
          employee: {
            id: "ANONYMOUS",
            name: "Pelapor Anonim",
            email: "",
            department: null,
            position: null
          }
        };
      }
      return c;
    });

    return res.json({ complaints });
  } catch (error) {
    next(error);
  }
});

// Legal summary stats for Legal Counsel dashboard
legalRouter.get("/summary", allowRoles(Role.LEGAL_COUNSEL), async (_req, res, next) => {
  try {
    const [total, submitted, inReview, investigation, mediation, resolved, byCategory] = await Promise.all([
      prisma.legalComplaint.count(),
      prisma.legalComplaint.count({ where: { status: LegalStatus.SUBMITTED } }),
      prisma.legalComplaint.count({ where: { status: LegalStatus.IN_REVIEW } }),
      prisma.legalComplaint.count({ where: { status: LegalStatus.INVESTIGATION } }),
      prisma.legalComplaint.count({ where: { status: LegalStatus.MEDIATION } }),
      prisma.legalComplaint.count({ where: { status: LegalStatus.RESOLVED } }),
      prisma.legalComplaint.groupBy({
        by: ["category"],
        _count: { id: true }
      })
    ]);

    return res.json({
      summary: {
        total,
        submitted,
        inReview,
        investigation,
        mediation,
        resolved,
        byCategory: Object.fromEntries(byCategory.map((b) => [b.category, b._count.id]))
      }
    });
  } catch (error) {
    next(error);
  }
});

// Legal Counsel updates status & writes legal/investigation/mediation notes
legalRouter.patch("/complaints/:id/status", allowRoles(Role.LEGAL_COUNSEL), async (req: AuthRequest, res, next) => {
  try {
    const input = z.object({
      status: z.nativeEnum(LegalStatus),
      legalNotes: z.string().trim().max(2000).optional(),
      investigationNotes: z.string().trim().max(2000).optional(),
      mediationNotes: z.string().trim().max(2000).optional()
    }).parse(req.body);

    const complaint = await prisma.legalComplaint.update({
      where: { id: String(req.params.id) },
      data: {
        status: input.status,
        counselId: req.auth!.id,
        ...(input.legalNotes !== undefined ? { legalNotes: input.legalNotes } : {}),
        ...(input.investigationNotes !== undefined ? { investigationNotes: input.investigationNotes } : {}),
        ...(input.mediationNotes !== undefined ? { mediationNotes: input.mediationNotes } : {})
      },
      include: {
        counsel: { select: { id: true, name: true, department: true } }
      }
    });

    const { userId: _userId, ...anonymousComplaint } = complaint;
    const responseComplaint = complaint.isAnonymous ? anonymousComplaint : complaint;

    return res.json({
      message: `Status pengaduan hukum diperbarui menjadi ${input.status}.`,
      complaint: responseComplaint
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return res.status(404).json({ error: "Laporan pengaduan tidak ditemukan." });
    }
    next(error);
  }
});
