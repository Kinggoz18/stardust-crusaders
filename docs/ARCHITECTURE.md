# Architecture

Stardust Crusaders platform: player API on a VPS, staff admin on Cloudflare Pages (edge), shared zod schemas.

## System diagram

```
Game clients (Capacitor) ──HTTPS──► apps/api (Bun+Fastify on VPS)
                                         │
                                         ▼
                                    Postgres

Staff browser ──► apps/admin (Pages SPA)
                      │
                      ▼
              Pages Function (/api/*) ──x-admin-proxy-token──► apps/api /admin/v1/*
```

## Packages

| Path | Role |
| --- | --- |
| `packages/schema` | zod contracts for accounts, progress, wallet, telemetry, ads, IAP, admin |
| `apps/api` | Long-running HTTP API, Drizzle + Postgres, Docker + Caddy |
| `apps/admin` | Vite React SPA + Pages Functions proxy (no Node APIs) |

## Data model (summary)

- **accounts** — anonymous `device_id` first; nullable link provider/subject/email for later Apple/Google/email
- **game_progress** — versioned JSON document per account×game with `revision`
- **wallet_ledger** — append-only coins with idempotency keys
- **telemetry_events** — deduped by event id; consent-gated
- **ad_reward_transactions** / **iap_webhook_events** — idempotent provider callbacks
- **ad_frequency_caps** — per-game (and optional per-account) interstitial caps for games to read
- **staff_users** / **staff_sessions** / **admin_audit_log** — argon2id + TOTP, short sessions, audited reads/writes

## Module layout (`apps/api/src/modules`)

`accounts`, `progress`, `wallet`, `telemetry`, `ads`, `iap`, `admin` — reserved for later multiplayer tick, remote flags, push.

## Decision records

### DR1 — Postgres on the VPS vs managed

**Decision:** Start with Postgres **on the same VPS** via docker-compose (app + Postgres + Caddy). Backups: nightly `pg_dump` to off-box object storage (documented in RUNBOOK). Revisit managed Postgres (e.g. Neon/RDS) when ops load or HA needs justify the cost.

**Why:** Solo/small studio; one billable host; migrations and ephemeral test DBs stay simple. Managed is the escape hatch, not the day-one dependency.

### DR2 — Admin login and Cloudflare Access

**Decision:** Staff email + password (argon2id) + **mandatory TOTP** now. Session cookie `HttpOnly; Secure; SameSite=Strict` via the Pages origin. **Cloudflare Access** is optional later in front of the admin hostname; do not require it for local or first deploy.

**Why:** Works offline of CF Access; TOTP covers 2FA without an IdP. Access can wrap the hostname when the studio wants SSO/device posture.

### DR3 — Anonymous device id farming and later linking

**Decision:**

- Device id is client-supplied (≥8 chars) but **not** a secret. Rate-limit account creation; one active account per `device_id` (partial unique index). Soft-delete allows re-create after deletion.
- Farming mitigation (now): rate limits, no reward without server-side ad/IAP verification, wallet ledger ignores client coin claims as authoritative.
- **Linking merge (later):** when Apple/Google/email links, if the provider subject already owns an account, merge by OR-merging One Spark stars/album/firstClear, summing wallet via ledger transfer entries, taking max revision documents per game with One Spark merge rules; keep an audit row. Current `/v1/accounts/link` is a **stub** that only stores provider subject.

### DR4 — Where per-game rules run later

**Decision:** Prefer a future `packages/rules` (or per-game packages published from each game repo) imported by `apps/api` for authoritative validation. Until then, One Spark sanity + merge live in `@stardust/schema` / progress module; Loom Rush and Borrowed Time documents are **draft** schemas only.

**Why:** Games already own economy numbers and sims; the API should import the same pure functions rather than re-implement. Shared schema package stays the wire contract.

### DR5 — ORM

**Decision:** **Drizzle ORM** + SQL migrations with tested down files (expand-then-contract).

**Why:** Typed schema close to SQL; works on Bun; no query-builder surprise tax. Kysely was considered; Drizzle’s migrate story and schema-as-code fit better here.

### DR6 — Ad network

**Decision:** **AdMob** for Interstitial and Rewarded Video. No native ads. `AdProvider` implementations: `none`, `generic` (HMAC test), `admob` (SSV ECDSA against Google's published verifier keys, cached ≤24h). Rewarded grants are idempotent by `transaction_id`. Interstitial frequency caps live in `ad_frequency_caps` and are exposed on `GET /v1/ads/config`.

**Why:** Owner choice; SSV removes client-trusted rewards; caps stay configurable without a mediation SDK on the server.

## Progress conflict handling

Client sends `revision`. Mismatch → `409 stale_revision` with server document. One Spark applies OR-merge for stars/album and monotonic `firstClear`; coins in the document are cache — **wallet ledger** is authoritative.
