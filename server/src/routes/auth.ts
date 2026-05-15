import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import {
  COOKIE_NAME,
  COOKIE_OPTIONS,
  hashPassword,
  signToken,
  verifyPassword,
  verifyToken,
} from "../lib/auth.js";
import { isTitleUnlocked } from "../lib/titles.js";

const RegisterBody = z.object({
  username: z.string().min(2).max(24).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(6).max(200),
});

const LoginBody = z.object({
  username: z.string().min(2),
  password: z.string().min(1),
});

// 320KB cap on the encoded data URL — well above our client-side downscale (a
// 320px JPEG is typically 20-40KB) and small enough that leaderboard/history
// queries that include it stay responsive.
const MAX_AVATAR_LEN = 320_000;

const ProfileBody = z.object({
  avatarColor: z.string().max(16).optional(),
  avatarInitials: z.string().max(2).optional(),
  avatarImage: z.string().max(MAX_AVATAR_LEN).optional(),
  equippedTitle: z.string().max(32).optional(),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (req, reply) => {
    const parsed = RegisterBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    const { username, password } = parsed.data;

    const exists = await prisma.user.findUnique({ where: { username } });
    if (exists) return reply.code(409).send({ error: "user_exists" });

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { username, passwordHash },
    });

    const token = signToken({ sub: user.id, username: user.username });
    reply.setCookie(COOKIE_NAME, token, COOKIE_OPTIONS);
    return { user: publicUser(user) };
  });

  app.post("/auth/login", async (req, reply) => {
    const parsed = LoginBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_body" });
    const { username, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return reply.code(401).send({ error: "invalid_credentials" });

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return reply.code(401).send({ error: "invalid_credentials" });

    const token = signToken({ sub: user.id, username: user.username });
    reply.setCookie(COOKIE_NAME, token, COOKIE_OPTIONS);
    return { user: publicUser(user) };
  });

  app.post("/auth/logout", async (_req, reply) => {
    reply.clearCookie(COOKIE_NAME, {
      path: COOKIE_OPTIONS.path,
      sameSite: COOKIE_OPTIONS.sameSite,
      secure: COOKIE_OPTIONS.secure,
    });
    return { ok: true };
  });

  app.get("/auth/me", async (req, reply) => {
    const token = (req.cookies as Record<string, string | undefined>)[COOKIE_NAME];
    if (!token) return reply.code(401).send({ error: "unauthenticated" });
    const payload = verifyToken(token);
    if (!payload) return reply.code(401).send({ error: "unauthenticated" });
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return reply.code(401).send({ error: "unauthenticated" });
    return { user: publicUser(user) };
  });

  // Update avatar / title. Authenticated.
  app.post("/me/profile", async (req, reply) => {
    const token = (req.cookies as Record<string, string | undefined>)[COOKIE_NAME];
    if (!token) return reply.code(401).send({ error: "unauthenticated" });
    const payload = verifyToken(token);
    if (!payload) return reply.code(401).send({ error: "unauthenticated" });

    const parsed = ProfileBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    const body = parsed.data;

    const current = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!current) return reply.code(401).send({ error: "unauthenticated" });

    // Server-side gate on titles: never accept a title the user hasn't unlocked.
    if (body.equippedTitle !== undefined && !isTitleUnlocked(body.equippedTitle, current.classicPeakElo)) {
      return reply.code(403).send({ error: "title_locked" });
    }

    const updated = await prisma.user.update({
      where: { id: payload.sub },
      data: {
        ...(body.avatarColor !== undefined && { avatarColor: body.avatarColor }),
        ...(body.avatarInitials !== undefined && { avatarInitials: body.avatarInitials }),
        ...(body.avatarImage !== undefined && { avatarImage: body.avatarImage }),
        ...(body.equippedTitle !== undefined && { equippedTitle: body.equippedTitle }),
      },
    });
    return { user: publicUser(updated) };
  });
}

function publicUser(u: {
  id: string;
  username: string;
  classicElo: number;
  classicPeakElo: number;
  classicMatches: number;
  classicWins: number;
  classicLosses: number;
  classicDraws: number;
  avatarColor: string;
  avatarInitials: string;
  avatarImage: string;
  equippedTitle: string;
  createdAt: Date;
}) {
  return {
    id: u.id,
    username: u.username,
    classicElo: u.classicElo,
    classicPeakElo: u.classicPeakElo,
    classicMatches: u.classicMatches,
    classicWins: u.classicWins,
    classicLosses: u.classicLosses,
    classicDraws: u.classicDraws,
    avatarColor: u.avatarColor,
    avatarInitials: u.avatarInitials,
    avatarImage: u.avatarImage,
    equippedTitle: u.equippedTitle,
    createdAt: u.createdAt,
  };
}
