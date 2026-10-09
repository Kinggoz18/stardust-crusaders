import { z } from "zod";
import { gameIdSchema } from "./games/registry.js";

export const adProviderNameSchema = z.enum(["none", "generic"]);

export const adRewardCallbackSchema = z.object({
  transactionId: z.string().min(1).max(128),
  accountId: z.string().uuid(),
  gameId: gameIdSchema,
  reward: z.object({
    kind: z.enum(["coins", "booster", "extra_moves", "other"]),
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
