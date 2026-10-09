import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("login", () => {
  test("shows studio sign-in", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Stardust Crusaders" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("has no serious axe violations", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await page.locator(".login form").evaluate((el) =>
      Promise.all(el.getAnimations().map((a) => a.finished.catch(() => undefined))),
    );
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
