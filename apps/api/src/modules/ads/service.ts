import { randomInt } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import {
  ADS_DISABLED_IN_ENVIRONMENT_CODE,
  ADS_DISABLED_IN_ENVIRONMENT_MESSAGE,
  adConfigResponseSchema,
  adRewardCallbackSchema,
  gameIdSchema,
  isClientAdsEnabled,
  type AdConfigResponse,
  type AdRewardCallback,
  type GameId,
} from "@stardust/schema";
import type { Config } from "../../config.js";
import type { Db } from "../../db/client.js";
import {
  adFrequencyCaps,
  adRewardTransactions,
  adUnits,
  houseAds,
  houseAdsGame,
  houseAdsGlobal,
} from "../../db/schema.js";
import type { AdProvider } from "./provider.js";
import type { WalletService } from "../wallet/service.js";

const DEFAULT_INTERSTITIAL = {
  minTransitions: 4,
  maxTransitions: 6,
  maxPerSession: 3,
  enabled: true,
};

const DEFAULT_REWARDED = {
  enabled: true,
  maxPerSession: 20,
};

export class AdsService {
  constructor(
    private readonly db: Db["db"],
    private readonly provider: AdProvider,
    private readonly wallet: WalletService,
    private readonly config: Config,
  ) {}

  private assertClientAdsEnabled() {
    if (!isClientAdsEnabled(this.config.NODE_ENV)) {
      throw adsDisabled();
    }
  }

  async verifyAndGrant(raw: unknown, rawBody: string) {
    this.assertClientAdsEnabled();
    const payload = adRewardCallbackSchema.parse(raw);
    const ok = await this.provider.verifyRewardCallback(payload, rawBody);
    if (!ok) {
      throw unauthorized("Reward signature is invalid.", "invalid_signature");
    }
    return this.grantOnce(payload);
  }

  /** AdMob SSV GET callback. */
  async verifySsvAndGrant(queryString: string) {
    this.assertClientAdsEnabled();
    if (!this.provider.verifySsvQuery) {
      throw unauthorized("This ad network does not use that callback.", "unsupported_provider");
    }
    const payload = await this.provider.verifySsvQuery(queryString);
    if (!payload) {
      throw unauthorized("Reward signature is invalid.", "invalid_signature");
    }
    return this.grantOnce(payload);
  }

  async configFor(accountId: string, gameIdRaw: string): Promise<AdConfigResponse> {
    const gameId = gameIdSchema.parse(gameIdRaw);
    const units = await this.resolveUnits(gameId);
    if (!isClientAdsEnabled(this.config.NODE_ENV)) {
      return adConfigResponseSchema.parse({
        provider: this.provider.name,
        gameId,
        units,
        interstitial: {
          ...DEFAULT_INTERSTITIAL,
          enabled: false,
          nextGap: DEFAULT_INTERSTITIAL.minTransitions,
        },
        rewarded: {
          ssv: true,
          kinds: ["coins", "booster", "extra_moves", "other"],
          enabled: false,
          maxPerSession: DEFAULT_REWARDED.maxPerSession,
        },
        houseAds: {
          available: false,
          killSwitch: false,
          globalEnabled: false,
          gameEnabled: false,
          rules: {
            naturalBreakOnly: true,
            neverAfterOtherAd: true,
            requiresConsent: true,
            neverSelfPromote: true,
          },
          items: [],
        },
      });
    }
    const interstitialBase = await this.resolveCap(accountId, gameId, "interstitial", DEFAULT_INTERSTITIAL);
    const rewardedBase = await this.resolveCap(accountId, gameId, "rewarded", {
      minTransitions: 1,
      maxTransitions: 1,
      maxPerSession: DEFAULT_REWARDED.maxPerSession,
      enabled: DEFAULT_REWARDED.enabled,
    });
    const nextGap = randomInt(interstitialBase.minTransitions, interstitialBase.maxTransitions + 1);
    const houseAdsConfig = await this.resolveHouseAds(gameId);
    return adConfigResponseSchema.parse({
      provider: this.provider.name,
      gameId,
      units,
      interstitial: { ...interstitialBase, nextGap },
      rewarded: {
        ssv: true,
        kinds: ["coins", "booster", "extra_moves", "other"],
        enabled: rewardedBase.enabled,
        maxPerSession: rewardedBase.maxPerSession,
      },
      houseAds: houseAdsConfig,
    });
  }

