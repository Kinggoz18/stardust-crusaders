import type { FastifyInstance } from "fastify";
import { GAME_ADMIN_META, GAME_IDS, gameIdSchema } from "@stardust/schema";
import type { AdminAuthService } from "./auth.js";
import type { AdminService } from "./service.js";
import type { Config } from "../../config.js";

function sessionToken(cookieHeader: string | undefined, bearer: string | undefined): string | undefined {
  if (bearer?.startsWith("Bearer ")) return bearer.slice(7);
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(/(?:^|;\s*)stardust_staff=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

export async function registerAdminRoutes(
  app: FastifyInstance,
  deps: { adminAuth: AdminAuthService; admin: AdminService; config: Config },
) {
  app.addHook("onRequest", async (req, reply) => {
    if (!req.url.startsWith("/admin/")) return;
    const proxy = req.headers["x-admin-proxy-token"];
    if (proxy !== deps.config.ADMIN_PROXY_TOKEN) {
      // Allow direct local calls in development/test without proxy token when NODE_ENV=test
      if (deps.config.NODE_ENV === "production") {
        return reply.status(401).send({
          error: { code: "unauthorized", message: "Proxy authentication failed." },
        });
      }
    }
  });

  app.get("/admin/v1/auth/bootstrap-status", async () => {
    return deps.adminAuth.bootstrapStatus();
  });

  app.post(
    "/admin/v1/auth/bootstrap",
    {
      config: {
        rateLimit: { max: 10, timeWindow: "1 minute" },
      },
    },
    async (req, reply) => {
      const created = await deps.adminAuth.bootstrapMaster(req.body);
      return reply.status(201).send(created);
    },
  );

  app.post("/admin/v1/auth/accept-invite", async (req, reply) => {
    const created = await deps.adminAuth.acceptInvite(req.body);
    return reply.status(201).send(created);
  });

  app.post("/admin/v1/auth/login", async (req, reply) => {
    const result = await deps.adminAuth.login(req.body);
    if (!result.ok) {
      if (result.reason === "totp") {
        return reply.status(401).send({
          error: {
            code: "invalid_totp",
            message: "That authenticator code did not work. Try a fresh one.",
          },
        });
      }
      return reply.status(401).send({
        error: {
          code: "invalid_credentials",
          message: "Check your email and password, then try again.",
        },
      });
    }
    reply.header(
      "set-cookie",
      `stardust_staff=${encodeURIComponent(result.token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${2 * 60 * 60}`,
    );
    return {
      ok: true as const,
      role: result.role,
      expiresAt: result.expiresAt,
      token: result.token,
    };
  });

  app.post("/admin/v1/auth/logout", async (req, reply) => {
    const token = sessionToken(req.headers.cookie, req.headers.authorization);
    if (token) await deps.adminAuth.logout(token);
    reply.header(
      "set-cookie",
      "stardust_staff=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0",
    );
    return { ok: true };
  });

  app.get("/admin/v1/accounts", async (req, reply) => {
    const staff = await requireStaff(req, deps);
    if (!staff) return unauthorized(reply);
    const q = String((req.query as { q?: string }).q ?? "");
    const cursor = (req.query as { cursor?: string }).cursor;
    return deps.admin.searchAccounts(staff, q, cursor);
  });

  app.get("/admin/v1/accounts/:id", async (req, reply) => {
    const staff = await requireStaff(req, deps);
    if (!staff) return unauthorized(reply);
    const id = (req.params as { id: string }).id;
    const data = await deps.admin.getAccount(staff, id);
    if (!data) {
      return reply.status(404).send({
        error: { code: "not_found", message: "Player not found." },
      });
    }
    return data;
  });

  app.get("/admin/v1/accounts/:id/wallet", async (req, reply) => {
    const staff = await requireStaff(req, deps);
    if (!staff) return unauthorized(reply);
    return deps.admin.getWallet(staff, (req.params as { id: string }).id);
  });

  app.get("/admin/v1/accounts/:id/events", async (req, reply) => {
    const staff = await requireStaff(req, deps);
    if (!staff) return unauthorized(reply);
    return deps.admin.getEvents(staff, (req.params as { id: string }).id);
  });

  app.post("/admin/v1/accounts/:id/ban", async (req, reply) => {
    const staff = await requireStaff(req, deps);
    if (!staff) return unauthorized(reply);
    const reason = String((req.body as { reason?: string })?.reason ?? "policy");
    return deps.admin.ban(staff, (req.params as { id: string }).id, reason);
  });

  app.post("/admin/v1/accounts/:id/unban", async (req, reply) => {
    const staff = await requireStaff(req, deps);
    if (!staff) return unauthorized(reply);
    return deps.admin.unban(staff, (req.params as { id: string }).id);
  });

  app.post("/admin/v1/accounts/:id/games/:gameId/reset", async (req, reply) => {
    const staff = await requireStaff(req, deps);
    if (!staff) return unauthorized(reply);
    const gameId = gameIdSchema.parse((req.params as { gameId: string }).gameId);
    return deps.admin.resetProgress(staff, (req.params as { id: string }).id, gameId);
  });

  app.get("/admin/v1/audit", async (req, reply) => {
    const staff = await requireStaff(req, deps);
    if (!staff) return unauthorized(reply);
    const rows = await deps.admin.listAudit(staff);
    return { entries: rows };
  });

  app.get("/admin/v1/games", async (req, reply) => {
    const staff = await requireStaff(req, deps);
    if (!staff) return unauthorized(reply);
    return {
      games: GAME_IDS.map((id) => {
        const meta = GAME_ADMIN_META[id];
        return {
          id: meta.gameId,
          name: meta.displayName,
          draft: meta.draft,
          summary: gameBlurb(id),
        };
      }),
    };
  });

  app.get("/admin/v1/games/:gameId/players", async (req, reply) => {
    const staff = await requireStaff(req, deps);
    if (!staff) return unauthorized(reply);
    const gameId = gameIdSchema.parse((req.params as { gameId: string }).gameId);
    const cursor = (req.query as { cursor?: string }).cursor;
    return deps.admin.listGamePlayers(staff, gameId, cursor);
  });

  app.get("/admin/v1/staff", async (req, reply) => {
    const staff = await requireStaff(req, deps);
    if (!staff) return unauthorized(reply);
    const people = await deps.adminAuth.listStaff(staff);
    return { staff: people };
  });

  app.get("/admin/v1/staff/invites", async (req, reply) => {
    const staff = await requireStaff(req, deps);
    if (!staff) return unauthorized(reply);
    const invites = await deps.adminAuth.listInvites(staff);
    return { invites };
  });

  app.post("/admin/v1/staff/invites", async (req, reply) => {
    const staff = await requireStaff(req, deps);
    if (!staff) return unauthorized(reply);
    const created = await deps.adminAuth.inviteStaff(staff, req.body);
    return reply.status(201).send(created);
  });

  /** @deprecated Prefer POST /admin/v1/staff/invites */
  app.post("/admin/v1/staff", async (req, reply) => {
    const staff = await requireStaff(req, deps);
    if (!staff) return unauthorized(reply);
    const created = await deps.adminAuth.inviteStaff(staff, req.body);
    return reply.status(201).send(created);
  });

  app.post("/admin/v1/staff/invites/:id/revoke", async (req, reply) => {
    const staff = await requireStaff(req, deps);
    if (!staff) return unauthorized(reply);
    const id = (req.params as { id: string }).id;
    return deps.adminAuth.revokeInvite(staff, id);
  });
}

function gameBlurb(id: (typeof GAME_IDS)[number]): string {
  switch (id) {
    case "one-spark":
      return "Live fireworks puzzle. Stars, album and daily streak are ready to inspect.";
    case "loom-rush":
      return "Draft tray-match save. Level, wardrobe and boosters may still change.";
    case "borrowed-time":
      return "Draft island snapshot. Era, debt and chronicle fields are provisional.";
  }
}

async function requireStaff(
  req: { headers: { cookie?: string; authorization?: string } },
  deps: { adminAuth: AdminAuthService },
) {
  const token = sessionToken(req.headers.cookie, req.headers.authorization);
  return deps.adminAuth.resolveSession(token);
}

function unauthorized(reply: { status: (c: number) => { send: (b: unknown) => unknown } }) {
  return reply.status(401).send({
    error: { code: "unauthorized", message: "Sign in again to continue." },
  });
}
