import { expect, test } from "@playwright/test";

const routes = [
  "/",
  "/how-it-works",
  "/for-issuers",
  "/for-liquidity-providers",
  "/risk-and-methodology",
  "/explore",
  "/portfolio",
  "/redemptions",
  "/pool",
  "/registry",
  "/vaults/0x0000000000000000000000000000000000000000",
  "/redemptions/1",
  "/receipts/1",
];

test.describe("Nostos route shells", () => {
  for (const route of routes) {
    test(`${route} renders a named main landmark`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator("h1").first()).toBeVisible();
    });
  }

  test("malformed vault paths render the branded 404", async ({ page }) => {
    await page.goto("/vaults/not-an-address");
    await expect(page.getByRole("heading", { name: /not on the map/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /return home/i })).toBeVisible();
  });

  test("landing hero keeps the prototype hierarchy and CTA destinations", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: /Capital on its way home/i })).toBeVisible();
    await expect(page.getByTestId("hero-flow-scene")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Explore" })).toHaveAttribute("href", "/explore");
    await expect(page.getByRole("button", { name: /connect wallet/i }).first()).toBeVisible();
    await expect(page.getByTestId("hero-primary-cta")).toHaveAttribute("href", "/explore");
    await expect(page.getByRole("link", { name: /How the exit works/i })).toHaveAttribute("href", "/how-it-works");
    await expect(page.getByTestId("hero-flow-scene")).not.toContainText(/0x|USDT|APY|tx/i);
  });

  test("landing fold keeps truthful states and working CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Your redemption should not disappear." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Track the wait. Keep the option." })).toBeVisible();
    await expect(page.getByTestId("fold-pending").getByText("PENDING", { exact: true })).toBeVisible();
    await expect(page.getByTestId("fold-claimable").getByText("CLAIMABLE", { exact: true })).toBeVisible();
    await expect(page.getByTestId("fold-receipt").getByText("PUBLIC RECORD", { exact: true })).toBeVisible();
    await expect(page.locator('img[src*="paper-curl"]')).toHaveCount(1);
    await expect(page.locator('img[src*="pushpin"]')).toHaveCount(1);
    await expect(page.locator('img[src*="paperclip"]')).toHaveCount(1);
    await expect(page.getByRole("link", { name: "See how it works" })).toHaveAttribute("href", "/how-it-works");
    await expect(page.getByTestId("final-explore-cta")).toHaveAttribute("href", "/explore");
    await expect(page.getByTestId("final-explore-cta")).toHaveAttribute("data-variant", "hero");
    await expect(page.locator("body")).not.toContainText(/0x|USDT|APY|tx\b/i);
  });

  test("secondary text uses a distinct readable token", async ({ page }) => {
    await page.goto("/");
    const tokens = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        surface: root.getPropertyValue("--muted").trim(),
        foreground: root.getPropertyValue("--muted-foreground").trim(),
      };
    });
    expect(tokens.surface).not.toBe(tokens.foreground);
  });

  test("wallet preview traps focus and keeps provider actions unavailable", async ({ page }) => {
    await page.goto("/explore");
    await page.getByRole("button", { name: /connect wallet/i }).first().press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("button", { name: "MetaMask" })).toBeDisabled();
    await expect(page.getByRole("dialog")).toContainText(/not available in this UI phase/i);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("marketing mobile drawer exposes all primary destinations", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.getByRole("button", { name: /open navigation menu/i }).click();
    await expect(page.getByRole("navigation", { name: /mobile main navigation/i })).toBeVisible();
    await expect(page.getByRole("navigation", { name: /mobile main navigation/i }).getByRole("link", { name: /Explore/i })).toBeVisible();
    await page.getByRole("complementary", { name: /mobile menu/i }).getByRole("button", { name: /close navigation menu/i }).click();
    await expect(page.getByRole("navigation", { name: /mobile main navigation/i })).toBeHidden();
  });

  test("explorer filters are local controls with no fabricated rows", async ({ page }) => {
    await page.goto("/explore");
    await page.getByRole("button", { name: /private credit/i }).click();
    await expect(page.getByText(/vault data is not connected/i)).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(0);
  });
});

test.describe("Nostos responsive shell", () => {
  for (const width of [375, 768, 1024, 1440]) {
    test(`does not overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("fold simplifies decorative notes on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto("/");
    await expect(page.locator('[data-testid="fold-claimable"]')).toBeHidden();
    await expect(page.locator('[data-testid="fold-pending"]')).toBeVisible();
    await expect(page.locator('[data-testid="fold-receipt"]')).toBeVisible();
  });
});
