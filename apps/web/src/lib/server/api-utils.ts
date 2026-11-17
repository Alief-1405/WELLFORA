import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function requireSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new ApiError("Origin permintaan tidak diizinkan.", 403);
  }
}

export async function readJson(request: NextRequest): Promise<unknown> {
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > 8 * 1024 * 1024) {
    throw new ApiError("Ukuran data yang dikirim terlalu besar.", 413);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError("Data JSON tidak valid.", 400);
  }
}

export function queryObject(request: NextRequest) {
  return Object.fromEntries(new URL(request.url).searchParams.entries());
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return json({ error: error.message }, error.status);
  }
  if (error instanceof ZodError) {
    return json({
      error: "Data yang dikirim tidak valid.",
      details: error.flatten().fieldErrors
    }, 400);
  }

  if (process.env.NODE_ENV === "production") {
    console.error("Internal Server Error:", error instanceof Error ? error.name : "UnknownError");
  } else {
    console.error("Internal Server Error:", error);
  }
  return json({ error: "Terjadi kesalahan pada server." }, 500);
}

type RateLimitState = {
  count: number;
  resetAt: number;
};

const globalForRateLimit = globalThis as typeof globalThis & {
  wellforaRateLimits?: Map<string, RateLimitState>;
};
const rateLimits = globalForRateLimit.wellforaRateLimits ?? new Map<string, RateLimitState>();
globalForRateLimit.wellforaRateLimits = rateLimits;

export function isRateLimited(request: NextRequest, bucket: string, limit: number, windowMs: number) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const current = rateLimits.get(key);

  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  if (current.count >= limit) return true;

  current.count++;
  return false;
}

export function rateLimitResponse(message: string) {
  return json({ error: message }, 429);
}

export function isPrismaError(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
