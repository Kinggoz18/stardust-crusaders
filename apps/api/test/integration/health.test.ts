import { describe, expect, test, afterAll } from "bun:test";
import { startTestApp } from "../helpers.js";

const harness = await startTestApp();
afterAll(() => harness.stop());

describe("health", () => {
  test("GET /health returns ok", async () => {
    const res = await harness.app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  test("GET /ready checks database", async () => {
    const res = await harness.app.inject({ method: "GET", url: "/ready" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ready: true });
  });
});
