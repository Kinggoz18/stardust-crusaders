import { z } from "zod";

/**
 * DRAFT schema for Loom Rush — derived from docs/games/LOOM_RUSH_FINAL_PLAN.md.
 * Not a shipped client save; expect breaking changes before soft launch.
 */
export const loomRushProgressSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  _draft: z.literal(true).default(true),
  /** Highest level cleared (1-based). */
  levelReached: z.number().int().min(0).default(0),
  /** Per-level best star count 0–3 (Masterpiece = 3). */
  stars: z.record(z.string(), z.number().int().min(0).max(3)).default({}),
  /** Wardrobe / Loom Shop collectibles (garment template ids). */
  wardrobe: z.array(z.string()).default([]),
  coins: z.number().int().min(0).default(0),
  boosters: z
    .object({
      unpick: z.number().int().min(0).default(0),
      snip: z.number().int().min(0).default(0),
      shuffle: z.number().int().min(0).default(0),
      peek: z.number().int().min(0).default(0),
    })
    .default({}),
  tutorialDone: z.boolean().default(false),
});

export type LoomRushProgress = z.infer<typeof loomRushProgressSchema>;
