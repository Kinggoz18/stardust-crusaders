import { describe, expect, test, afterAll } from "bun:test";
import * as OTPAuth from "otpauth";
import { startTestApp } from "../helpers.js";

const harness = await startTestApp();
afterAll(() => harness.stop());

function totpCode(secret: string) {
  return new OTPAuth.TOTP({
    issuer: "Stardust Crusaders",
    label: "ads@stardust.test",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).generate();
}

async function loginAs(role: "owner" | "support" | "viewer") {
  const staff = await harness.ctx.adminAuth.createStaff({
    email: `${role}-ads-${crypto.randomUUID().slice(0, 6)}@stardust.test`,
    password: "test-password-ok",
    role,
  });
  const login = await harness.app.inject({
    method: "POST",
    url: "/admin/v1/auth/login",
    payload: {
      email: staff.email,
      password: "test-password-ok",
      totpCode: totpCode(staff.totpSecret),
    },
  });
  return login.json().token as string;
}

describe("ad controls", () => {
  test("house ads default off; kill switch; own-games-only; roles; audit", async () => {
    const anon = await harness.app.inject({
      method: "POST",
      url: "/v1/accounts/anonymous",
      payload: {
        deviceId: `ad-ctrl-${crypto.randomUUID().slice(0, 8)}`,
        platform: "android",
        consent: { analytics: true, crashReports: false, marketing: false },
      },
    });
    const access = anon.json().accessToken as string;

    const config = await harness.app.inject({
      method: "GET",
      url: "/v1/ads/config?gameId=one-spark",
      headers: { authorization: `Bearer ${access}` },
    });
    expect(config.statusCode).toBe(200);
    expect(config.json().houseAds.available).toBe(false);
    expect(config.json().houseAds.globalEnabled).toBe(false);
    expect(config.json().houseAds.killSwitch).toBe(false);
    expect(config.json().rewarded.enabled).toBe(true);

    const viewer = await loginAs("viewer");
    const viewerDenied = await harness.app.inject({
      method: "GET",
      url: "/admin/v1/games/one-spark/ads/settings",
      headers: { authorization: `Bearer ${viewer}` },
    });
    expect(viewerDenied.statusCode).toBe(403);

    const support = await loginAs("support");
    const settings = await harness.app.inject({
      method: "GET",
      url: "/admin/v1/games/one-spark/ads/settings",
      headers: { authorization: `Bearer ${support}` },
    });
    expect(settings.statusCode).toBe(200);
    expect(settings.json().interstitial.enabled).toBe(true);

    const put = await harness.app.inject({
      method: "PUT",
      url: "/admin/v1/games/one-spark/ads/settings",
      headers: { authorization: `Bearer ${support}` },
      payload: {
        interstitial: {
          enabled: false,
          minTransitions: 5,
          maxTransitions: 7,
          maxPerSession: 2,
          unitId: "ca-app-pub-test/one-spark-interstitial",
        },
        rewarded: {
          enabled: true,
          maxPerSession: 10,
          unitId: "ca-app-pub-test/one-spark-rewarded",
        },
        houseAdsGameEnabled: true,
      },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().interstitial.enabled).toBe(false);
    expect(put.json().houseAdsGameEnabled).toBe(true);

    const badHouse = await harness.app.inject({
      method: "POST",
      url: "/admin/v1/ads/house",
      headers: { authorization: `Bearer ${support}` },
      payload: {
        promotedGame: "one-spark",
        creativeRef: "bundle://demo",
        targetGames: ["one-spark"],
      },
    });
    expect(badHouse.statusCode).toBe(400);

    const create = await harness.app.inject({
      method: "POST",
      url: "/admin/v1/ads/house",
      headers: { authorization: `Bearer ${support}` },
      payload: {
        promotedGame: "one-spark",
        creativeRef: "bundle://one-spark-playable",
        targetGames: ["loom-rush"],
        enabled: true,
        maxPerSession: 1,
      },
    });
    expect(create.statusCode).toBe(201);
    const houseId = create.json().id as string;

    // Still unavailable: global off
    const stillOff = await harness.app.inject({
      method: "GET",
      url: "/v1/ads/config?gameId=loom-rush",
      headers: { authorization: `Bearer ${access}` },
    });
    expect(stillOff.json().houseAds.available).toBe(false);

    const supportEnable = await harness.app.inject({
      method: "PUT",
      url: "/admin/v1/ads/house/global",
      headers: { authorization: `Bearer ${support}` },
      payload: { enabled: true },
    });
    expect(supportEnable.statusCode).toBe(403);

    const owner = await loginAs("owner");
    const enable = await harness.app.inject({
      method: "PUT",
      url: "/admin/v1/ads/house/global",
      headers: { authorization: `Bearer ${owner}` },
      payload: { enabled: true },
    });
    expect(enable.statusCode).toBe(200);
    expect(enable.json().global.enabled).toBe(true);

    // loom-rush game house flag still false by default
    await harness.app.inject({
      method: "PUT",
      url: "/admin/v1/games/loom-rush/ads/settings",
      headers: { authorization: `Bearer ${support}` },
      payload: {
        interstitial: {
          enabled: true,
          minTransitions: 4,
          maxTransitions: 6,
          maxPerSession: 3,
          unitId: "ca-app-pub-test/loom-rush-interstitial",
        },
        rewarded: {
          enabled: true,
          maxPerSession: 20,
          unitId: "ca-app-pub-test/loom-rush-rewarded",
        },
        houseAdsGameEnabled: true,
      },
    });

    const on = await harness.app.inject({
      method: "GET",
      url: "/v1/ads/config?gameId=loom-rush",
      headers: { authorization: `Bearer ${access}` },
    });
    expect(on.json().houseAds.available).toBe(true);
    expect(on.json().houseAds.items.some((i: { id: string }) => i.id === houseId)).toBe(true);
    // never self-promote into one-spark
    expect(on.json().houseAds.items.every((i: { promotedGame: string }) => i.promotedGame !== "loom-rush")).toBe(
      true,
    );

    const kill = await harness.app.inject({
      method: "PUT",
      url: "/admin/v1/ads/house/global",
      headers: { authorization: `Bearer ${support}` },
      payload: { killSwitch: true },
    });
    expect(kill.statusCode).toBe(200);
    expect(kill.json().global.killSwitch).toBe(true);

    const killed = await harness.app.inject({
      method: "GET",
      url: "/v1/ads/config?gameId=loom-rush",
      headers: { authorization: `Bearer ${access}` },
    });
    expect(killed.json().houseAds.available).toBe(false);
    expect(killed.json().houseAds.killSwitch).toBe(true);
    expect(killed.json().houseAds.items).toEqual([]);

    const audit = await harness.app.inject({
      method: "GET",
      url: "/admin/v1/audit",
      headers: { authorization: `Bearer ${owner}` },
    });
    const actions = audit.json().entries.map((e: { action: string }) => e.action);
    expect(actions).toContain("ad_settings_update");
    expect(actions).toContain("house_ad_create");
    expect(actions).toContain("house_ads_global_update");
  });
});
