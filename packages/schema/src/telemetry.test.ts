import { describe, expect, test } from "bun:test";
import { postEventsRequestSchema } from "./telemetry.js";

describe("telemetry batch", () => {
  test("requires consent flag and event ids", () => {
    const batch = postEventsRequestSchema.parse({
      consentAnalytics: true,
      events: [
        {
          id: "11111111-1111-1111-1111-111111111111",
          name: "session_start",
          ts: new Date().toISOString(),
          props: {},
        },
      ],
    });
    expect(batch.events).toHaveLength(1);
  });

  test("rejects empty batch", () => {
    expect(() =>
      postEventsRequestSchema.parse({ consentAnalytics: false, events: [] }),
    ).toThrow();
  });
});
