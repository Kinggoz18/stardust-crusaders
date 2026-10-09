import { z } from "zod";

/** RevenueCat webhook envelope (sandbox / stub). */
export const revenueCatEventSchema = z.object({
  api_version: z.string().optional(),
  event: z.object({
    id: z.string().min(1),
    type: z.string().min(1),
    app_user_id: z.string().min(1),
    product_id: z.string().optional(),
    price: z.number().optional(),
    currency: z.string().optional(),
    environment: z.enum(["SANDBOX", "PRODUCTION"]).default("SANDBOX"),
    event_timestamp_ms: z.number().int().optional(),
  }),
});

export type RevenueCatEvent = z.infer<typeof revenueCatEventSchema>;

export const revenueCatWebhookResponseSchema = z.object({
  ok: z.boolean(),
  duplicate: z.boolean(),
});
