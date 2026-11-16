import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../shared/prisma";
import { requireAuth, type AuthRequest } from "../middleware/auth";

export const authRouter = Router();
const cookieName = "wellfora_session";
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Terlalu banyak percobaan masuk. Coba lagi beberapa saat." }
});

function generateSessionToken(userId: string, role: Role) {
  return jwt.sign({ role }, process.env.JWT_SECRET!, { subject: userId, expiresIn: "24h" });
}

const demoPhoneByRole: Record<Role, string> = {
  EMPLOYEE: "081234567890",
  HR_ADMIN: "081298765432",
  PSYCHOLOGIST: "081311223344",
  LEGAL_COUNSEL: "081355667788",
  SUPER_ADMIN: "081122334455"
};

authRouter.post("/demo-login", async (req, res, next) => {
  if (process.env.NODE_ENV !== "development") {
    return res.status(404).json({ error: "Login demo hanya tersedia di lingkungan development." });
  }

  try {
    const { role } = z.object({ role: z.nativeEnum(Role) }).parse(req.body);
    const user = await prisma.user.findFirst({
      where: { role, phone: demoPhoneByRole[role] },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        position: true,
        phone: true,
        isActive: true
      }
    });

    if (!user || !user.isActive) {
      return res.status(404).json({ error: "Akun demo tidak tersedia. Jalankan seed pada database development." });
    }

    res.cookie(cookieName, generateSessionToken(user.id, user.role), cookieOptions);
    return res.json({ message: "Login demo berhasil.", user });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/register", (_req, res) => {
  return res.status(403).json({
    error: "Pendaftaran mandiri tidak tersedia. Hubungi HRD perusahaan untuk mengajukan akun."
  });
});

authRouter.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const input = z.object({
      phone: z.string().trim().min(8).max(20),
      password: z.string().min(1).max(72).refine((value) => Buffer.byteLength(value, "utf8") <= 72)
    }).parse(req.body);

    const user = await prisma.user.findUnique({
      where: { phone: input.phone },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        position: true,
        phone: true,
        isActive: true,
        passwordHash: true
      }
    });
    if (!user) {
      return res.status(401).json({ error: "Nomor telepon atau password tidak sesuai." });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: "Akun ini telah dinonaktifkan (karyawan resign/non-aktif). Hubungi Superadmin." });
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Nomor telepon atau password tidak sesuai." });
    }
    const { passwordHash: _passwordHash, ...safeUser } = user;

    res.cookie(cookieName, generateSessionToken(user.id, user.role), cookieOptions);
    return res.json({ message: "Login berhasil.", user: safeUser });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, (req: AuthRequest, res) => {
  return res.json({ user: req.auth });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(cookieName, { ...cookieOptions, maxAge: undefined });
  res.clearCookie("mindwork_session", { ...cookieOptions, maxAge: undefined });
  return res.json({ message: "Kamu telah berhasil keluar dari akun Wellfora." });
});
