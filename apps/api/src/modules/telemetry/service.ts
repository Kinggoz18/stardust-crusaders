import {
  isAdTelemetryEventName,
  isClientAdsEnabled,
  parseTelemetryProps,
  postEventsRequestSchema,
} from "@stardust/schema";
import { sql } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { metricsQualityDaily, telemetryEvents } from "../../db/schema.js";
import type { Config } from "../../config.js";

const MAX_PROPS_BYTES = 8 * 1024;

export class TelemetryService {
  constructor(
    private readonly db: Db["db"],
    private readonly config: Config,
  ) {}

  async ingest(accountId: string | null, raw: unknown) {
    const body = postEventsRequestSchema.parse(raw);
    if (!body.consentAnalytics) {
      await this.bumpQuality({ consentOptOuts: body.events.length, rejected: body.events.length });
      return { accepted: 0, duplicates: 0, rejected: body.events.length };
    }

    let accepted = 0;
    let duplicates = 0;
    let rejected = 0;

    const adsEnabled = isClientAdsEnabled(this.config.NODE_ENV);

    for (const event of body.events) {
      if (!adsEnabled && isAdTelemetryEventName(event.name)) {
        rejected += 1;
        continue;
      }
      const propsCheck = parseTelemetryProps(event.name, event.props ?? {});
      if (!propsCheck.ok) {
        rejected += 1;
        continue;
      }
      const props = propsCheck.props;
      const propsSize = Buffer.byteLength(JSON.stringify(props), "utf8");
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
          props,
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

    await this.bumpQuality({ accepted, duplicates, rejected });
    return { accepted, duplicates, rejected };
  }

  private async bumpQuality(delta: {
    accepted?: number;
    duplicates?: number;
    rejected?: number;
    consentOptOuts?: number;
  }) {
    const day = new Date().toISOString().slice(0, 10);
    await this.db
      .insert(metricsQualityDaily)
      .values({
        day,
        accepted: delta.accepted ?? 0,
        duplicates: delta.duplicates ?? 0,
        rejected: delta.rejected ?? 0,
        consentOptOuts: delta.consentOptOuts ?? 0,
      })
      .onConflictDoUpdate({
        target: metricsQualityDaily.day,
        set: {
          accepted: sql`${metricsQualityDaily.accepted} + ${delta.accepted ?? 0}`,
          duplicates: sql`${metricsQualityDaily.duplicates} + ${delta.duplicates ?? 0}`,
          rejected: sql`${metricsQualityDaily.rejected} + ${delta.rejected ?? 0}`,
          consentOptOuts: sql`${metricsQualityDaily.consentOptOuts} + ${delta.consentOptOuts ?? 0}`,
        },
      });
  }
}
