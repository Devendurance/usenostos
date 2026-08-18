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

  test("wallet dialog shows a truthful no-provider state without fabricated data", async ({ page }) => {
    await page.goto("/explore");
    await page.getByRole("button", { name: /connect wallet/i }).first().press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText(/no injected wallet detected/i);
    await expect(page.getByRole("dialog")).not.toContainText(/0x[a-fA-F0-9]{40}/);
    await expect(page.getByRole("dialog")).not.toContainText(/\d+ tBOT|\d+ USDT/);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("external switch to an unsupported chain blocks balances and requires BOT TESTNET", async ({ page }) => {
    // Controllable fake EIP-1193 provider on BOT Testnet (968).
    await page.addInitScript(() => {
      const ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";
      let chainId = "0x3c8"; // 968
      const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
      const provider = {
        get chainId() {
          return chainId;
        },
        isMetaMask: true,
        request: async ({ method, params }: { method: string; params?: unknown[] }) => {
          if (method === "eth_chainId") return chainId;
          if (method === "eth_requestAccounts" || method === "eth_accounts") return [ADDRESS];
          if (method === "net_version") return String(parseInt(chainId, 16));
          if (method === "wallet_getPermissions") return [];
          if (method === "wallet_switchEthereumChain") {
            const target = (params as Array<{ chainId: string }>)[0].chainId;
            chainId = target;
            for (const cb of listeners["chainChanged"] ?? []) cb(target);
            return null;
          }
          return null;
        },
        on: (event: string, cb: (...args: unknown[]) => void) => {
          (listeners[event] ??= []).push(cb);
        },
        removeListener: (event: string, cb: (...args: unknown[]) => void) => {
          listeners[event] = (listeners[event] ?? []).filter((x) => x !== cb);
        },
        emitChainChanged: (id: number) => {
          chainId = "0x" + id.toString(16);
          for (const cb of listeners["chainChanged"] ?? []) cb(chainId);
        },
      };
      (window as unknown as Record<string, unknown>).ethereum = provider;
      (window as unknown as Record<string, unknown>).__nostosProvider = provider;
    });

    await page.goto("/explore");
    await page.getByRole("button", { name: /connect wallet/i }).first().press("Enter");
    await page.getByRole("dialog").getByRole("button", { name: /injected|metamask/i }).click();
    await expect(page.getByTestId("connected-address")).toContainText("1234");
    await expect(page.getByRole("dialog")).toContainText("BOT TESTNET (968)");

    // Externally switch to Celo (42220) - not present in wagmi config.chains.
    await page.evaluate(() =>
      (window as unknown as { __nostosProvider: { emitChainChanged: (n: number) => void } }).__nostosProvider.emitChainChanged(42220),
    );

    await expect(page.getByRole("dialog")).toContainText(/BOT TESTNET REQUIRED/i);
    await expect(page.getByRole("dialog")).toContainText(/42220/);
    await expect(page.getByTestId("connected-address")).toBeVisible();
    await expect(page.getByRole("dialog")).not.toContainText(/\d+ tBOT|\d+ USDT/);

    // Switch back to BOT Testnet through the app's explicit action.
    await page.getByRole("button", { name: /switch network/i }).click();
    await expect(page.getByRole("dialog")).toContainText("BOT TESTNET (968)");
    await expect(page.getByRole("dialog")).not.toContainText(/BOT TESTNET REQUIRED/i);
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

  test("explore shows real discovery cards with no fabricated financial values", async ({ page }) => {
    await page.goto("/explore");
    await expect(page.getByRole("heading", { name: "OUSG" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "TBILL" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nostos Async Settlement Vault" })).toBeVisible();
    await expect(page.getByText(/DISCOVERY ONLY/i).first()).toBeVisible();
    await expect(page.getByText(/REDEMPTION SUPPORTED/i).first()).toBeVisible();
    // No fabricated non-zero financial values; the demo vault's explicit "0% YIELD" is truthful.
    await expect(page.locator("main")).not.toContainText(/[1-9]\d*(\.\d+)?\s?%|0\.\d+%/);
  });

  test("demo vault detail is reachable and reflects its persisted deployment state", async ({ page }) => {
    await page.goto("/vaults/nostos-async-vault");
    await expect(page.getByRole("heading", { name: "Nostos Async Settlement Vault" })).toBeVisible();
    await expect(page.getByText(/0% YIELD/i).first()).toBeVisible();
    await expect(page.getByText(/Vault address/i).first()).toBeVisible();
    await expect(page.getByText(/Vault assets/i).first()).toBeVisible();
  });

  test("vault detail resolves a discovery-only opportunity without financial actions", async ({ page }) => {
    await page.goto("/vaults/tbill");
    await expect(page.getByRole("heading", { name: "TBILL" })).toBeVisible();
    await expect(page.getByText(/DISCOVERY ONLY/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /deposit unavailable/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /redeem|approve|instant cashout/i })).toHaveCount(0);
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
