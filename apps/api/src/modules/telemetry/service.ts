import { postEventsRequestSchema } from "@stardust/schema";
import type { Db } from "../../db/client.js";
import { telemetryEvents } from "../../db/schema.js";

const MAX_PROPS_BYTES = 8 * 1024;

export class TelemetryService {
  constructor(private readonly db: Db["db"]) {}

  async ingest(accountId: string | null, raw: unknown) {
    const body = postEventsRequestSchema.parse(raw);
    if (!body.consentAnalytics) {
      return { accepted: 0, duplicates: 0, rejected: body.events.length };
    }

    let accepted = 0;
    let duplicates = 0;
    let rejected = 0;

    for (const event of body.events) {
      const propsSize = Buffer.byteLength(JSON.stringify(event.props ?? {}), "utf8");
      if (propsSize > MAX_PROPS_BYTES) {
        rejected += 1;
        continue;
      }
      try {
        await this.db.insert(telemetryEvents).values({
          id: event.id,
          accountId,
          gameId: event.gameId ?? null,
          name: event.name,
          sessionId: event.sessionId ?? null,
          props: event.props ?? {},
          ts: new Date(event.ts),
        });
        accepted += 1;
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === "23505") {
          duplicates += 1;
        } else {
          rejected += 1;
        }
      }
    }

    return { accepted, duplicates, rejected };
  }
}
