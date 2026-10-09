import { loadConfig } from "../src/config.js";
import { createAppContext } from "../src/app-context.js";
import { buildServer } from "../src/server.js";
import { migrateUp } from "../src/db/migrator.js";
import { startTestPostgres, type TestPg } from "./pg.js";

export function testConfig(databaseUrl: string) {
  return loadConfig({
    DATABASE_URL: databaseUrl,
    JWT_SECRET: "x".repeat(32),
    REFRESH_TOKEN_SECRET: "y".repeat(32),
    ADMIN_SESSION_SECRET: "z".repeat(16),
    API_BASE_URL: "http://localhost:3000",
    CORS_ALLOWED_ORIGINS: "http://localhost:5173",
    ADMIN_PROXY_TOKEN: "proxy-token-16chars",
    REVENUECAT_WEBHOOK_SECRET: "rc-secret-test",
    AD_PROVIDER: "none",
    AD_PROVIDER_SIGNING_SECRET: "ad-secret-test",
    NODE_ENV: "test",
    LOG_LEVEL: "error",
  } as NodeJS.ProcessEnv);
}

export async function startTestApp() {
  const pg = await startTestPostgres();
  const config = testConfig(pg.connectionString);
  const ctx = createAppContext(config, pg.connectionString);
  await migrateUp(ctx.sql);
  const app = await buildServer(config, ctx);
  return {
    app,
    ctx,
    config,
    async stop() {
      await app.close();
      await ctx.sql.end({ timeout: 5 });
      await pg.stop();
    },
  };
}

export type { TestPg };
