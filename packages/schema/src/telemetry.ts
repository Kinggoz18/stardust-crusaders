import { z } from "zod";
import { gameIdSchema } from "./games/registry.js";

export const telemetryEventSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(64),
  gameId: gameIdSchema.optional(),
  ts: z.string().datetime(),
  sessionId: z.string().min(1).max(64).optional(),
  props: z.record(z.string(), z.unknown()).default({}),
});

export type TelemetryEvent = z.infer<typeof telemetryEventSchema>;

export const postEventsRequestSchema = z.object({
  consentAnalytics: z.boolean(),
  events: z.array(telemetryEventSchema).min(1).max(100),
});

export const postEventsResponseSchema = z.object({
  accepted: z.number().int().min(0),
  duplicates: z.number().int().min(0),
  rejected: z.number().int().min(0),
});

/** Funnel-oriented event names reserved for per-game tables. */
export const FUNNEL_EVENT_NAMES = [
  "session_start",
  "session_end",
  "level_start",
  "level_clear",
  "level_fail",
  "quit_point",
  "tier_reached",
  "hint_used",
  "ad_rewarded_offer",
  "ad_rewarded_start",
  "ad_rewarded_complete",
  "ad_interstitial_impression",
  "house_ad_shown",
  "house_ad_started",
  "house_ad_completed",
  "house_ad_clicked",
  "install",
] as const;
