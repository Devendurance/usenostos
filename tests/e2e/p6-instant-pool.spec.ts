import { expect, test } from "@playwright/test";
import { installP6RpcFixture, P6_FIXTURE_UNLOCK_AT } from "./p6-rpc-fixture";

async function connectWallet(page: Parameters<typeof installP6RpcFixture>[0]) {
  await page.getByRole("button", { name: /connect wallet/i }).first().press("Enter");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /injected|metamask/i })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: /close wallet dialog/i }).click();
}

test.describe("P6 public LP InstantPool", () => {
  test("renders LP metrics from fixture reads", async ({ page }) => {
    await installP6RpcFixture(page);
    await page.goto("/pool");
    await connectWallet(page);

    await expect(page.getByText("Permissionless LPs deposit Testnet USDT")).toBeVisible();
    await expect(page.getByText("LP NAV")).toBeVisible();
    await expect(page.getByText("800 USDT").first()).toBeVisible();
    await expect(page.getByText("Available liquidity")).toBeVisible();
    await expect(page.getByText("500 USDT")).toBeVisible();
    await expect(page.getByText("Share price")).toBeVisible();
    await expect(page.getByText("Outstanding face value")).toBeVisible();
    await expect(page.getByText("320 USDT")).toBeVisible();
    await expect(page.getByText("Outstanding cost basis")).toBeVisible();
    await expect(page.getByText("Gross realized spread")).toBeVisible();
    await expect(page.getByText("12.5 USDT")).toBeVisible();
    await expect(page.getByText("Protocol fees accrued")).toBeVisible();
    await expect(page.getByText("LP realized profit")).toBeVisible();
    await expect(page.getByText("10 USDT")).toBeVisible();
    await expect(page.getByText("Your LP shares")).toBeVisible();
    await expect(page.getByText("Max withdrawable now")).toBeVisible();
  });

  test("deposit flow REVIEW → APPROVE USDT → CONFIRMED", async ({ page }) => {
    await installP6RpcFixture(page);
    await page.goto("/pool");
    await connectWallet(page);

    await page.getByLabel("USDT amount").fill("100");
    await expect(page.getByText(/Preview shares: 100/)).toBeVisible();
    await page.getByRole("button", { name: /deposit usdt/i }).click();
    await expect(page.getByTestId("p6-lp-deposit-stage")).toContainText("REVIEW");
    await page.getByRole("button", { name: /approve usdt/i }).click();
    await expect(page.getByTestId("p6-lp-deposit-stage")).toContainText("CONFIRMED");
  });

  test("shows the on-chain cooldown unlock and blocks redeem", async ({ page }) => {
    await installP6RpcFixture(page, { unlockAt: P6_FIXTURE_UNLOCK_AT });
    await page.goto("/pool");
    await connectWallet(page);

    await expect(page.getByText("2033-05-18T03:33:20.000Z").first()).toBeVisible();
    await expect(page.getByText("Withdrawal cooldown", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /redeem shares/i })).toBeDisabled();
  });

  test("does not pretend withdrawal is available when cash is deployed", async ({ page }) => {
    await installP6RpcFixture(page, { cashDeployed: true });
    await page.goto("/pool");
    await connectWallet(page);

    await expect(page.getByText("Withdrawal unavailable")).toBeVisible();
    await expect(page.getByText(/max redeemable shares are 0/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /redeem shares/i })).toBeDisabled();
    await expect(page.getByText("Max withdrawable now")).toBeVisible();
    await expect(page.getByText("0", { exact: true })).toBeVisible();
  });

  test("P6 instant sale reaches CONFIRMED and shows pool ownership", async ({ page }) => {
    await installP6RpcFixture(page);
    await page.goto("/pool");
    await connectWallet(page);

    await expect(page.getByText(/You receive now/)).toBeVisible();
    await expect(page.getByText("98.5")).toBeVisible();
    await page.getByRole("button", { name: /get instant liquidity/i }).click();
    await expect(page.getByTestId("p6-tx-stage")).toContainText("REVIEW");
    await page.getByRole("button", { name: /confirm sale/i }).click();
    await expect(page.getByTestId("p6-tx-stage")).toContainText("CONFIRMED");
    await expect(page.getByText(/Owner is InstantPool/)).toBeVisible();
    await expect(page.getByText("YES")).toBeVisible();
  });

  test("shows a truthful failure state when the wallet rejects the sale", async ({ page }) => {
    const fixture = await installP6RpcFixture(page);
    await page.goto("/pool");
    await connectWallet(page);

    await fixture.rejectNextTransaction();
    await page.getByRole("button", { name: /get instant liquidity/i }).click();
    await expect(page.getByTestId("p6-tx-stage")).toContainText("REVIEW");
    await page.getByRole("button", { name: /confirm sale/i }).click();
    await expect(page.getByTestId("p6-tx-stage")).toContainText("FAILED");
    await expect(page.getByTestId("p6-tx-stage")).toContainText(/rejected in wallet/i);
  });

  test("blocks the quote on the wrong network", async ({ page }) => {
    await installP6RpcFixture(page, { chainId: "0x2a5" });
    await page.goto("/pool");
    await connectWallet(page);

    await expect(page.getByText(/BOT TESTNET REQUIRED/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /get instant liquidity/i })).toHaveCount(0);
    await expect(page.getByText(/You are on chain 677/)).toBeVisible();
  });
});
