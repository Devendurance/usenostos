import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_P6_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  projects: [
    {
      name: "e2e-p6",
      testMatch: /p6-.*\.spec\.ts/,
    },
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_NOSTOS_E2E: "true",
      NEXT_PUBLIC_NOSTOS_E2E_P4_FIXTURE: JSON.stringify({
        asyncVault: "0x0000000000000000000000000000000000000101",
        redemptionTicket: "0x0000000000000000000000000000000000000202",
      }),
      NEXT_PUBLIC_NOSTOS_E2E_P6_FIXTURE: JSON.stringify({
        instantPool: "0x0000000000000000000000000000000000000404",
      }),
    },
  },
});
