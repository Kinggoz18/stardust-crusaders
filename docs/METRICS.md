# Metrics

First-party analytics for One Spark, Loom Rush, and Borrowed Time. Events land in Postgres via `POST /v1/events` (consent-gated). No third-party SDK in the games. Anonymous unless the player has a linked account; we store `account_id` only when a Bearer token is present.

Rollups live forever; raw `telemetry_events` are kept **90 days** then purged after the nightly job.

## Event taxonomy

Wire shape: `telemetryEventSchema` in `@stardust/schema`. Named events below have stricter `props` schemas in `packages/schema/src/telemetry-events.ts`. Unknown names are still stored (forward-compatible) if they pass the base schema.

| Name | Games | Props (zod) | When |
| --- | --- | --- | --- |
| `session_start` | all | `{ platform?: android\|ios }` | App/session open |
| `session_end` | all | `{ durationSec: int≥0 }` | Session close / background |
| `level_start` | all | `{ level: int≥1, attempt?: int≥1 }` | Level begins |
| `level_clear` | all | `{ level, stars?: 0–3, movesLeft?: int≥0, attempt?: int }` | Win |
| `level_fail` | all | `{ level, reason?: string, attempt?: int }` | Fail |
| `quit_point` | all | `{ level?: int, screen?: string }` | Leave mid-flow |
| `hint_used` | all | `{ level?, source: coins\|ad }` | Hint consumed |
| `coin_earn` | all | `{ amount: int>0, source: string }` | Client-visible earn (ledger is authoritative) |
| `coin_spend` | all | `{ amount: int>0, sink: string }` | Client-visible spend |
| `ad_rewarded_offer` | all | `{ placement?: string }` | Offer shown |
| `ad_rewarded_start` | all | `{ placement?: string }` | Playback start |
| `ad_rewarded_complete` | all | `{ placement?, rewardKind? }` | Finished (server SSV is authoritative for grants) |
| `ad_interstitial_impression` | all | `{ placement?: string }` | Interstitial shown |
| `iap_offer_seen` | all | `{ productId: string }` | Store offer shown |
| `tier_reached` | borrowed-time | `{ era: string, debt?: int, buildings?: int }` | Era / island milestone |
| `building_placed` | borrowed-time | `{ buildingId: string, tier?: string }` | Building built |
| `install` | all | `{ platform?: android\|ios }` | First open after install (also inferred from account create) |

Batch request: `postEventsRequestSchema` — `consentAnalytics: false` rejects the whole batch (counted as opt-out / rejected).

## Privacy (iOS / Android)

We never use IDFA, GAID, or device fingerprinting. Analytics are consent-gated (`consentAnalytics`). Identity for metrics is first-party only:

- **Signed-in / linked account** → `account_id` from our Bearer token
- **Anonymous** → our opaque account row keyed by studio `deviceId` (not an advertising id)
- **Segments we do use:** new vs returning (first-seen cohort), platform (`android` \| `ios`), consent state, signed-in vs anonymous
- **When ATT is declined (or never asked):** keep first-party gameplay metrics; **omit** advertising-id attribution and treat ARPDAU / campaign install sources as unavailable on iOS

| Scope | Meaning |
| --- | --- |
| **Full** | Same definition on Android and iOS using first-party ids |
| **iOS-limited** | Available with first-party ids; advertising-network or ATT-dependent slices omitted or labelled in admin |
| **Android-only** | Not computed on iOS (none today — we do not ship GAID-based metrics) |

Dashboard shows a small **Limited on iOS** label on iOS-limited tiles.

## Metric catalogue

Definitions use **UTC calendar days** unless noted. Filters: `gameId`, `platform`, date range.

