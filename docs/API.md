# API reference

Generated from the Fastify routes and `@stardust/schema` contracts. Base URL: `API_BASE_URL`.

Consistent errors:

```json
{ "error": { "code": "validation_error", "message": "…", "details": {} } }
```

## Player

| Method | Path | Auth | Body / notes |
| --- | --- | --- | --- |
| GET | `/health` | — | liveness |
| GET | `/ready` | — | readiness (DB ping) |
| POST | `/v1/accounts/anonymous` | — | `createAnonymousAccountRequestSchema` → tokens |
| POST | `/v1/accounts/refresh` | — | `refreshTokenRequestSchema` |
| POST | `/v1/accounts/link` | Bearer | stub `linkAccountRequestSchema` |
| GET | `/v1/accounts/me/export` | Bearer | NDPA/GDPR export |
| DELETE | `/v1/accounts/me` | Bearer | soft delete |
| GET | `/v1/games/:gameId/progress` | Bearer | `{ revision, document }` |
| PUT | `/v1/games/:gameId/progress` | Bearer | `putProgressRequestSchema`; `409 stale_revision` |
| GET | `/v1/wallet` | Bearer | balance + entries |
| POST | `/v1/wallet/entries` | Bearer | `postWalletEntryRequestSchema` (idempotent) |
| POST | `/v1/events` | optional Bearer | `postEventsRequestSchema`; consent + dedupe |
| POST | `/v1/ads/reward-callback` | signature | Generic HMAC body (`adRewardCallbackSchema`) when `AD_PROVIDER=generic` |
| GET | `/v1/ads/reward-callback` | AdMob SSV | Query-string ECDSA callback; idempotent by `transaction_id` |
| GET | `/v1/ads/config?gameId=` | Bearer | Per-game units, interstitial/rewarded pacing, and house-ad offers (`adConfigResponseSchema`). House ads off by default; never self-promote. |
| POST | `/v1/webhooks/revenuecat` | HMAC header | sandbox stub; idempotent by event id |

`gameId`: `one-spark` \| `loom-rush` \| `borrowed-time`.

## Admin (`/admin/v1/*`)

Requires staff session (cookie `stardust_staff` or `Authorization: Bearer`). In production, Pages proxy must send `x-admin-proxy-token`.

| Method | Path | Roles | Notes |
| --- | --- | --- | --- |
| GET | `/admin/v1/auth/bootstrap-status` | — | `{ needsBootstrap }` |
| POST | `/admin/v1/auth/bootstrap` | — | one-time master key + email + password → owner + TOTP secret |
| POST | `/admin/v1/auth/accept-invite` | — | invite token + password → staff + TOTP secret |
| POST | `/admin/v1/auth/login` | — | email + password + TOTP |
| POST | `/admin/v1/auth/logout` | staff | |
| GET | `/admin/v1/staff` | owner, support | |
| GET | `/admin/v1/staff/invites` | owner | |
| POST | `/admin/v1/staff/invites` | owner | returns one-time `inviteToken` |
| POST | `/admin/v1/staff/invites/:id/revoke` | owner | |
| GET | `/admin/v1/accounts?q=&cursor=` | all | search; audited |
| GET | `/admin/v1/accounts/:id` | all | detail + progress; audited |
| GET | `/admin/v1/accounts/:id/wallet` | all | audited |
| GET | `/admin/v1/accounts/:id/events` | all | audited |
| POST | `/admin/v1/accounts/:id/ban` | owner, support | audited |
| POST | `/admin/v1/accounts/:id/unban` | owner, support | audited |
| POST | `/admin/v1/accounts/:id/games/:gameId/reset` | owner | backup row; audited |
| GET | `/admin/v1/games` | all | registry |
| GET | `/admin/v1/games/:gameId/players` | all | accounts with progress for that game |
| GET | `/admin/v1/metrics` | all | Legacy summary: DAU/WAU/MAU + real retention |
| GET | `/admin/v1/metrics/overview` | all | Key numbers + series (`from`,`to`,`gameId?`,`platform?`) |
| GET | `/admin/v1/metrics/retention` | all | Cohort table D1/D7/D30 |
| GET | `/admin/v1/metrics/funnel` | all | Level funnel (requires `gameId`) |
| GET | `/admin/v1/metrics/difficulty` | all | Win rate vs designed band (requires `gameId`) |
| GET | `/admin/v1/metrics/economy` | all | Hints, coin flow, balances |
| GET | `/admin/v1/metrics/ads` | all | Ads + IAP; ARPDAU pending AdMob reports |
| GET | `/admin/v1/metrics/quality` | all | Ingest accepts/dupes/rejects/opt-outs |
| GET | `/admin/v1/metrics/borrowed-time` | all | Era, buildings, session pacing |
| GET | `/admin/v1/games/:gameId/ads/settings` | owner, support | Network ad enable/frequency/unit ids + per-game house opt-in |
| PUT | `/admin/v1/games/:gameId/ads/settings` | owner, support | Update settings; audited (`ad_settings_update`) |
| GET | `/admin/v1/ads/house` | owner, support | Global switches + registry |
| PUT | `/admin/v1/ads/house/global` | owner (enable); owner/support (kill) | Studio on needs owner; kill switch instant off; audited |
| POST | `/admin/v1/ads/house` | owner, support | Create house ad (own games only; no self-target); audited |
| PATCH | `/admin/v1/ads/house/:id` | owner, support | Update house ad; audited |
| DELETE | `/admin/v1/ads/house/:id` | owner, support | Delete house ad; audited |
| GET | `/admin/v1/audit` | owner, support | |

## Schemas

See `packages/schema/src/*`. One Spark progress is real (mirrors `docs/one-spark-reference`). Loom Rush and Borrowed Time are **draft** (`_draft: true`).
