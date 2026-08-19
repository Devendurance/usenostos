import { expect, test } from "@playwright/test";
import {
  installP4RpcFixture,
  P4_FIXTURE_ALICE,
  P4_FIXTURE_BOB,
} from "./p4-rpc-fixture";

async function connectWallet(page: Parameters<typeof installP4RpcFixture>[0]) {
  await page.getByRole("button", { name: /connect wallet/i }).first().press("Enter");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /injected|metamask/i })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: /close wallet dialog/i }).click();
}

test.describe("P4 transferable redemption claims", () => {
  test("transfers a live ticket and lets the new owner claim", async ({ page }) => {
    const fixture = await installP4RpcFixture(page);

    await page.goto("/vaults/nostos-async-vault");
    await connectWallet(page);

    await expect(page.getByText("Ticket #7")).toBeVisible();
    await expect(page.locator("#main-content").getByText(new RegExp(P4_FIXTURE_ALICE, "i"))).toBeVisible();

    await page.getByLabel("Transfer claim to").fill(P4_FIXTURE_BOB);
    const transferButton = page.locator("button").filter({ hasText: "Transfer claim" });
    await expect(transferButton).toBeVisible();
    await expect(transferButton).toBeEnabled();
    await transferButton.click();
    await expect(page.getByTestId("p4-tx-stage")).toContainText("REVIEW");
    await page.locator("button").filter({ hasText: "Confirm transfer" }).click();
    await expect(page.getByTestId("p4-tx-stage")).toContainText("CONFIRMED");
    await expect(page.locator("#main-content").getByText(new RegExp(P4_FIXTURE_BOB, "i"))).toBeVisible();
    const claimButton = page.locator("button").filter({ hasText: "Claim settlement" });
    await expect(claimButton).toBeDisabled();

    await fixture.switchAccount(P4_FIXTURE_BOB);
    await expect(claimButton).toBeEnabled();

    await claimButton.click();
    await expect(page.getByTestId("p4-tx-stage")).toContainText("REVIEW");
    await page.locator("button").filter({ hasText: "Confirm claim" }).click();
    await expect(page.getByTestId("p4-tx-stage")).toContainText("CONFIRMED");
  });

  test("shows a truthful failure state when the wallet rejects transfer", async ({ page }) => {
    const fixture = await installP4RpcFixture(page);

    await page.goto("/vaults/nostos-async-vault");
    await connectWallet(page);
    await page.getByLabel("Transfer claim to").fill(P4_FIXTURE_BOB);
    await fixture.rejectNextTransaction();

    const transferButton = page.locator("button").filter({ hasText: "Transfer claim" });
    await expect(transferButton).toBeVisible();
    await expect(transferButton).toBeEnabled();
    await transferButton.click();
    await expect(page.getByTestId("p4-tx-stage")).toContainText("REVIEW");
    await page.locator("button").filter({ hasText: "Confirm transfer" }).click();
    await expect(page.getByTestId("p4-tx-stage")).toContainText("FAILED");
    await expect(page.getByTestId("p4-tx-stage")).toContainText(/rejected in wallet/i);
  });

  test("requires a fresh review after transfer details change", async ({ page }) => {
    await installP4RpcFixture(page);

    await page.goto("/vaults/nostos-async-vault");
    await connectWallet(page);
    await page.getByLabel("Transfer claim to").fill(P4_FIXTURE_BOB);
    await page.locator("button").filter({ hasText: "Transfer claim" }).click();
    await expect(page.getByTestId("p4-tx-stage")).toContainText("REVIEW");

    await page.getByLabel("Transfer claim to").fill(P4_FIXTURE_ALICE);
    await expect(page.locator("button").filter({ hasText: "Transfer claim" })).toBeVisible();
    await expect(page.locator("button").filter({ hasText: "Confirm transfer" })).toHaveCount(0);
  });
});
