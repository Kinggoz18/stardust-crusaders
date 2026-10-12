import type { FastifyInstance } from "fastify";
import type { IapService } from "./service.js";
import type { GooglePlayIapService } from "./google-service.js";
import type { AppleIapService } from "./apple-service.js";

export async function registerIapRoutes(app: FastifyInstance, deps: { iap: IapService; googlePlay?: GooglePlayIapService; apple?: AppleIapService }) {
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

    // Validator endpoint for cordova-plugin-purchase (store.validator). ?game=one-spark
    scope.post("/v1/iap/google/verify", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (req, reply) => {
      const gp = deps.googlePlay;
      const game = String((req.query as { game?: string }).game ?? "");
      const body = req.body as { parsed: unknown } | undefined;
      if (!gp) return reply.status(200).send({ ok: false, code: 6778003, message: "Purchase checks are switched off." });
      const verdict = await gp.validate(game, body?.parsed);
      return reply.status(200).send(verdict);
    });

    // One validator for both stores, picked by the transaction type the plugin sends.
    scope.post("/v1/iap/verify", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (req, reply) => {
      const game = String((req.query as { game?: string }).game ?? "");
      const parsed = (req.body as { parsed: unknown } | undefined)?.parsed as { transaction?: { type?: string } } | undefined;
      const kind = parsed?.transaction?.type;
      const off = { ok: false, code: 6778003, message: "Purchase checks are switched off." };
      if (kind === "apple-sk2") return reply.send(deps.apple ? await deps.apple.validate(game, parsed) : off);
      if (kind === "android-playstore") return reply.send(deps.googlePlay ? await deps.googlePlay.validate(game, parsed) : off);
      return reply.send({ ok: false, code: 6778003, message: "Unsupported store." });
    });

    // App Store Server Notifications V2 (set this URL in App Store Connect).
    scope.post("/v1/webhooks/apple", async (req, reply) => {
      if (!deps.apple) return reply.status(503).send({ ok: false });
      const body = req.body as { parsed: unknown } | undefined;
      return reply.status(200).send(await deps.apple.handleNotification(body?.parsed));
    });
  });
}
