import { z } from "zod";

/**
 * DRAFT schemas for Borrowed Time — from FINAL_PLAN §12 data-model readiness.
 * Local-only Phase 1 shapes; multiplayer tick/replay is design-only (see ROADMAP).
 */

export const islandSnapshotSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  _draft: z.literal(true).default(true),
  islandId: z.string().min(1),
  tier: z.enum(["colony", "village", "town", "city"]),
  lots: z.array(z.record(z.string(), z.unknown())).default([]),
  buildings: z.array(z.record(z.string(), z.unknown())).default([]),
  palisade: z.number().int().min(0).default(0),
  roads: z.number().int().min(0).default(0),
  debt: z.number().int().default(0),
  greySet: z.array(z.string()).default([]),
  tech: z.record(z.string(), z.unknown()).default({}),
  defence: z.record(z.string(), z.unknown()).default({}),
});

export type IslandSnapshot = z.infer<typeof islandSnapshotSchema>;

export const borrowedTimeEventSchema = z.object({
  id: z.string().min(1),
  at: z.string().datetime(),
  kind: z.enum(["raid", "seizure", "tier_up", "trade", "other"]),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const borrowedTimeCommandSchema = z.object({
  seq: z.number().int().min(0),
  at: z.string().datetime(),
  intent: z.enum(["build", "borrow", "repay", "dusk_decide", "other"]),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const borrowedTimeProgressSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  _draft: z.literal(true).default(true),
  island: islandSnapshotSchema,
  /** Append-only event log (chronicle / replays). */
  eventLog: z.array(borrowedTimeEventSchema).default([]),
  /** Client intents with sequence numbers — server replays later (stub). */
  commandLog: z.array(borrowedTimeCommandSchema).default([]),
  coins: z.number().int().min(0).default(0),
});

export type BorrowedTimeProgress = z.infer<typeof borrowedTimeProgressSchema>;
