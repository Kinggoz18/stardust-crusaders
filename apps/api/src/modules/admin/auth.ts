import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { timingSafeEqual } from "node:crypto";
import * as OTPAuth from "otpauth";
import {
  acceptInviteRequestSchema,
  bootstrapMasterRequestSchema,
  inviteStaffRequestSchema,
  staffLoginRequestSchema,
  type StaffRole,
} from "@stardust/schema";
import type { Db } from "../../db/client.js";
import {
  adminAuditLog,
  adminBootstrap,
  staffInvites,
  staffSessions,
  staffUsers,
} from "../../db/schema.js";
import { randomToken, sha256 } from "../../lib/crypto.js";

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const INVITE_TTL_MS = 72 * 60 * 60 * 1000;
const MASTER_KEY_MAX_FAILURES = 5;
const MASTER_KEY_LOCKOUT_MS = 15 * 60 * 1000;

export type StaffContext = {
  staffId: string;
  email: string;
  role: StaffRole;
  sessionId: string;
};

export class AdminAuthService {
  constructor(
    private readonly db: Db["db"],
    private readonly masterKey: string | undefined,
  ) {}

  async createStaff(input: {
    email: string;
    password: string;
    role: StaffRole;
  }) {
    const passwordHash = await Bun.password.hash(input.password, {
      algorithm: "argon2id",
      memoryCost: 19456,
      timeCost: 2,
    });
    const totp = new OTPAuth.Secret({ size: 20 });
    const [row] = await this.db
      .insert(staffUsers)
      .values({
        email: input.email.toLowerCase(),
        passwordHash,
        totpSecret: totp.base32,
        role: input.role,
      })
      .returning();
    return {
      id: row.id,
      email: row.email,
      role: row.role as StaffRole,
      totpSecret: totp.base32,
      otpauthUrl: new OTPAuth.TOTP({
        issuer: "Stardust Crusaders",
        label: row.email,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: totp,
      }).toString(),
    };
  }

  async bootstrapStatus() {
    const staff = await this.db.query.staffUsers.findFirst();
    const state = await this.ensureBootstrapRow();
    return {
      needsBootstrap: !staff && !state.masterKeyUsedAt,
    };
  }

  /** Warn when the env still holds a key after it was consumed. Never logs the key. */
  async shouldWarnRemoveMasterKey(): Promise<boolean> {
    if (!this.masterKey) return false;
    const state = await this.ensureBootstrapRow();
    return Boolean(state.masterKeyUsedAt);
  }

