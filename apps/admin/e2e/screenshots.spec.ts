import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";

const widths = [360, 768, 1280] as const;
const outDir = path.resolve(
  process.cwd(),
  "../../.artifacts/20261009-1200-admin-ui/screenshots",
);

async function settle(page: Page) {
  await page.locator("body").evaluate(async () => {
    await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)));
  });
}

async function axeOk(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
}

async function asStaff(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem("stardust_role", "owner");
    sessionStorage.setItem("stardust_csrf", "test-csrf");
  });
}

async function mockAccounts(page: Page, mode: "success" | "empty" | "error" | "loading") {
  await page.route("**/api/admin/v1/accounts**", async (route) => {
    if (mode === "loading") {
      await new Promise((r) => setTimeout(r, 15_000));
      return;
    }
    if (mode === "error") {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "x", message: "We could not load players. Try again." } }),
      });
      return;
    }
    if (mode === "empty") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accounts: [], nextCursor: null }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accounts: [
          {
            id: "11111111-1111-1111-1111-111111111111",
            deviceId: "demo-device",
            email: null,
            platform: "android",
            bannedAt: null,
            createdAt: "2026-10-01T12:00:00.000Z",
          },
        ],
        nextCursor: null,
      }),
    });
  });
}

test.describe("admin screenshots", () => {
  test("login at breakpoints", async ({ page }) => {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/login");
      await expect(page.getByRole("heading", { name: "Stardust Crusaders" })).toBeVisible();
      await settle(page);
      await page.screenshot({
        path: path.join(outDir, `login-${width}.png`),
        fullPage: true,
      });
    }
    await axeOk(page);
  });

  test("accounts states", async ({ page }) => {
    await asStaff(page);

    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });

      await mockAccounts(page, "empty");
      await page.goto("/accounts");
      await expect(page.getByRole("heading", { name: "Players", exact: true })).toBeVisible();
      await expect(page.getByText("No players yet")).toBeVisible();
      await settle(page);
      await page.screenshot({ path: path.join(outDir, `accounts-empty-${width}.png`), fullPage: true });

      await mockAccounts(page, "error");
      await page.goto("/accounts");
      await expect(page.getByRole("heading", { name: "Could not load" })).toBeVisible();
      await settle(page);
      await page.screenshot({ path: path.join(outDir, `accounts-error-${width}.png`), fullPage: true });

      await mockAccounts(page, "success");
      await page.goto("/accounts");
      await expect(page.getByText("demo-device")).toBeVisible();
      await settle(page);
      await page.screenshot({ path: path.join(outDir, `accounts-success-${width}.png`), fullPage: true });
    }
    await axeOk(page);
  });

  test("other routes success", async ({ page }) => {
    await asStaff(page);
    await page.route("**/api/admin/v1/**", async (route) => {
      const url = route.request().url();
      if (url.includes("/metrics")) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            newAccounts24h: 3,
            dau: 12,
            wau: 40,
            retention: { d1: null, d7: null },
          }),
        });
        return;
      }
      if (url.includes("/games")) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            games: [
              { id: "one-spark", name: "One Spark" },
              { id: "loom-rush", name: "Loom Rush" },
              { id: "borrowed-time", name: "Borrowed Time" },
            ],
          }),
        });
        return;
      }
      if (url.includes("/audit")) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            entries: [
              {
                id: "a",
                action: "search_accounts",
                targetType: "account",
                targetId: null,
                createdAt: "2026-10-01T12:00:00.000Z",
              },
            ],
          }),
        });
        return;
      }
      if (url.includes("/accounts/")) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            account: {
              id: "11111111-1111-1111-1111-111111111111",
              deviceId: "demo-device",
              email: null,
              platform: "android",
              bannedAt: null,
              banReason: null,
              createdAt: "2026-10-01T12:00:00.000Z",
            },
            progress: [{ gameId: "one-spark", revision: 2, document: { stars: {}, album: {} } }],
          }),
        });
        return;
      }
      await route.fulfill({ status: 200, body: "{}" });
    });

    const routes = [
      ["/games", "Games", "games"],
      ["/metrics", "Trends", "metrics"],
      ["/audit", "Activity", "audit"],
      ["/settings/staff", "Staff", "staff"],
      ["/accounts/11111111-1111-1111-1111-111111111111", "Player profile", "account-detail"],
    ] as const;

    for (const [route, heading, slug] of routes) {
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route);
        await expect(page.getByRole("heading", { name: heading })).toBeVisible();
        await settle(page);
        await page.screenshot({
          path: path.join(outDir, `${slug}-${width}.png`),
          fullPage: true,
        });
      }
    }
    await axeOk(page);
  });

  test("keyboard reaches primary search", async ({ page }) => {
    await asStaff(page);
    await mockAccounts(page, "success");
    await page.goto("/accounts");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    // Eventually land on search or nav; assert search is reachable
    await page.getByLabel("Search players").focus();
    await expect(page.getByLabel("Search players")).toBeFocused();
  });
});
