/**
 * Ads behind one small interface, so the real SDK is swapped in here and nowhere else.
 * showRewarded() resolves true when the player watched to the end and earned the reward.
 */
export type InterstitialResult = { shown: boolean };

export type AdPort = {
  ready(): boolean;
  showRewarded(): Promise<boolean>;
  showInterstitial(): Promise<InterstitialResult>;
};

export const noopAds: AdPort = {
  ready: () => false,
  async showRewarded() {
    return false;
  },
  async showInterstitial() {
    return { shown: false };
  },
};

/** Development stand-in until an ad SDK lands: a rewarded "ad" that lasts `ms` and always pays out. */
export function devAds(ms = 2000): AdPort {
  return {
    ready: () => true,
    showRewarded: () => new Promise((done) => setTimeout(() => done(true), ms)),
    async showInterstitial() {
      return { shown: false };
    },
  };
}

export function createAds(_consent = true): AdPort {
  return devAds();
}
