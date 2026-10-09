import { createHmac, timingSafeEqual } from "node:crypto";
import { revenueCatEventSchema } from "@stardust/schema";
import type { Db } from "../../db/client.js";
import { iapWebhookEvents } from "../../db/schema.js";

export class IapService {
  constructor(
    private readonly db: Db["db"],
    private readonly webhookSecret: string,
  ) {}

  verifySignature(rawBody: string, signatureHeader: string | undefined): boolean {
    if (!signatureHeader) return false;
    const expected = createHmac("sha256", this.webhookSecret).update(rawBody).digest("hex");
    try {
      const a = Buffer.from(expected);
      const b = Buffer.from(signatureHeader);
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  async handleWebhook(rawBody: string, signatureHeader: string | undefined) {
    if (!this.verifySignature(rawBody, signatureHeader)) {
      const err = new Error("Webhook signature is invalid.") as Error & {
        statusCode: number;
        code: string;
      };
      err.statusCode = 401;
      err.code = "invalid_signature";
      throw err;
    }

    const parsed = revenueCatEventSchema.parse(JSON.parse(rawBody));
    if (parsed.event.environment === "PRODUCTION") {
      // Sandbox-only policy: accept the envelope but do not fulfill production events.
      return { ok: true, duplicate: false, ignored: true as const };
    }

    const eventId = parsed.event.id;
    const existing = await this.db.query.iapWebhookEvents.findFirst({
      where: (t, { eq }) => eq(t.eventId, eventId),
    });
    if (existing) {
      return { ok: true, duplicate: true };
    }

    await this.db.insert(iapWebhookEvents).values({
      eventId,
      provider: "revenuecat",
      payload: parsed,
    });

    return { ok: true, duplicate: false };
  }
}
