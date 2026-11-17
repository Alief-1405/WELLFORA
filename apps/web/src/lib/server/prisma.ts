import { config as loadDotEnv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV !== "production" && (!process.env.DATABASE_URL || !process.env.JWT_SECRET)) {
  const apiEnvPath = resolve(process.cwd(), "../api/.env");
  if (existsSync(apiEnvPath)) {
    const result = loadDotEnv({ path: apiEnvPath });
    if (result.error) throw result.error;
  }
}

const globalForPrisma = globalThis as typeof globalThis & {
  wellforaPrisma?: PrismaClient;
};

export const prisma = globalForPrisma.wellforaPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.wellforaPrisma = prisma;
}
