import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { Server as SocketServer } from "socket.io";
import { authRoutes } from "./routes/auth.js";
import { profileRoutes } from "./routes/profile.js";
import { leaderboardRoutes } from "./routes/leaderboard.js";
import { practiceRoutes } from "./routes/practice.js";
import { registerSocketGateway } from "./sockets/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT ?? 4000);
const IS_PROD = process.env.NODE_ENV === "production";
// In production we serve the client from the same origin, so CORS is unused.
// In dev, allow the Vite dev server.
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

// Static client build: server/src -> ../../client/dist
const CLIENT_DIST = path.resolve(__dirname, "../../client/dist");
const HAS_CLIENT_BUILD = fs.existsSync(path.join(CLIENT_DIST, "index.html"));

async function main() {
  const app = Fastify({ logger: { level: "info" } });

  if (!IS_PROD) {
    await app.register(cors, {
      origin: CLIENT_ORIGIN,
      credentials: true,
    });
  }
  await app.register(cookie);

  app.get("/health", async () => ({ ok: true }));

  await app.register(authRoutes);
  await app.register(profileRoutes);
  await app.register(leaderboardRoutes);
  await app.register(practiceRoutes);

  // Serve built client (production / single-origin deploys like Replit).
  if (HAS_CLIENT_BUILD) {
    await app.register(fastifyStatic, {
      root: CLIENT_DIST,
      prefix: "/",
    });
    // SPA fallback: any unmatched non-API route returns index.html
    app.setNotFoundHandler((req, reply) => {
      const url = req.url;
      const isApi =
        url.startsWith("/auth/") ||
        url.startsWith("/me/") ||
        url.startsWith("/leaderboard") ||
        url.startsWith("/practice/") ||
        url.startsWith("/socket.io/") ||
        url.startsWith("/health");
      if (isApi) return reply.code(404).send({ error: "not_found" });
      return reply.sendFile("index.html");
    });
    app.log.info(`Serving client from ${CLIENT_DIST}`);
  } else {
    app.log.info("No client build found; running API-only. (Build the client to serve it from this server.)");
  }

  await app.listen({ port: PORT, host: "0.0.0.0" });

  const io = new SocketServer(app.server, {
    cors: IS_PROD ? undefined : { origin: CLIENT_ORIGIN, credentials: true },
  });
  registerSocketGateway(io);

  app.log.info(`Math Ranked server up on http://0.0.0.0:${PORT}`);
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
