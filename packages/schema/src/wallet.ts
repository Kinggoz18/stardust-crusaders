import { z } from "zod";
import { gameIdSchema } from "./games/registry.js";

export const walletReasonSchema = z.enum([
  "first_clear",
  "daily_reward",
  "hint",
  "extra_moves",
  "ad_reward",
  "iap",
  "admin_adjust",
  "refund",
  "other",
]);

export const walletLedgerEntrySchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  gameId: gameIdSchema.nullable(),
  delta: z.number().int(),
  balanceAfter: z.number().int().min(0),
  reason: walletReasonSchema,
  ref: z.string().max(128).nullable(),
  createdAt: z.string().datetime(),
});

export type WalletLedgerEntry = z.infer<typeof walletLedgerEntrySchema>;

export const postWalletEntryRequestSchema = z.object({
  gameId: gameIdSchema.optional(),
  delta: z.number().int(),
  reason: walletReasonSchema,
  ref: z.string().max(128).optional(),
  idempotencyKey: z.string().min(8).max(128),
});
