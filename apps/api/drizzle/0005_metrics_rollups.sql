-- Metrics rollups (forever) + difficulty bands + AdMob revenue placeholder + ingest quality.

CREATE TABLE metrics_daily (
  day date NOT NULL,
  game_id varchar(32) NOT NULL DEFAULT '',
  platform varchar(16) NOT NULL DEFAULT '',
  new_accounts integer NOT NULL DEFAULT 0,
  dau integer NOT NULL DEFAULT 0,
  wau integer NOT NULL DEFAULT 0,
  mau integer NOT NULL DEFAULT 0,
  sessions integer NOT NULL DEFAULT 0,
  session_seconds_sum bigint NOT NULL DEFAULT 0,
  session_end_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, game_id, platform)
);

CREATE TABLE metrics_retention_cohort (
  cohort_day date NOT NULL,
  game_id varchar(32) NOT NULL DEFAULT '',
  platform varchar(16) NOT NULL DEFAULT '',
  cohort_size integer NOT NULL DEFAULT 0,
  returned_d1 integer NOT NULL DEFAULT 0,
  returned_d7 integer NOT NULL DEFAULT 0,
  returned_d30 integer NOT NULL DEFAULT 0,
  PRIMARY KEY (cohort_day, game_id, platform)
);

CREATE TABLE metrics_level_daily (
  day date NOT NULL,
  game_id game_id NOT NULL,
  level integer NOT NULL,
  starts integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  fails integer NOT NULL DEFAULT 0,
  quits integer NOT NULL DEFAULT 0,
  moves_left_sum integer NOT NULL DEFAULT 0,
  moves_left_n integer NOT NULL DEFAULT 0,
  stars_0 integer NOT NULL DEFAULT 0,
  stars_1 integer NOT NULL DEFAULT 0,
  stars_2 integer NOT NULL DEFAULT 0,
  stars_3 integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, game_id, level)
);

CREATE TABLE metrics_economy_daily (
  day date NOT NULL,
  game_id varchar(32) NOT NULL DEFAULT '',
  hints_coins integer NOT NULL DEFAULT 0,
  hints_ads integer NOT NULL DEFAULT 0,
  coin_in integer NOT NULL DEFAULT 0,
  coin_out integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, game_id)
);

CREATE TABLE metrics_ads_daily (
  day date NOT NULL,
  game_id varchar(32) NOT NULL DEFAULT '',
  rewarded_offers integer NOT NULL DEFAULT 0,
  rewarded_starts integer NOT NULL DEFAULT 0,
  rewarded_completions integer NOT NULL DEFAULT 0,
  rewards_granted integer NOT NULL DEFAULT 0,
  interstitial_impressions integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, game_id)
);

-- Filled later from AdMob reports (ARPDAU). Schema reserved now.
CREATE TABLE metrics_ad_revenue_daily (
  day date NOT NULL,
  game_id varchar(32) NOT NULL DEFAULT '',
  revenue_micros bigint NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  source varchar(32) NOT NULL DEFAULT 'pending',
  PRIMARY KEY (day, game_id)
);

CREATE TABLE metrics_iap_daily (
  day date NOT NULL,
  game_id varchar(32) NOT NULL DEFAULT '',
  purchasers integer NOT NULL DEFAULT 0,
  revenue_cents integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, game_id)
);

CREATE TABLE metrics_quality_daily (
  day date NOT NULL PRIMARY KEY,
  accepted integer NOT NULL DEFAULT 0,
  duplicates integer NOT NULL DEFAULT 0,
  rejected integer NOT NULL DEFAULT 0,
  consent_opt_outs integer NOT NULL DEFAULT 0
);

CREATE TABLE metrics_rollup_runs (
  day date NOT NULL PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status varchar(32) NOT NULL DEFAULT 'running',
  detail jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE level_difficulty_bands (
  game_id game_id NOT NULL,
  level integer NOT NULL,
  win_rate_min double precision NOT NULL,
  win_rate_max double precision NOT NULL,
  PRIMARY KEY (game_id, level),
  CONSTRAINT level_difficulty_bands_chk CHECK (
    win_rate_min >= 0 AND win_rate_max <= 1 AND win_rate_max >= win_rate_min
  )
);

-- One Spark designed greedy win-rate bands (FINAL_PLAN phases), levels 1–40 seed.
INSERT INTO level_difficulty_bands (game_id, level, win_rate_min, win_rate_max)
SELECT
  'one-spark'::game_id,
  g.level,
  CASE
    WHEN g.level <= 10 THEN 0.9200
    WHEN g.level <= 20 THEN 0.8000
    WHEN g.level <= 40 THEN 0.6500
    ELSE 0.5500
  END,
  CASE
    WHEN g.level <= 10 THEN 1.0000
    WHEN g.level <= 20 THEN 0.9200
    WHEN g.level <= 40 THEN 0.8000
    ELSE 0.7000
  END
FROM generate_series(1, 40) AS g(level);

CREATE INDEX telemetry_events_account_ts_idx ON telemetry_events (account_id, ts);
CREATE INDEX telemetry_events_name_ts_idx ON telemetry_events (name, ts);
