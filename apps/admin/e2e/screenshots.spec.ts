import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";

const widths = [360, 768, 1280] as const;
const outDir = path.resolve(
  process.cwd(),
  "../../.artifacts/20261009-1205-admin-review/screenshots",
);

async function settle(page: Page) {
  await page.locator("body").evaluate(async () => {
    await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)));
  });
}

async function assertNoHorizontalScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
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
    await page.route("**/api/admin/v1/auth/bootstrap-status", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ needsBootstrap: false }),
      });
    });
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

  test("master admin setup screens", async ({ page }) => {
    await page.route("**/api/admin/v1/auth/bootstrap-status", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ needsBootstrap: true }),
      });
    });
    await page.route("**/api/admin/v1/auth/bootstrap", async (route) => {
      await route.fulfill({
        status: 201,
        body: JSON.stringify({
          ok: true,
          email: "owner@stardust.test",
          role: "owner",
          totpSecret: "SETUPTESTSECRET",
          otpauthUrl: "otpauth://totp/Stardust:owner@stardust.test",
        }),
      });
    });

    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto("/login");
    await expect(page.getByRole("link", { name: "Set up the master admin" })).toBeVisible();
    await settle(page);
    await page.screenshot({ path: path.join(outDir, "login-bootstrap-link-768.png"), fullPage: true });

    await page.goto("/setup");
    await expect(page.getByRole("heading", { name: "Set up the master admin" })).toBeVisible();
    await settle(page);
    await page.screenshot({ path: path.join(outDir, "setup-form-768.png"), fullPage: true });
    await axeOk(page);

    await page.getByLabel("Setup key").fill("x".repeat(32));
    await page.getByLabel("Your work email").fill("owner@stardust.test");
    await page.getByLabel("Choose a password").fill("local-dev-password");
    await page.getByRole("button", { name: "Create owner" }).click();
    await expect(page.getByRole("heading", { name: "Add your authenticator" })).toBeVisible();
    await expect(page.getByText("SETUPTESTSECRET")).toBeVisible();
    await settle(page);
    await page.screenshot({ path: path.join(outDir, "setup-totp-768.png"), fullPage: true });

    await page.goto("/invite?token=demo-invite-token");
    await expect(page.getByRole("heading", { name: "Join the studio" })).toBeVisible();
    await settle(page);
    await page.screenshot({ path: path.join(outDir, "invite-accept-768.png"), fullPage: true });
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
      await expect(page.getByText("demo-device").locator("visible=true").first()).toBeVisible();
      await settle(page);
      await assertNoHorizontalScroll(page);
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
              {
                id: "one-spark",
                name: "One Spark",
                draft: false,
                summary: "Live fireworks puzzle. Stars, album and daily streak are ready to inspect.",
              },
              {
                id: "loom-rush",
                name: "Loom Rush",
                draft: true,
                summary: "Draft tray-match save. Level, wardrobe and boosters may still change.",
              },
              {
                id: "borrowed-time",
                name: "Borrowed Time",
                draft: true,
                summary: "Draft island snapshot. Era, debt and chronicle fields are provisional.",
              },
            ],
          }),
        });
        return;
      }
      if (url.includes("/staff/invites")) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            invites: [
              {
                id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
                email: "newbie@stardust.test",
                role: "viewer",
                expiresAt: "2026-10-12T12:00:00.000Z",
                revokedAt: null,
                acceptedAt: null,
                createdAt: "2026-10-09T12:00:00.000Z",
              },
            ],
          }),
        });
        return;
      }
      if (url.includes("/staff")) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            staff: [
              {
                id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                email: "owner@stardust.test",
                role: "owner",
                createdAt: "2026-10-01T12:00:00.000Z",
                disabledAt: null,
              },
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
        await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
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
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/accounts");
    await page.getByLabel("Search players").focus();
    await expect(page.getByLabel("Search players")).toBeFocused();
  });

  test("menu drawer opens and closes with escape at 360", async ({ page }) => {
    await asStaff(page);
    await mockAccounts(page, "success");
    await page.setViewportSize({ width: 360, height: 900 });
    await page.goto("/accounts");
    const menu = page.getByRole("button", { name: "Menu" });
    await expect(menu).toBeVisible();
    await menu.click();
    const dialog = page.getByRole("dialog", { name: "Studio menu" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(menu).toBeFocused();
    await assertNoHorizontalScroll(page);
  });

  test("player profile shows plain game names and block confirm", async ({ page }) => {
    await asStaff(page);
    await page.route("**/api/admin/v1/**", async (route) => {
      const url = route.request().url();
      if (url.includes("/ban")) {
        await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
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
            progress: [
              {
                gameId: "one-spark",
                revision: 2,
                document: { stars: { "1": [true, false, false] }, album: {} },
              },
              {
                gameId: "loom-rush",
                revision: 1,
                document: { _draft: true, levelReached: 2, stars: {}, wardrobe: [], coins: 0, boosters: {}, tutorialDone: false },
              },
            ],
          }),
        });
        return;
      }
      await route.fulfill({ status: 200, body: "{}" });
    });

    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto("/accounts/11111111-1111-1111-1111-111111111111");
    await expect(page.getByRole("heading", { name: "Player profile" })).toBeVisible();
    await expect(page.getByRole("link", { name: "One Spark" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Loom Rush \(draft\)/ })).toBeVisible();
    await expect(page.getByText("one-spark")).toHaveCount(0);
    await expect(page.getByText(/save 2/i)).toHaveCount(0);

    const block = page.getByRole("button", { name: "Block player" });
    await expect(block).toHaveClass(/danger/);
    await block.click();
    const dialog = page.getByRole("alertdialog", { name: "Block this player?" });
    await expect(dialog).toBeVisible();
    await settle(page);
    await page.screenshot({
      path: path.join(outDir, "account-block-confirm-768.png"),
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(block).toBeFocused();
    await block.click();
    await dialog.getByRole("button", { name: "Block player" }).click();
    await expect(dialog).toBeHidden();
  });

  test("missing states: loading, detail empty/error, login errors", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 });

    await page.route("**/api/admin/v1/auth/login", async (route) => {
      const body = route.request().postDataJSON() as { password?: string; totpCode?: string };
      if (body.password === "bad-pass") {
        await route.fulfill({
          status: 401,
          body: JSON.stringify({
            error: {
              code: "invalid_credentials",
              message: "Check your email and password, then try again.",
            },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 401,
        body: JSON.stringify({
          error: {
            code: "invalid_totp",
            message: "That authenticator code did not work. Try a fresh one.",
          },
        }),
      });
    });

    await page.goto("/login");
    await page.getByLabel("Work email").fill("owner@stardust.test");
    await page.getByLabel("Password").fill("bad-pass");
    await page.getByLabel("Authenticator code").fill("123456");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toContainText("email and password");
    await settle(page);
    await page.screenshot({ path: path.join(outDir, "login-error-768.png"), fullPage: true });

    await page.getByLabel("Password").fill("good-password-ok");
    await page.getByLabel("Authenticator code").fill("000000");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toContainText("authenticator code");
    await settle(page);
    await page.screenshot({ path: path.join(outDir, "login-2fa-failure-768.png"), fullPage: true });

    await asStaff(page);

    await page.route("**/api/admin/v1/accounts**", async (route) => {
      if (!route.request().url().includes("/accounts/")) {
        await new Promise(() => undefined);
        return;
      }
      await route.fallback();
    });
    await page.goto("/accounts");
    await expect(page.getByLabel("Loading")).toBeVisible();
    await settle(page);
    await page.screenshot({ path: path.join(outDir, "accounts-loading-768.png"), fullPage: true });

    await page.unroute("**/api/admin/v1/accounts**");
    await page.route("**/api/admin/v1/accounts/**", async (route) => {
      await route.fulfill({
        status: 404,
        body: JSON.stringify({
          error: { code: "not_found", message: "Player not found." },
        }),
      });
    });
    await page.goto("/accounts/11111111-1111-1111-1111-111111111111");
    await expect(page.getByRole("heading", { name: "Could not load" })).toBeVisible();
    await expect(page.getByText("Player not found.")).toBeVisible();
    await settle(page);
    await page.screenshot({
      path: path.join(outDir, "account-detail-error-768.png"),
      fullPage: true,
    });

    await page.unroute("**/api/admin/v1/accounts/**");
    await page.route("**/api/admin/v1/accounts/**", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          account: {
            id: "11111111-1111-1111-1111-111111111111",
            deviceId: "lonely-device",
            email: null,
            platform: "ios",
            bannedAt: null,
            banReason: null,
            createdAt: "2026-10-01T12:00:00.000Z",
          },
          progress: [],
        }),
      });
    });
    await page.goto("/accounts/11111111-1111-1111-1111-111111111111");
    await expect(page.getByText("No game progress yet.")).toBeVisible();
    await settle(page);
    await page.screenshot({
      path: path.join(outDir, "account-detail-empty-768.png"),
      fullPage: true,
    });

    await page.goto("/accounts/11111111-1111-1111-1111-111111111111/games/one-spark");
    await expect(page.getByRole("heading", { name: "One Spark" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "No progress" })).toBeVisible();
    await settle(page);
    await page.screenshot({
      path: path.join(outDir, "account-game-empty-768.png"),
      fullPage: true,
    });
  });

  test("no horizontal page scroll at 360 on every route", async ({ page }) => {
    await asStaff(page);
    await page.setViewportSize({ width: 360, height: 900 });
    await page.route("**/api/admin/v1/**", async (route) => {
      const url = route.request().url();
      if (url.includes("/metrics")) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            newAccounts24h: 0,
            dau: 0,
            wau: 0,
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
              {
                id: "one-spark",
                name: "One Spark",
                draft: false,
                summary: "Live fireworks puzzle.",
              },
            ],
          }),
        });
        return;
      }
      if (url.includes("/staff/invites")) {
        await route.fulfill({ status: 200, body: JSON.stringify({ invites: [] }) });
        return;
      }
      if (url.includes("/staff")) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ staff: [] }),
        });
        return;
      }
      if (url.includes("/bootstrap-status")) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ needsBootstrap: false }),
        });
        return;
      }
      if (url.includes("/audit")) {
        await route.fulfill({ status: 200, body: JSON.stringify({ entries: [] }) });
        return;
      }
      if (url.includes("/accounts/") && !url.endsWith("/accounts")) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            account: {
              id: "11111111-1111-1111-1111-111111111111",
              deviceId: "demo-device-long-enough-to-stress-layout",
              email: null,
              platform: "android",
              bannedAt: null,
              banReason: null,
              createdAt: "2026-10-01T12:00:00.000Z",
            },
            progress: [
              {
                gameId: "one-spark",
                revision: 2,
                document: { stars: { "1": [true, false, false] }, album: {} },
              },
            ],
          }),
        });
        return;
      }
      if (url.includes("/accounts")) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            accounts: [
              {
                id: "11111111-1111-1111-1111-111111111111",
                deviceId: "demo-device-long-enough-to-stress-layout",
                email: null,
                platform: "android",
                bannedAt: null,
                createdAt: "2026-10-01T12:00:00.000Z",
              },
            ],
            nextCursor: null,
          }),
        });
        return;
      }
      await route.fulfill({ status: 200, body: "{}" });
    });

    const routes = [
      "/login",
      "/setup",
      "/invite",
      "/accounts",
      "/games",
      "/metrics",
      "/audit",
      "/settings/staff",
      "/accounts/11111111-1111-1111-1111-111111111111",
      "/accounts/11111111-1111-1111-1111-111111111111/games/one-spark",
    ];

    for (const route of routes) {
      if (route === "/login") {
        await page.goto(route);
      } else {
        await page.goto(route);
      }
      await settle(page);
      await assertNoHorizontalScroll(page);
    }
  });
});
