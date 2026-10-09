import { adRewardCallbackSchema } from "@stardust/schema";
import type { Db } from "../../db/client.js";
import { adRewardTransactions } from "../../db/schema.js";
import type { AdProvider } from "./provider.js";
import type { WalletService } from "../wallet/service.js";

export class AdsService {
  constructor(
    private readonly db: Db["db"],
    private readonly provider: AdProvider,
    private readonly wallet: WalletService,
  ) {}

  async verifyAndGrant(raw: unknown, rawBody: string) {
    const payload = adRewardCallbackSchema.parse(raw);
    if (!this.provider.verifyRewardCallback(payload, rawBody)) {
      const err = new Error("Reward signature is invalid.") as Error & {
        statusCode: number;
        code: string;
      };
      err.statusCode = 401;
      err.code = "invalid_signature";
      throw err;
    }

    const existing = await this.db.query.adRewardTransactions.findFirst({
      where: (t, { eq }) => eq(t.transactionId, payload.transactionId),
    });
    if (existing) {
      const balance = await this.wallet.balance(payload.accountId);
      return { granted: false, duplicate: true, balance };
    }

    await this.db.insert(adRewardTransactions).values({
      transactionId: payload.transactionId,
      accountId: payload.accountId,
      gameId: payload.gameId,
      rewardKind: payload.reward.kind,
      amount: payload.reward.amount,
    });

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
