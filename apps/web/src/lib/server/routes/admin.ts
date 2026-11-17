import { Prisma, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { allowRoles, type AuthUser } from "../auth";
import { isPrismaError, json, queryObject, readJson } from "../api-utils";
import { prisma } from "../prisma";

const phoneSchema = z.string().trim().regex(
  /^(\+62|62|0)[0-9]{8,13}$/,
  "Nomor telepon tidak valid. Gunakan format: 08xxx atau +62xxx"
);
const passwordSchema = z.string().min(12).max(72)
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72);

export async function adminRoutes(request: NextRequest, parts: string[], user: AuthUser) {
  allowRoles(user, Role.SUPER_ADMIN);

  if (parts[1] === "metrics" && parts.length === 2 && request.method === "GET") {
    const [totalUsers, activeUsers, inactiveUsers, usersByRole, totalLeaves, totalBookings, totalComplaints] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isActive: false } }),
      prisma.user.groupBy({ by: ["role"], _count: { id: true } }),
      prisma.leaveRequest.count(),
      prisma.consultationBooking.count(),
      prisma.legalComplaint.count()
    ]);
    return json({
      metrics: {
        totalUsers,
        activeUsers,
        inactiveUsers,
        usersByRole: Object.fromEntries(usersByRole.map((entry) => [entry.role, entry._count.id])),
        totalLeaves,
        totalBookings,
        totalComplaints
      }
    });
  }

  if (parts[1] !== "users") return null;
  if (parts.length === 2 && request.method === "GET") {
    const query = queryObject(request);
    const where: Prisma.UserWhereInput = {};
    if (query.role && Object.values(Role).includes(query.role as Role)) {
      where.role = query.role as Role;
    }
    if (query.isActive !== undefined) where.isActive = query.isActive === "true";
    if (query.search?.trim()) {
      where.OR = [
        { name: { contains: query.search.trim(), mode: "insensitive" } },
        { email: { contains: query.search.trim(), mode: "insensitive" } },
        { department: { contains: query.search.trim(), mode: "insensitive" } }
      ];
    }
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        position: true,
        phone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: "desc" }
    });
    return json({ users });
  }

  if (parts.length === 2 && request.method === "POST") {
    const input = z.object({
      name: z.string().trim().min(2).max(100),
      email: z.string().trim().email().toLowerCase(),
      password: passwordSchema,
      role: z.nativeEnum(Role),
      department: z.string().trim().max(100).default("Operasional"),
      position: z.string().trim().max(100).default("Staff"),
      phone: phoneSchema
    }).parse(await readJson(request));
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: input.email }, { phone: input.phone }] }
    });
    if (existing) return json({ error: "Email atau nomor telepon sudah terdaftar." }, 409);

    try {
      const newUser = await prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash: await bcrypt.hash(input.password, 12),
          role: input.role,
          department: input.department,
          position: input.position,
          phone: input.phone,
          isActive: true
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          department: true,
          position: true,
          isActive: true,
          createdAt: true
        }
      });
      return json({ message: "Pengguna baru berhasil ditambahkan.", user: newUser }, 201);
    } catch (error) {
      if (isPrismaError(error, "P2002")) {
        return json({ error: "Email atau nomor telepon sudah terdaftar." }, 409);
      }
      throw error;
    }
  }

  const userId = parts[2];
  const action = parts[3];
  if (!userId || parts.length !== 4 || request.method !== "PATCH") return null;

  if (action === "login") {
    const input = z.object({
      phone: phoneSchema,
      password: passwordSchema.optional()
    }).parse(await readJson(request));
    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          phone: input.phone,
          ...(input.password ? { passwordHash: await bcrypt.hash(input.password, 12) } : {})
        },
        select: { id: true, name: true, email: true, role: true, phone: true, isActive: true }
      });
      return json({ message: "Nomor telepon dan akses login berhasil diperbarui.", user: updatedUser });
    } catch (error) {
      if (isPrismaError(error, "P2002")) return json({ error: "Nomor telepon sudah digunakan akun lain." }, 409);
      throw error;
    }
  }

  if (action === "role") {
    if (userId === user.id) {
      return json({ error: "Superadmin tidak dapat mengubah peran akunnya sendiri." }, 400);
    }
    const { role } = z.object({ role: z.nativeEnum(Role) }).parse(await readJson(request));
    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role },
        select: { id: true, name: true, email: true, role: true, department: true, isActive: true }
      });
      return json({ message: "Peran pengguna berhasil diperbarui.", user: updatedUser });
    } catch (error) {
      if (isPrismaError(error, "P2025")) return json({ error: "Akun tidak ditemukan." }, 404);
      throw error;
    }
  }

  if (action === "status") {
    if (userId === user.id) {
      return json({ error: "Superadmin tidak dapat menonaktifkan akunnya sendiri." }, 400);
    }
    const { isActive } = z.object({ isActive: z.boolean() }).parse(await readJson(request));
    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { isActive },
        select: { id: true, name: true, email: true, role: true, department: true, isActive: true }
      });
      const statusText = isActive ? "diaktifkan kembali" : "dinonaktifkan (karyawan resign)";
      return json({ message: `Akun ${updatedUser.name} berhasil ${statusText}.`, user: updatedUser });
    } catch (error) {
      if (isPrismaError(error, "P2025")) return json({ error: "Akun tidak ditemukan." }, 404);
      throw error;
    }
  }
  return null;
}
