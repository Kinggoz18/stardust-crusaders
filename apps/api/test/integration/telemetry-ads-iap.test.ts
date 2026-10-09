import { describe, expect, test, afterAll } from "bun:test";
import { createHmac } from "node:crypto";
import { startTestApp } from "../helpers.js";
import { signGenericReward } from "../../src/modules/ads/provider.js";

const harness = await startTestApp();
afterAll(() => harness.stop());

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
