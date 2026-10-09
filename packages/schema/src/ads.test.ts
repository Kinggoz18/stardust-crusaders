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
      rewarded: { ssv: true, kinds: ["coins"] },
    });
    expect(parsed.units.interstitial).toContain("loom-rush");
    expect(parsed.gameId).toBe("loom-rush");
  });
});
