// Singleplayer / practice: fetch one problem at a chosen difficulty.
// No ELO is touched, no match record is created.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pickProblemForDuel } from "../services/problems.js";
import { grade } from "../lib/grading.js";
import { prisma } from "../lib/db.js";

const PickQuery = z.object({
  elo: z.coerce.number().int().min(0).max(4000).default(1000),
});

const SubmitBody = z.object({
  problemId: z.string(),
  answer: z.string().max(500),
});

export async function practiceRoutes(app: FastifyInstance) {
  app.get("/practice/problem", async (req, reply) => {
    const parsed = PickQuery.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_query" });
    const problem = await pickProblemForDuel({ mode: "classic", targetElo: parsed.data.elo });
    if (!problem) return reply.code(404).send({ error: "no_problem" });
    return {
      problem: {
        id: problem.id,
        prompt: problem.prompt,
        answerType: problem.answerType,
        options: problem.options ? JSON.parse(problem.options) : null,
        timeLimitSec: problem.timeLimitSeconds,
        tier: problem.tier,
        difficultyElo: problem.difficultyElo,
      },
    };
  });

  app.post("/practice/submit", async (req, reply) => {
    const parsed = SubmitBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_body" });
    const problem = await prisma.problem.findUnique({ where: { id: parsed.data.problemId } });
    if (!problem) return reply.code(404).send({ error: "no_problem" });
    const result = grade({
      answerType: problem.answerType as "numeric" | "multiple_choice",
      submitted: parsed.data.answer,
      correctAnswer: problem.correctAnswer,
      tolerance: problem.tolerance ?? undefined,
      acceptableForms: problem.acceptableForms ? JSON.parse(problem.acceptableForms) : undefined,
    });
    return {
      correct: result.correct,
      accuracy: result.accuracy,
      correctAnswer: problem.correctAnswer,
      solution: problem.solution,
    };
  });
}
