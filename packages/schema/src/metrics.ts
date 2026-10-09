import { z } from "zod";
import { gameIdSchema } from "./games/registry.js";

export const metricsFilterSchema = z.object({
  gameId: gameIdSchema.optional(),
  platform: z.enum(["android", "ios"]).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const metricsOverviewSchema = z.object({
  newAccounts: z.number().int().min(0),
  dau: z.number().int().min(0),
  wau: z.number().int().min(0),
  mau: z.number().int().min(0),
  stickiness: z.number().min(0).max(1).nullable(),
  sessions: z.number().int().min(0),
  avgSessionSec: z.number().min(0).nullable(),
  retention: z.object({
    d1: z.number().min(0).max(1).nullable(),
    d7: z.number().min(0).max(1).nullable(),
    d30: z.number().min(0).max(1).nullable(),
  }),
  series: z.array(
    z.object({
      day: z.string(),
      dau: z.number().int().min(0),
      newAccounts: z.number().int().min(0),
      sessions: z.number().int().min(0),
    }),
  ),
});

export const metricsRetentionSchema = z.object({
  cohorts: z.array(
    z.object({
      cohortDay: z.string(),
      cohortSize: z.number().int().min(0),
      d1: z.number().min(0).max(1).nullable(),
      d7: z.number().min(0).max(1).nullable(),
      d30: z.number().min(0).max(1).nullable(),
    }),
  ),
});

export const metricsFunnelSchema = z.object({
  gameId: gameIdSchema,
  levels: z.array(
    z.object({
      level: z.number().int().positive(),
      starts: z.number().int().min(0),
      wins: z.number().int().min(0),
      fails: z.number().int().min(0),
      quits: z.number().int().min(0),
      avgMovesLeft: z.number().nullable(),
      stars: z.object({
        s0: z.number().int().min(0),
        s1: z.number().int().min(0),
        s2: z.number().int().min(0),
        s3: z.number().int().min(0),
      }),
    }),
  ),
});

export const metricsDifficultySchema = z.object({
  gameId: gameIdSchema,
  levels: z.array(
    z.object({
      level: z.number().int().positive(),
      starts: z.number().int().min(0),
      wins: z.number().int().min(0),
      winRate: z.number().min(0).max(1).nullable(),
      bandMin: z.number().min(0).max(1).nullable(),
      bandMax: z.number().min(0).max(1).nullable(),
      inBand: z.boolean().nullable(),
    }),
  ),
});

export const metricsEconomySchema = z.object({
  hintsCoins: z.number().int().min(0),
  hintsAds: z.number().int().min(0),
  coinIn: z.number().int().min(0),
  coinOut: z.number().int().min(0),
  balanceBuckets: z.array(z.object({ bucket: z.string(), accounts: z.number().int().min(0) })),
  byReason: z.array(z.object({ reason: z.string(), deltaSum: z.number().int() })),
});

export const metricsAdsSchema = z.object({
  rewardedOffers: z.number().int().min(0),
  rewardedStarts: z.number().int().min(0),
  rewardedCompletions: z.number().int().min(0),
  completionRate: z.number().min(0).max(1).nullable(),
  rewardsGranted: z.number().int().min(0),
  rewardRatePerUser: z.number().min(0).nullable(),
  interstitialImpressions: z.number().int().min(0),
  interstitialPerSession: z.number().min(0).nullable(),
  arpdau: z.number().min(0).nullable(),
  arpdauPending: z.boolean(),
  iapPurchasers: z.number().int().min(0),
  iapRevenueCents: z.number().int().min(0),
  payerShare: z.number().min(0).max(1).nullable(),
  medianHoursToFirstPurchase: z.number().min(0).nullable(),
});

export const metricsQualitySchema = z.object({
  accepted: z.number().int().min(0),
  duplicates: z.number().int().min(0),
  rejected: z.number().int().min(0),
  consentOptOuts: z.number().int().min(0),
  dedupeRate: z.number().min(0).max(1).nullable(),
  series: z.array(
    z.object({
      day: z.string(),
      accepted: z.number().int().min(0),
      duplicates: z.number().int().min(0),
      rejected: z.number().int().min(0),
      consentOptOuts: z.number().int().min(0),
    }),
  ),
});

export const metricsBorrowedTimeSchema = z.object({
  eras: z.array(
    z.object({
      era: z.string(),
      reachers: z.number().int().min(0),
      avgDebt: z.number().nullable(),
      avgBuildings: z.number().nullable(),
    }),
  ),
  buildingsPlaced: z.number().int().min(0),
  avgSessionSec: z.number().min(0).nullable(),
  sessions: z.number().int().min(0),
});

export const metricsLegacySummarySchema = z.object({
  newAccounts24h: z.number().int().min(0),
  dau: z.number().int().min(0),
  wau: z.number().int().min(0),
  mau: z.number().int().min(0).optional(),
  retention: z.object({
    d1: z.number().min(0).max(1).nullable(),
    d7: z.number().min(0).max(1).nullable(),
    d30: z.number().min(0).max(1).nullable().optional(),
  }),
  asOf: z.string().optional(),
});
