DROP TABLE IF EXISTS ad_units;

ALTER TABLE ad_frequency_caps DROP CONSTRAINT IF EXISTS ad_frequency_caps_transitions_chk;

ALTER TABLE ad_frequency_caps
  ADD COLUMN max_per_hour integer,
  ADD COLUMN max_per_day integer,
  ADD COLUMN min_interval_seconds integer DEFAULT 60;

UPDATE ad_frequency_caps
SET
  max_per_hour = max_per_session * 2,
  max_per_day = max_per_session * 10,
  min_interval_seconds = 90;

ALTER TABLE ad_frequency_caps
  ALTER COLUMN max_per_hour SET NOT NULL,
  ALTER COLUMN max_per_day SET NOT NULL,
  ALTER COLUMN min_interval_seconds SET NOT NULL;

ALTER TABLE ad_frequency_caps
  DROP COLUMN min_transitions,
  DROP COLUMN max_transitions,
  DROP COLUMN max_per_session,
  DROP COLUMN enabled;

ALTER TABLE ad_frequency_caps
  ADD CONSTRAINT ad_frequency_caps_positive_chk CHECK (
    max_per_hour > 0 AND max_per_day > 0 AND min_interval_seconds >= 0
  );
