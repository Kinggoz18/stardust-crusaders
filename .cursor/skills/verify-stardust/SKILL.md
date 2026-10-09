---
name: verify-stardust
description: Launch, doctor, drive, evidence, and cleanup for the Stardust Crusaders API and admin dashboard. Use when verifying any change in this repo.
---

# Verify Stardust

Evidence root: `.artifacts/<run-id>/` with `screenshots/`, `videos/`, `logs/`, `README.md`, and `.pending-review`.

## Launch
```bash
export PATH="$HOME/.bun/bin:$PATH"
bun install
cp -n .env.example .env
# Prefer docker compose when Docker is available; otherwise integration tests start embedded Postgres.
docker compose up -d postgres || true
bun run db:migrate
bun run db:seed
bun run dev:api   # :3000
bun run dev:admin # :5173
```

## Doctor
```bash
bun run ci
```
Expect: lint, typecheck, unit + integration tests, migration up/down check, both builds, admin e2e (axe + screenshots).

## Drive
Feature map (states × breakpoints):

| Route | States | Breakpoints |
| --- | --- | --- |
| `/login` | empty, error, success | 360, 768, 1280 |
| `/accounts` | loading, empty, error, success | 360, 768, 1280 |
| `/accounts/:id` | loading, error, success | 360, 768, 1280 |
| `/accounts/:id/games/:game` | loading, empty, success | 360, 768, 1280 |
| `/games` | success | 360, 768, 1280 |
| `/metrics` | loading, empty, success | 360, 768, 1280 |
| `/audit` | loading, empty, success | 360, 768, 1280 |
| `/settings/staff` | loading, no-permission, success | 360, 768, 1280 |

API contract checks: anonymous account create, refresh, progress put (revision), wallet ledger, events batch, ad reward callback idempotency, RevenueCat webhook replay, admin auth (wrong role / expired / tampered).

## Evidence
- Screenshots under `.artifacts/<run-id>/screenshots/`
- Playwright traces / videos under `videos/`
- `bun run ci` log under `logs/ci.txt`
- One-line index in `README.md`; touch `.pending-review`

## Cleanup
Kill only recorded PIDs for api/admin/dev servers. `docker compose down` only containers this run started. Never delete `.artifacts/`. Remove scratch under `${TMPDIR:-/tmp}/agent-<run-id>/`.
