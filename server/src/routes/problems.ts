// Lightweight catalogue-introspection endpoints. The lobby UI uses these to
// preview how many problems match the host's tier/category filter before they
// actually start a match — way better UX than waiting until round 1 fails.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db.js";

const CountQuery = z.object({
  tiers: z.string().optional(),       // comma-separated, e.g. "Bronze,Silver,Gold"
  categories: z.string().optional(),  // comma-separated, e.g. "algebra,calculus"
});

export async function problemsRoutes(app: FastifyInstance) {
  // GET /api/problems/count?tiers=Bronze,Silver&categories=nationella_3c
  app.get("/problems/count", async (req, reply) => {
    const parsed = CountQuery.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_query" });

    const tiers = parsed.data.tiers
      ? parsed.data.tiers.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    const categories = parsed.data.categories
      ? parsed.data.categories.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const where = {
      mode: "classic" as const,
      ...(tiers.length > 0 && { tier: { in: tiers } }),
      ...(categories.length > 0 && { category: { in: categories } }),
    };
    const count = await prisma.problem.count({ where });
    return { count };
  });
}
