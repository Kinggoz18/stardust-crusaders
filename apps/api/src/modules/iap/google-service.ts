import { createHash } from "node:crypto";
import { z } from "zod";
import type { Db } from "../../db/client.js";
import { iapWebhookEvents } from "../../db/schema.js";
import type { GooglePlayVerifier } from "./google-play.js";

/** Body that cordova-plugin-purchase posts to `store.validator`. */
export const playValidatorBodySchema = z.object({
  id: z.string().min(1).max(200),
  type: z.string().optional(),
  transaction: z.object({
    type: z.literal("android-playstore"),
    purchaseToken: z.string().min(10).max(4096),
  }).passthrough(),
  additionalData: z.object({ applicationUsername: z.string().max(200).optional() }).passthrough().optional(),
}).passthrough();

export type PlayMode = "off" | "sandbox" | "live";

export type PlayVerdict =
  | { ok: true; data: { id: string; latest_receipt: true; transaction: unknown; orderId?: string; duplicate: boolean } }
  | { ok: false; code: number; message: string };

// Codes understood by cordova-plugin-purchase (CdvPurchase.ErrorCode range).
const BAD = 6778003;
const PENDING = 6778004;

export class GooglePlayIapService {
  constructor(
    private readonly db: Db["db"] | null,
    private readonly verifier: GooglePlayVerifier | null,
    private readonly mode: PlayMode,
  ) {}

  async validate(gameId: string, rawBody: unknown): Promise<PlayVerdict> {
    if (this.mode === "off" || !this.verifier) {
      return { ok: false, code: BAD, message: "Purchase checks are switched off." };
    }
    const parsed = playValidatorBodySchema.safeParse(rawBody);
    if (!parsed.success) return { ok: false, code: BAD, message: "Purchase details are missing." };
    const body = parsed.data;
    const pkg = this.verifier.packageFor(gameId);
    if (!pkg) return { ok: false, code: BAD, message: "Unknown game." };

    const token = body.transaction.purchaseToken;
    const p = await this.verifier.getPurchase(pkg, token);
    if (!p) return { ok: false, code: BAD, message: "Google does not know this purchase." };
    if (p.purchaseState === "PENDING") return { ok: false, code: PENDING, message: "Payment is still pending." };
    if (p.purchaseState !== "PURCHASED") return { ok: false, code: BAD, message: "Purchase was cancelled." };
    if (this.mode === "sandbox" && !p.test) {
      return { ok: false, code: BAD, message: "Only test purchases are accepted right now." };
    }
    if (!p.productIds.includes(body.id)) {
      return { ok: false, code: BAD, message: "Purchase is for a different item." };
    }
    const who = body.additionalData?.applicationUsername;
    if (p.accountRef && who && p.accountRef !== who) {
      return { ok: false, code: BAD, message: "Purchase belongs to another player." };
    }

    const eventId = `gp:${createHash("sha256").update(token).digest("hex").slice(0, 60)}`;
    let duplicate = false;
    if (this.db) {
      const existing = await this.db.query.iapWebhookEvents.findFirst({
        where: (t, { eq }) => eq(t.eventId, eventId),
      });
      duplicate = Boolean(existing);
      if (!existing) {
        await this.db.insert(iapWebhookEvents).values({
          eventId,
          provider: "google-play",
          payload: { gameId, productId: body.id, orderId: p.orderId, test: p.test, accountRef: p.accountRef ?? who },
        }).onConflictDoNothing();
      }
    }
    if (!p.acknowledged) await this.verifier.acknowledge(pkg, body.id, token);
    return {
      ok: true,
      data: { id: body.id, latest_receipt: true, transaction: body.transaction, orderId: p.orderId, duplicate },
    };
  }
}
