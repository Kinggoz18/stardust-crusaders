import type { FastifyInstance } from "fastify";
import type { WalletService } from "./service.js";
import type { Config } from "../../config.js";
import { requireAccount } from "../accounts/routes.js";

export async function registerWalletRoutes(
  app: FastifyInstance,
  deps: { wallet: WalletService; config: Config },
) {
  app.get("/v1/wallet", async (req, reply) => {
    const accountId = await requireAccount(req.headers.authorization, deps.config);
    if (!accountId) {
      return reply.status(401).send({
        error: { code: "unauthorized", message: "Sign in again to continue." },
      });
    }
    const balance = await deps.wallet.balance(accountId);
    const entries = await deps.wallet.list(accountId);
    return {
      balance,
      entries: entries.map((e) => ({
        id: e.id,
        gameId: e.gameId,
        delta: e.delta,
        balanceAfter: e.balanceAfter,
        reason: e.reason,
        ref: e.ref,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  });

  app.post("/v1/wallet/entries", async (req, reply) => {
    const accountId = await requireAccount(req.headers.authorization, deps.config);
    if (!accountId) {
      return reply.status(401).send({
        error: { code: "unauthorized", message: "Sign in again to continue." },
      });
    }
    const { entry, duplicate } = await deps.wallet.append(accountId, req.body);
    return reply.status(duplicate ? 200 : 201).send({
      duplicate,
      entry: {
        id: entry.id,
        delta: entry.delta,
        balanceAfter: entry.balanceAfter,
        reason: entry.reason,
      },
    });
  });
}
