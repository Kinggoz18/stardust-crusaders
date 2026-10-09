import { z } from "zod";
import { gameIdSchema, GAME_IDS } from "./games/registry.js";

export const adProviderNameSchema = z.enum(["none", "generic", "admob"]);

export const adRewardKindSchema = z.enum(["coins", "booster", "extra_moves", "other"]);

export const adFormatSchema = z.enum(["interstitial", "rewarded", "house"]);

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

export const houseAdOfferSchema = z.object({
  id: z.string().uuid(),
  promotedGame: gameIdSchema,
  creativeRef: z.string().min(1).max(256),
  maxPerSession: z.number().int().positive(),
});

export const houseAdsClientConfigSchema = z.object({
  /** Effective: global on, kill switch off, and this game opted in. */
  available: z.boolean(),
  killSwitch: z.boolean(),
  globalEnabled: z.boolean(),
  gameEnabled: z.boolean(),
  /** Always true — clients must honour these. */
  rules: z.object({
    naturalBreakOnly: z.literal(true),
    neverAfterOtherAd: z.literal(true),
    requiresConsent: z.literal(true),
    neverSelfPromote: z.literal(true),
  }),
  items: z.array(houseAdOfferSchema),
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
    enabled: z.boolean(),
    maxPerSession: z.number().int().positive(),
  }),
  houseAds: houseAdsClientConfigSchema,
});

export type AdConfigResponse = z.infer<typeof adConfigResponseSchema>;
export type AdInterstitialConfig = z.infer<typeof adInterstitialConfigSchema>;

/** Admin: per-game network ad settings (owner/support). */
export const adminGameAdsSettingsSchema = z.object({
  gameId: gameIdSchema,
  interstitial: z.object({
    enabled: z.boolean(),
    minTransitions: z.number().int().positive(),
    maxTransitions: z.number().int().positive(),
    maxPerSession: z.number().int().positive(),
    unitId: z.string().min(1).max(128),
  }),
  rewarded: z.object({
    enabled: z.boolean(),
    maxPerSession: z.number().int().positive(),
    unitId: z.string().min(1).max(128),
  }),
  houseAdsGameEnabled: z.boolean(),
});

export const adminGameAdsSettingsUpdateSchema = z
  .object({
    interstitial: z
      .object({
        enabled: z.boolean(),
        minTransitions: z.number().int().positive(),
        maxTransitions: z.number().int().positive(),
        maxPerSession: z.number().int().positive(),
        unitId: z.string().min(1).max(128),
      })
      .refine((v) => v.maxTransitions >= v.minTransitions, {
        message: "maxTransitions must be >= minTransitions",
      }),
    rewarded: z.object({
      enabled: z.boolean(),
      maxPerSession: z.number().int().positive(),
      unitId: z.string().min(1).max(128),
    }),
    houseAdsGameEnabled: z.boolean().optional(),
  })
  .strict();

export const houseAdRecordSchema = z.object({
  id: z.string().uuid(),
  promotedGame: gameIdSchema,
  creativeRef: z.string().min(1).max(256),
  targetGames: z.array(gameIdSchema).min(1),
  platform: z.enum(["android", "ios"]).nullable(),
  enabled: z.boolean(),
  maxPerSession: z.number().int().positive(),
  startsAt: z.string().datetime().nullable(),
  endsAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const houseAdFieldsSchema = z.object({
  promotedGame: gameIdSchema,
  creativeRef: z.string().min(1).max(256),
  targetGames: z.array(gameIdSchema).min(1),
  platform: z.enum(["android", "ios"]).nullable().optional(),
  enabled: z.boolean().optional(),
  maxPerSession: z.number().int().positive().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

function refineHouseAdTargets(
  val: { promotedGame?: z.infer<typeof gameIdSchema>; targetGames?: z.infer<typeof gameIdSchema>[] },
  ctx: z.RefinementCtx,
) {
  if (!val.targetGames || !val.promotedGame) return;
  for (const g of val.targetGames) {
    if (!GAME_IDS.includes(g)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Target must be one of our games.",
        path: ["targetGames"],
      });
    }
    if (g === val.promotedGame) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A game never shows a house ad for itself.",
        path: ["targetGames"],
      });
    }
  }
}

export const houseAdCreateSchema = houseAdFieldsSchema.superRefine(refineHouseAdTargets);

export const houseAdUpdateSchema = houseAdFieldsSchema.partial().strict().superRefine(refineHouseAdTargets);

export const houseAdsGlobalSchema = z.object({
  enabled: z.boolean(),
  killSwitch: z.boolean(),
  updatedAt: z.string().datetime(),
});

export const houseAdsGlobalUpdateSchema = z
  .object({
    /** Owner-only: turn house ads on studio-wide (requires confirm in admin). */
    enabled: z.boolean().optional(),
    /** Instant off for all games. */
    killSwitch: z.boolean().optional(),
  })
  .refine((v) => v.enabled !== undefined || v.killSwitch !== undefined, {
    message: "Provide enabled and/or killSwitch.",
  });

export const houseAdsAdminListSchema = z.object({
  global: houseAdsGlobalSchema,
  games: z.array(z.object({ gameId: gameIdSchema, enabled: z.boolean() })),
  items: z.array(houseAdRecordSchema),
});
