import { describe, expect, test } from "bun:test";
import {
  ADS_DISABLED_IN_ENVIRONMENT_CODE,
  ADS_DISABLED_IN_ENVIRONMENT_MESSAGE,
} from "@stardust/schema";
import { testConfig } from "../helpers.js";
import { startTestPostgres } from "../pg.js";
import { createAppContext } from "../../src/app-context.js";
import { buildServer } from "../../src/server.js";
import { migrateUp } from "../../src/db/migrator.js";
import { signGenericReward } from "../../src/modules/ads/provider.js";

async function startWithNodeEnv(nodeEnv: "development" | "test" | "production") {
  const pg = await startTestPostgres();
  const config = testConfig(pg.connectionString, { nodeEnv });
  const ctx = createAppContext(config, pg.connectionString);
  await migrateUp(ctx.sql);
  const app = await buildServer(config, ctx);
  return {
    app,
    config,
    async stop() {
      await app.close();
      await ctx.sql.end({ timeout: 5 });
      await pg.stop();
    },
  };
}

describe("ads environment gate", () => {
  for (const nodeEnv of ["development", "test"] as const) {
    test(`${nodeEnv}: client config disables all formats and house offers`, async () => {
      const local = await startWithNodeEnv(nodeEnv);
      try {
        const anon = await local.app.inject({
          method: "POST",
          url: "/v1/accounts/anonymous",
          payload: {
            deviceId: `ads-env-${nodeEnv}`,
            platform: "android",
            consent: { analytics: true, crashReports: false, marketing: false },
          },
        });
        const access = anon.json().accessToken as string;
        const config = await local.app.inject({
          method: "GET",
          url: "/v1/ads/config?gameId=one-spark",
          headers: { authorization: `Bearer ${access}` },
        });
        expect(config.statusCode).toBe(200);
        const body = config.json();
        expect(body.interstitial.enabled).toBe(false);
        expect(body.rewarded.enabled).toBe(false);
        expect(body.houseAds.available).toBe(false);
        expect(body.houseAds.items).toEqual([]);
      } finally {
        await local.stop();
      }
    });

    test(`${nodeEnv}: reward callback and ad telemetry are blocked`, async () => {
      const local = await startWithNodeEnv(nodeEnv);
      try {
        const anon = await local.app.inject({
          method: "POST",
          url: "/v1/accounts/anonymous",
          payload: {
            deviceId: `ads-env-cb-${nodeEnv}`,
            platform: "android",
            consent: { analytics: true, crashReports: false, marketing: false },
          },
        });
        const accountId = anon.json().accountId as string;
        const signedAt = new Date().toISOString();
        const base = {
          transactionId: `txn-${nodeEnv}`,
          accountId,
          gameId: "one-spark" as const,
          reward: { kind: "coins" as const, amount: 3 },
          signedAt,
        };
        const signature = signGenericReward(local.config.AD_PROVIDER_SIGNING_SECRET, base);
        const denied = await local.app.inject({
          method: "POST",
          url: "/v1/ads/reward-callback",
          payload: { ...base, signature },
        });
        expect(denied.statusCode).toBe(403);
        expect(denied.json().error.code).toBe(ADS_DISABLED_IN_ENVIRONMENT_CODE);
        expect(denied.json().error.message).toBe(ADS_DISABLED_IN_ENVIRONMENT_MESSAGE);

        const events = await local.app.inject({
          method: "POST",
          url: "/v1/events",
          payload: {
            consentAnalytics: true,
            events: [
              {
                id: crypto.randomUUID(),
                name: "house_ad_shown",
                ts: new Date().toISOString(),
                gameId: "one-spark",
                props: {
                  houseAdId: "11111111-1111-1111-1111-111111111111",
                  promotedGame: "loom-rush",
                  placement: "level_complete",
                },
              },
            ],
          },
        });
        expect(events.json().rejected).toBe(1);
        expect(events.json().accepted).toBe(0);
      } finally {
        delete process.env.AD_PROVIDER;
        await local.stop();
      }
    });
  }

  test("production: rewarded config can stay enabled when caps allow", async () => {
    const local = await startWithNodeEnv("production");
    try {
      const anon = await local.app.inject({
        method: "POST",
        url: "/v1/accounts/anonymous",
        payload: {
          deviceId: "ads-env-prod",
          platform: "android",
          consent: { analytics: true, crashReports: false, marketing: false },
        },
      });
      const access = anon.json().accessToken as string;
      const config = await local.app.inject({
        method: "GET",
        url: "/v1/ads/config?gameId=one-spark",
        headers: { authorization: `Bearer ${access}` },
      });
      expect(config.statusCode).toBe(200);
      expect(config.json().rewarded.enabled).toBe(true);
      expect(config.json().interstitial.enabled).toBe(true);
    } finally {
      await local.stop();
    }
  });
});
