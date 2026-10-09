-- expand: create enums and core tables
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TYPE staff_role AS ENUM ('owner', 'support', 'viewer');
CREATE TYPE game_id AS ENUM ('one-spark', 'loom-rush', 'borrowed-time');
CREATE TYPE link_provider AS ENUM ('apple', 'google', 'email');

CREATE TABLE games (
  id game_id PRIMARY KEY,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id varchar(128) NOT NULL,
  platform varchar(16) NOT NULL DEFAULT 'android',
  email text,
  link_provider link_provider,
  link_subject text,
  consent_analytics boolean NOT NULL DEFAULT false,
  consent_crash boolean NOT NULL DEFAULT false,
  consent_marketing boolean NOT NULL DEFAULT false,
  banned_at timestamptz,
  ban_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX accounts_device_id_active_uidx ON accounts (device_id) WHERE deleted_at IS NULL;
CREATE INDEX accounts_email_idx ON accounts (email);

CREATE TABLE refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX refresh_tokens_hash_uidx ON refresh_tokens (token_hash);

CREATE TABLE game_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  game_id game_id NOT NULL,
  revision integer NOT NULL DEFAULT 0,
  document jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX game_progress_account_game_uidx ON game_progress (account_id, game_id);

CREATE TABLE progress_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  game_id game_id NOT NULL,
  revision integer NOT NULL,
  document jsonb NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  game_id game_id,
  delta integer NOT NULL,
  balance_after integer NOT NULL,
  reason varchar(32) NOT NULL,
  ref varchar(128),
  idempotency_key varchar(128) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX wallet_ledger_idem_uidx ON wallet_ledger (account_id, idempotency_key);
CREATE INDEX wallet_ledger_account_idx ON wallet_ledger (account_id);

CREATE TABLE telemetry_events (
  id uuid PRIMARY KEY,
  account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  game_id game_id,
  name varchar(64) NOT NULL,
  session_id varchar(64),
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  ts timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX telemetry_events_game_name_idx ON telemetry_events (game_id, name);
CREATE INDEX telemetry_events_ts_idx ON telemetry_events (ts);

CREATE TABLE ad_reward_transactions (
  transaction_id varchar(128) PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  game_id game_id NOT NULL,
  reward_kind varchar(32) NOT NULL,
  amount integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE iap_webhook_events (
  event_id varchar(128) PRIMARY KEY,
  provider varchar(32) NOT NULL DEFAULT 'revenuecat',
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE staff_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  totp_secret text NOT NULL,
  role staff_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz
);
CREATE UNIQUE INDEX staff_users_email_uidx ON staff_users (email);

CREATE TABLE staff_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX staff_sessions_hash_uidx ON staff_sessions (token_hash);

CREATE TABLE admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  action varchar(64) NOT NULL,
  target_type varchar(64) NOT NULL,
  target_id text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_log_created_idx ON admin_audit_log (created_at);

CREATE TABLE idempotency_keys (
  key varchar(128) PRIMARY KEY,
  route varchar(128) NOT NULL,
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO games (id, display_name) VALUES
  ('one-spark', 'One Spark'),
  ('loom-rush', 'Loom Rush'),
  ('borrowed-time', 'Borrowed Time')
ON CONFLICT DO NOTHING;
