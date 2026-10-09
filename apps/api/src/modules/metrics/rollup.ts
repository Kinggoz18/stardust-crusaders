import { sql } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { metricsRollupRuns } from "../../db/schema.js";

const RAW_RETENTION_DAYS = 90;

export type RollupResult = {
  day: string;
  status: "ok" | "error";
  purgedEvents: number;
};

/** Idempotent daily rollup for one UTC calendar day. */
export async function rollupDay(db: Db["db"], day: string): Promise<RollupResult> {
  await db
    .insert(metricsRollupRuns)
    .values({ day, status: "running", detail: {} })
    .onConflictDoUpdate({
      target: metricsRollupRuns.day,
      set: { startedAt: new Date(), finishedAt: null, status: "running", detail: {} },
    });

  try {
    await db.execute(sql`DELETE FROM metrics_daily WHERE day = ${day}::date`);
    await db.execute(sql`
      INSERT INTO metrics_daily (
        day, game_id, platform, new_accounts, dau, wau, mau, sessions, session_seconds_sum, session_end_count
      )
      SELECT
        ${day}::date,
        coalesce(e.game_id::text, '') AS game_id,
        coalesce(e.props->>'platform', '') AS platform,
        0,
        count(DISTINCT e.account_id) FILTER (WHERE e.account_id IS NOT NULL),
        0,
        0,
        count(*) FILTER (WHERE e.name = 'session_start'),
        coalesce(sum((e.props->>'durationSec')::int) FILTER (WHERE e.name = 'session_end'), 0),
        count(*) FILTER (WHERE e.name = 'session_end')
      FROM telemetry_events e
      WHERE e.ts >= ${day}::date
        AND e.ts < (${day}::date + interval '1 day')
      GROUP BY 2, 3
    `);

    // All-games / all-platform rollup row
    await db.execute(sql`
      INSERT INTO metrics_daily (
        day, game_id, platform, new_accounts, dau, wau, mau, sessions, session_seconds_sum, session_end_count
      )
      SELECT
        ${day}::date, '', '',
        (SELECT count(*)::int FROM accounts a
          WHERE a.created_at >= ${day}::date AND a.created_at < (${day}::date + interval '1 day')
            AND a.deleted_at IS NULL),
        (SELECT count(DISTINCT account_id)::int FROM telemetry_events
          WHERE ts >= ${day}::date AND ts < (${day}::date + interval '1 day') AND account_id IS NOT NULL),
        (SELECT count(DISTINCT account_id)::int FROM telemetry_events
          WHERE ts >= (${day}::date - interval '6 days') AND ts < (${day}::date + interval '1 day')
            AND account_id IS NOT NULL),
        (SELECT count(DISTINCT account_id)::int FROM telemetry_events
          WHERE ts >= (${day}::date - interval '29 days') AND ts < (${day}::date + interval '1 day')
            AND account_id IS NOT NULL),
        (SELECT count(*)::int FROM telemetry_events
          WHERE ts >= ${day}::date AND ts < (${day}::date + interval '1 day') AND name = 'session_start'),
        (SELECT coalesce(sum((props->>'durationSec')::int), 0) FROM telemetry_events
          WHERE ts >= ${day}::date AND ts < (${day}::date + interval '1 day') AND name = 'session_end'),
        (SELECT count(*)::int FROM telemetry_events
          WHERE ts >= ${day}::date AND ts < (${day}::date + interval '1 day') AND name = 'session_end')
      ON CONFLICT (day, game_id, platform) DO UPDATE SET
        new_accounts = excluded.new_accounts,
        dau = excluded.dau,
        wau = excluded.wau,
        mau = excluded.mau,
        sessions = excluded.sessions,
        session_seconds_sum = excluded.session_seconds_sum,
        session_end_count = excluded.session_end_count
    `);

    // Per-game, all-platform aggregates (platform = '')
    await db.execute(sql`
      INSERT INTO metrics_daily (
        day, game_id, platform, new_accounts, dau, wau, mau, sessions, session_seconds_sum, session_end_count
      )
      SELECT
        ${day}::date,
        e.game_id::text,
        '',
        0,
        count(DISTINCT e.account_id) FILTER (WHERE e.account_id IS NOT NULL),
        0,
        0,
        count(*) FILTER (WHERE e.name = 'session_start'),
        coalesce(sum((e.props->>'durationSec')::int) FILTER (WHERE e.name = 'session_end'), 0),
        count(*) FILTER (WHERE e.name = 'session_end')
      FROM telemetry_events e
      WHERE e.ts >= ${day}::date
        AND e.ts < (${day}::date + interval '1 day')
        AND e.game_id IS NOT NULL
      GROUP BY e.game_id
      ON CONFLICT (day, game_id, platform) DO UPDATE SET
        dau = excluded.dau,
        sessions = excluded.sessions,
        session_seconds_sum = excluded.session_seconds_sum,
        session_end_count = excluded.session_end_count
    `);

    await db.execute(sql`DELETE FROM metrics_retention_cohort WHERE cohort_day = ${day}::date`);
    await db.execute(sql`
      WITH first_seen AS (
        SELECT account_id, min(ts::date) AS cohort_day
        FROM telemetry_events
        WHERE account_id IS NOT NULL
        GROUP BY account_id
      ),
      cohort AS (
        SELECT account_id FROM first_seen WHERE cohort_day = ${day}::date
      )
      INSERT INTO metrics_retention_cohort (
        cohort_day, game_id, platform, cohort_size, returned_d1, returned_d7, returned_d30
      )
      SELECT
        ${day}::date, '', '',
        (SELECT count(*)::int FROM cohort),
        (SELECT count(DISTINCT e.account_id)::int FROM telemetry_events e
          JOIN cohort c ON c.account_id = e.account_id
          WHERE e.ts::date = (${day}::date + interval '1 day')),
        (SELECT count(DISTINCT e.account_id)::int FROM telemetry_events e
          JOIN cohort c ON c.account_id = e.account_id
          WHERE e.ts::date = (${day}::date + interval '7 days')),
        (SELECT count(DISTINCT e.account_id)::int FROM telemetry_events e
          JOIN cohort c ON c.account_id = e.account_id
          WHERE e.ts::date = (${day}::date + interval '30 days'))
    `);

    await db.execute(sql`DELETE FROM metrics_level_daily WHERE day = ${day}::date`);
    await db.execute(sql`
      INSERT INTO metrics_level_daily (
        day, game_id, level, starts, wins, fails, quits,
        moves_left_sum, moves_left_n, stars_0, stars_1, stars_2, stars_3
      )
      SELECT
        ${day}::date,
        e.game_id,
        (e.props->>'level')::int AS level,
        count(*) FILTER (WHERE e.name = 'level_start'),
        count(*) FILTER (WHERE e.name = 'level_clear'),
        count(*) FILTER (WHERE e.name = 'level_fail'),
        count(*) FILTER (WHERE e.name = 'quit_point'),
        coalesce(sum((e.props->>'movesLeft')::int) FILTER (WHERE e.name = 'level_clear'), 0),
        count(*) FILTER (WHERE e.name = 'level_clear' AND e.props ? 'movesLeft'),
        count(*) FILTER (WHERE e.name = 'level_clear' AND coalesce((e.props->>'stars')::int, 0) = 0),
        count(*) FILTER (WHERE e.name = 'level_clear' AND (e.props->>'stars')::int = 1),
        count(*) FILTER (WHERE e.name = 'level_clear' AND (e.props->>'stars')::int = 2),
        count(*) FILTER (WHERE e.name = 'level_clear' AND (e.props->>'stars')::int = 3)
      FROM telemetry_events e
      WHERE e.ts >= ${day}::date
        AND e.ts < (${day}::date + interval '1 day')
        AND e.game_id IS NOT NULL
        AND e.name IN ('level_start', 'level_clear', 'level_fail', 'quit_point')
        AND (e.props->>'level') ~ '^[0-9]+$'
      GROUP BY e.game_id, 3
    `);

    await db.execute(sql`DELETE FROM metrics_economy_daily WHERE day = ${day}::date`);
    await db.execute(sql`
      INSERT INTO metrics_economy_daily (day, game_id, hints_coins, hints_ads, coin_in, coin_out)
      SELECT
        ${day}::date,
        '',
        (SELECT count(*)::int FROM telemetry_events
          WHERE ts >= ${day}::date AND ts < (${day}::date + interval '1 day')
            AND name = 'hint_used' AND props->>'source' = 'coins'),
        (SELECT count(*)::int FROM telemetry_events
          WHERE ts >= ${day}::date AND ts < (${day}::date + interval '1 day')
            AND name = 'hint_used' AND props->>'source' = 'ad'),
        (SELECT coalesce(sum(delta), 0)::int FROM wallet_ledger
          WHERE created_at >= ${day}::date AND created_at < (${day}::date + interval '1 day') AND delta > 0),
        (SELECT coalesce(sum(-delta), 0)::int FROM wallet_ledger
          WHERE created_at >= ${day}::date AND created_at < (${day}::date + interval '1 day') AND delta < 0)
    `);

    await db.execute(sql`DELETE FROM metrics_ads_daily WHERE day = ${day}::date`);
    await db.execute(sql`
      INSERT INTO metrics_ads_daily (
        day, game_id, rewarded_offers, rewarded_starts, rewarded_completions,
        rewards_granted, interstitial_impressions
      )
      SELECT
        ${day}::date, '',
        (SELECT count(*)::int FROM telemetry_events WHERE ts >= ${day}::date AND ts < (${day}::date + interval '1 day') AND name = 'ad_rewarded_offer'),
        (SELECT count(*)::int FROM telemetry_events WHERE ts >= ${day}::date AND ts < (${day}::date + interval '1 day') AND name = 'ad_rewarded_start'),
        (SELECT count(*)::int FROM telemetry_events WHERE ts >= ${day}::date AND ts < (${day}::date + interval '1 day') AND name = 'ad_rewarded_complete'),
        (SELECT count(*)::int FROM ad_reward_transactions WHERE created_at >= ${day}::date AND created_at < (${day}::date + interval '1 day')),
        (SELECT count(*)::int FROM telemetry_events WHERE ts >= ${day}::date AND ts < (${day}::date + interval '1 day') AND name = 'ad_interstitial_impression')
    `);

    await db.execute(sql`DELETE FROM metrics_iap_daily WHERE day = ${day}::date`);
    await db.execute(sql`
      INSERT INTO metrics_iap_daily (day, game_id, purchasers, revenue_cents)
      SELECT
        ${day}::date, '',
        (SELECT count(DISTINCT payload->'event'->>'app_user_id')::int FROM iap_webhook_events
          WHERE created_at >= ${day}::date AND created_at < (${day}::date + interval '1 day')),
        0
    `);

    // Ensure quality row exists for the day (ingest may have created it).
    await db.execute(sql`
      INSERT INTO metrics_quality_daily (day, accepted, duplicates, rejected, consent_opt_outs)
      VALUES (${day}::date, 0, 0, 0, 0)
      ON CONFLICT (day) DO NOTHING
    `);

    const purge = await db.execute(sql`
      WITH deleted AS (
        DELETE FROM telemetry_events
        WHERE ts < (current_date - ${RAW_RETENTION_DAYS}::int)
        RETURNING 1
      )
      SELECT count(*)::int AS n FROM deleted
    `);
    const purgedEvents = Number((purge as unknown as { n: number }[])?.[0]?.n ?? 0);

    await db
      .update(metricsRollupRuns)
      .set({
        finishedAt: new Date(),
        status: "ok",
        detail: { purgedEvents },
      })
      .where(sql`${metricsRollupRuns.day} = ${day}::date`);

    return { day, status: "ok", purgedEvents };
  } catch (err) {
    await db
      .update(metricsRollupRuns)
      .set({
        finishedAt: new Date(),
        status: "error",
        detail: { message: err instanceof Error ? err.message : "rollup failed" },
      })
      .where(sql`${metricsRollupRuns.day} = ${day}::date`);
    throw err;
  }
}

export function yesterdayUtc(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