  async bootstrapMaster(raw: unknown) {
    const body = bootstrapMasterRequestSchema.parse(raw);

    const outcome = await this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(42001)`);
      await this.ensureBootstrapRowTx(tx);

      const [state] = await tx.select().from(adminBootstrap).where(eq(adminBootstrap.id, 1));
      if (state.lockedUntil && state.lockedUntil.getTime() > Date.now()) {
        return { kind: "locked" as const };
      }

      const existingStaff = await tx.query.staffUsers.findFirst();
      if (existingStaff || state.masterKeyUsedAt) {
        await this.recordBootstrapDenial(tx, "already_used");
        return { kind: "already_used" as const };
      }

      if (!this.masterKey || !constantTimeEqual(body.masterKey, this.masterKey)) {
        const failures = (state.failedAttempts ?? 0) + 1;
        const lockedUntil =
          failures >= MASTER_KEY_MAX_FAILURES
            ? new Date(Date.now() + MASTER_KEY_LOCKOUT_MS)
            : null;
        await tx
          .update(adminBootstrap)
          .set({ failedAttempts: failures, lockedUntil })
          .where(eq(adminBootstrap.id, 1));
        await this.recordBootstrapDenial(tx, "bad_key");
        return { kind: lockedUntil ? ("locked" as const) : ("bad_key" as const) };
      }

      const passwordHash = await Bun.password.hash(body.password, {
        algorithm: "argon2id",
        memoryCost: 19456,
        timeCost: 2,
      });
      const totp = new OTPAuth.Secret({ size: 20 });
      const [staff] = await tx
        .insert(staffUsers)
        .values({
          email: body.email.toLowerCase(),
          passwordHash,
          totpSecret: totp.base32,
          role: "owner",
        })
        .returning();

      await tx
        .update(adminBootstrap)
        .set({
          masterKeyUsedAt: new Date(),
          masterAdminId: staff.id,
          failedAttempts: 0,
          lockedUntil: null,
        })
        .where(eq(adminBootstrap.id, 1));

      await tx.insert(adminAuditLog).values({
        staffId: staff.id,
        action: "bootstrap",
        targetType: "staff",
        targetId: staff.id,
        meta: { email: staff.email },
      });

      return {
        kind: "ok" as const,
        email: staff.email,
        role: "owner" as const,
        totpSecret: totp.base32,
        otpauthUrl: new OTPAuth.TOTP({
          issuer: "Stardust Crusaders",
          label: staff.email,
          algorithm: "SHA1",
          digits: 6,
          period: 30,
          secret: totp,
        }).toString(),
      };
    });

    if (outcome.kind === "locked") throw lockedError();
    if (outcome.kind === "already_used") throw alreadyUsedError();
    if (outcome.kind === "bad_key") throw badKeyError();
    return {
      ok: true as const,
      email: outcome.email,
      role: outcome.role,
      totpSecret: outcome.totpSecret,
      otpauthUrl: outcome.otpauthUrl,
    };
  }

  /** Seed helper: mark master key consumed after creating a local owner. */
  async markBootstrapUsed(masterAdminId: string) {
    await this.ensureBootstrapRow();
    await this.db
      .update(adminBootstrap)
      .set({
        masterKeyUsedAt: new Date(),
        masterAdminId,
        failedAttempts: 0,
        lockedUntil: null,
      })
      .where(eq(adminBootstrap.id, 1));
  }

  async login(raw: unknown): Promise<
    | { ok: true; token: string; role: StaffRole; expiresAt: string; sessionId: string }
    | { ok: false; reason: "credentials" | "totp" }
  > {
    const body = staffLoginRequestSchema.parse(raw);
    const staff = await this.db.query.staffUsers.findFirst({
      where: and(eq(staffUsers.email, body.email.toLowerCase()), isNull(staffUsers.disabledAt)),
    });
    if (!staff) return { ok: false, reason: "credentials" };
    const ok = await Bun.password.verify(body.password, staff.passwordHash);
    if (!ok) return { ok: false, reason: "credentials" };

    const totp = new OTPAuth.TOTP({
      issuer: "Stardust Crusaders",
      label: staff.email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(staff.totpSecret),
    });
    const delta = totp.validate({ token: body.totpCode, window: 1 });
    if (delta === null) return { ok: false, reason: "totp" };

    const token = randomToken(32);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const [session] = await this.db
      .insert(staffSessions)
      .values({
        staffId: staff.id,
        tokenHash: sha256(token),
        expiresAt,
      })
      .returning();

    await this.audit(staff.id, "login", "staff", staff.id, {});

    return {
      ok: true,
      token,
      role: staff.role as StaffRole,
      expiresAt: expiresAt.toISOString(),
      sessionId: session.id,
    };
  }

  async resolveSession(token: string | undefined): Promise<StaffContext | null> {
    if (!token) return null;
    const hash = sha256(token);
    const session = await this.db.query.staffSessions.findFirst({
      where: eq(staffSessions.tokenHash, hash),
    });
    if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) return null;
    const staff = await this.db.query.staffUsers.findFirst({
      where: and(eq(staffUsers.id, session.staffId), isNull(staffUsers.disabledAt)),
    });
    if (!staff) return null;
    return {
      staffId: staff.id,
      email: staff.email,
      role: staff.role as StaffRole,
      sessionId: session.id,
    };
  }

  async logout(token: string) {
    await this.db
      .update(staffSessions)
      .set({ revokedAt: new Date() })
      .where(eq(staffSessions.tokenHash, sha256(token)));
  }

  async audit(
    staffId: string | null,
    action: string,
    targetType: string,
    targetId: string | null,
    meta: Record<string, unknown>,
  ) {
    await this.db.insert(adminAuditLog).values({
      staffId,
      action,
      targetType,
      targetId,
      meta,
    });
  }

  requireRole(staff: StaffContext, allowed: StaffRole[]) {
    if (!allowed.includes(staff.role)) {
      const err = new Error("You do not have permission for this action.") as Error & {
        statusCode: number;
        code: string;
      };
      err.statusCode = 403;
      err.code = "forbidden";
      throw err;
    }
  }

  async listStaff(staff: StaffContext) {
    this.requireRole(staff, ["owner", "support"]);
    const rows = await this.db.query.staffUsers.findMany({
      orderBy: [desc(staffUsers.createdAt)],
    });
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role as StaffRole,
      createdAt: r.createdAt.toISOString(),
      disabledAt: r.disabledAt ? r.disabledAt.toISOString() : null,
    }));
  }

  async listInvites(staff: StaffContext) {
    this.requireRole(staff, ["owner"]);
    const rows = await this.db.query.staffInvites.findMany({
      orderBy: [desc(staffInvites.createdAt)],
    });
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role as StaffRole,
      expiresAt: r.expiresAt.toISOString(),
      revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
      acceptedAt: r.acceptedAt ? r.acceptedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async inviteStaff(staff: StaffContext, raw: unknown) {
    this.requireRole(staff, ["owner"]);
    const body = inviteStaffRequestSchema.parse(raw);
    const email = body.email.toLowerCase();
    const existing = await this.db.query.staffUsers.findFirst({
      where: eq(staffUsers.email, email),
    });
    if (existing) {
      throw conflictError("That person already has access.");
    }
    const pending = await this.db.query.staffInvites.findFirst({
      where: and(
        eq(staffInvites.email, email),
        isNull(staffInvites.revokedAt),
        isNull(staffInvites.acceptedAt),
      ),
    });
    if (pending && pending.expiresAt.getTime() > Date.now()) {
      throw conflictError("An invite is already waiting for that email.");
    }

    const inviteToken = randomToken(32);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    const [row] = await this.db
      .insert(staffInvites)
      .values({
        email,
        role: body.role,
        tokenHash: sha256(inviteToken),
        invitedBy: staff.staffId,
        expiresAt,
      })
      .returning();

    await this.audit(staff.staffId, "staff_invite", "staff", row.id, {
      email,
      role: body.role,
    });

    return {
      id: row.id,
      email: row.email,
      role: row.role as StaffRole,
      expiresAt: expiresAt.toISOString(),
      inviteToken,
    };
  }

  async revokeInvite(staff: StaffContext, inviteId: string) {
    this.requireRole(staff, ["owner"]);
    const row = await this.db.query.staffInvites.findFirst({
      where: eq(staffInvites.id, inviteId),
    });
    if (!row || row.acceptedAt) {
      throw notFoundError("Invite not found.");
    }
    await this.db
      .update(staffInvites)
      .set({ revokedAt: new Date() })
      .where(eq(staffInvites.id, inviteId));
    await this.audit(staff.staffId, "staff_invite_revoke", "staff", inviteId, {
      email: row.email,
    });
    return { ok: true as const };
  }

  async acceptInvite(raw: unknown) {
    const body = acceptInviteRequestSchema.parse(raw);
    const hash = sha256(body.token);
    const invite = await this.db.query.staffInvites.findFirst({
      where: eq(staffInvites.tokenHash, hash),
    });
    if (!invite || invite.revokedAt) {
      throw goneError("This invite is no longer valid.");
    }
    if (invite.acceptedAt) {
      throw goneError("This invite was already used.");
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      throw goneError("This invite has expired.");
    }

    const existing = await this.db.query.staffUsers.findFirst({
      where: eq(staffUsers.email, invite.email),
    });
    if (existing) {
      throw conflictError("That person already has access.");
    }

    const created = await this.createStaff({
      email: invite.email,
      password: body.password,
      role: invite.role as StaffRole,
    });

    await this.db
      .update(staffInvites)
      .set({ acceptedAt: new Date() })
      .where(eq(staffInvites.id, invite.id));

    await this.audit(created.id, "staff_invite_accept", "staff", created.id, {
      inviteId: invite.id,
      email: created.email,
    });

    return {
      ok: true as const,
      email: created.email,
      role: created.role,
      totpSecret: created.totpSecret,
      otpauthUrl: created.otpauthUrl,
    };
  }

  private async ensureBootstrapRow() {
    const existing = await this.db.query.adminBootstrap.findFirst({
      where: eq(adminBootstrap.id, 1),
    });
    if (existing) return existing;
    await this.db.insert(adminBootstrap).values({ id: 1 }).onConflictDoNothing();
    const row = await this.db.query.adminBootstrap.findFirst({
      where: eq(adminBootstrap.id, 1),
    });
    if (!row) throw new Error("bootstrap row missing");
    return row;
  }

  private async ensureBootstrapRowTx(tx: {
    insert: Db["db"]["insert"];
  }) {
    await tx.insert(adminBootstrap).values({ id: 1 }).onConflictDoNothing();
  }

  private async recordBootstrapDenial(
    tx: { insert: Db["db"]["insert"] },
    reason: "bad_key" | "already_used",
  ) {
    await tx.insert(adminAuditLog).values({
      staffId: null,
      action: "bootstrap_denied",
      targetType: "bootstrap",
      targetId: null,
      meta: { reason },
    });
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  const ha = Buffer.from(sha256(a), "hex");
  const hb = Buffer.from(sha256(b), "hex");
  return ha.length === hb.length && timingSafeEqual(ha, hb);
}

function badKeyError() {
  const err = new Error("That setup key did not work. Try again.") as Error & {
    statusCode: number;
    code: string;
  };
  err.statusCode = 401;
  err.code = "invalid_master_key";
  return err;
}

function alreadyUsedError() {
  const err = new Error("Studio setup is already finished. Sign in instead.") as Error & {
    statusCode: number;
    code: string;
  };
  err.statusCode = 409;
  err.code = "bootstrap_used";
  return err;
}

function lockedError() {
  const err = new Error("Too many tries. Wait a bit, then try again.") as Error & {
    statusCode: number;
    code: string;
  };
  err.statusCode = 429;
  err.code = "master_key_locked";
  return err;
}

function conflictError(message: string) {
  const err = new Error(message) as Error & { statusCode: number; code: string };
  err.statusCode = 409;
  err.code = "already_exists";
  return err;
}

function notFoundError(message: string) {
  const err = new Error(message) as Error & { statusCode: number; code: string };
  err.statusCode = 404;
  err.code = "not_found";
  return err;
}

function goneError(message: string) {
  const err = new Error(message) as Error & { statusCode: number; code: string };
  err.statusCode = 410;
  err.code = "invite_invalid";
  return err;
}