| Metric | Definition | Source | Privacy |
| --- | --- | --- | --- |
| Installs / new accounts | Count of `accounts` created in the day (and optional `install` events) | accounts + events | Full (first-party); campaign attribution omitted on iOS without ATT |
| DAU | Distinct `account_id` with ≥1 event that day (null account_id excluded from DAU) | events → `metrics_daily` | Full |
| WAU / MAU | Distinct accounts with ≥1 event in trailing 7 / 30 days ending that day | events → `metrics_daily` | Full |
| Stickiness | DAU / MAU for that day | derived | Full |
| Retention D1 / D7 / D30 | Of accounts whose **first event day** (cohort) is C: share with ≥1 event on C+N | `metrics_retention_cohort` | Full |
| User type splits | New vs returning, platform, consent, signed-in vs anonymous | accounts + events | Full |
| Sessions | Count of `session_start` | rollup | Full |
| Session length | Sum/avg of `session_end.durationSec` | rollup | Full |
| Level funnel | Per game×level: starts, wins, fails, quits; attempts; avg moves left on win; star histogram | `metrics_level_daily` | Full |
| Difficulty health | Actual win rate = wins/starts vs designed band in `level_difficulty_bands` (One Spark phases from FINAL_PLAN) | rollup + bands | Full |
| Hint usage | `hint_used` split by `source` coins vs ad | economy rollup | Full |
| Coin sources / sinks | Sums from wallet ledger by reason (authoritative) + optional client `coin_*` | ledger + events | Full |
| Balance distribution | Snapshot buckets of current balances (from ledger) on rollup day | wallet | Full |
| Rewarded ads | offers / starts / completions; completion rate; rewards granted per user (SSV + events) | events + `ad_reward_transactions` | Full (server SSV); fill-rate by advertising id omitted |
| Interstitials / session | Impressions / sessions | events | Full |
| ARPDAU | Ad revenue / DAU — **table ready** (`metrics_ad_revenue_daily`); ingestion from AdMob reports **later** | pending | **iOS-limited** (network reports; no IDFA join) |
| IAP conversion | Distinct purchasers / DAU; revenue from RevenueCat webhook rows | `iap_webhook_events` | Full |
| Payer share | Lifetime or period purchasers / active accounts | IAP + accounts | Full |
| Time to first purchase | Median hours from account create to first IAP event | IAP + accounts | Full |
| Borrowed Time | Era reached, buildings, debt from `tier_reached` / progress; session pacing | events + progress | Full |
| Data quality | accepted / duplicates / rejected / consent opt-outs per day | `metrics_quality_daily` | Full |

## Rollup job

`bun run --filter @stardust/api metrics:rollup -- --day=YYYY-MM-DD` (default: yesterday UTC).

- Idempotent: upserts by primary key; safe to re-run.
- Restartable: processes one day; watermark in `metrics_rollup_runs`.
- Late/duplicate events: re-rollup of a day replaces that day's aggregates; event id uniqueness prevents double-ingest.
- After rollup, deletes raw events older than 90 days.

## Admin surfaces

- `/metrics` — thin **studio** headlines + data health only
- `/games` — studio headlines + entry to each title
- `/games/:game` — per-game dashboard (overview, players, levels, coins, ads, events; One Spark: level curve + hints; Borrowed Time: eras & debt). Role-aware nav (e.g. Ads requires support+).
- API under `/admin/v1/metrics/*` and `/admin/v1/games/:gameId/players`

## Client helper

`@stardust/schema/client` — `TelemetryClient` batches events, respects consent, offline queue + retry. Games import it; this repo does not modify game repos.

## Real vs waiting

| Real now | Waits |
| --- | --- |
| Event ingest, consent, dedupe, rollups from fixtures | Live player volume |
| DAU/WAU/MAU, retention D1/D7/D30 from events | — |
| Level funnel, difficulty vs bands (seeded One Spark bands) | Tuned bands for Loom/Borrowed |
| Economy from wallet ledger | — |
| Rewarded completion via SSV + events | — |
| IAP from RevenueCat webhook stub | Production RevenueCat |
| `metrics_ad_revenue_daily` schema | AdMob report ingestion / ARPDAU |
