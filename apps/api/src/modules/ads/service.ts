import { randomInt } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import {
  adConfigResponseSchema,
  adRewardCallbackSchema,
  gameIdSchema,
  type AdConfigResponse,
  type AdRewardCallback,
  type GameId,
} from "@stardust/schema";
import type { Db } from "../../db/client.js";
import { adFrequencyCaps, adRewardTransactions, adUnits } from "../../db/schema.js";
import type { AdProvider } from "./provider.js";
import type { WalletService } from "../wallet/service.js";

const DEFAULT_INTERSTITIAL = {
  minTransitions: 4,
  maxTransitions: 6,
  maxPerSession: 3,
  enabled: true,
};

export class AdsService {
  constructor(
    private readonly db: Db["db"],
    private readonly provider: AdProvider,
    private readonly wallet: WalletService,
  ) {}

  async verifyAndGrant(raw: unknown, rawBody: string) {
    const payload = adRewardCallbackSchema.parse(raw);
    const ok = await this.provider.verifyRewardCallback(payload, rawBody);
    if (!ok) {
      throw unauthorized("Reward signature is invalid.", "invalid_signature");
    }
    return this.grantOnce(payload);
  }

  /** AdMob SSV GET callback. */
  async verifySsvAndGrant(queryString: string) {
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
    const interstitialBase = await this.resolveInterstitial(accountId, gameId);
    const nextGap = randomInt(interstitialBase.minTransitions, interstitialBase.maxTransitions + 1);
    const units = await this.resolveUnits(gameId);
    return adConfigResponseSchema.parse({
      provider: this.provider.name,
      gameId,
      units,
      interstitial: { ...interstitialBase, nextGap },
      rewarded: {
        ssv: true,
        kinds: ["coins", "booster", "extra_moves", "other"],
      },
    });
  }

  private async resolveInterstitial(accountId: string, gameId: GameId) {
    const override = await this.db.query.adFrequencyCaps.findFirst({
      where: and(
        eq(adFrequencyCaps.gameId, gameId),
        eq(adFrequencyCaps.accountId, accountId),
        eq(adFrequencyCaps.placement, "interstitial"),
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
        eq(adFrequencyCaps.placement, "interstitial"),
      ),
    });
    if (!defaults) return { ...DEFAULT_INTERSTITIAL };
    return {
      minTransitions: defaults.minTransitions,
      maxTransitions: defaults.maxTransitions,
      maxPerSession: defaults.maxPerSession,
      enabled: defaults.enabled,
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
