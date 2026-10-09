import { describe, expect, test } from "bun:test";
import { TelemetryClient } from "./telemetry-client.js";

describe("TelemetryClient", () => {
  test("does not queue without consent", async () => {
    const client = new TelemetryClient({
      transport: async () => ({ accepted: 0, duplicates: 0, rejected: 0 }),
      getConsent: () => false,
      id: () => "11111111-1111-1111-1111-111111111111",
    });
    const result = client.track("session_start", {});
    expect(result.queued).toBe(false);
    expect(client.peekQueue()).toHaveLength(0);
  });

  test("rejects bad props for named events", () => {
    const client = new TelemetryClient({
      transport: async () => ({ accepted: 0, duplicates: 0, rejected: 0 }),
      getConsent: () => true,
      id: () => "11111111-1111-1111-1111-111111111111",
    });
    const result = client.track("level_clear", { level: -1 });
    expect(result).toEqual({ queued: false, reason: "schema" });
  });

  test("flushes a batch and retries on transport failure", async () => {
    let calls = 0;
    const store: { events: unknown[] } = { events: [] };
    const client = new TelemetryClient({
      transport: async (body) => {
        calls += 1;
        if (calls === 1) throw new Error("offline");
        store.events.push(body);
        return { accepted: 1, duplicates: 0, rejected: 0 };
      },
      getConsent: () => true,
      batchSize: 1,
      id: () => "11111111-1111-1111-1111-111111111111",
      now: () => new Date("2026-10-01T12:00:00.000Z"),
    });

    client.track("session_start", { platform: "android" }, { gameId: "one-spark" });
    expect(client.peekQueue()).toHaveLength(1);
    const failed = await client.flush();
    expect(failed).toBeNull();
    expect(client.peekQueue()).toHaveLength(1);
    const ok = await client.flush();
    expect(ok?.accepted).toBe(1);
    expect(client.peekQueue()).toHaveLength(0);
    expect(store.events).toHaveLength(1);
  });

  test("persists queue via storage", async () => {
    let saved: unknown[] = [];
    const client = new TelemetryClient({
      transport: async () => ({ accepted: 0, duplicates: 0, rejected: 0 }),
      getConsent: () => true,
      batchSize: 99,
      id: () => "22222222-2222-2222-2222-222222222222",
      now: () => new Date("2026-10-01T12:00:00.000Z"),
      storage: {
        load: () => [],
        save: (events) => {
          saved = events;
        },
      },
    });
    await client.init();
    client.track("hint_used", { source: "coins", level: 3 }, { gameId: "one-spark" });
    expect(saved).toHaveLength(1);
  });
});
