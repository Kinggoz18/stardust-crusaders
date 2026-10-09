import { describe, expect, test } from "bun:test";
import {
  adsAdminEnvironment,
  isAdTelemetryEventName,
  isClientAdsEnabled,
  normalizeNodeEnv,
} from "./ads-env.js";

describe("ads environment helpers", () => {
  test("treats dev like development", () => {
    expect(normalizeNodeEnv("dev")).toBe("development");
    expect(isClientAdsEnabled("dev")).toBe(false);
  });

  test("only production serves client ads", () => {
    expect(isClientAdsEnabled("development")).toBe(false);
    expect(isClientAdsEnabled("test")).toBe(false);
    expect(isClientAdsEnabled("production")).toBe(true);
  });

  test("flags ad and house telemetry names", () => {
    expect(isAdTelemetryEventName("ad_rewarded_complete")).toBe(true);
    expect(isAdTelemetryEventName("house_ad_clicked")).toBe(true);
    expect(isAdTelemetryEventName("session_start")).toBe(false);
  });

  test("admin banner copy", () => {
    expect(adsAdminEnvironment("production").clientAdsEnabled).toBe(true);
    expect(adsAdminEnvironment("development").bannerMessage).toBe("Ads are off in development.");
    expect(adsAdminEnvironment("test").bannerMessage).toBe("Ads are off in test.");
  });
});
