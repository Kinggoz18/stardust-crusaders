import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import type { Config } from "./config.js";
import type { AppContext } from "./app-context.js";
import { registerAccountRoutes } from "./modules/accounts/routes.js";
import { registerProgressRoutes } from "./modules/progress/routes.js";
import { registerWalletRoutes } from "./modules/wallet/routes.js";
import { registerTelemetryRoutes } from "./modules/telemetry/routes.js";
import { registerAdsRoutes } from "./modules/ads/routes.js";
import { registerIapRoutes } from "./modules/iap/routes.js";

export async function buildServer(config: Config, ctx?: AppContext) {
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
  app.get("/ready", async () => {
    if (!ctx) return { ready: true };
    try {
      await ctx.sql`SELECT 1`;
      return { ready: true };
    } catch {
      return { ready: false };
    }
  });

  if (ctx) {
    await registerAccountRoutes(app, { accounts: ctx.accounts, config });
    await registerProgressRoutes(app, { progress: ctx.progress, config });
    await registerWalletRoutes(app, { wallet: ctx.wallet, config });
    await registerTelemetryRoutes(app, { telemetry: ctx.telemetry, config });
    await registerAdsRoutes(app, { ads: ctx.ads });
    await registerIapRoutes(app, { iap: ctx.iap });
  }

  app.setErrorHandler((err: Error & { statusCode?: number; code?: string }, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: "validation_error",
          message: "Check the form and try again.",
          details: err.flatten(),
        },
      });
    }
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
