import { describe, expect, test } from "bun:test";
import { buildServer } from "../../src/server.js";
import { loadConfig } from "../../src/config.js";

describe("health (scaffold)", () => {
  test("GET /health returns ok", async () => {
    const config = loadConfig({
      DATABASE_URL: "postgres://stardust:stardust@localhost:5432/stardust",
      JWT_SECRET: "x".repeat(32),
      REFRESH_TOKEN_SECRET: "y".repeat(32),
      ADMIN_SESSION_SECRET: "z".repeat(16),
      API_BASE_URL: "http://localhost:3000",
      CORS_ALLOWED_ORIGINS: "http://localhost:5173",
      ADMIN_PROXY_TOKEN: "proxy-token-16chars",
      REVENUECAT_WEBHOOK_SECRET: "rc-secret",
      AD_PROVIDER: "none",
      AD_PROVIDER_SIGNING_SECRET: "ad-secret",
      NODE_ENV: "test",
      LOG_LEVEL: "error",
    } as NodeJS.ProcessEnv);

    const app = await buildServer(config);
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    await app.close();
  });
});
