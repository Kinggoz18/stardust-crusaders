import { describe, expect, test } from "bun:test";
import { errorBodySchema } from "./errors.js";

describe("errorBodySchema", () => {
  test("accepts a consistent error shape", () => {
    const parsed = errorBodySchema.parse({
      error: { code: "bad_request", message: "Invalid payload" },
    });
    expect(parsed.error.code).toBe("bad_request");
  });
});
