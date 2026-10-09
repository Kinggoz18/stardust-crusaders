import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { Config } from "./config.js";

export async function buildServer(config: Config) {
  const app = Fastify({
    logger: { level: config.LOG_LEVEL },
    bodyLimit: 64 * 1024,
    trustProxy: true,
  });

  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: false,
  });

  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
  });

  app.get("/health", async () => ({ ok: true }));
  app.get("/ready", async () => ({ ready: true }));

  app.setErrorHandler((err: Error & { statusCode?: number; code?: string }, _req, reply) => {
    const status = typeof err.statusCode === "number" ? err.statusCode : 500;
    const code = status >= 500 ? "internal_error" : err.code ?? "request_error";
    reply.status(status).send({
      error: {
        code,
        message: status >= 500 ? "Something went wrong." : err.message,
      },
    });
  });

  return app;
}
