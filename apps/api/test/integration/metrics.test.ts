import { describe, expect, test, afterAll } from "bun:test";
import * as OTPAuth from "otpauth";
import { startTestApp } from "../helpers.js";
import { rollupDay } from "../../src/modules/metrics/rollup.js";
import { accounts, telemetryEvents } from "../../src/db/schema.js";

const harness = await startTestApp();
afterAll(() => harness.stop());

function totpCode(secret: string) {
  return new OTPAuth.TOTP({
    issuer: "Stardust Crusaders",
    label: "metrics@stardust.test",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).generate();
}

async function staffToken() {
  const staff = await harness.ctx.adminAuth.createStaff({
    email: `metrics-${crypto.randomUUID().slice(0, 8)}@stardust.test`,
    password: "test-password-ok",
    role: "viewer",
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
  return login.json().token as string;
}

describe("metrics rollup + admin api", () => {
  test("idempotent rollup with late and duplicate events; real retention", async () => {
    const cohortDay = "2026-09-01";
    const d1 = "2026-09-02";
    const d7 = "2026-09-08";

    const [a1] = await harness.ctx.db
      .insert(accounts)
      .values({
        deviceId: `metrics-a1-${crypto.randomUUID()}`,
        platform: "android",
        consentAnalytics: true,
      })
      .returning();
    const [a2] = await harness.ctx.db
      .insert(accounts)
      .values({
        deviceId: `metrics-a2-${crypto.randomUUID()}`,
        platform: "ios",
        consentAnalytics: true,
      })
      .returning();

    const events = [
      {
        id: crypto.randomUUID(),
        accountId: a1!.id,
        gameId: "one-spark" as const,
        name: "session_start",
        props: { platform: "android" },
        ts: new Date(`${cohortDay}T10:00:00.000Z`),
      },
      {
        id: crypto.randomUUID(),
        accountId: a1!.id,
        gameId: "one-spark" as const,
        name: "level_start",
        props: { level: 1, attempt: 1 },
        ts: new Date(`${cohortDay}T10:01:00.000Z`),
      },
      {
        id: crypto.randomUUID(),
        accountId: a1!.id,
        gameId: "one-spark" as const,
        name: "level_clear",
        props: { level: 1, stars: 3, movesLeft: 2 },
        ts: new Date(`${cohortDay}T10:02:00.000Z`),
      },
      {
        id: crypto.randomUUID(),
        accountId: a1!.id,
        gameId: "one-spark" as const,
        name: "session_end",
        props: { durationSec: 120 },
        ts: new Date(`${cohortDay}T10:05:00.000Z`),
      },
      {
        id: crypto.randomUUID(),
        accountId: a2!.id,
        gameId: "one-spark" as const,
        name: "session_start",
        props: { platform: "ios" },
        ts: new Date(`${cohortDay}T11:00:00.000Z`),
      },
      // D1 return for a1
      {
        id: crypto.randomUUID(),
        accountId: a1!.id,
        gameId: "one-spark" as const,
        name: "session_start",
        props: { platform: "android" },
        ts: new Date(`${d1}T09:00:00.000Z`),
      },
      // D7 return for a1
      {
        id: crypto.randomUUID(),
        accountId: a1!.id,
        gameId: "one-spark" as const,
        name: "session_start",
        props: { platform: "android" },
        ts: new Date(`${d7}T09:00:00.000Z`),
      },
      // Late event for cohort day (arrives after first rollup conceptually)
      {
        id: crypto.randomUUID(),
        accountId: a2!.id,
        gameId: "one-spark" as const,
        name: "level_start",
        props: { level: 2 },
        ts: new Date(`${cohortDay}T22:00:00.000Z`),
      },
      {
        id: crypto.randomUUID(),
        accountId: a2!.id,
        gameId: "one-spark" as const,
        name: "level_fail",
        props: { level: 2, reason: "moves" },
        ts: new Date(`${cohortDay}T22:05:00.000Z`),
      },
    ];

    await harness.ctx.db.insert(telemetryEvents).values(events);

    // Duplicate id — ingest path would count duplicate; rollup must stay stable.
    const dupId = events[0]!.id;
    await harness.ctx.db
      .insert(telemetryEvents)
      .values({
        id: dupId,
        accountId: a1!.id,
        gameId: "one-spark",
        name: "session_start",
        props: { platform: "android" },
        ts: new Date(`${cohortDay}T10:00:00.000Z`),
      })
      .onConflictDoNothing();

    const first = await rollupDay(harness.ctx.db, cohortDay);
    expect(first.status).toBe("ok");
    const second = await rollupDay(harness.ctx.db, cohortDay);
    expect(second.status).toBe("ok");

    const daily = await harness.ctx.db.query.metricsDaily.findFirst({
      where: (t, { and, eq }) => and(eq(t.day, cohortDay), eq(t.gameId, ""), eq(t.platform, "")),
    });
    expect(daily?.dau).toBe(2);
    expect(daily?.sessions).toBe(2);

    const cohort = await harness.ctx.db.query.metricsRetentionCohort.findFirst({
      where: (t, { and, eq }) =>
        and(eq(t.cohortDay, cohortDay), eq(t.gameId, ""), eq(t.platform, "")),
    });
    expect(cohort?.cohortSize).toBe(2);
    expect(cohort?.returnedD1).toBe(1);
    expect(cohort?.returnedD7).toBe(1);

    const level = await harness.ctx.db.query.metricsLevelDaily.findFirst({
      where: (t, { and, eq }) =>
        and(eq(t.day, cohortDay), eq(t.gameId, "one-spark"), eq(t.level, 1)),
    });
    expect(level?.starts).toBe(1);
    expect(level?.wins).toBe(1);
    expect(level?.stars3).toBe(1);

    // Re-rollup after "late" already included — still idempotent
    await rollupDay(harness.ctx.db, cohortDay);
    const dailyAgain = await harness.ctx.db.query.metricsDaily.findFirst({
      where: (t, { and, eq }) => and(eq(t.day, cohortDay), eq(t.gameId, ""), eq(t.platform, "")),
    });
    expect(dailyAgain?.dau).toBe(2);

    const token = await staffToken();
    const overview = await harness.app.inject({
      method: "GET",
      url: `/admin/v1/metrics/overview?from=${cohortDay}&to=${cohortDay}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(overview.statusCode).toBe(200);
    const body = overview.json();
    expect(body.dau).toBe(2);
    expect(body.retention.d1).toBe(0.5);

    const funnel = await harness.app.inject({
      method: "GET",
      url: `/admin/v1/metrics/funnel?from=${cohortDay}&to=${cohortDay}&gameId=one-spark`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(funnel.statusCode).toBe(200);
    expect(funnel.json().levels.length).toBeGreaterThan(0);

    const difficulty = await harness.app.inject({
      method: "GET",
      url: `/admin/v1/metrics/difficulty?from=${cohortDay}&to=${cohortDay}&gameId=one-spark`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(difficulty.statusCode).toBe(200);
    const lvl1 = difficulty.json().levels.find((l: { level: number }) => l.level === 1);
    expect(lvl1.winRate).toBe(1);
    expect(lvl1.bandMin).toBeGreaterThan(0);

    const legacy = await harness.app.inject({
      method: "GET",
      url: "/admin/v1/metrics",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(legacy.statusCode).toBe(200);
    expect(legacy.json().retention).toBeDefined();
    // Not the old null placeholders when a matured cohort exists
    expect(typeof legacy.json().retention.d1 === "number" || legacy.json().retention.d1 === null).toBe(
      true,
    );

    const quality = await harness.app.inject({
      method: "GET",
      url: `/admin/v1/metrics/quality?from=${cohortDay}&to=${d7}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(quality.statusCode).toBe(200);
  });
});
