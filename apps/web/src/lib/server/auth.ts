import type { Role } from "@prisma/client";
import jwt from "jsonwebtoken";
import type { NextRequest, NextResponse } from "next/server";
import { ApiError } from "./api-utils";
import { prisma } from "./prisma";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  department: string | null;
  position: string | null;
  isActive: boolean;
};

export function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET must be configured.");
  if (secret.length < 32) throw new Error("JWT_SECRET must be at least 32 characters.");
  return secret;
}

export function generateSessionToken(userId: string, role: Role) {
  return jwt.sign({ role }, jwtSecret(), { subject: userId, expiresIn: "24h" });
}

export function setSessionCookie(response: NextResponse, userId: string, role: Role) {
  response.cookies.set("wellfora_session", generateSessionToken(userId, role), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 24 * 60 * 60
  });
}

export async function requireAuth(request: NextRequest): Promise<AuthUser> {
  const token = request.cookies.get("wellfora_session")?.value;
  if (!token) {
    throw new ApiError("Autentikasi diperlukan. Silakan login.", 401);
  }

  let claims: jwt.JwtPayload;
  try {
    claims = jwt.verify(token, jwtSecret()) as jwt.JwtPayload;
  } catch (error) {
    if (error instanceof Error && error.message.includes("JWT_SECRET")) throw error;
    throw new ApiError("Sesi telah kedaluwarsa. Silakan login kembali.", 401);
  }

  if (
    claims.aud === "wellfora-account-activation" ||
    claims.tokenType === "account-activation" ||
    typeof claims.sub !== "string"
  ) {
    throw new ApiError("Sesi token tidak valid.", 401);
  }

  const user = await prisma.user.findUnique({
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
  if (!user) throw new ApiError("Akun tidak ditemukan.", 401);
  if (!user.isActive) {
    throw new ApiError("Akun telah dinonaktifkan (karyawan resign atau non-aktif). Hubungi Superadmin.", 403);
  }
  return user;
}

export function allowRoles(user: AuthUser, ...roles: Role[]) {
  if (!roles.includes(user.role)) {
    throw new ApiError(`Akses ditolak. Fitur ini memerlukan salah satu peran: ${roles.join(", ")}.`, 403);
  }
}

export function clearSessionCookies(response: NextResponse) {
  for (const name of ["wellfora_session", "mindwork_session"]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0
    });
  }
}
