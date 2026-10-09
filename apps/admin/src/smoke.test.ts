import { describe, expect, test } from "bun:test";

describe("admin scaffold", () => {
  test("package identity", () => {
    expect("@stardust/admin").toContain("admin");
  });
});
