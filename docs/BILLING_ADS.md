# Google Play Billing and AdMob for One Spark, Loom Rush and Borrowed Time

Research notes, 12 Oct 2026. These are the choices all three games and this backend follow.

## Libraries

| Need | Choice | Why |
|---|---|---|
| Ads | `@capacitor-community/admob` 8.x | Rewarded, interstitial, UMP consent and server-side verification (SSV) options in one plugin |
| Purchases | `cordova-plugin-purchase` 13.x (`CdvPurchase.store`) | Talks to Play Billing directly and posts every receipt to our own validator URL. No third party in the money path |
| Not chosen | `@revenuecat/purchases-capacitor` | Needs Capacitor 8+, and we already run our own backend. The RevenueCat webhook stays in place in case we switch later |

## Ads

- Use Google's test units by default: rewarded `ca-app-pub-3940256099942544/5224354917`, interstitial `ca-app-pub-3940256099942544/1033173712`, test app id `ca-app-pub-3940256099942544~3347511713`.
- Real IDs live only in each game's `.env` (`VITE_ADMOB_APP_ID`, `VITE_ADMOB_REWARDED_ID`, `VITE_ADMOB_INTERSTITIAL_ID`). Only `.env.example` is committed.
- `VITE_ADS=off|stub|admob`. `stub` shows an in-game fake ad, for web and tests. `admob` needs the native project, which Chigozie generates himself.
- Ask for consent first (UMP: `requestConsentInfo` and then `showConsentForm` when required). Pass `npa` when there's no consent.
- Rewarded ads send SSV `customData = JSON {accountId, gameId, rewardKind}` and `userId = accountId`. That matches the existing `/v1/ads` AdMob SSV verifier in this repo.
- Rules:
  - **Borrowed Time:** rewarded only, never interstitials.
  - **One Spark and Loom Rush:** rewarded, plus an interstitial after a *win* every 4–6 level transitions (random in that range, re-rolled after each show). At most 3 per session, none in the first 2 levels, never after a loss, and none when "No ads" is owned.
- "No ads" removes interstitials only. Rewarded ads stay available because the player chooses them.

## Purchases

- Products are one-time items: the no-ads item is non-consumable, and currency packs are consumable. The product IDs come from `.env` (`VITE_IAP_PRODUCTS`, a list of `id:type` pairs) because Play Console IDs are set by Chigozie.
- Flow: `store.register` → `store.initialize([Platform.GOOGLE_PLAY])` → `order()`, then `approved` → `verify()`. The backend checks the purchase, and then `verified` → `finish()` (which consumes consumables).
- `store.validator = ${VITE_API_BASE}/v1/iap/google/verify?game=<gameId>`. `applicationUsername` = the account id, sent as `obfuscatedAccountId`.

## Server-side verification (this repo)

- `POST /v1/iap/google/verify?game=...` takes the cordova-plugin-purchase validator body.
- It calls `GET androidpublisher/v3/applications/{package}/purchases/productsv2/tokens/{token}` with a service-account token (`androidpublisher` scope).
- It checks that `purchaseStateContext.purchaseState == PURCHASED`, that the product id matches, and that `obfuscatedExternalAccountId` matches the account. In `sandbox` mode it also requires `testPurchaseContext`.
- It records `gp:<sha256(token)>` in `iap_webhook_events` (idempotent), acknowledges the purchase if needed, and returns `{ok:true,data:{...}}`. Pending purchases return code 6778004, so the store retries.
- Env: `GOOGLE_PLAY_VERIFY` (off/sandbox/live), `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `GOOGLE_PLAY_PACKAGES`.
- Later: RTDN (`OneTimeProductNotification`) through Pub/Sub, for refunds.

## Chigozie supplies

1. Play Console product IDs for each game.
2. AdMob app id, plus rewarded and interstitial unit ids, for each game.
3. A service-account JSON, invited in Play Console with financial and order access.
4. Final Android package names.
