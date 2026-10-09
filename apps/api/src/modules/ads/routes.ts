import type { FastifyInstance } from "fastify";
import type { AdsService } from "./service.js";

export async function registerAdsRoutes(app: FastifyInstance, deps: { ads: AdsService }) {
  app.post("/v1/ads/reward-callback", async (req, reply) => {
    const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    const result = await deps.ads.verifyAndGrant(req.body, rawBody);
    return reply.status(result.duplicate ? 200 : 201).send(result);
  });
}
