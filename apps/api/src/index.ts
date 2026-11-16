import "dotenv/config";
import express, { type ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { ZodError } from "zod";
import { authRouter } from "./routes/auth";
import { documentsRouter } from "./routes/documents";
import { adminRouter } from "./routes/admin";
import { accountRequestsRouter } from "./routes/account-requests";
import { wellbeingRouter } from "./routes/wellbeing";
import { leavesRouter } from "./routes/leaves";
import { counselingRouter } from "./routes/counseling";
import { legalRouter } from "./routes/legal";
import { atmaRouter } from "./routes/wellbot";
import { prisma } from "./shared/prisma";

const isProduction = process.env.NODE_ENV === "production";

for (const name of ["JWT_SECRET", "DATABASE_URL"]) {
  if (!process.env[name]) throw new Error(`${name} must be configured.`);
}
if (process.env.JWT_SECRET!.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters.");
}
if (isProduction) {
  for (const name of ["WEB_ORIGIN", "DIRECT_URL"]) {
    if (!process.env[name]) throw new Error(`${name} must be configured in production.`);
  }
  if (process.env.JWT_SECRET!.toLowerCase().includes("replace-with")) {
    throw new Error("JWT_SECRET must be replaced with a random production secret.");
  }
  const productionSettings = [
    process.env.DATABASE_URL!,
    process.env.DIRECT_URL!
  ];
  if (productionSettings.some((value) => /USER:PASSWORD@HOST:PORT|example\.com/i.test(value))) {
    throw new Error("Production database settings must not contain example placeholders.");
  }
  const webOrigin = new URL(process.env.WEB_ORIGIN!);
  if (webOrigin.protocol !== "https:" ||
      webOrigin.origin !== process.env.WEB_ORIGIN ||
      webOrigin.hostname === "example.com" ||
      webOrigin.hostname.endsWith(".example.com")) {
    throw new Error("WEB_ORIGIN must be an HTTPS origin without a trailing path or slash.");
  }
}

const app = express();
app.disable("x-powered-by");
const trustProxyValue = process.env.TRUST_PROXY;
const trustProxy = !trustProxyValue || trustProxyValue === "false"
  ? false
  : trustProxyValue === "true"
    ? true
    : /^\d+$/.test(trustProxyValue)
      ? Number(trustProxyValue)
      : trustProxyValue;
app.set("trust proxy", trustProxy);
app.use(helmet());
const webOrigin = process.env.WEB_ORIGIN || "http://localhost:3000";
app.use(cors({
  origin: webOrigin,
  credentials: true
}));
app.use(express.json({ limit: "8mb" }));
app.use(cookieParser());
app.use((req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin &&
      req.headers.origin !== webOrigin) {
    return res.status(403).json({ error: "Origin permintaan tidak diizinkan." });
  }
  next();
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60, // friendly for demo & testing
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Terlalu banyak percobaan. Coba lagi beberapa saat." }
});

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ status: "ok", service: "Wellfora API" });
  } catch {
    return res.status(503).json({ status: "unavailable", service: "Wellfora API" });
  }
});

// Mount routers
app.use("/api/auth", authLimiter, authRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/leaves", leavesRouter);
app.use("/api/account-requests", accountRequestsRouter);
app.use("/api/counseling", counselingRouter);
app.use("/api/legal", legalRouter);
app.use("/api/atma", atmaRouter);
app.use("/api/wellbot", atmaRouter);
app.use("/api", wellbeingRouter);
app.use("/api", adminRouter);

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    return res.status(400).json({ error: "Data yang dikirim tidak valid.", details: error.flatten().fieldErrors });
  }
  if (isProduction) {
    console.error("Internal Server Error:", error instanceof Error ? error.name : "UnknownError");
  } else {
    console.error("Internal Server Error:", error);
  }
  return res.status(500).json({ error: "Terjadi kesalahan pada server." });
};
app.use(errorHandler);

export default app;
