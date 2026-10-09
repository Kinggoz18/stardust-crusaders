import { z } from "zod";
import { gameIdSchema } from "./games/registry.js";

export const adProviderNameSchema = z.enum(["none", "generic", "admob"]);

export const adRewardKindSchema = z.enum(["coins", "booster", "extra_moves", "other"]);

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

export const adFrequencyCapSchema = z.object({
  maxPerHour: z.number().int().positive(),
  maxPerDay: z.number().int().positive(),
  minIntervalSeconds: z.number().int().min(0),
});

export const adConfigResponseSchema = z.object({
  provider: adProviderNameSchema,
  /** Native ads are out of scope. */
  placements: z.object({
    interstitial: adFrequencyCapSchema,
    rewarded: z.object({
      ssv: z.literal(true),
      kinds: z.array(adRewardKindSchema),
    }),
  }),
});

export type AdConfigResponse = z.infer<typeof adConfigResponseSchema>;
