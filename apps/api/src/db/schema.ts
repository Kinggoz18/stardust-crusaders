import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
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
  maxPerHour: integer("max_per_hour").notNull(),
  maxPerDay: integer("max_per_day").notNull(),
  minIntervalSeconds: integer("min_interval_seconds").notNull().default(60),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

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
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 64 }).notNull(),
    targetType: varchar("target_type", { length: 64 }).notNull(),
    targetId: text("target_id"),
    meta: jsonb("meta").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("admin_audit_log_created_idx").on(t.createdAt)],
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

export type Account = typeof accounts.$inferSelect;
export type StaffUser = typeof staffUsers.$inferSelect;
