import { describe, expect, test, afterAll } from "bun:test";
import { startTestApp } from "../helpers.js";

const harness = await startTestApp();
afterAll(() => harness.stop());

async function authDevice(deviceId: string) {
  const res = await harness.app.inject({
    method: "POST",
    url: "/v1/accounts/anonymous",
    payload: {
      deviceId,
      platform: "android",
      consent: { analytics: false, crashReports: false, marketing: false },
    },
  });
  return res.json().accessToken as string;
}

describe("progress and wallet", () => {
  test("put progress with revision and reject stale", async () => {
    const token = await authDevice("prog-device-1");
    const headers = { authorization: `Bearer ${token}` };

    const put1 = await harness.app.inject({
      method: "PUT",
      url: "/v1/games/one-spark/progress",
      headers,
      payload: {
        revision: 0,
        document: {
          stars: { "1": [true, false, false] },
          album: {},
          coins: 5,
          firstClear: { "1": true },
        },
      },
    });
    expect(put1.statusCode).toBe(200);
    expect(put1.json().revision).toBe(1);

    const stale = await harness.app.inject({
      method: "PUT",
      url: "/v1/games/one-spark/progress",
      headers,
      payload: {
        revision: 0,
        document: {
          stars: { "1": [true, true, false] },
          album: {},
          coins: 5,
          firstClear: { "1": true },
        },
      },
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error.code).toBe("stale_revision");
  });

  test("rejects star decrease", async () => {
    const token = await authDevice("prog-device-2");
    const headers = { authorization: `Bearer ${token}` };
    await harness.app.inject({
      method: "PUT",
      url: "/v1/games/one-spark/progress",
      headers,
      payload: {
        revision: 0,
        document: {
          stars: { "1": [true, false, false] },
          album: {},
          firstClear: { "1": true },
        },
      },
    });
    const bad = await harness.app.inject({
      method: "PUT",
      url: "/v1/games/one-spark/progress",
      headers,
      payload: {
        revision: 1,
        document: {
          stars: { "1": [false, false, false] },
          album: {},
          firstClear: { "1": true },
        },
      },
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.code).toBe("sanity_failed");
  });

  test("wallet ledger is append-only and idempotent", async () => {
    const token = await authDevice("wallet-device-1");
    const headers = { authorization: `Bearer ${token}` };
    const a = await harness.app.inject({
      method: "POST",
      url: "/v1/wallet/entries",
      headers,
      payload: {
        gameId: "one-spark",
        delta: 10,
        reason: "first_clear",
        idempotencyKey: "idem-wallet-1",
      },
    });
    expect(a.statusCode).toBe(201);
    expect(a.json().entry.balanceAfter).toBe(10);

    const replay = await harness.app.inject({
      method: "POST",
      url: "/v1/wallet/entries",
      headers,
      payload: {
        gameId: "one-spark",
        delta: 10,
        reason: "first_clear",
        idempotencyKey: "idem-wallet-1",
      },
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().duplicate).toBe(true);

    const bal = await harness.app.inject({ method: "GET", url: "/v1/wallet", headers });
    expect(bal.json().balance).toBe(10);
  });
});
