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
    const badPassword = await harness.app.inject({
      method: "POST",
      url: "/admin/v1/auth/login",
      payload: {
        email: staff.email,
        password: "wrong-password-xx",
        totpCode: "000000",
      },
    });
    expect(badPassword.statusCode).toBe(401);
    expect(badPassword.json().error.code).toBe("invalid_credentials");

    const badTotp = await harness.app.inject({
      method: "POST",
      url: "/admin/v1/auth/login",
      payload: {
        email: staff.email,
        password: "test-password-ok",
        totpCode: "000000",
      },
    });
    expect(badTotp.statusCode).toBe(401);
    expect(badTotp.json().error.code).toBe("invalid_totp");
    expect(badTotp.json().error.message).toContain("authenticator");

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

  test("owner can invite staff; support cannot", async () => {
    const support = await harness.ctx.adminAuth.createStaff({
      email: "support-invite@stardust.test",
      password: "test-password-ok",
      role: "support",
    });
    const owner = await harness.ctx.adminAuth.createStaff({
      email: "owner-invite@stardust.test",
      password: "test-password-ok",
      role: "owner",
    });

    const supportLogin = await harness.app.inject({
      method: "POST",
      url: "/admin/v1/auth/login",
      payload: {
        email: support.email,
        password: "test-password-ok",
        totpCode: totpCode(support.totpSecret),
      },
    });
    const denied = await harness.app.inject({
      method: "POST",
      url: "/admin/v1/staff/invites",
      headers: { authorization: `Bearer ${supportLogin.json().token}` },
      payload: {
        email: "newbie@stardust.test",
        role: "viewer",
      },
    });
    expect(denied.statusCode).toBe(403);

    const ownerLogin = await harness.app.inject({
      method: "POST",
      url: "/admin/v1/auth/login",
      payload: {
        email: owner.email,
        password: "test-password-ok",
        totpCode: totpCode(owner.totpSecret),
      },
    });
    const invited = await harness.app.inject({
      method: "POST",
      url: "/admin/v1/staff/invites",
      headers: { authorization: `Bearer ${ownerLogin.json().token}` },
      payload: {
        email: "newbie@stardust.test",
        role: "viewer",
      },
    });
    expect(invited.statusCode).toBe(201);
    expect(invited.json().email).toBe("newbie@stardust.test");
    expect(invited.json().inviteToken).toBeTruthy();
    expect(invited.json().totpSecret).toBeUndefined();

    const accepted = await harness.app.inject({
      method: "POST",
      url: "/admin/v1/auth/accept-invite",
      payload: {
        token: invited.json().inviteToken,
        password: "newbie-password-ok",
      },
    });
    expect(accepted.statusCode).toBe(201);
    expect(accepted.json().totpSecret).toBeTruthy();

    const list = await harness.app.inject({
      method: "GET",
      url: "/admin/v1/staff",
      headers: { authorization: `Bearer ${ownerLogin.json().token}` },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().staff.some((s: { email: string }) => s.email === "newbie@stardust.test")).toBe(
      true,
    );

    const loginNewbie = await harness.app.inject({
      method: "POST",
      url: "/admin/v1/auth/login",
      payload: {
        email: "newbie@stardust.test",
        password: "newbie-password-ok",
        totpCode: totpCode(accepted.json().totpSecret),
      },
    });
    expect(loginNewbie.statusCode).toBe(200);
  });

  test("bootstrap master key works once; race, lockout, invite expiry/revoke", async () => {
    const local = await startTestApp();
    const key = local.config.ADMIN_MASTER_KEY!;
    try {
      const status = await local.app.inject({
        method: "GET",
        url: "/admin/v1/auth/bootstrap-status",
      });
      expect(status.json().needsBootstrap).toBe(true);

      const bad = await local.app.inject({
        method: "POST",
        url: "/admin/v1/auth/bootstrap",
        payload: {
          masterKey: "wrong-master-key-32-characters-xx",
          email: "bad@stardust.test",
          password: "bootstrap-password",
        },
      });
      expect(bad.statusCode).toBe(401);
      expect(JSON.stringify(bad.json())).not.toContain(key);

      for (let i = 0; i < 4; i++) {
        await local.app.inject({
          method: "POST",
          url: "/admin/v1/auth/bootstrap",
          payload: {
            masterKey: "wrong-master-key-32-characters-xx",
            email: "bad@stardust.test",
            password: "bootstrap-password",
          },
        });
      }
      const locked = await local.app.inject({
        method: "POST",
        url: "/admin/v1/auth/bootstrap",
        payload: {
          masterKey: key,
          email: "locked@stardust.test",
          password: "bootstrap-password",
        },
      });
      expect(locked.statusCode).toBe(429);

      // Fresh DB for race + success path.
      await local.stop();
      const raceApp = await startTestApp();
      try {
        const raceKey = raceApp.config.ADMIN_MASTER_KEY!;
        const [a, b] = await Promise.all([
          raceApp.app.inject({
            method: "POST",
            url: "/admin/v1/auth/bootstrap",
            payload: {
              masterKey: raceKey,
              email: "race-a@stardust.test",
              password: "bootstrap-password",
            },
          }),
          raceApp.app.inject({
            method: "POST",
            url: "/admin/v1/auth/bootstrap",
            payload: {
              masterKey: raceKey,
              email: "race-b@stardust.test",
              password: "bootstrap-password",
            },
          }),
        ]);
        const codes = [a.statusCode, b.statusCode].sort();
        expect(codes).toEqual([201, 409]);
        const winner = a.statusCode === 201 ? a : b;
        expect(winner.json().role).toBe("owner");
        expect(winner.json().totpSecret).toBeTruthy();
        expect(JSON.stringify(winner.json())).not.toContain(raceKey);

        const second = await raceApp.app.inject({
          method: "POST",
          url: "/admin/v1/auth/bootstrap",
          payload: {
            masterKey: raceKey,
            email: "again@stardust.test",
            password: "bootstrap-password",
          },
        });
        expect(second.statusCode).toBe(409);
        expect(await raceApp.ctx.adminAuth.shouldWarnRemoveMasterKey()).toBe(true);

        const ownerLogin = await raceApp.app.inject({
          method: "POST",
          url: "/admin/v1/auth/login",
          payload: {
            email: winner.json().email,
            password: "bootstrap-password",
            totpCode: totpCode(winner.json().totpSecret),
          },
        });
        expect(ownerLogin.statusCode).toBe(200);
        const token = ownerLogin.json().token as string;

        const invite = await raceApp.app.inject({
          method: "POST",
          url: "/admin/v1/staff/invites",
          headers: { authorization: `Bearer ${token}` },
          payload: { email: "expiree@stardust.test", role: "support" },
        });
        expect(invite.statusCode).toBe(201);
        const inviteToken = invite.json().inviteToken as string;
        const inviteId = invite.json().id as string;

        await raceApp.ctx.sql`
          UPDATE staff_invites SET expires_at = now() - interval '1 minute' WHERE id = ${inviteId}
        `;
        const expired = await raceApp.app.inject({
          method: "POST",
          url: "/admin/v1/auth/accept-invite",
          payload: { token: inviteToken, password: "invitee-password" },
        });
        expect(expired.statusCode).toBe(410);

        const invite2 = await raceApp.app.inject({
          method: "POST",
          url: "/admin/v1/staff/invites",
          headers: { authorization: `Bearer ${token}` },
          payload: { email: "revokee@stardust.test", role: "viewer" },
        });
        const revokeToken = invite2.json().inviteToken as string;
        await raceApp.app.inject({
          method: "POST",
          url: `/admin/v1/staff/invites/${invite2.json().id}/revoke`,
          headers: { authorization: `Bearer ${token}` },
        });
        const revoked = await raceApp.app.inject({
          method: "POST",
          url: "/admin/v1/auth/accept-invite",
          payload: { token: revokeToken, password: "invitee-password" },
        });
        expect(revoked.statusCode).toBe(410);
      } finally {
        await raceApp.stop();
      }
    } finally {
      // local may already be stopped after the lockout section
      await local.stop().catch(() => undefined);
    }
  });
});
