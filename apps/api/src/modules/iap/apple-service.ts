import { z } from "zod";
import type { Db } from "../../db/client.js";
import { iapWebhookEvents } from "../../db/schema.js";
import { type AppleTransaction, type AppStoreServerApi, JwsError, verifyAppleJws } from "./apple.js";
import type { PlayMode, PlayVerdict } from "./google-service.js";

/** StoreKit 2 body that capacitor-plugin-cdv-purchase posts to `store.validator`. */
export const appleValidatorBodySchema = z.object({
  id: z.string().min(1).max(200),
  transaction: z.object({
    type: z.literal("apple-sk2"),
    jwsRepresentation: z.string().min(20).max(20_000),
  }).passthrough(),
  additionalData: z.object({ applicationUsername: z.string().max(200).optional() }).passthrough().optional(),
}).passthrough();

const BAD = 6778003;
const SANDBOX_ENVS = new Set(["Sandbox", "Xcode", "LocalTesting"]);

export type AppleOptions = {
  db: Db["db"] | null;
  mode: PlayMode;
  /** gameId -> bundle id */
  bundles: Record<string, string>;
  api?: AppStoreServerApi | null;
  roots?: string[];
  now?: () => Date;
};

export class AppleIapService {
  constructor(private readonly o: AppleOptions) {}

  private verify<T>(jws: string): T {
    return verifyAppleJws<T>(jws, this.o.roots, this.o.now?.() ?? new Date());
  }

  private envAllowed(env: string): boolean {
    return this.o.mode === "live" ? true : SANDBOX_ENVS.has(env);
  }

  async validate(gameId: string, rawBody: unknown): Promise<PlayVerdict> {
    if (this.o.mode === "off") return { ok: false, code: BAD, message: "Purchase checks are switched off." };
    const parsed = appleValidatorBodySchema.safeParse(rawBody);
    if (!parsed.success) return { ok: false, code: BAD, message: "Purchase details are missing." };
    const body = parsed.data;
    const bundleId = this.o.bundles[gameId];
    if (!bundleId) return { ok: false, code: BAD, message: "Unknown game." };

    let tx: AppleTransaction;
    try {
      tx = this.verify<AppleTransaction>(body.transaction.jwsRepresentation);
    } catch (e) {
      if (e instanceof JwsError) return { ok: false, code: BAD, message: "Apple did not sign this purchase." };
      throw e;
    }
    if (tx.bundleId !== bundleId) return { ok: false, code: BAD, message: "Purchase is for a different app." };
    if (tx.productId !== body.id) return { ok: false, code: BAD, message: "Purchase is for a different item." };
    if (!this.envAllowed(tx.environment)) {
      return { ok: false, code: BAD, message: "Only test purchases are accepted right now." };
    }
    if (tx.revocationDate) return { ok: false, code: BAD, message: "Purchase was refunded." };
    const who = body.additionalData?.applicationUsername;
    if (tx.appAccountToken && who && tx.appAccountToken.toLowerCase() !== who.toLowerCase()) {
      return { ok: false, code: BAD, message: "Purchase belongs to another player." };
    }

    if (this.o.api) {
      const fresh = await this.o.api.getTransaction(bundleId, tx.transactionId, tx.environment !== "Production");
      if (!fresh) return { ok: false, code: BAD, message: "Apple does not know this purchase." };
      const live = this.verify<AppleTransaction>(fresh);
      if (live.transactionId !== tx.transactionId || live.revocationDate) {
        return { ok: false, code: BAD, message: "Purchase was refunded." };
      }
    }

    const eventId = `as:${tx.transactionId}`.slice(0, 128);
    let duplicate = false;
    if (this.o.db) {
      const existing = await this.o.db.query.iapWebhookEvents.findFirst({ where: (t, { eq }) => eq(t.eventId, eventId) });
      duplicate = Boolean(existing);
      if (!existing) {
        await this.o.db.insert(iapWebhookEvents).values({
          eventId,
          provider: "app-store",
          payload: { gameId, productId: tx.productId, transactionId: tx.transactionId, environment: tx.environment, accountRef: tx.appAccountToken ?? who },
        }).onConflictDoNothing();
      }
    }
    return {
      ok: true,
      data: { id: body.id, latest_receipt: true, transaction: body.transaction, orderId: tx.transactionId, duplicate },
    };
  }

  /** App Store Server Notifications V2: { signedPayload }. Records each notification once. */
  async handleNotification(raw: unknown): Promise<{ ok: boolean; duplicate?: boolean; type?: string }> {
    const signed = z.object({ signedPayload: z.string().min(20) }).safeParse(raw);
    if (!signed.success) throw httpError(400, "bad_payload", "Notification is missing signedPayload.");
    let n: {
      notificationType: string;
      subtype?: string;
      notificationUUID: string;
      data?: { bundleId?: string; environment?: string; signedTransactionInfo?: string };
    };
    try {
      n = this.verify(signed.data.signedPayload);
    } catch (e) {
      if (e instanceof JwsError) throw httpError(401, "invalid_signature", "Notification signature is invalid.");
      throw e;
    }
    const bundles = new Set(Object.values(this.o.bundles));
    if (!n.data?.bundleId || !bundles.has(n.data.bundleId)) throw httpError(400, "unknown_app", "Notification is for an unknown app.");
    const tx = n.data.signedTransactionInfo ? this.verify<AppleTransaction>(n.data.signedTransactionInfo) : null;
    const eventId = `asn:${n.notificationUUID}`.slice(0, 128);
    if (this.o.db) {
      const existing = await this.o.db.query.iapWebhookEvents.findFirst({ where: (t, { eq }) => eq(t.eventId, eventId) });
      if (existing) return { ok: true, duplicate: true, type: n.notificationType };
      await this.o.db.insert(iapWebhookEvents).values({
        eventId,
        provider: "app-store",
        payload: {
          notificationType: n.notificationType,
          subtype: n.subtype,
          environment: n.data.environment,
          bundleId: n.data.bundleId,
          transactionId: tx?.transactionId,
          productId: tx?.productId,
          revoked: Boolean(tx?.revocationDate),
        },
      }).onConflictDoNothing();
    }
    return { ok: true, duplicate: false, type: n.notificationType };
  }
}

function httpError(statusCode: number, code: string, message: string) {
  return Object.assign(new Error(message), { statusCode, code });
}
