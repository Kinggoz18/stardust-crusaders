import { and, eq, isNull } from "drizzle-orm";
import * as OTPAuth from "otpauth";
import {
  inviteStaffRequestSchema,
  staffLoginRequestSchema,
  type StaffRole,
} from "@stardust/schema";
import { desc } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { adminAuditLog, staffSessions, staffUsers } from "../../db/schema.js";
import { randomToken, sha256 } from "../../lib/crypto.js";

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

export type StaffContext = {
  staffId: string;
  email: string;
  role: StaffRole;
  sessionId: string;
};

export class AdminAuthService {
  constructor(private readonly db: Db["db"]) {}

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
      role: row.role,
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

  async login(raw: unknown) {
    const body = staffLoginRequestSchema.parse(raw);
    const staff = await this.db.query.staffUsers.findFirst({
      where: and(eq(staffUsers.email, body.email.toLowerCase()), isNull(staffUsers.disabledAt)),
    });
    if (!staff) return null;
    const ok = await Bun.password.verify(body.password, staff.passwordHash);
    if (!ok) return null;

    const totp = new OTPAuth.TOTP({
      issuer: "Stardust Crusaders",
      label: staff.email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(staff.totpSecret),
    });
    const delta = totp.validate({ token: body.totpCode, window: 1 });
    if (delta === null) return null;

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
    staffId: string,
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

  async inviteStaff(staff: StaffContext, raw: unknown) {
    this.requireRole(staff, ["owner"]);
    const body = inviteStaffRequestSchema.parse(raw);
    const existing = await this.db.query.staffUsers.findFirst({
      where: eq(staffUsers.email, body.email.toLowerCase()),
    });
    if (existing) {
      const err = new Error("That person already has access.") as Error & {
        statusCode: number;
        code: string;
      };
      err.statusCode = 409;
      err.code = "already_exists";
      throw err;
    }
    const created = await this.createStaff({
      email: body.email,
      password: body.password,
      role: body.role,
    });
    await this.audit(staff.staffId, "staff_create", "staff", created.id, {
      email: created.email,
      role: created.role,
    });
    return {
      id: created.id,
      email: created.email,
      role: created.role,
      totpSecret: created.totpSecret,
    };
  }
}
