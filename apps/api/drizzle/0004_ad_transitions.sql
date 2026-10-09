-- Interstitial frequency: level transitions per session (not wall-clock time).
ALTER TABLE ad_frequency_caps
  ADD COLUMN min_transitions integer,
  ADD COLUMN max_transitions integer,
  ADD COLUMN max_per_session integer,
  ADD COLUMN enabled boolean NOT NULL DEFAULT true;

UPDATE ad_frequency_caps
SET
  min_transitions = 4,
  max_transitions = 6,
  max_per_session = 3,
  enabled = true;

ALTER TABLE ad_frequency_caps
  ALTER COLUMN min_transitions SET NOT NULL,
  ALTER COLUMN max_transitions SET NOT NULL,
  ALTER COLUMN max_per_session SET NOT NULL;

ALTER TABLE ad_frequency_caps DROP CONSTRAINT ad_frequency_caps_positive_chk;

ALTER TABLE ad_frequency_caps
  DROP COLUMN max_per_hour,
  DROP COLUMN max_per_day,
  DROP COLUMN min_interval_seconds;

ALTER TABLE ad_frequency_caps
  ADD CONSTRAINT ad_frequency_caps_transitions_chk CHECK (
    min_transitions > 0
    AND max_transitions >= min_transitions
    AND max_per_session > 0
  );

-- One AdMob ad-unit id per game × format (interstitial | rewarded). No native.
CREATE TABLE ad_units (
  game_id game_id NOT NULL,
  format varchar(32) NOT NULL,
  unit_id varchar(128) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (game_id, format),
  CONSTRAINT ad_units_format_chk CHECK (format IN ('interstitial', 'rewarded'))
);

-- Placeholder unit ids for local/test — replace in AdMob dashboard / ops (names only here).
INSERT INTO ad_units (game_id, format, unit_id) VALUES
  ('one-spark', 'interstitial', 'ca-app-pub-test/one-spark-interstitial'),
  ('one-spark', 'rewarded', 'ca-app-pub-test/one-spark-rewarded'),
  ('loom-rush', 'interstitial', 'ca-app-pub-test/loom-rush-interstitial'),
  ('loom-rush', 'rewarded', 'ca-app-pub-test/loom-rush-rewarded'),
  ('borrowed-time', 'interstitial', 'ca-app-pub-test/borrowed-time-interstitial'),
  ('borrowed-time', 'rewarded', 'ca-app-pub-test/borrowed-time-rewarded');
