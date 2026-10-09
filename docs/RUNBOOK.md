# Runbook

## Local development

```bash
bun install
cp .env.example .env
# Postgres: docker compose up -d postgres
# or system Postgres with DATABASE_URL=postgres://stardust:stardust@127.0.0.1:5432/stardust
bun run db:migrate
bun run db:seed
bun run dev:api    # :3000
bun run dev:admin  # :5173
bun run ci
```

Seed creates fake player devices (`fake-seed-*`) and a staff user `owner@stardust.local` (password printed by seed; TOTP secret printed once).

## API deploy files (do not deploy from bots)

- `docker-compose.yml` — postgres, api, caddy
- `apps/api/Dockerfile`
- `deploy/Caddyfile`

Typical VPS flow (human): build/push image, set env from secret store, `docker compose up -d`, migrate, verify `/health` and `/ready`.

## Admin deploy (Cloudflare Pages)

- Build output: `apps/admin/dist`
- Functions: `apps/admin/functions`
- Bindings: `API_BASE_URL`, `ADMIN_PROXY_TOKEN` (secret)

## Backup / restore

**Backup (nightly recommended):**

```bash
pg_dump "$DATABASE_URL" -Fc -f "stardust-$(date -u +%Y%m%d).dump"
# copy dump off-box (object storage)
```

**Restore:**

```bash
pg_restore -d "$DATABASE_URL" --clean --if-exists stardust-YYYYMMDD.dump
```

After restore, run `bun run db:migrate` to ensure journal matches.

## Rotate keys

1. Generate new `JWT_SECRET` / `REFRESH_TOKEN_SECRET` / `ADMIN_SESSION_SECRET` / `ADMIN_PROXY_TOKEN` / webhook secrets.
2. Deploy API with new env (old access tokens invalidate; staff must re-login).
3. Update Pages Function secrets for `ADMIN_PROXY_TOKEN` and `API_BASE_URL` together.
4. Update RevenueCat / ad provider dashboard secrets to match.
5. Never commit values; never log them.

## Migrations

```bash
bun run db:migrate           # up
bun run --filter '@stardust/api' db:migrate:check  # up then down then up on ephemeral DB
```

Expand-then-contract: additive columns first; remove only in a later migration after readers are gone.
