import { describe, expect, test, afterAll } from "bun:test";
import * as OTPAuth from "otpauth";
import { startTestApp } from "../helpers.js";

const harness = await startTestApp();
afterAll(() => harness.stop());

async function seedOwner() {
  return harness.ctx.adminAuth.createStaff({
    email: "owner@stardust.test",
    password: "test-password-ok",
    role: "owner",
  });
}

function totpCode(secret: string) {
  return new OTPAuth.TOTP({
    issuer: "Stardust Crusaders",
    label: "owner@stardust.test",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).generate();
}

describe("admin api", () => {
  test("login requires valid totp", async () => {
    const staff = await seedOwner();
    const bad = await harness.app.inject({
      method: "POST",
      url: "/admin/v1/auth/login",
      payload: {
        email: staff.email,
        password: "test-password-ok",
        totpCode: "000000",
      },
    });
    expect(bad.statusCode).toBe(401);

    const ok = await harness.app.inject({
      method: "POST",
      url: "/admin/v1/auth/login",
      payload: {
        email: staff.email,
        password: "test-password-ok",
        totpCode: totpCode(staff.totpSecret),
      },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().role).toBe("owner");
  });

  test("viewer cannot reset progress; owner can", async () => {
    const viewer = await harness.ctx.adminAuth.createStaff({
      email: "viewer@stardust.test",
      password: "test-password-ok",
      role: "viewer",
    });
    const owner = await harness.ctx.adminAuth.createStaff({
      email: "owner2@stardust.test",
      password: "test-password-ok",
      role: "owner",
    });

    const viewerLogin = await harness.app.inject({
      method: "POST",
      url: "/admin/v1/auth/login",
      payload: {
        email: viewer.email,
        password: "test-password-ok",
        totpCode: totpCode(viewer.totpSecret),
      },
    });
    const viewerToken = viewerLogin.json().token as string;

    const player = await harness.app.inject({
      method: "POST",
      url: "/v1/accounts/anonymous",
      payload: {
        deviceId: "admin-player-1",
        platform: "android",
        consent: { analytics: false, crashReports: false, marketing: false },
      },
    });
    const accountId = player.json().accountId as string;

    const forbidden = await harness.app.inject({
      method: "POST",
      url: `/admin/v1/accounts/${accountId}/games/one-spark/reset`,
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(forbidden.statusCode).toBe(403);

    const ownerLogin = await harness.app.inject({
      method: "POST",
      url: "/admin/v1/auth/login",
      payload: {
        email: owner.email,
        password: "test-password-ok",
        totpCode: totpCode(owner.totpSecret),
      },
    });
    const ownerToken = ownerLogin.json().token as string;
    const reset = await harness.app.inject({
      method: "POST",
      url: `/admin/v1/accounts/${accountId}/games/one-spark/reset`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(reset.statusCode).toBe(200);
    expect(reset.json().reset).toBe(true);
  });

  test("expired session is rejected", async () => {
    const staff = await harness.ctx.adminAuth.createStaff({
      email: "expire@stardust.test",
      password: "test-password-ok",
      role: "support",
    });
    const login = await harness.app.inject({
      method: "POST",
      url: "/admin/v1/auth/login",
      payload: {
        email: staff.email,
        password: "test-password-ok",
        totpCode: totpCode(staff.totpSecret),
      },
    });
    const token = login.json().token as string;
    await harness.ctx.sql`
      UPDATE staff_sessions SET expires_at = now() - interval '1 minute'
      WHERE token_hash = encode(digest(${token}, 'sha256'), 'hex')
    `.catch(async () => {
      // digest() needs pgcrypto; fall back to app hash
      const { sha256 } = await import("../../src/lib/crypto.js");
      await harness.ctx.sql`
        UPDATE staff_sessions SET expires_at = now() - interval '1 minute'
        WHERE token_hash = ${sha256(token)}
      `;
    });
    const res = await harness.app.inject({
      method: "GET",
      url: "/admin/v1/metrics",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(401);
  });

  test("account search and audit log", async () => {
    const staff = await harness.ctx.adminAuth.createStaff({
      email: "search@stardust.test",
      password: "test-password-ok",
      role: "support",
    });
    const login = await harness.app.inject({
      method: "POST",
      url: "/admin/v1/auth/login",
      payload: {
        email: staff.email,
        password: "test-password-ok",
        totpCode: totpCode(staff.totpSecret),
      },
    });
    const token = login.json().token as string;
    await harness.app.inject({
      method: "POST",
      url: "/v1/accounts/anonymous",
      payload: {
        deviceId: "searchable-device-99",
        platform: "android",
        consent: { analytics: false, crashReports: false, marketing: false },
      },
    });
    const search = await harness.app.inject({
      method: "GET",
      url: "/admin/v1/accounts?q=searchable-device",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(search.statusCode).toBe(200);
    expect(search.json().accounts.length).toBeGreaterThan(0);

    const audit = await harness.app.inject({
      method: "GET",
      url: "/admin/v1/audit",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(audit.statusCode).toBe(200);
    expect(audit.json().entries.length).toBeGreaterThan(0);
  });
});