  private async resolveCap(
    accountId: string,
    gameId: GameId,
    placement: string,
    fallback: {
      minTransitions: number;
      maxTransitions: number;
      maxPerSession: number;
      enabled: boolean;
    },
  ) {
    const override = await this.db.query.adFrequencyCaps.findFirst({
      where: and(
        eq(adFrequencyCaps.gameId, gameId),
        eq(adFrequencyCaps.accountId, accountId),
        eq(adFrequencyCaps.placement, placement),
      ),
    });
    if (override) {
      return {
        minTransitions: override.minTransitions,
        maxTransitions: override.maxTransitions,
        maxPerSession: override.maxPerSession,
        enabled: override.enabled,
      };
    }
    const defaults = await this.db.query.adFrequencyCaps.findFirst({
      where: and(
        eq(adFrequencyCaps.gameId, gameId),
        isNull(adFrequencyCaps.accountId),
        eq(adFrequencyCaps.placement, placement),
      ),
    });
    if (!defaults) return { ...fallback };
    return {
      minTransitions: defaults.minTransitions,
      maxTransitions: defaults.maxTransitions,
      maxPerSession: defaults.maxPerSession,
      enabled: defaults.enabled,
    };
  }

  private async resolveHouseAds(gameId: GameId) {
    const global =
      (await this.db.query.houseAdsGlobal.findFirst({ where: eq(houseAdsGlobal.id, 1) })) ?? {
        enabled: false,
        killSwitch: false,
      };
    const gameRow = await this.db.query.houseAdsGame.findFirst({
      where: eq(houseAdsGame.gameId, gameId),
    });
    const gameEnabled = gameRow?.enabled ?? false;
    const available = !global.killSwitch && global.enabled && gameEnabled;

    const now = new Date();
    let items: Array<{
      id: string;
      promotedGame: GameId;
      creativeRef: string;
      maxPerSession: number;
    }> = [];

    if (available) {
      const rows = await this.db.select().from(houseAds).where(eq(houseAds.enabled, true));
      items = rows
        .filter((r) => {
          if (r.promotedGame === gameId) return false;
          if (!r.targetGames.includes(gameId)) return false;
          if (r.startsAt && r.startsAt > now) return false;
          if (r.endsAt && r.endsAt < now) return false;
          return true;
        })
        .map((r) => ({
          id: r.id,
          promotedGame: r.promotedGame,
          creativeRef: r.creativeRef,
          maxPerSession: r.maxPerSession,
        }));
    }

    return {
      available: available && items.length > 0,
      killSwitch: global.killSwitch,
      globalEnabled: global.enabled,
      gameEnabled,
      rules: {
        naturalBreakOnly: true as const,
        neverAfterOtherAd: true as const,
        requiresConsent: true as const,
        neverSelfPromote: true as const,
      },
      items: available ? items : [],
    };
  }

  private async resolveUnits(gameId: GameId) {
    const rows = await this.db.query.adUnits.findMany({
      where: eq(adUnits.gameId, gameId),
    });
    const interstitial = rows.find((r) => r.format === "interstitial")?.unitId;
    const rewarded = rows.find((r) => r.format === "rewarded")?.unitId;
    if (!interstitial || !rewarded) {
      const err = new Error("Ad units are not configured for this game.") as Error & {
        statusCode: number;
        code: string;
      };
      err.statusCode = 500;
      err.code = "ad_units_missing";
      throw err;
    }
    return { interstitial, rewarded };
  }

  private async grantOnce(payload: AdRewardCallback) {
    const account = await this.db.query.accounts.findFirst({
      where: (a, { eq }) => eq(a.id, payload.accountId),
    });
    if (!account || account.deletedAt || account.bannedAt) {
      throw unauthorized("Reward account is not eligible.", "wrong_account");
    }

    const existing = await this.db.query.adRewardTransactions.findFirst({
      where: (t, { eq }) => eq(t.transactionId, payload.transactionId),
    });
    if (existing) {
      const balance = await this.wallet.balance(payload.accountId);
      return { granted: false, duplicate: true, balance };
    }

    try {
      await this.db.insert(adRewardTransactions).values({
        transactionId: payload.transactionId,
        accountId: payload.accountId,
        gameId: payload.gameId,
        rewardKind: payload.reward.kind,
        amount: payload.reward.amount,
      });
    } catch {
      const balance = await this.wallet.balance(payload.accountId);
      return { granted: false, duplicate: true, balance };
    }

    if (payload.reward.kind === "coins") {
      const { entry } = await this.wallet.append(payload.accountId, {
        gameId: payload.gameId,
        delta: payload.reward.amount,
        reason: "ad_reward",
        ref: payload.transactionId,
        idempotencyKey: `ad:${payload.transactionId}`,
      });
      return { granted: true, duplicate: false, balance: entry.balanceAfter };
    }

    const balance = await this.wallet.balance(payload.accountId);
    return { granted: true, duplicate: false, balance };
  }
}

function unauthorized(message: string, code: string) {
  const err = new Error(message) as Error & { statusCode: number; code: string };
  err.statusCode = 401;
  err.code = code;
  return err;
}

function adsDisabled() {
  const err = new Error(ADS_DISABLED_IN_ENVIRONMENT_MESSAGE) as Error & {
    statusCode: number;
    code: string;
  };
  err.statusCode = 403;
  err.code = ADS_DISABLED_IN_ENVIRONMENT_CODE;
  return err;
}
