import {
  bigint,
  boolean,
  date,
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  index,
} from "drizzle-orm/pg-core";

export const staffRoleEnum = pgEnum("staff_role", ["owner", "support", "viewer"]);
export const gameIdEnum = pgEnum("game_id", ["one-spark", "loom-rush", "borrowed-time"]);
export const linkProviderEnum = pgEnum("link_provider", ["apple", "google", "email"]);

export const games = pgTable("games", {
  id: gameIdEnum("id").primaryKey(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deviceId: varchar("device_id", { length: 128 }).notNull(),
    platform: varchar("platform", { length: 16 }).notNull().default("android"),
    email: text("email"),
    linkProvider: linkProviderEnum("link_provider"),
    linkSubject: text("link_subject"),
    consentAnalytics: boolean("consent_analytics").notNull().default(false),
    consentCrash: boolean("consent_crash").notNull().default(false),
    consentMarketing: boolean("consent_marketing").notNull().default(false),
    bannedAt: timestamp("banned_at", { withTimezone: true }),
    banReason: text("ban_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("accounts_device_id_active_uidx").on(t.deviceId),
    index("accounts_email_idx").on(t.email),
  ],
);

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("refresh_tokens_hash_uidx").on(t.tokenHash)],
);

export const gameProgress = pgTable(
  "game_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    gameId: gameIdEnum("game_id").notNull(),
    revision: integer("revision").notNull().default(0),
    document: jsonb("document").notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("game_progress_account_game_uidx").on(t.accountId, t.gameId)],
);

export const progressBackups = pgTable("progress_backups", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  gameId: gameIdEnum("game_id").notNull(),
  revision: integer("revision").notNull(),
  document: jsonb("document").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const walletLedger = pgTable(
  "wallet_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    gameId: gameIdEnum("game_id"),
    delta: integer("delta").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    reason: varchar("reason", { length: 32 }).notNull(),
    ref: varchar("ref", { length: 128 }),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("wallet_ledger_idem_uidx").on(t.accountId, t.idempotencyKey),
    index("wallet_ledger_account_idx").on(t.accountId),
  ],
);

export const telemetryEvents = pgTable(
  "telemetry_events",
  {
    id: uuid("id").primaryKey(),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    gameId: gameIdEnum("game_id"),
    name: varchar("name", { length: 64 }).notNull(),
    sessionId: varchar("session_id", { length: 64 }),
    props: jsonb("props").notNull().default({}),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("telemetry_events_game_name_idx").on(t.gameId, t.name),
    index("telemetry_events_ts_idx").on(t.ts),
  ],
);

