import { describe, expect, test } from "bun:test";
import { loadConfig } from "./config.js";

const base = {
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
};

describe("loadConfig", () => {
  test("parses valid env", () => {
    const cfg = loadConfig(base as NodeJS.ProcessEnv);
    expect(cfg.PORT).toBe(3000);
    expect(cfg.corsOrigins).toEqual(["http://localhost:5173"]);
  });

  test("rejects short secrets", () => {
    expect(() => loadConfig({ ...base, JWT_SECRET: "short" } as NodeJS.ProcessEnv)).toThrow(/Invalid config/);
  });
});
