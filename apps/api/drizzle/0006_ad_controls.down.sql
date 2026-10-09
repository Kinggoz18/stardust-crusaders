DROP TABLE IF EXISTS house_ads;
DROP TABLE IF EXISTS house_ads_game;
DROP TABLE IF EXISTS house_ads_global;

DELETE FROM ad_frequency_caps WHERE placement = 'rewarded';

ALTER TABLE ad_frequency_caps DROP CONSTRAINT IF EXISTS ad_frequency_caps_placement_chk;
ALTER TABLE ad_frequency_caps
  ADD CONSTRAINT ad_frequency_caps_placement_chk
  CHECK (placement IN ('interstitial'));
