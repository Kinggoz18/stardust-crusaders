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

Seed creates fake player devices (`fake-seed-*`) and a staff user `owner@stardust.local` (password printed by seed; TOTP secret printed once). Seed also marks the master-key bootstrap as used.

## First admin (empty database)

1. Set `ADMIN_MASTER_KEY` (≥32 chars) in the API env. Never commit the value.
2. Open the admin app → **Set up the master admin** (`/setup`) when no staff exist.
3. Enter the setup key, your email, and a password. Save the authenticator secret shown once, then sign in with email + password + TOTP.
4. **Remove `ADMIN_MASTER_KEY` from the environment** (API warns on startup if it is still set after setup).
5. Invite teammates from **Staff**: choose email + role; copy the one-time invite code (or `/invite?token=…`) and send it yourself. Invitees set a password and enrol TOTP. Revoke unused invites from the same page.

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

## AdMob setup (names only)

Chosen network: **AdMob** for Interstitial and Rewarded Video only (no native ads). One AdMob app setup serves **all three games**; each game has its own interstitial + rewarded **ad unit** pair stored in `ad_units` (replace the `ca-app-pub-test/…` placeholders after creating units in AdMob).

1. In AdMob, create Interstitial + Rewarded units for **One Spark**, **Loom Rush**, and **Borrowed Time** (six units total). Update `ad_units.unit_id` per `game_id` × format.
2. Enable **server-side verification (SSV)** on each Rewarded ad unit. Callback URL:
   `https://<API_HOST>/v1/ads/reward-callback` (GET).
3. Games must set SSV options before show:
   - `user_id` = player account UUID
   - `custom_data` = JSON `{"accountId":"<uuid>","gameId":"one-spark|loom-rush|borrowed-time","rewardKind":"coins|booster|extra_moves|other"}`
4. API env: set `AD_PROVIDER=admob`. Optional overrides: `ADMOB_SSV_KEYS_URL` (default Google verifier keys), `ADMOB_SSV_MAX_AGE_MS`. Keep `AD_PROVIDER_SIGNING_SECRET` set (unused by AdMob, still required by config).
5. Games call `GET /v1/ads/config?gameId=…` (Bearer). Response includes:
   - `units.interstitial` / `units.rewarded` for that game
   - `interstitial`: `{ minTransitions, maxTransitions, maxPerSession, enabled, nextGap }`
   - `rewarded`: `{ ssv, kinds, enabled, maxPerSession }`
   - `houseAds`: `{ available, killSwitch, globalEnabled, gameEnabled, rules, items[] }` — off until owner enables studio-wide and support opts the game in; items never promote the hosting game
   - Default pacing: one interstitial every **4–6 level transitions** per session (`nextGap` is the server-chosen value in that range). Show only after a win at a natural break; never mid-level; never right after a rewarded or house ad; stop at `maxPerSession`.
6. Admin: `/games/:game/ads` Controls + House ads. Unit ids and frequency live in `ad_units` / `ad_frequency_caps`. House registry in `house_ads*`. Kill switch = instant off for all games.
7. Google rotates verifier keys; the API caches them ≤ 24h from `ADMOB_SSV_KEYS_URL`. No AdMob private keys live on our servers — only Google's published public keys.

## Rotate keys

1. Generate new `JWT_SECRET` / `REFRESH_TOKEN_SECRET` / `ADMIN_SESSION_SECRET` / `ADMIN_PROXY_TOKEN` / webhook secrets.
2. Deploy API with new env (old access tokens invalidate; staff must re-login).
3. Update Pages Function secrets for `ADMIN_PROXY_TOKEN` and `API_BASE_URL` together.
4. Update RevenueCat dashboard secrets to match. AdMob SSV uses Google's public verifier keys (no shared HMAC secret).
5. Never commit values; never log them.

## Migrations

```bash
bun run db:migrate           # up
bun run --filter '@stardust/api' db:migrate:check  # up then down then up on ephemeral DB
```

Expand-then-contract: additive columns first; remove only in a later migration after readers are gone.
