import type { FastifyInstance } from "fastify";
import type { IapService } from "./service.js";

export async function registerIapRoutes(app: FastifyInstance, deps: { iap: IapService }) {
  await app.register(async (scope) => {
    scope.removeContentTypeParser("application/json");
    scope.addContentTypeParser(
      "application/json",
      { parseAs: "buffer" },
      (_req, body, done) => {
        try {
          const raw = Buffer.isBuffer(body) ? body.toString("utf8") : String(body);
          const parsed = JSON.parse(raw) as unknown;
          done(null, { raw, parsed });
        } catch (err) {
          done(err as Error, undefined);
        }
      },
    );

    scope.post("/v1/webhooks/revenuecat", async (req, reply) => {
      const body = req.body as { raw: string; parsed: unknown };
      const signature = req.headers["x-revenuecat-signature"] as string | undefined;
      const result = await deps.iap.handleWebhook(body.raw, signature);
      return reply.status(200).send(result);
    });
  });
}
