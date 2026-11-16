import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { allowRoles, requireAuth, type AuthRequest } from "../middleware/auth";
import { prisma } from "../shared/prisma";

export const adminRouter = Router();
adminRouter.use(requireAuth, allowRoles(Role.SUPER_ADMIN));

// List users with search & filters
adminRouter.get("/admin/users", async (req, res, next) => {
  try {
    const { role, isActive, search } = req.query;

    const where: any = {};
    if (role && Object.values(Role).includes(role as Role)) {
      where.role = role as Role;
    }
    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }
    if (typeof search === "string" && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: "insensitive" } },
        { email: { contains: search.trim(), mode: "insensitive" } },
        { department: { contains: search.trim(), mode: "insensitive" } }
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

    return res.json({ users });
  } catch (error) {
    next(error);
  }
});

// Create new user (by Superadmin)
adminRouter.post("/admin/users", async (req, res, next) => {
  try {
    const input = z.object({
      name: z.string().trim().min(2).max(100),
      email: z.string().trim().email().toLowerCase(),
      password: z.string().min(12).max(72).refine((value) => Buffer.byteLength(value, "utf8") <= 72),
      role: z.nativeEnum(Role),
      department: z.string().trim().max(100).default("Operasional"),
      position: z.string().trim().max(100).default("Staff"),
      phone: z.string().trim().regex(/^(\+62|62|0)[0-9]{8,13}$/, "Nomor telepon tidak valid. Gunakan format: 08xxx atau +62xxx")
    }).parse(req.body);

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: input.email }, { phone: input.phone }] }
    });
    if (existing) {
      return res.status(409).json({ error: "Email atau nomor telepon sudah terdaftar." });
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
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

    return res.status(201).json({ message: "Pengguna baru berhasil ditambahkan.", user });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return res.status(409).json({ error: "Email atau nomor telepon sudah terdaftar." });
    }
    next(error);
  }
});

adminRouter.patch("/admin/users/:userId/login", async (req, res, next) => {
  try {
    const input = z.object({
      phone: z.string().trim().regex(/^(\+62|62|0)[0-9]{8,13}$/, "Nomor telepon tidak valid. Gunakan format: 08xxx atau +62xxx"),
      password: z.string().min(12).max(72).refine((value) => Buffer.byteLength(value, "utf8") <= 72).optional()
    }).parse(req.body);

    const data = {
      phone: input.phone,
      ...(input.password ? { passwordHash: await bcrypt.hash(input.password, 12) } : {})
    };
    const user = await prisma.user.update({
      where: { id: String(req.params.userId) },
      data,
      select: { id: true, name: true, email: true, role: true, phone: true, isActive: true }
    });

    return res.json({ message: "Nomor telepon dan akses login berhasil diperbarui.", user });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return res.status(409).json({ error: "Nomor telepon sudah digunakan akun lain." });
    }
    next(error);
  }
});

// Update user role
adminRouter.patch("/admin/users/:userId/role", async (req: AuthRequest, res, next) => {
  try {
    const userId = String(req.params.userId);
    if (userId === req.auth!.id) {
      return res.status(400).json({ error: "Superadmin tidak dapat mengubah peran akunnya sendiri." });
    }
    const { role } = z.object({ role: z.nativeEnum(Role) }).parse(req.body);
    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, name: true, email: true, role: true, department: true, isActive: true }
    });
    return res.json({ message: "Peran pengguna berhasil diperbarui.", user });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return res.status(404).json({ error: "Akun tidak ditemukan." });
    }
    next(error);
  }
});

// Deactivate or activate user (Crucial: for resigned employees)
adminRouter.patch("/admin/users/:userId/status", async (req: AuthRequest, res, next) => {
  try {
    const userId = String(req.params.userId);
    if (userId === req.auth!.id) {
      return res.status(400).json({ error: "Superadmin tidak dapat menonaktifkan akunnya sendiri." });
    }
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);

    const user = await prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: { id: true, name: true, email: true, role: true, department: true, isActive: true }
    });

    const statusText = isActive ? "diaktifkan kembali" : "dinonaktifkan (karyawan resign)";
    return res.json({ message: `Akun ${user.name} berhasil ${statusText}.`, user });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return res.status(404).json({ error: "Akun tidak ditemukan." });
    }
    next(error);
  }
});

// Platform-wide metrics for Superadmin
adminRouter.get("/admin/metrics", async (_req, res, next) => {
  try {
    const [totalUsers, activeUsers, inactiveUsers, usersByRole, totalLeaves, totalBookings, totalComplaints] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isActive: false } }),
      prisma.user.groupBy({ by: ["role"], _count: { id: true } }),
      prisma.leaveRequest.count(),
      prisma.consultationBooking.count(),
      prisma.legalComplaint.count()
    ]);

    return res.json({
      metrics: {
        totalUsers,
        activeUsers,
        inactiveUsers,
        usersByRole: Object.fromEntries(usersByRole.map((u) => [u.role, u._count.id])),
        totalLeaves,
        totalBookings,
        totalComplaints
      }
    });
  } catch (error) {
    next(error);
  }
});
