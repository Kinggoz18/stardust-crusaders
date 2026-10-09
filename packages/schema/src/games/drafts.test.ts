import { describe, expect, test } from "bun:test";
import { loomRushProgressSchema } from "./loom-rush.js";
import { borrowedTimeProgressSchema } from "./borrowed-time.js";
import { progressSchemaFor } from "./registry.js";

describe("draft game schemas", () => {
  test("loom rush is marked draft", () => {
    const doc = loomRushProgressSchema.parse({});
    expect(doc._draft).toBe(true);
    expect(doc.levelReached).toBe(0);
  });

  test("borrowed time island snapshot + logs", () => {
    const doc = borrowedTimeProgressSchema.parse({
      island: {
        islandId: "isle-1",
        tier: "colony",
      },
    });
    expect(doc._draft).toBe(true);
    expect(doc.island.tier).toBe("colony");
    expect(doc.eventLog).toEqual([]);
  });

  test("progressSchemaFor routes by game id", () => {
    expect(progressSchemaFor("one-spark").parse({ stars: {}, album: {} }).schemaVersion).toBe(1);
    expect(progressSchemaFor("loom-rush").parse({})._draft).toBe(true);
  });
});
