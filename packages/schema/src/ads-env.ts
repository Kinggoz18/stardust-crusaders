import { z } from "zod";

/** Game clients and admin read this when NODE_ENV is not production. */
export const ADS_DISABLED_IN_ENVIRONMENT_MESSAGE = "Ads disabled in this environment.";

export const ADS_DISABLED_IN_ENVIRONMENT_CODE = "ads_disabled_in_environment";

export function normalizeNodeEnv(nodeEnv: string): string {
  return nodeEnv === "dev" ? "development" : nodeEnv;
}

export function isClientAdsEnabled(nodeEnv: string): boolean {
  const normalized = normalizeNodeEnv(nodeEnv);
  return normalized === "production";
}

export function isAdTelemetryEventName(name: string): boolean {
  return (
    name.startsWith("ad_") ||
    name.startsWith("house_ad_")
  );
}

export const adsAdminEnvironmentSchema = z.object({
  clientAdsEnabled: z.boolean(),
  bannerMessage: z.string().optional(),
});

export type AdsAdminEnvironment = z.infer<typeof adsAdminEnvironmentSchema>;

export function adsAdminEnvironment(nodeEnv: string): AdsAdminEnvironment {
  const enabled = isClientAdsEnabled(nodeEnv);
  if (enabled) {
    return { clientAdsEnabled: true };
  }
  const normalized = normalizeNodeEnv(nodeEnv);
  const bannerMessage =
    normalized === "test"
      ? "Ads are off in test."
      : "Ads are off in development.";
  return { clientAdsEnabled: false, bannerMessage };
}
