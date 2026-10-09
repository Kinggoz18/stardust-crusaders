import { z } from "zod";
import { gameIdSchema } from "./games/registry.js";
import { adRewardKindSchema } from "./ads.js";

const platformSchema = z.enum(["android", "ios"]);

export const sessionStartPropsSchema = z.object({
  platform: platformSchema.optional(),
});

export const sessionEndPropsSchema = z.object({
  durationSec: z.number().int().min(0),
});

export const levelStartPropsSchema = z.object({
  level: z.number().int().positive(),
  attempt: z.number().int().positive().optional(),
});

export const levelClearPropsSchema = z.object({
  level: z.number().int().positive(),
  stars: z.number().int().min(0).max(3).optional(),
  movesLeft: z.number().int().min(0).optional(),
  attempt: z.number().int().positive().optional(),
});

export const levelFailPropsSchema = z.object({
  level: z.number().int().positive(),
  reason: z.string().max(64).optional(),
  attempt: z.number().int().positive().optional(),
});

export const quitPointPropsSchema = z.object({
  level: z.number().int().positive().optional(),
  screen: z.string().max(64).optional(),
});

export const hintUsedPropsSchema = z.object({
  level: z.number().int().positive().optional(),
  source: z.enum(["coins", "ad"]),
});

export const coinEarnPropsSchema = z.object({
  amount: z.number().int().positive(),
  source: z.string().min(1).max(64),
});

export const coinSpendPropsSchema = z.object({
  amount: z.number().int().positive(),
  sink: z.string().min(1).max(64),
});

export const adPlacementPropsSchema = z.object({
  placement: z.string().max(64).optional(),
});

export const adRewardedCompletePropsSchema = z.object({
  placement: z.string().max(64).optional(),
  rewardKind: adRewardKindSchema.optional(),
});

export const iapOfferSeenPropsSchema = z.object({
  productId: z.string().min(1).max(128),
});

export const tierReachedPropsSchema = z.object({
  era: z.string().min(1).max(64),
  debt: z.number().int().optional(),
  buildings: z.number().int().min(0).optional(),
});

export const buildingPlacedPropsSchema = z.object({
  buildingId: z.string().min(1).max(64),
  tier: z.string().max(64).optional(),
});

export const installPropsSchema = z.object({
  platform: platformSchema.optional(),
});

/** Named event → props schema. Base telemetry still accepts unknown names. */
export const TELEMETRY_EVENT_PROPS = {
  session_start: sessionStartPropsSchema,
  session_end: sessionEndPropsSchema,
  level_start: levelStartPropsSchema,
  level_clear: levelClearPropsSchema,
  level_fail: levelFailPropsSchema,
  quit_point: quitPointPropsSchema,
  hint_used: hintUsedPropsSchema,
  coin_earn: coinEarnPropsSchema,
  coin_spend: coinSpendPropsSchema,
  ad_rewarded_offer: adPlacementPropsSchema,
  ad_rewarded_start: adPlacementPropsSchema,
  ad_rewarded_complete: adRewardedCompletePropsSchema,
  ad_interstitial_impression: adPlacementPropsSchema,
  iap_offer_seen: iapOfferSeenPropsSchema,
  tier_reached: tierReachedPropsSchema,
  building_placed: buildingPlacedPropsSchema,
  install: installPropsSchema,
} as const;

export type TelemetryEventName = keyof typeof TELEMETRY_EVENT_PROPS;

export const TELEMETRY_EVENT_NAMES = Object.keys(TELEMETRY_EVENT_PROPS) as TelemetryEventName[];

export function parseTelemetryProps(name: string, props: unknown) {
  const schema = TELEMETRY_EVENT_PROPS[name as TelemetryEventName];
  if (!schema) return { ok: true as const, props: (props ?? {}) as Record<string, unknown> };
  const parsed = schema.safeParse(props ?? {});
  if (!parsed.success) return { ok: false as const, error: parsed.error };
  return { ok: true as const, props: parsed.data as Record<string, unknown> };
}

export const namedTelemetryEventSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).max(64),
    gameId: gameIdSchema.optional(),
    ts: z.string().datetime(),
    sessionId: z.string().min(1).max(64).optional(),
    props: z.record(z.string(), z.unknown()).default({}),
  })
  .superRefine((val, ctx) => {
    const result = parseTelemetryProps(val.name, val.props);
    if (!result.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Event props do not match the catalogue.",
        path: ["props"],
      });
    }
  });
