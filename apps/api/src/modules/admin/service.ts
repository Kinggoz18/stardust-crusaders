import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import type { GameId } from "@stardust/schema";
import type { Db } from "../../db/client.js";
import {
  accounts,
  adminAuditLog,
  gameProgress,
  progressBackups,
  telemetryEvents,
  walletLedger,
} from "../../db/schema.js";
import type { AdminAuthService, StaffContext } from "./auth.js";
import type { MetricsService } from "../metrics/service.js";

export class AdminService {
  constructor(
    private readonly db: Db["db"],
    private readonly auth: AdminAuthService,
    private readonly metricsService?: MetricsService,
  ) {}

  async searchAccounts(staff: StaffContext, q: string, cursor?: string, limit = 20) {
    this.auth.requireRole(staff, ["owner", "support", "viewer"]);
    await this.auth.audit(staff.staffId, "search_accounts", "account", null, { q });

    const rows = await this.db
      .select({
        id: accounts.id,
        deviceId: accounts.deviceId,
        email: accounts.email,
        platform: accounts.platform,
        bannedAt: accounts.bannedAt,
        createdAt: accounts.createdAt,
      })
      .from(accounts)
      .where(
        and(
          isNull(accounts.deletedAt),
          or(
            ilike(accounts.deviceId, `%${q}%`),
            ilike(accounts.email, `%${q}%`),
            sql`${accounts.id}::text = ${q}`,
          ),
          cursor ? sql`${accounts.createdAt} < ${cursor}` : undefined,
        ),
      )
      .orderBy(desc(accounts.createdAt))
      .limit(limit + 1);

    const page = rows.slice(0, limit);
    const next = rows.length > limit ? page[page.length - 1]?.createdAt.toISOString() : null;
    return { accounts: page, nextCursor: next };
  }

  async getAccount(staff: StaffContext, accountId: string) {
    this.auth.requireRole(staff, ["owner", "support", "viewer"]);
    await this.auth.audit(staff.staffId, "read_account", "account", accountId, {});
    const account = await this.db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    });
    if (!account) return null;
    const progress = await this.db.query.gameProgress.findMany({
      where: eq(gameProgress.accountId, accountId),
    });
    return { account, progress };
  }

  async getWallet(staff: StaffContext, accountId: string) {
    this.auth.requireRole(staff, ["owner", "support", "viewer"]);
    await this.auth.audit(staff.staffId, "read_wallet", "account", accountId, {});
    return this.db.query.walletLedger.findMany({
      where: eq(walletLedger.accountId, accountId),
      orderBy: [desc(walletLedger.createdAt)],
      limit: 100,
    });
  }

  async getEvents(staff: StaffContext, accountId: string) {
    this.auth.requireRole(staff, ["owner", "support", "viewer"]);
    await this.auth.audit(staff.staffId, "read_events", "account", accountId, {});
    return this.db.query.telemetryEvents.findMany({
      where: eq(telemetryEvents.accountId, accountId),
      orderBy: [desc(telemetryEvents.ts)],
      limit: 100,
    });
  }

  async ban(staff: StaffContext, accountId: string, reason: string) {
    this.auth.requireRole(staff, ["owner", "support"]);
    await this.db
      .update(accounts)
      .set({ bannedAt: new Date(), banReason: reason, updatedAt: new Date() })
      .where(eq(accounts.id, accountId));
    await this.auth.audit(staff.staffId, "ban", "account", accountId, { reason });
    return { banned: true };
  }

  async unban(staff: StaffContext, accountId: string) {
    this.auth.requireRole(staff, ["owner", "support"]);
    await this.db
      .update(accounts)
      .set({ bannedAt: null, banReason: null, updatedAt: new Date() })
      .where(eq(accounts.id, accountId));
    await this.auth.audit(staff.staffId, "unban", "account", accountId, {});
    return { banned: false };
  }

  async resetProgress(staff: StaffContext, accountId: string, gameId: GameId) {
    this.auth.requireRole(staff, ["owner"]);
    const row = await this.db.query.gameProgress.findFirst({
      where: and(eq(gameProgress.accountId, accountId), eq(gameProgress.gameId, gameId)),
    });
    if (row) {
      await this.db.insert(progressBackups).values({
        accountId,
        gameId,
        revision: row.revision,
        document: row.document,
        reason: "admin_reset",
      });
      await this.db
        .update(gameProgress)
        .set({ revision: row.revision + 1, document: {}, updatedAt: new Date() })
        .where(eq(gameProgress.id, row.id));
    }
    await this.auth.audit(staff.staffId, "reset_progress", "account", accountId, { gameId });
    return { reset: true };
  }

  async metrics(staff: StaffContext) {
    if (this.metricsService) {
      return this.metricsService.legacySummary(staff);
    }
    this.auth.requireRole(staff, ["owner", "support", "viewer"]);
    const [{ count: newAccounts }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(accounts)
      .where(sql`${accounts.createdAt} > now() - interval '1 day'`);

    const [{ count: dau }] = await this.db
      .select({ count: sql<number>`count(distinct ${telemetryEvents.accountId})::int` })
      .from(telemetryEvents)
      .where(sql`${telemetryEvents.ts} > now() - interval '1 day'`);

    const [{ count: wau }] = await this.db
      .select({ count: sql<number>`count(distinct ${telemetryEvents.accountId})::int` })
      .from(telemetryEvents)
      .where(sql`${telemetryEvents.ts} > now() - interval '7 days'`);

    return {
      newAccounts24h: newAccounts ?? 0,
      dau: dau ?? 0,
      wau: wau ?? 0,
      mau: 0,
      retention: { d1: null, d7: null, d30: null },
    };
  }

  async listAudit(staff: StaffContext, limit = 50) {
    this.auth.requireRole(staff, ["owner", "support"]);
    return this.db.query.adminAuditLog.findMany({
      orderBy: [desc(adminAuditLog.createdAt)],
      limit,
    });
  }
}
