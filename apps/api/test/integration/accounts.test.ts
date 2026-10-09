import { describe, expect, test, afterAll } from "bun:test";
import { startTestApp } from "../helpers.js";

const harness = await startTestApp();
afterAll(() => harness.stop());

const consent = { analytics: false, crashReports: false, marketing: false };

describe("accounts", () => {
  test("creates anonymous account and returns tokens", async () => {
    const res = await harness.app.inject({
      method: "POST",
      url: "/v1/accounts/anonymous",
      payload: {
        deviceId: "device-android-001",
        platform: "android",
        consent,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.accountId).toBeTruthy();
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
  });

  test("same device id returns same account", async () => {
    const a = await harness.app.inject({
      method: "POST",
      url: "/v1/accounts/anonymous",
      payload: { deviceId: "device-same", platform: "android", consent },
    });
    const b = await harness.app.inject({
      method: "POST",
      url: "/v1/accounts/anonymous",
      payload: { deviceId: "device-same", platform: "android", consent },
    });
    expect(a.json().accountId).toBe(b.json().accountId);
  });

  test("refresh rotates tokens", async () => {
    const created = await harness.app.inject({
      method: "POST",
      url: "/v1/accounts/anonymous",
      payload: { deviceId: "device-refresh", platform: "android", consent },
    });
    const { refreshToken } = created.json();
    const res = await harness.app.inject({
      method: "POST",
      url: "/v1/accounts/refresh",
      payload: { refreshToken },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().refreshToken).not.toBe(refreshToken);
  });

  test("tampered access token is rejected", async () => {
    const created = await harness.app.inject({
      method: "POST",
      url: "/v1/accounts/anonymous",
      payload: { deviceId: "device-tamper", platform: "android", consent },
    });
    const token = created.json().accessToken as string;
    const tampered = token.slice(0, -4) + "xxxx";
    const res = await harness.app.inject({
      method: "GET",
      url: "/v1/accounts/me/export",
      headers: { authorization: `Bearer ${tampered}` },
    });
    expect(res.statusCode).toBe(401);
  });

  test("link account stub contract", async () => {
    const created = await harness.app.inject({
      method: "POST",
      url: "/v1/accounts/anonymous",
      payload: { deviceId: "device-link", platform: "android", consent },
    });
    const res = await harness.app.inject({
      method: "POST",
      url: "/v1/accounts/link",
      headers: { authorization: `Bearer ${created.json().accessToken}` },
      payload: { provider: "apple", idToken: "fake-id-token-value" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ linked: true, provider: "apple", stub: true });
  });

  test("export and delete account", async () => {
    const created = await harness.app.inject({
      method: "POST",
      url: "/v1/accounts/anonymous",
      payload: { deviceId: "device-delete", platform: "android", consent },
    });
    const auth = { authorization: `Bearer ${created.json().accessToken}` };
    const exported = await harness.app.inject({
      method: "GET",
      url: "/v1/accounts/me/export",
      headers: auth,
    });
    expect(exported.statusCode).toBe(200);
    expect(exported.json().consent.analytics).toBe(false);

    const del = await harness.app.inject({
      method: "DELETE",
      url: "/v1/accounts/me",
      headers: auth,
    });
    expect(del.statusCode).toBe(204);
  });
});
