# Security

Threat model and controls for the Stardust Crusaders platform. OWASP Top 10:2025 mindset: a finding counts with a failing test.

## Assets

- Player accounts, progress, wallet ledger, telemetry
- Staff credentials and TOTP secrets
- Webhook signing secrets (RevenueCat, ad callbacks)
- Admin proxy token (Pages → API)

## Trust boundaries

1. **Game client → API:** untrusted. Validate every payload with zod. Never trust client coins or progress without sanity checks / ledger.
2. **Pages Function → API:** trusted only with `x-admin-proxy-token`. Browser never holds that secret.
3. **Webhooks → API:** trusted only after HMAC verification; fail closed.
4. **Staff browser → Pages:** session cookie HttpOnly/Secure/SameSite=Strict; CSRF header on mutating calls.

## Controls by theme

| Theme | Control |
| --- | --- |
| Broken access control | Player JWT `sub` ownership; staff roles (`owner`/`support`/`viewer`); audit on personal data reads |
| Injection | Parameterised SQL (Drizzle/postgres); zod on all bodies |
| Auth failures | Short-lived access tokens; refresh rotation; mandatory TOTP for staff; rate limits |
| Integrity | Idempotency keys; revision checks; webhook event id uniqueness |
| Cryptographic failures | argon2id (Bun.password); HMAC SHA-256 for webhooks/generic ads; AdMob SSV ECDSA P-256 against Google's public keys; secrets only via env |
| Misconfiguration | `.env.example` names only; security headers (helmet); CORS allowlist |
| Logging | No secrets or full webhook PII in logs; structured Fastify logs |

## Payments

Sandbox only. RevenueCat webhook stub verifies signature and ignores `PRODUCTION` environment for fulfillment. Test keys only.

## NDPA 2023 / GDPR

Consent flags are explicit booleans (no pre-ticked server defaults). Account export and delete endpoints exist. Admin reads of personal data are audited.

## Dependency audit

`bun run ci` should include `bun pm` / audit as the toolchain allows; GitHub Dependabot recommended on the repo.
