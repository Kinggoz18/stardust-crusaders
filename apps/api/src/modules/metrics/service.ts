import { and, eq, gte, lte, sql } from "drizzle-orm";
import {
  metricsAdsSchema,
  metricsBorrowedTimeSchema,
  metricsDifficultySchema,
  metricsEconomySchema,
  metricsFilterSchema,
  metricsFunnelSchema,
  metricsOverviewSchema,
  metricsQualitySchema,
  metricsRetentionSchema,
  type StaffRole,
} from "@stardust/schema";
import type { Db } from "../../db/client.js";
import {
  accounts,
  levelDifficultyBands,
  metricsAdRevenueDaily,
  metricsAdsDaily,
  metricsDaily,
  metricsEconomyDaily,
  metricsIapDaily,
  metricsQualityDaily,
  metricsRetentionCohort,
} from "../../db/schema.js";
import type { AdminAuthService, StaffContext } from "../admin/auth.js";

export class MetricsService {
  constructor(
    private readonly db: Db["db"],
    private readonly auth: AdminAuthService,
  ) {}

  private allow(staff: StaffContext) {
    this.auth.requireRole(staff, ["owner", "support", "viewer"] as StaffRole[]);
  }

  private parseFilter(raw: unknown) {
    return metricsFilterSchema.parse(raw);
  }

  async overview(staff: StaffContext, raw: unknown) {
    this.allow(staff);
    const f = this.parseFilter(raw);
    const rows = await this.db
      .select()
      .from(metricsDaily)
      .where(
        and(
          eq(metricsDaily.gameId, f.gameId ?? ""),
          eq(metricsDaily.platform, f.platform ?? ""),
          gte(metricsDaily.day, f.from),
          lte(metricsDaily.day, f.to),
        ),
      )
      .orderBy(metricsDaily.day);

    const latest = rows[rows.length - 1];
    const cohort = await this.db.query.metricsRetentionCohort.findFirst({
      where: and(
        eq(metricsRetentionCohort.gameId, f.gameId ?? ""),
        eq(metricsRetentionCohort.platform, f.platform ?? ""),
        eq(metricsRetentionCohort.cohortDay, f.to),
      ),
    });

    const stickiness =
      latest && latest.mau > 0 ? latest.dau / latest.mau : latest && latest.dau === 0 ? 0 : null;
    const avgSessionSec =
      latest && latest.sessionEndCount > 0
        ? latest.sessionSecondsSum / latest.sessionEndCount
        : null;

    const cohortDay = cohort ? String(cohort.cohortDay) : f.to;
    return metricsOverviewSchema.parse({
      newAccounts: latest?.newAccounts ?? 0,
      dau: latest?.dau ?? 0,
      wau: latest?.wau ?? 0,
      mau: latest?.mau ?? 0,
      stickiness,
      sessions: latest?.sessions ?? 0,
      avgSessionSec,
      retention: {
        d1: retentionRate(cohort?.returnedD1, cohort?.cohortSize, cohortDay, 1),
        d7: retentionRate(cohort?.returnedD7, cohort?.cohortSize, cohortDay, 7),
        d30: retentionRate(cohort?.returnedD30, cohort?.cohortSize, cohortDay, 30),
      },
      series: rows.map((r) => ({
        day: String(r.day),
        dau: r.dau,
        newAccounts: r.newAccounts,
        sessions: r.sessions,
      })),
    });
  }

  async retention(staff: StaffContext, raw: unknown) {
    this.allow(staff);
    const f = this.parseFilter(raw);
    const rows = await this.db
      .select()
      .from(metricsRetentionCohort)
      .where(
        and(
          eq(metricsRetentionCohort.gameId, f.gameId ?? ""),
          eq(metricsRetentionCohort.platform, f.platform ?? ""),
          gte(metricsRetentionCohort.cohortDay, f.from),
          lte(metricsRetentionCohort.cohortDay, f.to),
        ),
      )
      .orderBy(metricsRetentionCohort.cohortDay);

    return metricsRetentionSchema.parse({
      cohorts: rows.map((r) => {
        const day = String(r.cohortDay);
        return {
          cohortDay: day,
          cohortSize: r.cohortSize,
          d1: retentionRate(r.returnedD1, r.cohortSize, day, 1),
          d7: retentionRate(r.returnedD7, r.cohortSize, day, 7),
          d30: retentionRate(r.returnedD30, r.cohortSize, day, 30),
        };
      }),
    });
  }