export const adRewardTransactions = pgTable(
  "ad_reward_transactions",
  {
    transactionId: varchar("transaction_id", { length: 128 }).primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    gameId: gameIdEnum("game_id").notNull(),
    rewardKind: varchar("reward_kind", { length: 32 }).notNull(),
    amount: integer("amount").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
);

export const adFrequencyCaps = pgTable("ad_frequency_caps", {
  id: uuid("id").defaultRandom().primaryKey(),
  gameId: gameIdEnum("game_id").notNull(),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
  placement: varchar("placement", { length: 32 }).notNull(),
  minTransitions: integer("min_transitions").notNull(),
  maxTransitions: integer("max_transitions").notNull(),
  maxPerSession: integer("max_per_session").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const adUnits = pgTable(
  "ad_units",
  {
    gameId: gameIdEnum("game_id").notNull(),
    format: varchar("format", { length: 32 }).notNull(),
    unitId: varchar("unit_id", { length: 128 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("ad_units_game_format_uidx").on(t.gameId, t.format)],
);

export const iapWebhookEvents = pgTable("iap_webhook_events", {
  eventId: varchar("event_id", { length: 128 }).primaryKey(),
  provider: varchar("provider", { length: 32 }).notNull().default("revenuecat"),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const staffUsers = pgTable(
  "staff_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    totpSecret: text("totp_secret").notNull(),
    role: staffRoleEnum("role").notNull().default("viewer"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("staff_users_email_uidx").on(t.email)],
);

export const staffSessions = pgTable(
  "staff_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("staff_sessions_hash_uidx").on(t.tokenHash)],
);

export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    staffId: uuid("staff_id").references(() => staffUsers.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 64 }).notNull(),
    targetType: varchar("target_type", { length: 64 }).notNull(),
    targetId: text("target_id"),
    meta: jsonb("meta").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("admin_audit_log_created_idx").on(t.createdAt)],
);

/** Singleton row: whether the env master key has been consumed. */
export const adminBootstrap = pgTable("admin_bootstrap", {
  id: integer("id").primaryKey().default(1),
  masterKeyUsedAt: timestamp("master_key_used_at", { withTimezone: true }),
  masterAdminId: uuid("master_admin_id").references(() => staffUsers.id, {
    onDelete: "set null",
  }),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const staffInvites = pgTable(
  "staff_invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    role: staffRoleEnum("role").notNull(),
    tokenHash: text("token_hash").notNull(),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("staff_invites_token_uidx").on(t.tokenHash),
    index("staff_invites_email_idx").on(t.email),
  ],
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    key: varchar("key", { length: 128 }).primaryKey(),
    route: varchar("route", { length: 128 }).notNull(),
    responseStatus: integer("response_status").notNull(),
    responseBody: jsonb("response_body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
);

/** Migration journal table managed by our migrator. */
export const schemaMigrations = pgTable("schema_migrations", {
  id: varchar("id", { length: 128 }).primaryKey(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).defaultNow().notNull(),
});

export const metricsDaily = pgTable(
  "metrics_daily",
  {
    day: date("day").notNull(),
    gameId: varchar("game_id", { length: 32 }).notNull().default(""),
    platform: varchar("platform", { length: 16 }).notNull().default(""),
    newAccounts: integer("new_accounts").notNull().default(0),
    dau: integer("dau").notNull().default(0),
    wau: integer("wau").notNull().default(0),
    mau: integer("mau").notNull().default(0),
    sessions: integer("sessions").notNull().default(0),
    sessionSecondsSum: bigint("session_seconds_sum", { mode: "number" }).notNull().default(0),
    sessionEndCount: integer("session_end_count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.gameId, t.platform] })],
);

export const metricsRetentionCohort = pgTable(
  "metrics_retention_cohort",
  {
    cohortDay: date("cohort_day").notNull(),
    gameId: varchar("game_id", { length: 32 }).notNull().default(""),
    platform: varchar("platform", { length: 16 }).notNull().default(""),
    cohortSize: integer("cohort_size").notNull().default(0),
    returnedD1: integer("returned_d1").notNull().default(0),
    returnedD7: integer("returned_d7").notNull().default(0),
    returnedD30: integer("returned_d30").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.cohortDay, t.gameId, t.platform] })],
);

export const metricsLevelDaily = pgTable(
  "metrics_level_daily",
  {
    day: date("day").notNull(),
    gameId: gameIdEnum("game_id").notNull(),
    level: integer("level").notNull(),
    starts: integer("starts").notNull().default(0),
    wins: integer("wins").notNull().default(0),
    fails: integer("fails").notNull().default(0),
    quits: integer("quits").notNull().default(0),
    movesLeftSum: integer("moves_left_sum").notNull().default(0),
    movesLeftN: integer("moves_left_n").notNull().default(0),
    stars0: integer("stars_0").notNull().default(0),
    stars1: integer("stars_1").notNull().default(0),
    stars2: integer("stars_2").notNull().default(0),
    stars3: integer("stars_3").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.gameId, t.level] })],
);

export const metricsEconomyDaily = pgTable(
  "metrics_economy_daily",
  {
    day: date("day").notNull(),
    gameId: varchar("game_id", { length: 32 }).notNull().default(""),
    hintsCoins: integer("hints_coins").notNull().default(0),
    hintsAds: integer("hints_ads").notNull().default(0),
    coinIn: integer("coin_in").notNull().default(0),
    coinOut: integer("coin_out").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.gameId] })],
);

export const metricsAdsDaily = pgTable(
  "metrics_ads_daily",
  {
    day: date("day").notNull(),
    gameId: varchar("game_id", { length: 32 }).notNull().default(""),
    rewardedOffers: integer("rewarded_offers").notNull().default(0),
    rewardedStarts: integer("rewarded_starts").notNull().default(0),
    rewardedCompletions: integer("rewarded_completions").notNull().default(0),
    rewardsGranted: integer("rewards_granted").notNull().default(0),
    interstitialImpressions: integer("interstitial_impressions").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.gameId] })],
);

export const metricsAdRevenueDaily = pgTable(
  "metrics_ad_revenue_daily",
  {
    day: date("day").notNull(),
    gameId: varchar("game_id", { length: 32 }).notNull().default(""),
    revenueMicros: bigint("revenue_micros", { mode: "number" }).notNull().default(0),
    impressions: integer("impressions").notNull().default(0),
    source: varchar("source", { length: 32 }).notNull().default("pending"),
  },
  (t) => [primaryKey({ columns: [t.day, t.gameId] })],
);

export const metricsIapDaily = pgTable(
  "metrics_iap_daily",
  {
    day: date("day").notNull(),
    gameId: varchar("game_id", { length: 32 }).notNull().default(""),
    purchasers: integer("purchasers").notNull().default(0),
    revenueCents: integer("revenue_cents").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.gameId] })],
);

export const metricsQualityDaily = pgTable("metrics_quality_daily", {
  day: date("day").primaryKey(),
  accepted: integer("accepted").notNull().default(0),
  duplicates: integer("duplicates").notNull().default(0),
  rejected: integer("rejected").notNull().default(0),
  consentOptOuts: integer("consent_opt_outs").notNull().default(0),
});

export const metricsRollupRuns = pgTable("metrics_rollup_runs", {
  day: date("day").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: varchar("status", { length: 32 }).notNull().default("running"),
  detail: jsonb("detail").notNull().default({}),
});

export const levelDifficultyBands = pgTable(
  "level_difficulty_bands",
  {
    gameId: gameIdEnum("game_id").notNull(),
    level: integer("level").notNull(),
    winRateMin: doublePrecision("win_rate_min").notNull(),
    winRateMax: doublePrecision("win_rate_max").notNull(),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.level] })],
);

export type Account = typeof accounts.$inferSelect;
export type StaffUser = typeof staffUsers.$inferSelect;
