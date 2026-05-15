// Heroku release phase: run Prisma migrations against the DATABASE Postgres
// addon. We normalise DATABASE_URL here so the Prisma CLI gets a connection
// string with `sslmode=require` — Heroku Postgres rejects non-SSL connections,
// but its provided URL doesn't always include the flag.
import { spawnSync } from "node:child_process";

const raw = process.env.DATABASE_URL ?? "";
if (raw && !/[?&]sslmode=/.test(raw) && !/localhost|127\.0\.0\.1/.test(raw)) {
  process.env.DATABASE_URL = raw + (raw.includes("?") ? "&" : "?") + "sslmode=require";
}

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"],
  { cwd: "server", stdio: "inherit", env: process.env },
);

process.exit(result.status ?? 1);
