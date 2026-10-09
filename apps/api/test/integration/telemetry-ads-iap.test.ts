import { describe, expect, test, afterAll } from "bun:test";
import { createHmac } from "node:crypto";
import { startTestApp, testConfig } from "../helpers.js";
import { startTestPostgres } from "../pg.js";
import { createAppContextWithAds } from "../../src/app-context.js";
import { buildServer } from "../../src/server.js";
import { migrateUp } from "../../src/db/migrator.js";
import {
  AdMobProvider,
  createTestAdMobSigner,
  signGenericReward,
} from "../../src/modules/ads/provider.js";

const harness = await startTestApp();
afterAll(() => harness.stop());

async function startAdMobApp() {
  const pg = await startTestPostgres();
  const config = testConfig(pg.connectionString);
  const signer = createTestAdMobSigner(1916455855);
  const provider = new AdMobProvider({ keyCache: signer.cache, maxAgeMs: 3_600_000 });
  const ctx = createAppContextWithAds(
    { ...config, AD_PROVIDER: "admob" },
    pg.connectionString,
    provider,
  );
  await migrateUp(ctx.sql);
  const app = await buildServer({ ...config, AD_PROVIDER: "admob" }, ctx);
  return {
    app,
    ctx,
    signer,
    async stop() {
      await app.close();
      await ctx.sql.end({ timeout: 5 });
      await pg.stop();
    },
  };
}

async function createAccount(deviceId: string) {
  const res = await harness.app.inject({
    method: "POST",
    url: "/v1/accounts/anonymous",
    payload: {
      deviceId,
      platform: "android",
      consent: { analytics: true, crashReports: false, marketing: false },
    },
  });
  return res.json() as { accountId: string; accessToken: string };
}

describe("telemetry", () => {
  test("events batch dedupes by id and respects consent", async () => {
    const event = {
      id: "22222222-2222-2222-2222-222222222222",
      name: "session_start",
      ts: new Date().toISOString(),
      props: { v: 1 },
    };
    const first = await harness.app.inject({
      method: "POST",
      url: "/v1/events",
      payload: { consentAnalytics: true, events: [event] },
    });
    expect(first.statusCode).toBe(202);
    expect(first.json().accepted).toBe(1);

    const second = await harness.app.inject({
      method: "POST",
      url: "/v1/events",
      payload: { consentAnalytics: true, events: [event] },
    });
    expect(second.json().duplicates).toBe(1);

    const noConsent = await harness.app.inject({
      method: "POST",
      url: "/v1/events",
      payload: {
        consentAnalytics: false,
        events: [
          {
            id: "33333333-3333-3333-3333-333333333333",
            name: "session_end",
            ts: new Date().toISOString(),
            props: {},
          },
        ],
      },
    });
    expect(noConsent.json().rejected).toBe(1);
  });
});

