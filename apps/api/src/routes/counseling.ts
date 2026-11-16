import { Router } from "express";
import { z } from "zod";
import { BookingStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "../shared/prisma";
import { requireAuth, allowRoles, type AuthRequest } from "../middleware/auth";

export const counselingRouter = Router();
counselingRouter.use(requireAuth);

const weekdayNames: Record<string, string> = {
  Monday: "Senin",
  Tuesday: "Selasa",
  Wednesday: "Rabu",
  Thursday: "Kamis",
  Friday: "Jumat",
  Saturday: "Sabtu",
  Sunday: "Minggu"
};
const indonesianWeekdays = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"] as const;

const practiceSlotSchema = z.object({
  day: z.enum(indonesianWeekdays),
  time: z.string().trim().regex(/^([01]\d|2[0-3]):([0-5]\d) - ([01]\d|2[0-3]):([0-5]\d) WIB$/),
  isAvailable: z.boolean().default(true)
}).refine(({ time }) => {
  const parts = time.match(/\d+/g);
  if (!parts || parts.length !== 4) return false;
  const [startHour, startMinute, endHour, endMinute] = parts.map(Number);
  return startHour * 60 + startMinute < endHour * 60 + endMinute;
}, { message: "Waktu selesai harus setelah waktu mulai.", path: ["time"] });

function slotRange(time: string) {
  const parts = time.match(/\d+/g);
  if (!parts || parts.length !== 4) return null;
  const [startHour, startMinute, endHour, endMinute] = parts.map(Number);
  return [startHour * 60 + startMinute, endHour * 60 + endMinute] as const;
}

// Get list of psychologists with their practice slots (available to all authenticated users)
counselingRouter.get("/psychologists", async (_req, res, next) => {
  try {
    const psychologists = await prisma.user.findMany({
      where: { role: Role.PSYCHOLOGIST, isActive: true },
      select: {
        id: true,
        name: true,
        department: true,
        position: true,
        practiceSlots: {
          where: { isAvailable: true },
          orderBy: { createdAt: "asc" }
        }
      },
      orderBy: { name: "asc" }
    });

    return res.json({ psychologists });
  } catch (error) {
    next(error);
  }
});

// Return date-specific practice slots without exposing other employees' booking details.
counselingRouter.get("/availability", allowRoles(Role.EMPLOYEE), async (req, res, next) => {
  try {
    const input = z.object({
      psychologistId: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
    }).parse(req.query);
    const utcDate = new Date(`${input.date}T00:00:00.000Z`);
    if (!Number.isFinite(utcDate.getTime()) || utcDate.toISOString().slice(0, 10) !== input.date) {
      return res.status(400).json({ error: "Tanggal konsultasi tidak valid." });
    }

    const psychologist = await prisma.user.findFirst({
      where: { id: input.psychologistId, role: Role.PSYCHOLOGIST, isActive: true },
      select: { id: true }
    });
    if (!psychologist) {
      return res.status(404).json({ error: "Psikolog tidak ditemukan atau sedang tidak aktif." });
    }

    const weekday = weekdayNames[new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      timeZone: "UTC"
    }).format(utcDate)];
    const nextUtcDate = new Date(utcDate);
    nextUtcDate.setUTCDate(nextUtcDate.getUTCDate() + 1);
    const dayStart = new Date(`${input.date}T00:00:00+07:00`);
    const dayEnd = new Date(`${nextUtcDate.toISOString().slice(0, 10)}T00:00:00+07:00`);

    const [practiceSlots, bookings] = await Promise.all([
      prisma.practiceSlot.findMany({
        where: {
          psychologistId: psychologist.id,
          day: weekday,
          isAvailable: true
        },
        orderBy: { createdAt: "asc" }
      }),
      prisma.consultationBooking.findMany({
        where: {
          psychologistId: psychologist.id,
          scheduledAt: { gte: dayStart, lt: dayEnd },
          status: { not: BookingStatus.CANCELLED }
        },
        select: { scheduledAt: true }
      })
    ]);

    const bookedTimes = new Set(bookings.map((booking) => booking.scheduledAt.getTime()));
    const now = new Date();
    const slots = practiceSlots.map((slot) => {
      const range = slotRange(slot.time);
      if (!range) return null;

      const startTime = `${String(Math.floor(range[0] / 60)).padStart(2, "0")}:${String(range[0] % 60).padStart(2, "0")}`;
      const scheduledAt = new Date(`${input.date}T${startTime}:00+07:00`);
      const booked = bookedTimes.has(scheduledAt.getTime());
      const past = scheduledAt <= now;

      return {
        id: slot.id,
        day: slot.day,
        time: slot.time,
        startTime,
        booked,
        past,
        available: !booked && !past
      };
    });

    if (slots.some((slot) => slot === null)) {
      return res.status(500).json({ error: "Format jadwal praktik tidak valid. Hubungi administrator." });
    }

    return res.json({ slots });
  } catch (error) {
    next(error);
  }
});

