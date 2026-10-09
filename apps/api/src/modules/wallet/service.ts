import { desc, eq } from "drizzle-orm";
import { postWalletEntryRequestSchema, type GameId } from "@stardust/schema";
import type { Db } from "../../db/client.js";
import { walletLedger } from "../../db/schema.js";

export class WalletService {
  constructor(private readonly db: Db["db"]) {}

  async balance(accountId: string): Promise<number> {
    const latest = await this.db.query.walletLedger.findFirst({
      where: eq(walletLedger.accountId, accountId),
      orderBy: [desc(walletLedger.createdAt)],
    });
    return latest?.balanceAfter ?? 0;
  }

  async list(accountId: string, limit = 50) {
    return this.db.query.walletLedger.findMany({
      where: eq(walletLedger.accountId, accountId),
      orderBy: [desc(walletLedger.createdAt)],
      limit,
    });
  }

  async append(accountId: string, raw: unknown) {
    const body = postWalletEntryRequestSchema.parse(raw);
    const existing = await this.db.query.walletLedger.findFirst({
      where: eq(walletLedger.idempotencyKey, body.idempotencyKey),
    });
    if (existing && existing.accountId === accountId) {
      return { entry: existing, duplicate: true };
    }

    const current = await this.balance(accountId);
    const balanceAfter = current + body.delta;
    if (balanceAfter < 0) {
      const err = new Error("Not enough coins.") as Error & { statusCode: number; code: string };
      err.statusCode = 400;
      err.code = "insufficient_funds";
      throw err;
    }

    const [entry] = await this.db
      .insert(walletLedger)
      .values({
        accountId,
        gameId: (body.gameId as GameId | undefined) ?? null,
        delta: body.delta,
        balanceAfter,
        reason: body.reason,
        ref: body.ref ?? null,
        idempotencyKey: body.idempotencyKey,
      })
      .returning();

    return { entry, duplicate: false };
  }
}
