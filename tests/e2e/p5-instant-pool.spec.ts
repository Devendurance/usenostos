import { expect, test } from "@playwright/test";
import { installP5RpcFixture } from "./p5-rpc-fixture";

async function connectWallet(page: Parameters<typeof installP5RpcFixture>[0]) {
  await page.getByRole("button", { name: /connect wallet/i }).first().press("Enter");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /injected|metamask/i })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: /close wallet dialog/i }).click();
}

test.describe("P5 Nostos InstantPool", () => {
  test("renders real pool metrics and an instant quote for a pending ticket", async ({ page }) => {
    await installP5RpcFixture(page);
    await page.goto("/pool");
    await connectWallet(page);

    await expect(page.getByText("Available liquidity")).toBeVisible();
    await expect(page.getByText("Outstanding claim face value")).toBeVisible();
    await expect(page.getByText("Outstanding cost basis")).toBeVisible();
    await expect(page.getByText("Realized spread")).toBeVisible();
    await expect(page.getByText(/Ticket/).first()).toBeVisible();
    await expect(page.getByText("#7")).toBeVisible();
    await expect(page.getByText(/You receive now/)).toBeVisible();
    await expect(page.getByText("98.5")).toBeVisible();
    await expect(page.getByRole("button", { name: /get instant liquidity/i })).toBeEnabled();
  });

  test("approve + sell lifecycle reaches CONFIRMED and shows pool ownership", async ({ page }) => {
    await installP5RpcFixture(page);
    await page.goto("/pool");
    await connectWallet(page);

    await page.getByRole("button", { name: /get instant liquidity/i }).click();
    await expect(page.getByTestId("p5-tx-stage")).toContainText("REVIEW");
    await page.getByRole("button", { name: /confirm sale/i }).click();
    await expect(page.getByTestId("p5-tx-stage")).toContainText("CONFIRMED");
    await expect(page.getByText(/Owner is InstantPool/)).toBeVisible();
    await expect(page.getByText("YES")).toBeVisible();
  });

  test("shows a truthful failure state when the wallet rejects the sale", async ({ page }) => {
    const fixture = await installP5RpcFixture(page);
    await page.goto("/pool");
    await connectWallet(page);

    await fixture.rejectNextTransaction();
    await page.getByRole("button", { name: /get instant liquidity/i }).click();
    await expect(page.getByTestId("p5-tx-stage")).toContainText("REVIEW");
    await page.getByRole("button", { name: /confirm sale/i }).click();
    await expect(page.getByTestId("p5-tx-stage")).toContainText("FAILED");
    await expect(page.getByTestId("p5-tx-stage")).toContainText(/rejected in wallet/i);
  });

  test("blocks the quote on the wrong network", async ({ page }) => {
    await installP5RpcFixture(page, { chainId: "0x2a5" });
    await page.goto("/pool");
    await connectWallet(page);

    await expect(page.getByText(/BOT TESTNET REQUIRED/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /get instant liquidity/i })).toHaveCount(0);
    await expect(page.getByText(/You are on chain 677/)).toBeVisible();
  });
});
