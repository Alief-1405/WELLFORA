import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { prisma } from "../shared/prisma";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  department?: string | null;
  position?: string | null;
  isActive: boolean;
};

export type AuthRequest = Request & { auth?: AuthUser };

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.wellfora_session;
  if (!token) {
    return res.status(401).json({ error: "Autentikasi diperlukan. Silakan login." });
  }

  let claims: jwt.JwtPayload;
  try {
    claims = jwt.verify(token, process.env.JWT_SECRET!) as jwt.JwtPayload;
  } catch {
    return res.status(401).json({ error: "Sesi telah kedaluwarsa. Silakan login kembali." });
  }

  if (typeof claims.sub !== "string") {
    return res.status(401).json({ error: "Sesi token tidak valid." });
  }

  let user: AuthUser | null;
  try {
    user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        position: true,
        isActive: true
      }
    });
  } catch (error) {
    return next(error);
  }

  if (!user) {
    return res.status(401).json({ error: "Akun tidak ditemukan." });
  }

  if (!user.isActive) {
    return res.status(403).json({ error: "Akun telah dinonaktifkan (karyawan resign atau non-aktif). Hubungi Superadmin." });
  }

  req.auth = user;
  next();
}

export function allowRoles(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({
        error: `Akses ditolak. Fitur ini memerlukan salah satu peran: ${roles.join(", ")}.`
      });
    }
    next();
  };
}