// Psychologist manages their practice slots
counselingRouter.get("/slots", allowRoles(Role.PSYCHOLOGIST), async (req: AuthRequest, res, next) => {
  try {
    const slots = await prisma.practiceSlot.findMany({
      where: { psychologistId: req.auth!.id },
      orderBy: { createdAt: "asc" }
    });
    return res.json({ slots });
  } catch (error) {
    next(error);
  }
});

counselingRouter.post("/slots", allowRoles(Role.PSYCHOLOGIST), async (req: AuthRequest, res, next) => {
  try {
    const input = practiceSlotSchema.parse(req.body);

    const newRange = slotRange(input.time);
    if (!newRange) {
      return res.status(400).json({ error: "Format waktu slot tidak valid." });
    }

    const existingSlots = await prisma.practiceSlot.findMany({
      where: {
        psychologistId: req.auth!.id,
        day: input.day,
        isAvailable: true
      },
      select: { time: true }
    });
    const overlaps = existingSlots.some((existing) => {
      const range = slotRange(existing.time);
      return range !== null && newRange[0] < range[1] && range[0] < newRange[1];
    });
    if (overlaps) {
      return res.status(409).json({ error: "Jadwal slot bertumpang tindih dengan slot praktik yang sudah tersedia." });
    }

    const slot = await prisma.practiceSlot.create({
      data: {
        psychologistId: req.auth!.id,
        day: input.day,
        time: input.time,
        isAvailable: input.isAvailable
      }
    });

    return res.status(201).json({ message: "Slot waktu praktik berhasil ditambahkan.", slot });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return res.status(409).json({ error: "Slot praktik dengan hari dan waktu tersebut sudah ada." });
    }
    next(error);
  }
});

counselingRouter.delete("/slots/:id", allowRoles(Role.PSYCHOLOGIST), async (req: AuthRequest, res, next) => {
  try {
    await prisma.practiceSlot.deleteMany({
      where: { id: String(req.params.id), psychologistId: req.auth!.id }
    });
    return res.json({ message: "Slot praktik berhasil dihapus." });
  } catch (error) {
    next(error);
  }
});

