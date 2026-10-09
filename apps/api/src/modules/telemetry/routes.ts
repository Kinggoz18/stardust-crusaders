import type { FastifyInstance } from "fastify";
import type { TelemetryService } from "./service.js";
import type { Config } from "../../config.js";
import { verifyJwt } from "../../lib/crypto.js";

export async function registerTelemetryRoutes(
  app: FastifyInstance,
  deps: { telemetry: TelemetryService; config: Config },
) {
  app.post(
    "/v1/events",
    {
      config: {
        rateLimit: { max: 30, timeWindow: "1 minute" },
      },
    },
    async (req, reply) => {
      let accountId: string | null = null;
      const auth = req.headers.authorization;
      if (auth?.startsWith("Bearer ")) {
        const payload = await verifyJwt<{ sub?: string; typ?: string }>(
          auth.slice(7),
          deps.config.JWT_SECRET,
        );
        if (payload?.sub && payload.typ === "access") accountId = payload.sub;
      }
      const result = await deps.telemetry.ingest(accountId, req.body);
      return reply.status(202).send(result);
    },
  );
}
