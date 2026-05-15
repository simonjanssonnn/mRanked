// Heroku release phase: run Prisma migrations against the DATABASE Postgres
// addon. We normalise DATABASE_URL here so the Prisma CLI gets a connection
// string with `sslmode=require` — Heroku Postgres rejects non-SSL connections,
// but its provided URL doesn't always include the flag.
import { spawnSync } from "node:child_process";

const raw = process.env.DATABASE_URL ?? "";
if (!raw) {
  console.error(
    "\n[release] DATABASE_URL is not set on this dyno.\n" +
      "          The Postgres addon is probably not attached.\n" +
      "          Run: heroku addons:create heroku-postgresql:mini\n" +
      "          Then redeploy (an empty commit is enough).\n",
  );
  process.exit(1);
}
if (!/[?&]sslmode=/.test(raw) && !/localhost|127\.0\.0\.1/.test(raw)) {
  process.env.DATABASE_URL = raw + (raw.includes("?") ? "&" : "?") + "sslmode=require";
}

// `db push` syncs the schema directly without requiring committed migration
// files. Fine for this project — we use Prisma as a schema authority, not a
// migration history. If you ever want proper versioned migrations later, run
// `prisma migrate dev --name init` locally, commit the `prisma/migrations`
// folder, and swap this for `prisma migrate deploy`.
const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["prisma", "db", "push", "--schema", "prisma/schema.prisma", "--accept-data-loss"],
  { cwd: "server", stdio: "inherit", env: process.env },
);

process.exit(result.status ?? 1);
