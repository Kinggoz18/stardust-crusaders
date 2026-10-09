import { loadConfig } from "../config.js";
import { createDb } from "./client.js";
import { accounts, gameProgress, walletLedger } from "./schema.js";
import { migrateUp } from "./migrator.js";

const FAKE_PREFIX = "fake-seed-";

const config = loadConfig();
const { db, sql } = createDb(config.DATABASE_URL);
await migrateUp(sql);

const seeds = [
  {
    deviceId: `${FAKE_PREFIX}one-spark-device`,
    gameId: "one-spark" as const,
    document: {
      schemaVersion: 1,
      stars: { "1": [true, true, false] },
      album: { japan: "normal" },
      tutorialDone: true,
      coins: 12,
      firstClear: { "1": true },
      daily: { lastPlayed: null, lastRewarded: null, streak: 0, lastStreakDate: null },
      travelSeen: {},
    },
  },
  {
    deviceId: `${FAKE_PREFIX}loom-rush-device`,
    gameId: "loom-rush" as const,
    document: {
      schemaVersion: 1,
      _draft: true,
      levelReached: 3,
      stars: { "1": 3, "2": 2 },
      wardrobe: ["apron"],
      coins: 20,
      boosters: { unpick: 1, snip: 0, shuffle: 0, peek: 0 },
      tutorialDone: true,
    },
  },
  {
    deviceId: `${FAKE_PREFIX}borrowed-time-device`,
    gameId: "borrowed-time" as const,
    document: {
      schemaVersion: 1,
      _draft: true,
      island: {
        schemaVersion: 1,
        _draft: true,
        islandId: "fake-island-1",
        tier: "colony",
        lots: [],
        buildings: [],
        palisade: 0,
        roads: 0,
        debt: 0,
        greySet: [],
        tech: {},
        defence: {},
      },
      eventLog: [],
      commandLog: [],
      coins: 0,
    },
  },
];

for (const s of seeds) {
  const [account] = await db
    .insert(accounts)
    .values({
      deviceId: s.deviceId,
      platform: "android",
      consentAnalytics: false,
      consentCrash: false,
      consentMarketing: false,
    })
    .onConflictDoNothing()
    .returning();

  const row =
    account ??
    (await db.query.accounts.findFirst({
      where: (a, { eq }) => eq(a.deviceId, s.deviceId),
    }));
  if (!row) continue;

  await db
    .insert(gameProgress)
    .values({
      accountId: row.id,
      gameId: s.gameId,
      revision: 1,
      document: s.document,
    })
    .onConflictDoNothing();

  await db
    .insert(walletLedger)
    .values({
      accountId: row.id,
      gameId: s.gameId,
      delta: 10,
      balanceAfter: 10,
      reason: "other",
      ref: "seed",
      idempotencyKey: `${FAKE_PREFIX}${s.gameId}-wallet`,
    })
    .onConflictDoNothing();
}

// Staff owner for local admin (TOTP secret printed once — test only).
import { AdminAuthService } from "../modules/admin/auth.js";
const adminAuth = new AdminAuthService(db);
const existingStaff = await db.query.staffUsers.findFirst({
  where: (t, { eq }) => eq(t.email, "owner@stardust.local"),
});
if (!existingStaff) {
  const staff = await adminAuth.createStaff({
    email: "owner@stardust.local",
    password: "local-dev-password",
    role: "owner",
  });
  console.log("seed: staff owner@stardust.local / local-dev-password");
  console.log("seed: totp secret (test only):", staff.totpSecret);
}

console.log("seed: fake accounts marked with device id prefix", FAKE_PREFIX);
await sql.end({ timeout: 5 });
