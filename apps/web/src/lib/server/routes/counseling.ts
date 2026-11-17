import { BookingStatus, Prisma, Role } from "@prisma/client";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { allowRoles, type AuthUser } from "../auth";
import { isPrismaError, json, queryObject, readJson } from "../api-utils";
import { prisma } from "../prisma";

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

export async function counselingRoutes(request: NextRequest, parts: string[], user: AuthUser) {
  const action = parts[1];
  if (action === "psychologists" && parts.length === 2 && request.method === "GET") {
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
    return json({ psychologists });
  }

  if (action === "availability" && parts.length === 2 && request.method === "GET") {
    allowRoles(user, Role.EMPLOYEE);
    const input = z.object({
      psychologistId: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
    }).parse(queryObject(request));
    const utcDate = new Date(`${input.date}T00:00:00.000Z`);
    if (!Number.isFinite(utcDate.getTime()) || utcDate.toISOString().slice(0, 10) !== input.date) {
      return json({ error: "Tanggal konsultasi tidak valid." }, 400);
    }
    const psychologist = await prisma.user.findFirst({
      where: { id: input.psychologistId, role: Role.PSYCHOLOGIST, isActive: true },
      select: { id: true }
    });
    if (!psychologist) return json({ error: "Psikolog tidak ditemukan atau sedang tidak aktif." }, 404);
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
        where: { psychologistId: psychologist.id, day: weekday, isAvailable: true },
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
      return { id: slot.id, day: slot.day, time: slot.time, startTime, booked, past, available: !booked && !past };
    });
    if (slots.some((slot) => slot === null)) {
      return json({ error: "Format jadwal praktik tidak valid. Hubungi administrator." }, 500);
    }
    return json({ slots });
  }

  if (action === "slots" && parts.length === 2 && request.method === "GET") {
    allowRoles(user, Role.PSYCHOLOGIST);
    const slots = await prisma.practiceSlot.findMany({
      where: { psychologistId: user.id },
      orderBy: { createdAt: "asc" }
    });
    return json({ slots });
  }

  if (action === "slots" && parts.length === 2 && request.method === "POST") {
    allowRoles(user, Role.PSYCHOLOGIST);
    const input = practiceSlotSchema.parse(await readJson(request));
    const newRange = slotRange(input.time);
    if (!newRange) return json({ error: "Format waktu slot tidak valid." }, 400);
    const existingSlots = await prisma.practiceSlot.findMany({
      where: { psychologistId: user.id, day: input.day, isAvailable: true },
      select: { time: true }
    });
    const overlaps = existingSlots.some((existing) => {
      const range = slotRange(existing.time);
      return range !== null && newRange[0] < range[1] && range[0] < newRange[1];
    });
    if (overlaps) {
      return json({ error: "Jadwal slot bertumpang tindih dengan slot praktik yang sudah tersedia." }, 409);
    }
    try {
      const slot = await prisma.practiceSlot.create({
        data: { psychologistId: user.id, day: input.day, time: input.time, isAvailable: input.isAvailable }
      });
      return json({ message: "Slot waktu praktik berhasil ditambahkan.", slot }, 201);
    } catch (error) {
      if (isPrismaError(error, "P2002")) {
        return json({ error: "Slot praktik dengan hari dan waktu tersebut sudah ada." }, 409);
      }
      throw error;
    }
  }

  if (action === "slots" && parts.length === 3 && request.method === "DELETE") {
    allowRoles(user, Role.PSYCHOLOGIST);
    await prisma.practiceSlot.deleteMany({ where: { id: parts[2], psychologistId: user.id } });
    return json({ message: "Slot praktik berhasil dihapus." });
  }

  if (action === "bookings" && parts.length === 2 && request.method === "POST") {
    allowRoles(user, Role.EMPLOYEE);
    const input = z.object({
      psychologistId: z.string().min(1),
      scheduledAt: z.string().datetime(),
      notes: z.string().trim().max(1000).optional()
    }).parse(await readJson(request));
    const scheduledAt = new Date(input.scheduledAt);
    if (scheduledAt <= new Date()) return json({ error: "Pilih jadwal konsultasi yang akan datang." }, 400);
    const psychologist = await prisma.user.findFirst({
      where: { id: input.psychologistId, role: Role.PSYCHOLOGIST, isActive: true }
    });
    if (!psychologist) return json({ error: "Psikolog tidak ditemukan atau sedang tidak aktif." }, 404);
    const localParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jakarta",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(scheduledAt);
    const localTime = Object.fromEntries(localParts.map((part) => [part.type, part.value]));
    const slot = await prisma.practiceSlot.findFirst({
      where: {
        psychologistId: psychologist.id,
        isAvailable: true,
        day: weekdayNames[localTime.weekday],
        time: { startsWith: `${localTime.hour}:${localTime.minute}` }
      }
    });
    if (!slot) {
      return json({ error: "Pilih tanggal dan waktu sesuai dengan slot praktik yang tersedia." }, 400);
    }
    try {
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
            employeeId: user.id,
            psychologistId: psychologist.id,
            scheduledAt,
            notes: input.notes,
            status: BookingStatus.PENDING
          },
          include: { psychologist: { select: { id: true, name: true, department: true } } }
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if (!booking) {
        return json({ error: "Jadwal slot pada jam tersebut sudah dipesan. Pilih waktu lain." }, 409);
      }
      return json({ message: "Permintaan booking konsultasi berhasil diajukan.", booking }, 201);
    } catch (error) {
      if (isPrismaError(error, "P2034")) {
        return json({ error: "Jadwal baru saja dipesan. Pilih waktu lain." }, 409);
      }
      throw error;
    }
  }

  if (action === "bookings" && parts.length === 2 && request.method === "GET") {
    const isPsychologist = user.role === Role.PSYCHOLOGIST;
    const isEmployee = user.role === Role.EMPLOYEE;
    if (!isPsychologist && !isEmployee) {
      return json({ error: "Riwayat konseling hanya tersedia bagi karyawan dan psikolog terkait." }, 403);
    }
    const query = queryObject(request);
    const where: Prisma.ConsultationBookingWhereInput = {};
    if (isEmployee) where.employeeId = user.id;
    if (isPsychologist) where.psychologistId = user.id;
    if (query.status && Object.values(BookingStatus).includes(query.status as BookingStatus)) {
      where.status = query.status as BookingStatus;
    }
    const bookings = await prisma.consultationBooking.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, email: true, department: true, position: true } },
        psychologist: { select: { id: true, name: true, email: true, department: true } }
      },
      orderBy: { scheduledAt: "desc" }
    });
    return json({ bookings });
  }

  if (action === "bookings" && parts.length === 4 && parts[3] === "status" && request.method === "PATCH") {
    allowRoles(user, Role.PSYCHOLOGIST);
    const input = z.object({
      status: z.nativeEnum(BookingStatus),
      clinicalNotes: z.string().trim().max(2000).optional(),
      actionPlan: z.string().trim().max(1000).optional(),
      counselingUrl: z.string().url().refine((value) => new URL(value).protocol === "https:").optional()
    }).parse(await readJson(request));
    const existing = await prisma.consultationBooking.findFirst({
      where: { id: parts[2], psychologistId: user.id },
      select: { id: true }
    });
    if (!existing) return json({ error: "Sesi konsultasi tidak ditemukan." }, 404);
    try {
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
      return json({ message: "Status janji temu dan catatan sesi berhasil diperbarui.", booking });
    } catch (error) {
      if (isPrismaError(error, "P2025")) return json({ error: "Sesi konsultasi tidak ditemukan." }, 404);
      throw error;
    }
  }
  return null;
}
