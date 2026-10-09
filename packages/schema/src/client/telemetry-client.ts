import {
  postEventsRequestSchema,
  telemetryEventSchema,
  type TelemetryEvent,
} from "../telemetry.js";
import { parseTelemetryProps } from "../telemetry-events.js";
import type { GameId } from "../games/registry.js";

export type TelemetryTransport = (body: unknown) => Promise<{
  accepted: number;
  duplicates: number;
  rejected: number;
}>;

export type TelemetryClientOptions = {
  transport: TelemetryTransport;
  /** Called to read current analytics consent. */
  getConsent: () => boolean;
  /** Persist queue between sessions (e.g. localStorage). */
  storage?: {
    load: () => Promise<TelemetryEvent[]> | TelemetryEvent[];
    save: (events: TelemetryEvent[]) => Promise<void> | void;
  };
  batchSize?: number;
  maxQueue?: number;
  /** Inject clock for tests. */
  now?: () => Date;
  /** Inject id generator for tests. */
  id?: () => string;
};

/**
 * Tiny helper games import: consent-gated batching with offline queue + retry.
 * Does not talk to network itself — pass `transport` that POSTs to `/v1/events`.
 */
export class TelemetryClient {
  private queue: TelemetryEvent[] = [];
  private flushing = false;
  private readonly batchSize: number;
  private readonly maxQueue: number;
  private readonly now: () => Date;
  private readonly id: () => string;

  constructor(private readonly options: TelemetryClientOptions) {
    this.batchSize = options.batchSize ?? 20;
    this.maxQueue = options.maxQueue ?? 500;
    this.now = options.now ?? (() => new Date());
    this.id = options.id ?? (() => crypto.randomUUID());
  }

  async init() {
    if (this.options.storage) {
      const loaded = await this.options.storage.load();
      this.queue = Array.isArray(loaded) ? loaded.slice(0, this.maxQueue) : [];
    }
  }

  track(
    name: string,
    props: Record<string, unknown> = {},
    meta: { gameId?: GameId; sessionId?: string; ts?: string } = {},
  ) {
    if (!this.options.getConsent()) return { queued: false, reason: "consent" as const };

    const parsedProps = parseTelemetryProps(name, props);
    if (!parsedProps.ok) return { queued: false, reason: "schema" as const };

    const event = telemetryEventSchema.parse({
      id: this.id(),
      name,
      gameId: meta.gameId,
      sessionId: meta.sessionId,
      ts: meta.ts ?? this.now().toISOString(),
      props: parsedProps.props,
    });

    this.queue.push(event);
    if (this.queue.length > this.maxQueue) {
      this.queue = this.queue.slice(-this.maxQueue);
    }
    void this.persist();
    if (this.queue.length >= this.batchSize) void this.flush();
    return { queued: true as const };
  }

  async flush(): Promise<{ accepted: number; duplicates: number; rejected: number } | null> {
    if (this.flushing || this.queue.length === 0) return null;
    if (!this.options.getConsent()) {
      this.queue = [];
      await this.persist();
      return { accepted: 0, duplicates: 0, rejected: 0 };
    }

    this.flushing = true;
    const batch = this.queue.slice(0, this.batchSize);
    const body = postEventsRequestSchema.parse({
      consentAnalytics: true,
      events: batch,
    });

    try {
      const result = await this.options.transport(body);
      this.queue = this.queue.slice(batch.length);
      await this.persist();
      return result;
    } catch {
      // Keep queue for retry.
      return null;
    } finally {
      this.flushing = false;
    }
  }

  peekQueue() {
    return [...this.queue];
  }

  private async persist() {
    if (this.options.storage) await this.options.storage.save(this.queue);
  }
}
