import { PrismaClient } from "@prisma/client";

// Heroku Postgres requires SSL but its DATABASE_URL doesn't always include
// `sslmode=require`. Normalise the URL so the connection works the same on
// Heroku, Neon, Railway, or a plain local Postgres (no `?sslmode` needed
// against localhost).
const raw = process.env.DATABASE_URL ?? "";
const needsSsl =
  raw &&
  !/[?&]sslmode=/.test(raw) &&
  !/localhost|127\.0\.0\.1/.test(raw);

const datasourceUrl = needsSsl
  ? raw + (raw.includes("?") ? "&" : "?") + "sslmode=require"
  : raw;

export const prisma = new PrismaClient(
  datasourceUrl ? { datasourceUrl } : undefined,
);
