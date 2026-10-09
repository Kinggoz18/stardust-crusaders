import { z } from "zod";

const configSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  ADMIN_SESSION_SECRET: z.string().min(16),
  API_BASE_URL: z.string().url(),
  CORS_ALLOWED_ORIGINS: z.string().min(1),
  ADMIN_PROXY_TOKEN: z.string().min(16),
  /** One-time studio setup key. Remove from env after the first owner is created. */
  ADMIN_MASTER_KEY: z.string().min(32).optional(),
  REVENUECAT_WEBHOOK_SECRET: z.string().min(8),
  AD_PROVIDER: z.enum(["none", "generic", "admob"]).default("none"),
  AD_PROVIDER_SIGNING_SECRET: z.string().min(8),
  /** Override AdMob verifier keys URL (tests only). Default is Google's published list. */
  ADMOB_SSV_KEYS_URL: z.string().url().optional(),
  /** Max age of an AdMob SSV timestamp in ms (default 1 hour). */
  ADMOB_SSV_MAX_AGE_MS: z.coerce.number().int().positive().default(3_600_000),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  NODE_ENV: z.preprocess(
    (v) => (v === "dev" ? "development" : v),
    z.enum(["development", "test", "production"]).default("development"),
  ),
});

export type Config = z.infer<typeof configSchema> & {
  corsOrigins: string[];
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid config: ${msg}`);
  }
  return {
    ...parsed.data,
    corsOrigins: parsed.data.CORS_ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
  };
}
