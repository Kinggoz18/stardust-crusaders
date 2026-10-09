import { z } from "zod";
import { oneSparkProgressSchema } from "./one-spark.js";
import { loomRushProgressSchema } from "./loom-rush.js";
import { borrowedTimeProgressSchema } from "./borrowed-time.js";

export const gameIdSchema = z.enum(["one-spark", "loom-rush", "borrowed-time"]);
export type GameId = z.infer<typeof gameIdSchema>;

export const GAME_IDS = gameIdSchema.options;

export const progressDocumentSchema = z.discriminatedUnion("gameId", [
  z.object({ gameId: z.literal("one-spark"), document: oneSparkProgressSchema }),
  z.object({ gameId: z.literal("loom-rush"), document: loomRushProgressSchema }),
  z.object({ gameId: z.literal("borrowed-time"), document: borrowedTimeProgressSchema }),
]);

export function progressSchemaFor(gameId: GameId) {
  switch (gameId) {
    case "one-spark":
      return oneSparkProgressSchema;
    case "loom-rush":
      return loomRushProgressSchema;
    case "borrowed-time":
      return borrowedTimeProgressSchema;
  }
}

export const putProgressRequestSchema = z.object({
  revision: z.number().int().min(0),
  document: z.unknown(),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export const putProgressResponseSchema = z.object({
  revision: z.number().int().min(1),
  document: z.unknown(),
  merged: z.boolean().optional(),
});

export const staleRevisionErrorSchema = z.object({
  error: z.object({
    code: z.literal("stale_revision"),
    message: z.string(),
    details: z.object({
      serverRevision: z.number().int(),
      serverDocument: z.unknown(),
    }),
  }),
});
