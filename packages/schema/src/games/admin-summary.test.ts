import { describe, expect, test } from "bun:test";
import { GAME_IDS } from "./registry.js";
import {
  GAME_ADMIN_META,
  progressSchemaPaths,
  summarizeProgress,
} from "./admin-summary.js";

describe("admin summary mappings", () => {
  for (const gameId of GAME_IDS) {
    test(`${gameId}: every schema field has an admin mapping`, () => {
      const paths = progressSchemaPaths(gameId);
      const mapped = new Set(GAME_ADMIN_META[gameId].fields.map((f) => f.path));
      const missing = paths.filter((p) => !mapped.has(p));
      expect(missing).toEqual([]);
    });

    test(`${gameId}: every mapping path exists on the schema`, () => {
      const paths = new Set(progressSchemaPaths(gameId));
      const extras = GAME_ADMIN_META[gameId].fields
        .map((f) => f.path)
        .filter((p) => !paths.has(p));
      expect(extras).toEqual([]);
    });
  }

  test("summarizeProgress shows draft and plain labels for loom rush", () => {
    const summary = summarizeProgress(
      "loom-rush",
      { levelReached: 5, wardrobe: ["apron"], stars: { "1": 3 }, coins: 10 },
      2,
    );
    expect(summary.draft).toBe(true);
    expect(summary.displayName).toBe("Loom Rush");
    expect(summary.rows.some((r) => r.label === "Level reached" && r.value === "5")).toBe(true);
    expect(summary.rows.some((r) => r.path === "_draft")).toBe(false);
  });

  test("summarizeProgress marks one spark as not draft", () => {
    const summary = summarizeProgress("one-spark", { stars: {}, album: {} }, 1);
    expect(summary.draft).toBe(false);
    expect(summary.displayName).toBe("One Spark");
  });

  test("summarizeProgress includes borrowed time era", () => {
    const summary = summarizeProgress(
      "borrowed-time",
      { island: { islandId: "i1", tier: "village" } },
      1,
    );
    expect(summary.draft).toBe(true);
    expect(summary.rows.some((r) => r.label === "Era" && r.value === "village")).toBe(true);
  });
});
