import { randomInt } from "node:crypto";
import { Role } from "@prisma/client";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { allowRoles, type AuthUser } from "../auth";
import { json, readJson } from "../api-utils";
import { prisma } from "../prisma";

const subscales = {
  depression: { indexes: [2, 4, 9, 12, 15, 16, 20], limits: [9, 13, 20, 27] },
  anxiety: { indexes: [1, 3, 6, 8, 14, 18, 19], limits: [7, 9, 14, 19] },
  stress: { indexes: [0, 5, 7, 10, 11, 13, 17], limits: [14, 18, 25, 33] }
};

function level(score: number, limits: number[]) {
  if (score <= limits[0]) return "NORMAL";
  if (score <= limits[1]) return "RINGAN";
  if (score <= limits[2]) return "SEDANG";
  if (score <= limits[3]) return "PARAH";
  return "SANGAT_PARAH";
}

export async function wellbeingRoutes(request: NextRequest, parts: string[], user: AuthUser) {
  if (parts[0] === "mood") {
    allowRoles(user, Role.EMPLOYEE);
    if (parts.length === 1 && request.method === "POST") {
      const input = z.object({
        mood: z.number().int().min(1).max(5),
        note: z.string().max(500).optional()
      }).parse(await readJson(request));
      const entry = await prisma.moodEntry.create({ data: { ...input, userId: user.id } });
      return json({ message: "Check-in suasana hati berhasil dicatat.", entry }, 201);
    }
    if (parts.length === 1 && request.method === "GET") {
      const moods = await prisma.moodEntry.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 14
      });
      return json({ moods });
    }
  }

  if (parts[0] === "assessments" && parts[1] === "dass21" && parts.length === 2) {
    allowRoles(user, Role.EMPLOYEE);
    if (request.method === "POST") {
      const { answers } = z.object({
        answers: z.array(z.number().int().min(0).max(3)).length(21)
      }).parse(await readJson(request));
      const scores = Object.fromEntries(
        Object.entries(subscales).map(([name, scale]) => {
          const score = scale.indexes.reduce((sum, index) => sum + answers[index], 0) * 2;
          return [name, { score, level: level(score, scale.limits) }];
        })
      ) as Record<keyof typeof subscales, { score: number; level: string }>;
      const result = await prisma.assessmentResult.create({
        data: {
          userId: user.id,
          depression: scores.depression.score,
          anxiety: scores.anxiety.score,
          stress: scores.stress.score
        }
      });
      return json({
        result,
        interpretation: scores,
        disclaimer: "Skrining ini adalah indikator awal kesejahteraan psikologis, bukan diagnosis klinis resmi. Jika hasil menunjukkan tingkat sedang hingga sangat parah, kami sarankan konsultasi dengan psikolog."
      }, 201);
    }
    if (request.method === "GET") {
      const results = await prisma.assessmentResult.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 10
      });
      return json({ results });
    }
  }

  if (parts[0] === "forum") {
    allowRoles(user, Role.EMPLOYEE);
    if (parts.length === 1 && request.method === "POST") {
      const { body } = z.object({ body: z.string().trim().min(1).max(2000) }).parse(await readJson(request));
      const post = await prisma.forumPost.create({
        data: { userId: user.id, pseudonymId: `Kawan-${randomInt(1000, 9999)}`, body }
      });
      return json({
        post: { id: post.id, pseudonymId: post.pseudonymId, body: post.body, createdAt: post.createdAt }
      }, 201);
    }
    if (parts.length === 1 && request.method === "GET") {
      const posts = await prisma.forumPost.findMany({
        select: { id: true, pseudonymId: true, body: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 50
      });
      return json({ posts });
    }
  }
  return null;
}
