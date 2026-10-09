import { z } from "zod";

export const consentFlagsSchema = z.object({
  analytics: z.boolean(),
  crashReports: z.boolean(),
  marketing: z.boolean(),
});

export type ConsentFlags = z.infer<typeof consentFlagsSchema>;

export const linkProviderSchema = z.enum(["apple", "google", "email"]);
export type LinkProvider = z.infer<typeof linkProviderSchema>;

export const createAnonymousAccountRequestSchema = z.object({
  deviceId: z.string().min(8).max(128),
  platform: z.enum(["android", "ios", "web"]).default("android"),
  consent: consentFlagsSchema,
});

export const createAnonymousAccountResponseSchema = z.object({
  accountId: z.string().uuid(),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
});

export const refreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1),
});

export const linkAccountRequestSchema = z.object({
  provider: linkProviderSchema,
  /** Provider subject / id token — stubbed; contract only for now. */
  idToken: z.string().min(1),
});

export const linkAccountResponseSchema = z.object({
  linked: z.literal(true),
  provider: linkProviderSchema,
  stub: z.literal(true),
});

export const accountExportSchema = z.object({
  accountId: z.string().uuid(),
  createdAt: z.string().datetime(),
  consent: consentFlagsSchema,
  games: z.record(z.string(), z.unknown()),
  wallet: z.array(z.unknown()),
  events: z.array(z.unknown()),
});

export type CreateAnonymousAccountRequest = z.infer<typeof createAnonymousAccountRequestSchema>;
export type CreateAnonymousAccountResponse = z.infer<typeof createAnonymousAccountResponseSchema>;