describe("ads", () => {
  test("none provider rejects callbacks", async () => {
    const account = await createAccount("ad-device-none");
    const signedAt = new Date().toISOString();
    const base = {
      transactionId: "txn-ad-none",
      accountId: account.accountId,
      gameId: "one-spark" as const,
      reward: { kind: "coins" as const, amount: 7 },
      signedAt,
    };
    const signature = signGenericReward(harness.config.AD_PROVIDER_SIGNING_SECRET, base);
    const denied = await harness.app.inject({
      method: "POST",
      url: "/v1/ads/reward-callback",
      payload: { ...base, signature },
    });
    expect(denied.statusCode).toBe(401);
  });

  test("generic provider grants once and replays safely", async () => {
    process.env.AD_PROVIDER = "generic";
    const local = await startTestApp();
    try {
      const created = await local.app.inject({
        method: "POST",
        url: "/v1/accounts/anonymous",
        payload: {
          deviceId: "ad-device-generic",
          platform: "android",
          consent: { analytics: false, crashReports: false, marketing: false },
        },
      });
      const accountId = created.json().accountId as string;
      const signedAt = new Date().toISOString();
      const base = {
        transactionId: "txn-ad-1",
        accountId,
        gameId: "one-spark" as const,
        reward: { kind: "coins" as const, amount: 7 },
        signedAt,
      };
      const signature = signGenericReward(local.config.AD_PROVIDER_SIGNING_SECRET, base);
      const first = await local.app.inject({
        method: "POST",
        url: "/v1/ads/reward-callback",
        payload: { ...base, signature },
      });
      expect(first.statusCode).toBe(201);
      expect(first.json().granted).toBe(true);
      expect(first.json().balance).toBe(7);

      const second = await local.app.inject({
        method: "POST",
        url: "/v1/ads/reward-callback",
        payload: { ...base, signature },
      });
      expect(second.statusCode).toBe(200);
      expect(second.json().duplicate).toBe(true);
      expect(second.json().balance).toBe(7);
    } finally {
      delete process.env.AD_PROVIDER;
      await local.stop();
    }
  });

  test("admob SSV: valid, tampered, expired key, replay, wrong account", async () => {
    const local = await startAdMobApp();
    try {
      const created = await local.app.inject({
        method: "POST",
        url: "/v1/accounts/anonymous",
        payload: {
          deviceId: "ad-device-admob",
          platform: "android",
          consent: { analytics: false, crashReports: false, marketing: false },
        },
      });
      const accountId = created.json().accountId as string;
      const accessToken = created.json().accessToken as string;
      const other = await local.app.inject({
        method: "POST",
        url: "/v1/accounts/anonymous",
        payload: {
          deviceId: "ad-device-admob-other",
          platform: "android",
          consent: { analytics: false, crashReports: false, marketing: false },
        },
      });
      const otherId = other.json().accountId as string;

      const custom = encodeURIComponent(
        JSON.stringify({ accountId, gameId: "one-spark", rewardKind: "coins" }),
      );
      const baseParams = {
        ad_network: "5450213213286189855",
        ad_unit: "2747237135",
        custom_data: custom,
        reward_amount: "7",
        reward_item: "coins",
        timestamp: String(Date.now()),
        transaction_id: "18fa792de1bca816048293fc71035638",
        user_id: accountId,
      };
      const validQ = local.signer.signQuery(baseParams);
      const first = await local.app.inject({
        method: "GET",
        url: `/v1/ads/reward-callback?${validQ}`,
      });
      expect(first.statusCode).toBe(201);
      expect(first.json().granted).toBe(true);
      expect(first.json().balance).toBe(7);

      const replay = await local.app.inject({
        method: "GET",
        url: `/v1/ads/reward-callback?${validQ}`,
      });
      expect(replay.statusCode).toBe(200);
      expect(replay.json().duplicate).toBe(true);
      expect(replay.json().balance).toBe(7);

      const tampered = validQ.replace("reward_amount=7", "reward_amount=70");
      const badSig = await local.app.inject({
        method: "GET",
        url: `/v1/ads/reward-callback?${tampered}`,
      });
      expect(badSig.statusCode).toBe(401);

      // Expired key: publisher rotates away our keyId.
      local.signer.publishKeys([]);
      const expiredKey = await local.app.inject({
        method: "GET",
        url: `/v1/ads/reward-callback?${validQ}`,
      });
      expect(expiredKey.statusCode).toBe(401);
      local.signer.publishKeys([{ keyId: local.signer.keyId, pem: local.signer.pem }]);

      const wrongCustom = encodeURIComponent(
        JSON.stringify({ accountId: otherId, gameId: "one-spark", rewardKind: "coins" }),
      );
      const wrongQ = local.signer.signQuery({
        ...baseParams,
        custom_data: wrongCustom,
        user_id: accountId,
        transaction_id: "18fa792de1bca816048293fc71035639",
        timestamp: String(Date.now()),
      });
      const wrongAccount = await local.app.inject({
        method: "GET",
        url: `/v1/ads/reward-callback?${wrongQ}`,
      });
      expect(wrongAccount.statusCode).toBe(401);

      const cfg = await local.app.inject({
        method: "GET",
        url: "/v1/ads/config?gameId=one-spark",
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(cfg.statusCode).toBe(200);
      expect(cfg.json().provider).toBe("admob");
      expect(cfg.json().placements.interstitial.maxPerHour).toBeGreaterThan(0);
      expect(cfg.json().placements.rewarded.ssv).toBe(true);
    } finally {
      await local.stop();
    }
  });
});

describe("revenuecat webhook", () => {
  test("verifies signature and is idempotent on replay", async () => {
    const payload = {
      event: {
        id: "rc_evt_1",
        type: "INITIAL_PURCHASE",
        app_user_id: "user-1",
        product_id: "coins_100",
        environment: "SANDBOX",
      },
    };
    const raw = JSON.stringify(payload);
    const sig = createHmac("sha256", harness.config.REVENUECAT_WEBHOOK_SECRET)
      .update(raw)
      .digest("hex");

    const first = await harness.app.inject({
      method: "POST",
      url: "/v1/webhooks/revenuecat",
      headers: {
        "content-type": "application/json",
        "x-revenuecat-signature": sig,
      },
      payload: raw,
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().duplicate).toBe(false);

    const second = await harness.app.inject({
      method: "POST",
      url: "/v1/webhooks/revenuecat",
      headers: {
        "content-type": "application/json",
        "x-revenuecat-signature": sig,
      },
      payload: raw,
    });
    expect(second.json().duplicate).toBe(true);

    const bad = await harness.app.inject({
      method: "POST",
      url: "/v1/webhooks/revenuecat",
      headers: {
        "content-type": "application/json",
        "x-revenuecat-signature": "deadbeef",
      },
      payload: raw,
    });
    expect(bad.statusCode).toBe(401);
  });
});