  async funnel(staff: StaffContext, raw: unknown) {
    this.allow(staff);
    const f = this.parseFilter(raw);
    if (!f.gameId) {
      const err = new Error("Pick a game to see the level funnel.") as Error & {
        statusCode: number;
        code: string;
      };
      err.statusCode = 400;
      err.code = "game_required";
      throw err;
    }
    const rows = await this.db.execute(sql`
      SELECT
        level,
        sum(starts)::int AS starts,
        sum(wins)::int AS wins,
        sum(fails)::int AS fails,
        sum(quits)::int AS quits,
        CASE WHEN sum(moves_left_n) > 0
          THEN sum(moves_left_sum)::float / sum(moves_left_n)
          ELSE NULL END AS avg_moves_left,
        sum(stars_0)::int AS s0,
        sum(stars_1)::int AS s1,
        sum(stars_2)::int AS s2,
        sum(stars_3)::int AS s3
      FROM metrics_level_daily
      WHERE game_id = ${f.gameId}
        AND day >= ${f.from}::date AND day <= ${f.to}::date
      GROUP BY level
      ORDER BY level
    `);

    const levels = (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
      level: Number(r.level),
      starts: Number(r.starts),
      wins: Number(r.wins),
      fails: Number(r.fails),
      quits: Number(r.quits),
      avgMovesLeft: r.avg_moves_left == null ? null : Number(r.avg_moves_left),
      stars: {
        s0: Number(r.s0),
        s1: Number(r.s1),
        s2: Number(r.s2),
        s3: Number(r.s3),
      },
    }));

    return metricsFunnelSchema.parse({ gameId: f.gameId, levels });
  }

  async difficulty(staff: StaffContext, raw: unknown) {
    this.allow(staff);
    const f = this.parseFilter(raw);
    if (!f.gameId) {
      const err = new Error("Pick a game to see difficulty health.") as Error & {
        statusCode: number;
        code: string;
      };
      err.statusCode = 400;
      err.code = "game_required";
      throw err;
    }

    const funnel = await this.funnel(staff, raw);
    const bands = await this.db
      .select()
      .from(levelDifficultyBands)
      .where(eq(levelDifficultyBands.gameId, f.gameId));
    const byLevel = new Map(bands.map((b) => [b.level, b]));

    return metricsDifficultySchema.parse({
      gameId: f.gameId,
      levels: funnel.levels.map((l) => {
        const band = byLevel.get(l.level);
        const winRate = l.starts > 0 ? l.wins / l.starts : null;
        const inBand =
          winRate == null || !band
            ? null
            : winRate >= band.winRateMin && winRate <= band.winRateMax;
        return {
          level: l.level,
          starts: l.starts,
          wins: l.wins,
          winRate,
          bandMin: band?.winRateMin ?? null,
          bandMax: band?.winRateMax ?? null,
          inBand,
        };
      }),
    });
  }

  async economy(staff: StaffContext, raw: unknown) {
    this.allow(staff);
    const f = this.parseFilter(raw);
    const rows = await this.db
      .select()
      .from(metricsEconomyDaily)
      .where(
        and(
          eq(metricsEconomyDaily.gameId, f.gameId ?? ""),
          gte(metricsEconomyDaily.day, f.from),
          lte(metricsEconomyDaily.day, f.to),
        ),
      );

    const hintsCoins = rows.reduce((a, r) => a + r.hintsCoins, 0);
    const hintsAds = rows.reduce((a, r) => a + r.hintsAds, 0);
    const coinIn = rows.reduce((a, r) => a + r.coinIn, 0);
    const coinOut = rows.reduce((a, r) => a + r.coinOut, 0);

    const reasons = await this.db.execute(sql`
      SELECT reason, sum(delta)::int AS delta_sum
      FROM wallet_ledger
      WHERE created_at >= ${f.from}::date AND created_at < (${f.to}::date + interval '1 day')
      GROUP BY reason
      ORDER BY reason
    `);

    const balances = await this.db.execute(sql`
      WITH latest AS (
        SELECT DISTINCT ON (account_id) account_id, balance_after
        FROM wallet_ledger
        ORDER BY account_id, created_at DESC
      )
      SELECT
        CASE
          WHEN balance_after < 10 THEN '0-9'
          WHEN balance_after < 50 THEN '10-49'
          WHEN balance_after < 200 THEN '50-199'
          ELSE '200+'
        END AS bucket,
        count(*)::int AS accounts
      FROM latest
      GROUP BY 1
      ORDER BY 1
    `);

    return metricsEconomySchema.parse({
      hintsCoins,
      hintsAds,
      coinIn,
      coinOut,
      balanceBuckets: (balances as unknown as Array<{ bucket: string; accounts: number }>).map(
        (b) => ({ bucket: b.bucket, accounts: Number(b.accounts) }),
      ),
      byReason: (reasons as unknown as Array<{ reason: string; delta_sum: number }>).map((r) => ({
        reason: r.reason,
        deltaSum: Number(r.delta_sum),
      })),
    });
  }

  async ads(staff: StaffContext, raw: unknown) {
    this.allow(staff);
    const f = this.parseFilter(raw);
    const rows = await this.db
      .select()
      .from(metricsAdsDaily)
      .where(
        and(
          eq(metricsAdsDaily.gameId, f.gameId ?? ""),
          gte(metricsAdsDaily.day, f.from),
          lte(metricsAdsDaily.day, f.to),
        ),
      );
    const offers = rows.reduce((a, r) => a + r.rewardedOffers, 0);
    const starts = rows.reduce((a, r) => a + r.rewardedStarts, 0);
    const completions = rows.reduce((a, r) => a + r.rewardedCompletions, 0);
    const granted = rows.reduce((a, r) => a + r.rewardsGranted, 0);
    const interstitials = rows.reduce((a, r) => a + r.interstitialImpressions, 0);

    const daily = await this.db
      .select()
      .from(metricsDaily)
      .where(
        and(
          eq(metricsDaily.gameId, ""),
          eq(metricsDaily.platform, ""),
          gte(metricsDaily.day, f.from),
          lte(metricsDaily.day, f.to),
        ),
      );
    const sessions = daily.reduce((a, r) => a + r.sessions, 0);
    const dauSum = daily.reduce((a, r) => a + r.dau, 0);

    const revenue = await this.db
      .select()
      .from(metricsAdRevenueDaily)
      .where(
        and(
          eq(metricsAdRevenueDaily.gameId, f.gameId ?? ""),
          gte(metricsAdRevenueDaily.day, f.from),
          lte(metricsAdRevenueDaily.day, f.to),
        ),
      );
    const revenueMicros = revenue.reduce((a, r) => a + r.revenueMicros, 0);
    const hasRealRevenue = revenue.some((r) => r.source !== "pending" && r.revenueMicros > 0);

    const iapRows = await this.db
      .select()
      .from(metricsIapDaily)
      .where(
        and(
          eq(metricsIapDaily.gameId, f.gameId ?? ""),
          gte(metricsIapDaily.day, f.from),
          lte(metricsIapDaily.day, f.to),
        ),
      );
    const iapPurchasers = iapRows.reduce((a, r) => a + r.purchasers, 0);
    const iapRevenueCents = iapRows.reduce((a, r) => a + r.revenueCents, 0);

    const medianHours = await this.db.execute(sql`
      WITH first_purchase AS (
        SELECT
          payload->'event'->>'app_user_id' AS account_id,
          min(created_at) AS purchased_at
        FROM iap_webhook_events
        WHERE created_at >= ${f.from}::date
          AND created_at < (${f.to}::date + interval '1 day')
          AND payload->'event'->>'app_user_id' IS NOT NULL
        GROUP BY 1
      ),
      deltas AS (
        SELECT extract(epoch FROM (fp.purchased_at - a.created_at)) / 3600.0 AS hours
        FROM first_purchase fp
        JOIN accounts a ON a.id::text = fp.account_id
        WHERE fp.purchased_at >= a.created_at
      )
      SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY hours) AS median_hours
      FROM deltas
    `);
    const medianRaw = (medianHours as unknown as Array<{ median_hours: number | null }>)?.[0]
      ?.median_hours;

    return metricsAdsSchema.parse({
      rewardedOffers: offers,
      rewardedStarts: starts,
      rewardedCompletions: completions,
      completionRate: starts > 0 ? completions / starts : null,
      rewardsGranted: granted,
      rewardRatePerUser: dauSum > 0 ? granted / dauSum : null,
      interstitialImpressions: interstitials,
      interstitialPerSession: sessions > 0 ? interstitials / sessions : null,
      arpdau: hasRealRevenue && dauSum > 0 ? revenueMicros / 1_000_000 / dauSum : null,
      arpdauPending: !hasRealRevenue,
      iapPurchasers,
      iapRevenueCents,
      payerShare: dauSum > 0 ? Math.min(1, iapPurchasers / dauSum) : null,
      medianHoursToFirstPurchase: medianRaw == null ? null : Number(medianRaw),
    });
  }

  async quality(staff: StaffContext, raw: unknown) {
    this.allow(staff);
    const f = this.parseFilter(raw);
    const rows = await this.db
      .select()
      .from(metricsQualityDaily)
      .where(and(gte(metricsQualityDaily.day, f.from), lte(metricsQualityDaily.day, f.to)))
      .orderBy(metricsQualityDaily.day);

    const accepted = rows.reduce((a, r) => a + r.accepted, 0);
    const duplicates = rows.reduce((a, r) => a + r.duplicates, 0);
    const rejected = rows.reduce((a, r) => a + r.rejected, 0);
    const consentOptOuts = rows.reduce((a, r) => a + r.consentOptOuts, 0);
    const denom = accepted + duplicates;
    return metricsQualitySchema.parse({
      accepted,
      duplicates,
      rejected,
      consentOptOuts,
      dedupeRate: denom > 0 ? duplicates / denom : null,
      series: rows.map((r) => ({
        day: String(r.day),
        accepted: r.accepted,
        duplicates: r.duplicates,
        rejected: r.rejected,
        consentOptOuts: r.consentOptOuts,
      })),
    });
  }

  async borrowedTime(staff: StaffContext, raw: unknown) {
    this.allow(staff);
    const f = this.parseFilter(raw);
    const eras = await this.db.execute(sql`
      SELECT
        props->>'era' AS era,
        count(DISTINCT account_id)::int AS reachers,
        avg((props->>'debt')::float) AS avg_debt,
        avg((props->>'buildings')::float) AS avg_buildings
      FROM telemetry_events
      WHERE name = 'tier_reached'
        AND game_id = 'borrowed-time'
        AND ts >= ${f.from}::date
        AND ts < (${f.to}::date + interval '1 day')
        AND props ? 'era'
      GROUP BY 1
      ORDER BY reachers DESC
    `);
    const buildingsRows = (await this.db.execute(sql`
      SELECT count(*)::int AS count
      FROM telemetry_events
      WHERE name = 'building_placed'
        AND game_id = 'borrowed-time'
        AND ts >= ${f.from}::date
        AND ts < (${f.to}::date + interval '1 day')
    `)) as unknown as Array<{ count: number }>;

    const pacing = (await this.db.execute(sql`
      SELECT
        count(*) FILTER (WHERE name = 'session_start')::int AS sessions,
        coalesce(avg((props->>'durationSec')::float) FILTER (WHERE name = 'session_end'), NULL) AS avg_session_sec
      FROM telemetry_events
      WHERE game_id = 'borrowed-time'
        AND ts >= ${f.from}::date
        AND ts < (${f.to}::date + interval '1 day')
        AND name IN ('session_start', 'session_end')
    `)) as unknown as Array<{ sessions: number; avg_session_sec: number | null }>;
    const pace = pacing[0];

    return metricsBorrowedTimeSchema.parse({
      eras: (eras as unknown as Array<Record<string, unknown>>).map((r) => ({
        era: String(r.era),
        reachers: Number(r.reachers),
        avgDebt: r.avg_debt == null ? null : Number(r.avg_debt),
        avgBuildings: r.avg_buildings == null ? null : Number(r.avg_buildings),
      })),
      buildingsPlaced: Number(buildingsRows[0]?.count ?? 0),
      avgSessionSec: pace?.avg_session_sec == null ? null : Number(pace.avg_session_sec),
      sessions: Number(pace?.sessions ?? 0),
    });
  }

  /** Legacy overview used by GET /admin/v1/metrics — real retention when cohorts exist. */
  async legacySummary(staff: StaffContext) {
    this.allow(staff);
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const day = await this.db.query.metricsDaily.findFirst({
      where: and(
        eq(metricsDaily.day, yesterday),
        eq(metricsDaily.gameId, ""),
        eq(metricsDaily.platform, ""),
      ),
    });

    const [{ count: newAccountsLive }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(accounts)
      .where(sql`${accounts.createdAt} > now() - interval '1 day'`);

    const live =
      day ??
      (
        await this.db
          .select()
          .from(metricsDaily)
          .where(and(eq(metricsDaily.gameId, ""), eq(metricsDaily.platform, "")))
          .orderBy(sql`${metricsDaily.day} desc`)
          .limit(1)
      )[0];

    const cohortDay = live ? String(live.day) : yesterday;
    const cohort = await this.db.query.metricsRetentionCohort.findFirst({
      where: and(
        eq(metricsRetentionCohort.cohortDay, cohortDay),
        eq(metricsRetentionCohort.gameId, ""),
        eq(metricsRetentionCohort.platform, ""),
      ),
    });

    // Live DAU/WAU when no rollup yet (same windows as before, but retention is real).
    let dau = live?.dau ?? 0;
    let wau = live?.wau ?? 0;
    let mau = live?.mau ?? 0;
    if (!live) {
      const dRows = (await this.db.execute(sql`
        SELECT count(DISTINCT account_id)::int AS count FROM telemetry_events
        WHERE ts > now() - interval '1 day' AND account_id IS NOT NULL
      `)) as unknown as Array<{ count: number }>;
      const wRows = (await this.db.execute(sql`
        SELECT count(DISTINCT account_id)::int AS count FROM telemetry_events
        WHERE ts > now() - interval '7 days' AND account_id IS NOT NULL
      `)) as unknown as Array<{ count: number }>;
      const mRows = (await this.db.execute(sql`
        SELECT count(DISTINCT account_id)::int AS count FROM telemetry_events
        WHERE ts > now() - interval '30 days' AND account_id IS NOT NULL
      `)) as unknown as Array<{ count: number }>;
      dau = Number(dRows[0]?.count ?? 0);
      wau = Number(wRows[0]?.count ?? 0);
      mau = Number(mRows[0]?.count ?? 0);
    }

    return {
      newAccounts24h: day?.newAccounts ?? newAccountsLive ?? 0,
      dau,
      wau,
      mau,
      retention: {
        d1: retentionRate(cohort?.returnedD1, cohort?.cohortSize, cohortDay, 1),
        d7: retentionRate(cohort?.returnedD7, cohort?.cohortSize, cohortDay, 7),
        d30: retentionRate(cohort?.returnedD30, cohort?.cohortSize, cohortDay, 30),
      },
      asOf: live ? String(live.day) : today,
    };
  }
}

/** Return rate once the cohort has aged `days`; null while still maturing or empty. */
function retentionRate(
  num: number | undefined,
  den: number | undefined,
  cohortDay: string,
  days: number,
): number | null {
  if (num == null || den == null || den === 0) return null;
  const mature = Date.parse(`${cohortDay}T00:00:00.000Z`) + days * 86_400_000;
  const todayUtc = Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate(),
  );
  if (mature > todayUtc) return null;
  return num / den;
}
