import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts"],
    setupFiles: ["./test-setup.ts"],
    // The grading / elo / ranks modules are pure and run instantly; the
    // anticheat module imports `prisma` which can take a beat to instantiate.
    // 10s is plenty for everything.
    testTimeout: 10_000,
  },
});
