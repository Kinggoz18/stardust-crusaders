-- Per-game rewarded defaults + house ads registry (own games only). Off by default.

ALTER TABLE ad_frequency_caps DROP CONSTRAINT IF EXISTS ad_frequency_caps_placement_chk;
ALTER TABLE ad_frequency_caps
  ADD CONSTRAINT ad_frequency_caps_placement_chk
  CHECK (placement IN ('interstitial', 'rewarded', 'house'));

INSERT INTO ad_frequency_caps (game_id, placement, min_transitions, max_transitions, max_per_session, enabled)
SELECT v.game_id::game_id, 'rewarded', 1, 1, 20, true
FROM (VALUES ('one-spark'), ('loom-rush'), ('borrowed-time')) AS v(game_id)
WHERE NOT EXISTS (
  SELECT 1 FROM ad_frequency_caps c
  WHERE c.game_id = v.game_id::game_id
    AND c.placement = 'rewarded'
    AND c.account_id IS NULL
);

-- Global house-ad master switches (single row).
CREATE TABLE house_ads_global (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  kill_switch boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO house_ads_global (id, enabled, kill_switch) VALUES (1, false, false);

-- Per-game house-ad opt-in (off by default).
CREATE TABLE house_ads_game (
  game_id game_id PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO house_ads_game (game_id, enabled) VALUES
  ('one-spark', false),
  ('loom-rush', false),
  ('borrowed-time', false);

CREATE TABLE house_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promoted_game game_id NOT NULL,
  creative_ref varchar(256) NOT NULL,
  target_games game_id[] NOT NULL,
  platform varchar(16),
  enabled boolean NOT NULL DEFAULT false,
  max_per_session integer NOT NULL DEFAULT 1,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT house_ads_platform_chk CHECK (platform IS NULL OR platform IN ('android', 'ios')),
  CONSTRAINT house_ads_max_chk CHECK (max_per_session > 0),
  CONSTRAINT house_ads_targets_chk CHECK (cardinality(target_games) > 0)
);

CREATE INDEX house_ads_enabled_idx ON house_ads (enabled) WHERE enabled = true;
