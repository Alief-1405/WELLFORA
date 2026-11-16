import { Router } from "express";
import { randomInt } from "node:crypto";
import { Role } from "@prisma/client";
import { z } from "zod";
import { AuthRequest, allowRoles, requireAuth } from "../middleware/auth";
import { prisma } from "../shared/prisma";

export const wellbeingRouter = Router();
wellbeingRouter.use(requireAuth);

wellbeingRouter.post("/mood", allowRoles(Role.EMPLOYEE), async (req: AuthRequest, res, next) => {
  try {
    const input = z.object({
      mood: z.number().int().min(1).max(5),
      note: z.string().max(500).optional()
    }).parse(req.body);

    const entry = await prisma.moodEntry.create({
      data: { ...input, userId: req.auth!.id }
    });

    return res.status(201).json({ message: "Check-in suasana hati berhasil dicatat.", entry });
  } catch (error) {
    next(error);
  }
});

wellbeingRouter.get("/mood", allowRoles(Role.EMPLOYEE), async (req: AuthRequest, res, next) => {
  try {
    const moods = await prisma.moodEntry.findMany({
      where: { userId: req.auth!.id },
      orderBy: { createdAt: "desc" },
      take: 14
    });
    return res.json({ moods });
  } catch (error) {
    next(error);
  }
});

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

wellbeingRouter.post("/assessments/dass21", allowRoles(Role.EMPLOYEE), async (req: AuthRequest, res, next) => {
  try {
    const { answers } = z.object({
      answers: z.array(z.number().int().min(0).max(3)).length(21)
    }).parse(req.body);

    const scores = Object.fromEntries(
      Object.entries(subscales).map(([name, scale]) => {
        const score = scale.indexes.reduce((sum, index) => sum + answers[index], 0) * 2;
        return [name, { score, level: level(score, scale.limits) }];
      })
    ) as Record<keyof typeof subscales, { score: number; level: string }>;

    const result = await prisma.assessmentResult.create({
      data: {
        userId: req.auth!.id,
        depression: scores.depression.score,
        anxiety: scores.anxiety.score,
        stress: scores.stress.score
      }
    });

    return res.status(201).json({
      result,
      interpretation: scores,
      disclaimer: "Skrining ini adalah indikator awal kesejahteraan psikologis, bukan diagnosis klinis resmi. Jika hasil menunjukkan tingkat sedang hingga sangat parah, kami sarankan konsultasi dengan psikolog."
    });
  } catch (error) {
    next(error);
  }
});

wellbeingRouter.get("/assessments/dass21", allowRoles(Role.EMPLOYEE), async (req: AuthRequest, res, next) => {
  try {
    const results = await prisma.assessmentResult.findMany({
      where: { userId: req.auth!.id },
      orderBy: { createdAt: "desc" },
      take: 10
    });
    return res.json({ results });
  } catch (error) {
    next(error);
  }
});

wellbeingRouter.post("/forum", allowRoles(Role.EMPLOYEE), async (req: AuthRequest, res, next) => {
  try {
    const { body } = z.object({ body: z.string().trim().min(1).max(2000) }).parse(req.body);
    const post = await prisma.forumPost.create({
      data: {
        userId: req.auth!.id,
        pseudonymId: `Kawan-${randomInt(1000, 9999)}`,
        body
      }
    });
    return res.status(201).json({
      post: { id: post.id, pseudonymId: post.pseudonymId, body: post.body, createdAt: post.createdAt }
    });
  } catch (error) {
    next(error);
  }
});

wellbeingRouter.get("/forum", allowRoles(Role.EMPLOYEE), async (_req, res, next) => {
  try {
    const posts = await prisma.forumPost.findMany({
      select: { id: true, pseudonymId: true, body: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    return res.json({ posts });
  } catch (error) {
    next(error);
  }
});
