import type { FastifyInstance } from "fastify";
import { gameIdSchema, putProgressRequestSchema } from "@stardust/schema";
import type { ProgressService } from "./service.js";
import type { Config } from "../../config.js";
import { requireAccount } from "../accounts/routes.js";

export async function registerProgressRoutes(
  app: FastifyInstance,
  deps: { progress: ProgressService; config: Config },
) {
  app.get("/v1/games/:gameId/progress", async (req, reply) => {
    const accountId = await requireAccount(req.headers.authorization, deps.config);
    if (!accountId) {
      return reply.status(401).send({
        error: { code: "unauthorized", message: "Sign in again to continue." },
      });
    }
    const gameId = gameIdSchema.parse((req.params as { gameId: string }).gameId);
    return deps.progress.get(accountId, gameId);
  });

  app.put("/v1/games/:gameId/progress", async (req, reply) => {
    const accountId = await requireAccount(req.headers.authorization, deps.config);
    if (!accountId) {
      return reply.status(401).send({
        error: { code: "unauthorized", message: "Sign in again to continue." },
      });
    }
    const gameId = gameIdSchema.parse((req.params as { gameId: string }).gameId);
    const body = putProgressRequestSchema.parse(req.body);
    const result = await deps.progress.put(accountId, gameId, body.revision, body.document);
    if (!result.ok) return reply.status(result.status).send(result.body);
    return { revision: result.revision, document: result.document, merged: result.merged };
  });
}
