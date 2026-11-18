import { randomBytes } from "node:crypto";
import { LegalCategory, LegalStatus, Role, type Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { allowRoles, type AuthUser } from "../auth";
import { isPrismaError, json, queryObject, readJson } from "../api-utils";
import { prisma } from "../prisma";

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

function omitKeys<T extends object, K extends keyof T>(value: T, keys: readonly K[]): Omit<T, K> {
  const result: Partial<T> = { ...value };
  for (const key of keys) delete result[key];
  return result as Omit<T, K>;
}

export async function legalRoutes(request: NextRequest, parts: string[], user: AuthUser) {
  if (parts[1] === "staff" && parts.length === 2 && request.method === "GET") {
    allowRoles(user, Role.EMPLOYEE);
    const legalStaff = await prisma.user.findMany({
      where: { role: Role.LEGAL_COUNSEL, isActive: true },
      select: { id: true, name: true, department: true },
      orderBy: { name: "asc" }
    });
    return json({ legalStaff });
  }

  if (parts[1] === "summary" && parts.length === 2 && request.method === "GET") {
    allowRoles(user, Role.LEGAL_COUNSEL);
    const [total, submitted, inReview, investigation, mediation, resolved, byCategory] = await Promise.all([
      prisma.legalComplaint.count(),
      prisma.legalComplaint.count({ where: { status: LegalStatus.SUBMITTED } }),
      prisma.legalComplaint.count({ where: { status: LegalStatus.IN_REVIEW } }),
      prisma.legalComplaint.count({ where: { status: LegalStatus.INVESTIGATION } }),
      prisma.legalComplaint.count({ where: { status: LegalStatus.MEDIATION } }),
      prisma.legalComplaint.count({ where: { status: LegalStatus.RESOLVED } }),
      prisma.legalComplaint.groupBy({ by: ["category"], _count: { id: true } })
    ]);
    return json({
      summary: {
        total,
        submitted,
        inReview,
        investigation,
        mediation,
        resolved,
        byCategory: Object.fromEntries(byCategory.map((entry) => [entry.category, entry._count.id]))
      }
    });
  }

  if (parts[1] !== "complaints") return null;
  if (parts.length === 2 && request.method === "POST") {
    allowRoles(user, Role.EMPLOYEE);
    const input = createComplaintSchema.parse(await readJson(request));
    const incidentDate = new Date(input.incidentDate);
    if (incidentDate > new Date()) return json({ error: "Tanggal kejadian tidak boleh di masa depan." }, 400);
    const year = new Date().getFullYear();
    const ticketNumber = `WLF-LGL-${year}-${randomBytes(8).toString("hex").toUpperCase()}`;
    const selectedCounsel = input.counselId
      ? await prisma.user.findFirst({
          where: { id: input.counselId, role: Role.LEGAL_COUNSEL, isActive: true },
          select: { id: true }
        })
      : null;
    if (input.counselId && !selectedCounsel) {
      return json({ error: "Petugas legal yang dipilih tidak tersedia." }, 400);
    }

    const counsel = selectedCounsel ?? await prisma.user.findFirst({
      where: { role: Role.LEGAL_COUNSEL, isActive: true },
      select: { id: true },
      orderBy: { name: "asc" }
    });
    const complaint = await prisma.legalComplaint.create({
      data: {
        ticketNumber,
        userId: user.id,
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
    return json({
      message: `Laporan pengaduan berhasil dibuat dengan nomor tiket ${ticketNumber}.`,
      complaint: omitKeys(complaint, [
        "userId",
        "counselId",
        "legalNotes",
        "investigationNotes",
        "mediationNotes"
      ])
    }, 201);
  }

  if (parts.length === 2 && request.method === "GET") {
    if (user.role !== Role.EMPLOYEE && user.role !== Role.LEGAL_COUNSEL) {
      return json({ error: "Fitur ini hanya tersedia untuk karyawan dan tim hukum." }, 403);
    }
    const query = queryObject(request);
    const where: Prisma.LegalComplaintWhereInput = {};
    if (user.role !== Role.LEGAL_COUNSEL) where.userId = user.id;
    if (query.status && Object.values(LegalStatus).includes(query.status as LegalStatus)) {
      where.status = query.status as LegalStatus;
    }
    if (query.category && Object.values(LegalCategory).includes(query.category as LegalCategory)) {
      where.category = query.category as LegalCategory;
    }
    const rawComplaints = await prisma.legalComplaint.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, email: true, department: true, position: true } },
        counsel: { select: { id: true, name: true, email: true, department: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    const complaints = rawComplaints.map((complaint) => {
      if (user.role === Role.EMPLOYEE) {
        return omitKeys(complaint, [
          "userId",
          "counselId",
          "employee",
          "counsel",
          "legalNotes",
          "investigationNotes",
          "mediationNotes"
        ]);
      }
      if (complaint.isAnonymous) {
        return {
          ...omitKeys(complaint, ["userId", "employee"]),
          employee: {
            id: "ANONYMOUS",
            name: "Pelapor Anonim",
            email: "",
            department: null,
            position: null
          }
        };
      }
      return complaint;
    });
    return json({ complaints });
  }

  if (parts.length === 4 && parts[3] === "status" && request.method === "PATCH") {
    allowRoles(user, Role.LEGAL_COUNSEL);
    const input = z.object({
      status: z.nativeEnum(LegalStatus),
      legalNotes: z.string().trim().max(2000).optional(),
      investigationNotes: z.string().trim().max(2000).optional(),
      mediationNotes: z.string().trim().max(2000).optional()
    }).parse(await readJson(request));
    try {
      const complaint = await prisma.legalComplaint.update({
        where: { id: parts[2] },
        data: {
          status: input.status,
          counselId: user.id,
          ...(input.legalNotes !== undefined ? { legalNotes: input.legalNotes } : {}),
          ...(input.investigationNotes !== undefined ? { investigationNotes: input.investigationNotes } : {}),
          ...(input.mediationNotes !== undefined ? { mediationNotes: input.mediationNotes } : {})
        },
        include: { counsel: { select: { id: true, name: true, department: true } } }
      });
      return json({
        message: `Status pengaduan hukum diperbarui menjadi ${input.status}.`,
        complaint: complaint.isAnonymous ? omitKeys(complaint, ["userId"]) : complaint
      });
    } catch (error) {
      if (isPrismaError(error, "P2025")) return json({ error: "Laporan pengaduan tidak ditemukan." }, 404);
      throw error;
    }
  }
  return null;
}
