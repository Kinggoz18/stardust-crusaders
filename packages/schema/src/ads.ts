import { z } from "zod";
import { gameIdSchema } from "./games/registry.js";

export const adProviderNameSchema = z.enum(["none", "generic", "admob"]);

export const adRewardKindSchema = z.enum(["coins", "booster", "extra_moves", "other"]);

export const adFormatSchema = z.enum(["interstitial", "rewarded"]);

export const adRewardCallbackSchema = z.object({
  transactionId: z.string().min(1).max(128),
  accountId: z.string().uuid(),
  gameId: gameIdSchema,
  reward: z.object({
    kind: adRewardKindSchema,
    amount: z.number().int().positive(),
  }),
  /** Opaque signature from the chosen network — verified by AdProvider. */
  signature: z.string().min(1),
  signedAt: z.string().datetime(),
});

export type AdRewardCallback = z.infer<typeof adRewardCallbackSchema>;

export const adRewardResponseSchema = z.object({
  granted: z.boolean(),
  duplicate: z.boolean(),
  balance: z.number().int().min(0).optional(),
});

/** custom_data JSON the game sets on the rewarded ad before show. */
export const admobCustomDataSchema = z.object({
  accountId: z.string().uuid(),
  gameId: gameIdSchema,
  rewardKind: adRewardKindSchema,
});

export type AdmobCustomData = z.infer<typeof admobCustomDataSchema>;

/**
 * Interstitial pacing by level transitions (not wall-clock time).
 * Client shows only after a win at a natural break; never mid-level;
 * never immediately after a rewarded ad; stop at maxPerSession.
 */
export const adInterstitialConfigSchema = z
  .object({
    minTransitions: z.number().int().positive(),
    maxTransitions: z.number().int().positive(),
    maxPerSession: z.number().int().positive(),
    enabled: z.boolean(),
    /** Server-chosen gap for the next interstitial in this session (inclusive range). */
    nextGap: z.number().int().positive(),
  })
  .refine((v) => v.maxTransitions >= v.minTransitions, {
    message: "maxTransitions must be >= minTransitions",
  })
  .refine((v) => v.nextGap >= v.minTransitions && v.nextGap <= v.maxTransitions, {
    message: "nextGap must fall within min/max transitions",
  });

export const adConfigResponseSchema = z.object({
  provider: adProviderNameSchema,
  gameId: gameIdSchema,
  /** One AdMob unit id per format for this game. No native units. */
  units: z.object({
    interstitial: z.string().min(1),
    rewarded: z.string().min(1),
  }),
  interstitial: adInterstitialConfigSchema,
  rewarded: z.object({
    ssv: z.literal(true),
    kinds: z.array(adRewardKindSchema),
  }),
});

export type AdConfigResponse = z.infer<typeof adConfigResponseSchema>;
export type AdInterstitialConfig = z.infer<typeof adInterstitialConfigSchema>;
