import type { FastifyInstance } from "fastify";
import type { AdminAuthService } from "../admin/auth.js";
import type { AdControlsService } from "./controls.js";
import type { Config } from "../../config.js";

function sessionToken(cookieHeader: string | undefined, bearer: string | undefined): string | undefined {
  if (bearer?.startsWith("Bearer ")) return bearer.slice(7);
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(/(?:^|;\s*)stardust_staff=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

export async function registerAdAdminRoutes(
  app: FastifyInstance,
  deps: { adminAuth: AdminAuthService; adControls: AdControlsService; config: Config },
) {
  app.addHook("onRequest", async (req, reply) => {
    if (!req.url.startsWith("/admin/v1/games/") && !req.url.startsWith("/admin/v1/ads/")) return;
    if (!req.url.includes("/ads")) return;
    const proxy = req.headers["x-admin-proxy-token"];
    if (proxy !== deps.config.ADMIN_PROXY_TOKEN && deps.config.NODE_ENV === "production") {
      return reply.status(401).send({
        error: { code: "unauthorized", message: "Proxy authentication failed." },
      });
    }
  });

  async function staffOr401(
    req: { headers: { cookie?: string; authorization?: string } },
    reply: { status: (c: number) => { send: (b: unknown) => unknown } },
  ) {
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

  app.get("/admin/v1/games/:gameId/ads/settings", async (req, reply) => {
    const staff = await staffOr401(req, reply);
    if (!staff) return;
    return deps.adControls.getGameSettings(staff, (req.params as { gameId: string }).gameId);
  });

  app.put("/admin/v1/games/:gameId/ads/settings", async (req, reply) => {
    const staff = await staffOr401(req, reply);
    if (!staff) return;
    return deps.adControls.updateGameSettings(
      staff,
      (req.params as { gameId: string }).gameId,
      req.body,
    );
  });

  app.get("/admin/v1/ads/house", async (req, reply) => {
    const staff = await staffOr401(req, reply);
    if (!staff) return;
    return deps.adControls.listHouseAds(staff);
  });

  app.put("/admin/v1/ads/house/global", async (req, reply) => {
    const staff = await staffOr401(req, reply);
    if (!staff) return;
    return deps.adControls.updateGlobal(staff, req.body);
  });

  app.post("/admin/v1/ads/house", async (req, reply) => {
    const staff = await staffOr401(req, reply);
    if (!staff) return;
    const created = await deps.adControls.createHouseAd(staff, req.body);
    return reply.status(201).send(created);
  });

  app.patch("/admin/v1/ads/house/:id", async (req, reply) => {
    const staff = await staffOr401(req, reply);
    if (!staff) return;
    return deps.adControls.updateHouseAd(staff, (req.params as { id: string }).id, req.body);
  });

  app.delete("/admin/v1/ads/house/:id", async (req, reply) => {
    const staff = await staffOr401(req, reply);
    if (!staff) return;
    return deps.adControls.deleteHouseAd(staff, (req.params as { id: string }).id);
  });
}
