// Heroku's build phase doesn't expose runtime config vars, so DATABASE_URL is
// unset while we run `prisma generate`. The generate step never actually
// connects — it only reads schema.prisma — but Prisma's validator refuses to
// run if `env("DATABASE_URL")` can't resolve at all. Provide a harmless stub
// when none is present so the build completes; the real DATABASE_URL is
// injected at dyno runtime by the Postgres addon.
import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://stub:stub@localhost:5432/stub";
}

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["prisma", "generate", "--schema", "prisma/schema.prisma"],
  { cwd: "server", stdio: "inherit", env: process.env },
);

process.exit(result.status ?? 1);
