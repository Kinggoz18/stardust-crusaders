import { describe, expect, test } from "bun:test";
import {
  assertOneSparkSanity,
  mergeStars,
  oneSparkProgressSchema,
} from "./one-spark.js";

describe("oneSparkProgressSchema", () => {
  test("parses empty-ish save", () => {
    const doc = oneSparkProgressSchema.parse({
      stars: {},
      album: {},
    });
    expect(doc.coins).toBe(0);
    expect(doc.schemaVersion).toBe(1);
  });

  test("mergeStars ORs bits", () => {
    expect(mergeStars([true, false, false], [false, true, false])).toEqual([
      true,
      true,
      false,
    ]);
  });

  test("sanity rejects star decrease and firstClear unset", () => {
    const prev = oneSparkProgressSchema.parse({
      stars: { "1": [true, false, false] },
      album: {},
      firstClear: { "1": true },
      coins: 5,
    });
    const next = oneSparkProgressSchema.parse({
      stars: { "1": [false, false, false] },
      album: {},
      firstClear: {},
      coins: 5,
    });
    const errors = assertOneSparkSanity(prev, next);
    expect(errors.some((e) => e.startsWith("stars_decreased"))).toBe(true);
    expect(errors.some((e) => e.startsWith("firstClear_unset"))).toBe(true);
  });
});