// Book a consultation session (Employee)
counselingRouter.post("/bookings", allowRoles(Role.EMPLOYEE), async (req: AuthRequest, res, next) => {
  try {
    const input = z.object({
      psychologistId: z.string().min(1),
      scheduledAt: z.string().datetime(),
      notes: z.string().trim().max(1000).optional()
    }).parse(req.body);

    const scheduledAt = new Date(input.scheduledAt);
    if (scheduledAt <= new Date()) {
      return res.status(400).json({ error: "Pilih jadwal konsultasi yang akan datang." });
    }

    const psychologist = await prisma.user.findFirst({
      where: { id: input.psychologistId, role: Role.PSYCHOLOGIST, isActive: true }
    });
    if (!psychologist) {
      return res.status(404).json({ error: "Psikolog tidak ditemukan atau sedang tidak aktif." });
    }

    const localParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jakarta",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(scheduledAt);
    const localTime = Object.fromEntries(localParts.map((part) => [part.type, part.value]));
    const weekday = weekdayNames[localTime.weekday];
    const slot = await prisma.practiceSlot.findFirst({
      where: {
        psychologistId: psychologist.id,
        isAvailable: true,
        day: weekday,
        time: { startsWith: `${localTime.hour}:${localTime.minute}` }
      }
    });

    if (!slot) {
      return res.status(400).json({ error: "Pilih tanggal dan waktu sesuai dengan slot praktik yang tersedia." });
    }

    const booking = await prisma.$transaction(async (transaction) => {
      const occupied = await transaction.consultationBooking.findFirst({
        where: {
          psychologistId: psychologist.id,
          scheduledAt,
          status: { not: BookingStatus.CANCELLED }
        }
      });
      if (occupied) return null;

      return transaction.consultationBooking.create({
        data: {
          employeeId: req.auth!.id,
          psychologistId: psychologist.id,
          scheduledAt,
          notes: input.notes,
          status: BookingStatus.PENDING
        },
        include: {
          psychologist: { select: { id: true, name: true, department: true } }
        }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (!booking) {
      return res.status(409).json({ error: "Jadwal slot pada jam tersebut sudah dipesan. Pilih waktu lain." });
    }

    return res.status(201).json({ message: "Permintaan booking konsultasi berhasil diajukan.", booking });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2034") {
      return res.status(409).json({ error: "Jadwal baru saja dipesan. Pilih waktu lain." });
    }
    next(error);
  }
});

// Employees and psychologists can only access their own counseling records.
counselingRouter.get("/bookings", async (req: AuthRequest, res, next) => {
  try {
    const isPsychologist = req.auth!.role === Role.PSYCHOLOGIST;
    const isEmployee = req.auth!.role === Role.EMPLOYEE;
    if (!isPsychologist && !isEmployee) {
      return res.status(403).json({ error: "Riwayat konseling hanya tersedia bagi karyawan dan psikolog terkait." });
    }
    const { status } = req.query;

    const where: any = {};
    if (isEmployee) {
      where.employeeId = req.auth!.id;
    } else if (isPsychologist) {
      where.psychologistId = req.auth!.id;
    }

    if (status && Object.values(BookingStatus).includes(status as BookingStatus)) {
      where.status = status as BookingStatus;
    }

    const bookings = await prisma.consultationBooking.findMany({
      where,
      include: {
        employee: {
          select: { id: true, name: true, email: true, department: true, position: true }
        },
        psychologist: {
          select: { id: true, name: true, email: true, department: true }
        }
      },
      orderBy: { scheduledAt: "desc" }
    });

    return res.json({ bookings });
  } catch (error) {
    next(error);
  }
});

// Psychologist updates booking status & adds clinical notes
counselingRouter.patch("/bookings/:id/status", allowRoles(Role.PSYCHOLOGIST), async (req: AuthRequest, res, next) => {
  try {
    const input = z.object({
      status: z.nativeEnum(BookingStatus),
      clinicalNotes: z.string().trim().max(2000).optional(),
      actionPlan: z.string().trim().max(1000).optional(),
      counselingUrl: z.string().url().refine((value) => new URL(value).protocol === "https:").optional()
    }).parse(req.body);

    const existing = await prisma.consultationBooking.findFirst({
      where: { id: String(req.params.id), psychologistId: req.auth!.id },
      select: { id: true }
    });
    if (!existing) {
      return res.status(404).json({ error: "Sesi konsultasi tidak ditemukan." });
    }

    const booking = await prisma.consultationBooking.update({
      where: { id: existing.id },
      data: {
        status: input.status,
        ...(input.clinicalNotes !== undefined ? { clinicalNotes: input.clinicalNotes } : {}),
        ...(input.actionPlan !== undefined ? { actionPlan: input.actionPlan } : {}),
        ...(input.counselingUrl ? { counselingUrl: input.counselingUrl } : {})
      },
      include: {
        employee: { select: { id: true, name: true, email: true } },
        psychologist: { select: { id: true, name: true } }
      }
    });

    return res.json({ message: "Status janji temu dan catatan sesi berhasil diperbarui.", booking });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return res.status(404).json({ error: "Sesi konsultasi tidak ditemukan." });
    }
    next(error);
  }
});
