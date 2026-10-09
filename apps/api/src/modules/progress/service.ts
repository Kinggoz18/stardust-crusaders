import { and, eq } from "drizzle-orm";
import {
  assertOneSparkSanity,
  gameIdSchema,
  mergeAlbum,
  mergeStars,
  oneSparkProgressSchema,
  progressSchemaFor,
  type GameId,
  type OneSparkProgress,
} from "@stardust/schema";
import type { Db } from "../../db/client.js";
import { gameProgress } from "../../db/schema.js";

export class ProgressService {
  constructor(private readonly db: Db["db"]) {}

  async get(accountId: string, gameId: GameId) {
    gameIdSchema.parse(gameId);
    const row = await this.db.query.gameProgress.findFirst({
      where: and(eq(gameProgress.accountId, accountId), eq(gameProgress.gameId, gameId)),
    });
    if (!row) {
      const empty = progressSchemaFor(gameId).parse(
        gameId === "one-spark" ? { stars: {}, album: {} } : gameId === "borrowed-time"
          ? { island: { islandId: "new", tier: "colony" } }
          : {},
      );
      return { revision: 0, document: empty };
    }
    return { revision: row.revision, document: row.document };
  }

  async put(
    accountId: string,
    gameId: GameId,
    revision: number,
    rawDocument: unknown,
  ): Promise<
    | { ok: true; revision: number; document: unknown; merged?: boolean }
    | { ok: false; status: 409 | 400; body: unknown }
  > {
    gameIdSchema.parse(gameId);
    const schema = progressSchemaFor(gameId);
    const parsed = schema.safeParse(rawDocument);
    if (!parsed.success) {
      return {
        ok: false,
        status: 400,
        body: {
          error: {
            code: "validation_error",
            message: "Progress document is invalid.",
            details: parsed.error.flatten(),
          },
        },
      };
    }

    const current = await this.get(accountId, gameId);
    if (revision !== current.revision) {
      return {
        ok: false,
        status: 409,
        body: {
          error: {
            code: "stale_revision",
            message: "Progress was updated elsewhere. Reload and try again.",
            details: {
              serverRevision: current.revision,
              serverDocument: current.document,
            },
          },
        },
      };
    }

    let document = parsed.data;
    let merged = false;

    if (gameId === "one-spark") {
      const prev = oneSparkProgressSchema.parse(current.document);
      const next = oneSparkProgressSchema.parse(document);
      const sanity = assertOneSparkSanity(prev, next);
      if (sanity.length) {
        return {
          ok: false,
          status: 400,
          body: {
            error: {
              code: "sanity_failed",
              message: "Progress change is not allowed.",
              details: sanity,
            },
          },
        };
      }
      document = mergeOneSpark(prev, next);
      merged = true;
      // Coins in the document are cache-only; ledger is authoritative later.
    }

    const nextRevision = current.revision + 1;
    if (current.revision === 0) {
      await this.db.insert(gameProgress).values({
        accountId,
        gameId,
        revision: nextRevision,
        document,
      });
    } else {
      await this.db
        .update(gameProgress)
        .set({ revision: nextRevision, document, updatedAt: new Date() })
        .where(and(eq(gameProgress.accountId, accountId), eq(gameProgress.gameId, gameId)));
    }

    return { ok: true, revision: nextRevision, document, merged };
  }
}

function mergeOneSpark(prev: OneSparkProgress, next: OneSparkProgress): OneSparkProgress {
  const stars: Record<string, boolean[]> = { ...prev.stars };
  for (const [id, bits] of Object.entries(next.stars)) {
    stars[id] = mergeStars(stars[id], bits);
  }
  const album: Record<string, "normal" | "gold"> = { ...prev.album };
  for (const [id, tier] of Object.entries(next.album)) {
    album[id] = mergeAlbum(album[id], tier === "gold");
  }
  const firstClear = { ...prev.firstClear, ...next.firstClear };
  return {
    ...next,
    stars,
    album,
    firstClear,
    // Keep the higher coin cache; ledger reconciles separately.
    coins: Math.max(prev.coins, next.coins),
  };
}
