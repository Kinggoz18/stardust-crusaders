-- AdMob frequency caps (interstitial). account_id NULL = per-game default.
CREATE TABLE ad_frequency_caps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id game_id NOT NULL,
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  placement varchar(32) NOT NULL,
  max_per_hour integer NOT NULL,
  max_per_day integer NOT NULL,
  min_interval_seconds integer NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_frequency_caps_placement_chk CHECK (placement IN ('interstitial')),
  CONSTRAINT ad_frequency_caps_positive_chk CHECK (
    max_per_hour > 0 AND max_per_day > 0 AND min_interval_seconds >= 0
  )
);

CREATE UNIQUE INDEX ad_freq_game_default_uidx
  ON ad_frequency_caps (game_id, placement)
  WHERE account_id IS NULL;

CREATE UNIQUE INDEX ad_freq_account_uidx
  ON ad_frequency_caps (game_id, account_id, placement)
  WHERE account_id IS NOT NULL;

INSERT INTO ad_frequency_caps (game_id, placement, max_per_hour, max_per_day, min_interval_seconds)
VALUES
  ('one-spark', 'interstitial', 6, 30, 90),
  ('loom-rush', 'interstitial', 6, 30, 90),
  ('borrowed-time', 'interstitial', 4, 20, 120);
