import { z } from "zod";

/**
 * One Spark save shape — mirrors docs/one-spark-reference/save.ts (real, not draft).
 */
export const oneSparkDailyWalletSchema = z.object({
  lastPlayed: z.string().nullable(),
  lastRewarded: z.string().nullable(),
  streak: z.number().int().min(0),
  lastStreakDate: z.string().nullable(),
});

export const oneSparkProgressSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  stars: z.record(z.string(), z.array(z.boolean()).max(3)),
  album: z.record(z.string(), z.enum(["normal", "gold"])),
  tutorialDone: z.boolean().default(false),
  /** Display/cache only — authoritative balance lives in the wallet ledger. */
  coins: z.number().int().min(0).default(0),
  firstClear: z.record(z.string(), z.boolean()).default({}),
  daily: oneSparkDailyWalletSchema.default({
    lastPlayed: null,
    lastRewarded: null,
    streak: 0,
    lastStreakDate: null,
  }),
  travelSeen: z.record(z.string(), z.boolean()).default({}),
  hintIntroSeen: z.boolean().optional(),
});

export type OneSparkProgress = z.infer<typeof oneSparkProgressSchema>;

export const oneSparkEconomySchema = z.object({
  firstClear: z.object({
    base: z.number().int(),
    perExtraStar: z.number().int(),
  }),
  replay: z.number().int(),
  daily: z.object({
    base: z.number().int(),
    perStreakDay: z.number().int(),
    streakCap: z.number().int(),
  }),
  extraMoves: z.object({
    moves: z.number().int(),
    prices: z.array(z.number().int()),
    stepAfter: z.number().int(),
  }),
  hints: z.object({
    costFactor: z.number(),
    showMs: z.number().int(),
  }),
});

/** OR-merge stars like client mergeStars. */
export function mergeStars(old: boolean[] | undefined, next: boolean[]): boolean[] {
  const prev = old ?? [false, false, false];
  return next.map((v, i) => v || !!prev[i]);
}

export function mergeAlbum(
  old: "normal" | "gold" | undefined,
  gold: boolean,
): "normal" | "gold" {
  return old === "gold" || gold ? "gold" : "normal";
}

/**
 * Server-side sanity for One Spark progress updates.
 * Stars only go up (OR-merge), coins never negative, firstClear monotonic.
 */
export function assertOneSparkSanity(prev: OneSparkProgress, next: OneSparkProgress): string[] {
  const errors: string[] = [];
  if (next.coins < 0) errors.push("coins_negative");

  for (const [levelId, nextStars] of Object.entries(next.stars)) {
    const old = prev.stars[levelId];
    if (old) {
      for (let i = 0; i < Math.min(old.length, nextStars.length); i++) {
        if (old[i] && !nextStars[i]) {
          errors.push(`stars_decreased:${levelId}:${i}`);
        }
      }
    }
  }

  for (const [levelId, cleared] of Object.entries(prev.firstClear)) {
    if (cleared && next.firstClear[levelId] !== true) {
      errors.push(`firstClear_unset:${levelId}`);
    }
  }

  return errors;
}
