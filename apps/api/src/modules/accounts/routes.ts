import type { FastifyInstance } from "fastify";
import {
  createAnonymousAccountRequestSchema,
  refreshTokenRequestSchema,
} from "@stardust/schema";
import type { AccountsService } from "./service.js";
import type { Config } from "../../config.js";
import { verifyJwt } from "../../lib/crypto.js";

export async function registerAccountRoutes(
  app: FastifyInstance,
  deps: { accounts: AccountsService; config: Config },
) {
  app.post("/v1/accounts/anonymous", async (req, reply) => {
    const body = createAnonymousAccountRequestSchema.parse(req.body);
    // Equal-weight consent: no defaults that opt-in; client must send explicit booleans.
    const result = await deps.accounts.createAnonymous(body);
    return reply.status(201).send(result);
  });

  app.post("/v1/accounts/refresh", async (req, reply) => {
    const body = refreshTokenRequestSchema.parse(req.body);
    const result = await deps.accounts.refresh(body.refreshToken);
    if (!result) {
      return reply.status(401).send({
        error: { code: "invalid_refresh", message: "Refresh token is invalid or expired." },
      });
    }
    return result;
  });

  app.post("/v1/accounts/link", async (req, reply) => {
    const accountId = await requireAccount(req.headers.authorization, deps.config);
    if (!accountId) {
      return reply.status(401).send({
        error: { code: "unauthorized", message: "Sign in again to continue." },
      });
    }
    const result = await deps.accounts.linkAccount(accountId, req.body);
    return result;
  });

  app.get("/v1/accounts/me/export", async (req, reply) => {
    const accountId = await requireAccount(req.headers.authorization, deps.config);
    if (!accountId) {
      return reply.status(401).send({
        error: { code: "unauthorized", message: "Sign in again to continue." },
      });
    }
    const data = await deps.accounts.exportAccount(accountId);
    if (!data) {
      return reply.status(404).send({
        error: { code: "not_found", message: "Account not found." },
      });
    }
    return data;
  });

  app.delete("/v1/accounts/me", async (req, reply) => {
    const accountId = await requireAccount(req.headers.authorization, deps.config);
    if (!accountId) {
      return reply.status(401).send({
        error: { code: "unauthorized", message: "Sign in again to continue." },
      });
    }
    await deps.accounts.deleteAccount(accountId);
    return reply.status(204).send();
  });
}

async function requireAccount(
  authorization: string | undefined,
  config: Config,
): Promise<string | null> {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length);
  const payload = await verifyJwt<{ sub?: string; typ?: string }>(token, config.JWT_SECRET);
  if (!payload?.sub || payload.typ !== "access") return null;
  return payload.sub;
}

export { requireAccount };
