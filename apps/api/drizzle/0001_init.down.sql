-- contract: drop tables then enums
DROP TABLE IF EXISTS idempotency_keys;
DROP TABLE IF EXISTS admin_audit_log;
DROP TABLE IF EXISTS staff_sessions;
DROP TABLE IF EXISTS staff_users;
DROP TABLE IF EXISTS iap_webhook_events;
DROP TABLE IF EXISTS ad_reward_transactions;
DROP TABLE IF EXISTS telemetry_events;
DROP TABLE IF EXISTS wallet_ledger;
DROP TABLE IF EXISTS progress_backups;
DROP TABLE IF EXISTS game_progress;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS games;
DROP TYPE IF EXISTS link_provider;
DROP TYPE IF EXISTS game_id;
DROP TYPE IF EXISTS staff_role;
