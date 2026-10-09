import type { FastifyInstance } from "fastify";
import type { Config } from "../../config.js";
import { requireAccount } from "../accounts/routes.js";
import type { AdsService } from "./service.js";

export async function registerAdsRoutes(
  app: FastifyInstance,
  deps: { ads: AdsService; config: Config },
) {
  app.post("/v1/ads/reward-callback", async (req, reply) => {
    const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    const result = await deps.ads.verifyAndGrant(req.body, rawBody);
    return reply.status(result.duplicate ? 200 : 201).send(result);
  });

  /** AdMob rewarded SSV callback (GET with signed query string). */
  app.get("/v1/ads/reward-callback", async (req, reply) => {
    const url = req.raw.url ?? "";
    const q = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
    const result = await deps.ads.verifySsvAndGrant(q);
    return reply.status(result.duplicate ? 200 : 201).send(result);
  });

  app.get("/v1/ads/config", async (req, reply) => {
    const accountId = await requireAccount(req.headers.authorization, deps.config);
    if (!accountId) {
      return reply.status(401).send({
        error: { code: "unauthorized", message: "Sign in again to continue." },
      });
    }
    const gameId = String((req.query as { gameId?: string }).gameId ?? "");
    const config = await deps.ads.configFor(accountId, gameId);
    return config;
  });
}
