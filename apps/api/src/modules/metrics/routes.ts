import type { FastifyInstance } from "fastify";
import type { AdminAuthService } from "../admin/auth.js";
import type { MetricsService } from "./service.js";
import type { Config } from "../../config.js";

function sessionToken(cookieHeader: string | undefined, bearer: string | undefined): string | undefined {
  if (bearer?.startsWith("Bearer ")) return bearer.slice(7);
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(/(?:^|;\s*)stardust_staff=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

export async function registerMetricsRoutes(
  app: FastifyInstance,
  deps: { adminAuth: AdminAuthService; metrics: MetricsService; config: Config },
) {
  app.addHook("onRequest", async (req, reply) => {
    if (!req.url.startsWith("/admin/v1/metrics")) return;
    const proxy = req.headers["x-admin-proxy-token"];
    if (proxy !== deps.config.ADMIN_PROXY_TOKEN && deps.config.NODE_ENV === "production") {
      return reply.status(401).send({
        error: { code: "unauthorized", message: "Proxy authentication failed." },
      });
    }
  });

  async function staffOr401(req: { headers: { cookie?: string; authorization?: string } }, reply: {
    status: (c: number) => { send: (b: unknown) => unknown };
  }) {
    const token = sessionToken(req.headers.cookie, req.headers.authorization);
    const staff = await deps.adminAuth.resolveSession(token);
    if (!staff) {
      reply.status(401).send({
        error: { code: "unauthorized", message: "Sign in again to continue." },
      });
      return null;
    }
    return staff;
  }

  app.get("/admin/v1/metrics", async (req, reply) => {
    const staff = await staffOr401(req, reply);
    if (!staff) return;
    return deps.metrics.legacySummary(staff);
  });

  app.get("/admin/v1/metrics/overview", async (req, reply) => {
    const staff = await staffOr401(req, reply);
    if (!staff) return;
    return deps.metrics.overview(staff, req.query);
  });

  app.get("/admin/v1/metrics/retention", async (req, reply) => {
    const staff = await staffOr401(req, reply);
    if (!staff) return;
    return deps.metrics.retention(staff, req.query);
  });

  app.get("/admin/v1/metrics/funnel", async (req, reply) => {
    const staff = await staffOr401(req, reply);
    if (!staff) return;
    return deps.metrics.funnel(staff, req.query);
  });

  app.get("/admin/v1/metrics/difficulty", async (req, reply) => {
    const staff = await staffOr401(req, reply);
    if (!staff) return;
    return deps.metrics.difficulty(staff, req.query);
  });

  app.get("/admin/v1/metrics/economy", async (req, reply) => {
    const staff = await staffOr401(req, reply);
    if (!staff) return;
    return deps.metrics.economy(staff, req.query);
  });

  app.get("/admin/v1/metrics/ads", async (req, reply) => {
    const staff = await staffOr401(req, reply);
    if (!staff) return;
    return deps.metrics.ads(staff, req.query);
  });

  app.get("/admin/v1/metrics/quality", async (req, reply) => {
    const staff = await staffOr401(req, reply);
    if (!staff) return;
    return deps.metrics.quality(staff, req.query);
  });

  app.get("/admin/v1/metrics/borrowed-time", async (req, reply) => {
    const staff = await staffOr401(req, reply);
    if (!staff) return;
    return deps.metrics.borrowedTime(staff, req.query);
  });
}
