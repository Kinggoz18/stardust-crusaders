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
| POST | `/v1/ads/reward-callback` | signature | `adRewardCallbackSchema` |
| POST | `/v1/webhooks/revenuecat` | HMAC header | sandbox stub; idempotent by event id |

`gameId`: `one-spark` \| `loom-rush` \| `borrowed-time`.

## Admin (`/admin/v1/*`)

Requires staff session (cookie `stardust_staff` or `Authorization: Bearer`). In production, Pages proxy must send `x-admin-proxy-token`.

| Method | Path | Roles | Notes |
| --- | --- | --- | --- |
| POST | `/admin/v1/auth/login` | — | email + password + TOTP |
| POST | `/admin/v1/auth/logout` | staff | |
| GET | `/admin/v1/accounts?q=&cursor=` | all | search; audited |
| GET | `/admin/v1/accounts/:id` | all | detail + progress; audited |
| GET | `/admin/v1/accounts/:id/wallet` | all | audited |
| GET | `/admin/v1/accounts/:id/events` | all | audited |
| POST | `/admin/v1/accounts/:id/ban` | owner, support | audited |
| POST | `/admin/v1/accounts/:id/unban` | owner, support | audited |
| POST | `/admin/v1/accounts/:id/games/:gameId/reset` | owner | backup row; audited |
| GET | `/admin/v1/games` | all | registry |
| GET | `/admin/v1/metrics` | all | DAU/WAU stub retention |
| GET | `/admin/v1/audit` | owner, support | |

## Schemas

See `packages/schema/src/*`. One Spark progress is real (mirrors `docs/one-spark-reference`). Loom Rush and Borrowed Time are **draft** (`_draft: true`).
