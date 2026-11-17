import type { NextRequest } from "next/server";
import { requireAuth, type AuthUser } from "./auth";
import {
  errorResponse,
  isRateLimited,
  json,
  rateLimitResponse,
  requireSameOrigin
} from "./api-utils";
import { accountRequestRoutes } from "./routes/account-requests";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { counselingRoutes } from "./routes/counseling";
import { documentRoutes } from "./routes/documents";
import { leaveRoutes } from "./routes/leaves";
import { legalRoutes } from "./routes/legal";
import { wellbeingRoutes } from "./routes/wellbeing";
import { wellbotRoutes } from "./routes/wellbot";
import { prisma } from "./prisma";

function isPublicAuthRoute(parts: string[]) {
  return parts[0] === "auth" &&
    parts.length === 2 &&
    ["activate", "demo-login", "register", "login", "logout"].includes(parts[1]);
}

async function dispatch(request: NextRequest, parts: string[], user?: AuthUser) {
  if (parts[0] === "health" && parts.length === 1 && request.method === "GET") {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return json({ status: "ok", service: "Wellfora API" });
    } catch (error) {
      const errorCode = typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : error instanceof Error ? error.name : "UnknownError";
      console.error("Database health check failed:", errorCode);
      return json({ status: "unavailable", service: "Wellfora API" }, 503);
    }
  }

  if (parts[0] === "auth") {
    const response = await authRoutes(request, parts, user);
    if (response) return response;
  }

  if (!user) return json({ error: "Autentikasi diperlukan. Silakan login." }, 401);

  if (parts[0] === "account-requests") {
    return await accountRequestRoutes(request, parts, user);
  }
  if (parts[0] === "admin") {
    return await adminRoutes(request, parts, user);
  }
  if (parts[0] === "documents") {
    return await documentRoutes(request, parts, user);
  }
  if (parts[0] === "leaves") {
    return await leaveRoutes(request, parts, user);
  }
  if (parts[0] === "counseling") {
    return await counselingRoutes(request, parts, user);
  }
  if (parts[0] === "legal") {
    return await legalRoutes(request, parts, user);
  }
  if (["mood", "assessments", "forum"].includes(parts[0])) {
    return await wellbeingRoutes(request, parts, user);
  }
  if (parts[0] === "atma" || parts[0] === "wellbot") {
    return await wellbotRoutes(request, parts, user);
  }
  return null;
}

export async function handleApiRequest(request: NextRequest) {
  try {
    const parts = new URL(request.url).pathname
      .replace(/^\/api\/?/, "")
      .split("/")
      .filter(Boolean)
      .map(decodeURIComponent);
    if (parts[0] === "auth" && isRateLimited(request, "auth", 60, 15 * 60 * 1000)) {
      return rateLimitResponse("Terlalu banyak percobaan. Coba lagi beberapa saat.");
    }
    if (parts[0] === "auth" && parts[1] === "login" &&
        isRateLimited(request, "auth-login", 10, 15 * 60 * 1000)) {
      return rateLimitResponse("Terlalu banyak percobaan masuk. Coba lagi beberapa saat.");
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) requireSameOrigin(request);

    const publicAuthRoute = isPublicAuthRoute(parts);
    let user: AuthUser | undefined;
    if (!publicAuthRoute && !(parts[0] === "health" && parts.length === 1)) {
      user = await requireAuth(request);
    } else if (parts[0] === "auth" && parts[1] === "me") {
      user = await requireAuth(request);
    }

    const response = await dispatch(request, parts, user);
    return response ?? json({ error: "Not Found" }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}
