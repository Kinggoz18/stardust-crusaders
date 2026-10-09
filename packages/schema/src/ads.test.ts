import { describe, expect, test } from "bun:test";
import { adConfigResponseSchema, adInterstitialConfigSchema } from "./ads.js";

describe("ad interstitial config", () => {
  test("accepts transition-based interstitial pacing", () => {
    const interstitial = adInterstitialConfigSchema.parse({
      minTransitions: 4,
      maxTransitions: 6,
      maxPerSession: 3,
      enabled: true,
      nextGap: 5,
    });
    expect(interstitial.nextGap).toBe(5);
  });

  test("rejects nextGap outside min/max", () => {
    expect(() =>
      adInterstitialConfigSchema.parse({
        minTransitions: 4,
        maxTransitions: 6,
        maxPerSession: 3,
        enabled: true,
        nextGap: 2,
      }),
    ).toThrow();
  });

  test("config response requires per-game units for interstitial and rewarded", () => {
    const parsed = adConfigResponseSchema.parse({
      provider: "admob",
      gameId: "loom-rush",
      units: {
        interstitial: "ca-app-pub-test/loom-rush-interstitial",
        rewarded: "ca-app-pub-test/loom-rush-rewarded",
      },
      interstitial: {
        minTransitions: 4,
        maxTransitions: 6,
        maxPerSession: 3,
        enabled: true,
        nextGap: 4,
      },
      rewarded: { ssv: true, kinds: ["coins"], enabled: true, maxPerSession: 20 },
      houseAds: {
        available: false,
        killSwitch: false,
        globalEnabled: false,
        gameEnabled: false,
        rules: {
          naturalBreakOnly: true,
          neverAfterOtherAd: true,
          requiresConsent: true,
          neverSelfPromote: true,
        },
        items: [],
      },
    });
    expect(parsed.units.interstitial).toContain("loom-rush");
    expect(parsed.gameId).toBe("loom-rush");
    expect(parsed.houseAds.available).toBe(false);
  });
});

describe("house ad create", () => {
  test("rejects self-promotion target", async () => {
    const { houseAdCreateSchema } = await import("./ads.js");
    expect(() =>
      houseAdCreateSchema.parse({
        promotedGame: "one-spark",
        creativeRef: "bundle://one-spark-demo",
        targetGames: ["one-spark", "loom-rush"],
      }),
    ).toThrow(/never shows a house ad for itself/);
  });

  test("accepts own-game targets only", async () => {
    const { houseAdCreateSchema } = await import("./ads.js");
    const row = houseAdCreateSchema.parse({
      promotedGame: "one-spark",
      creativeRef: "bundle://one-spark-demo",
      targetGames: ["loom-rush", "borrowed-time"],
    });
    expect(row.targetGames).toHaveLength(2);
  });

  test("rejects promoted game outside our catalogue", async () => {
    const { houseAdCreateSchema } = await import("./ads.js");
    expect(() =>
      houseAdCreateSchema.parse({
        promotedGame: "third-party-puzzle",
        creativeRef: "bundle://x",
        targetGames: ["loom-rush"],
      }),
    ).toThrow();
  });
});
