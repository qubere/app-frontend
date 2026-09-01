import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", testMatch: "broker-workflow.spec.ts", fullyParallel: true, retries: 0,
  timeout: 30000, reporter: "line",
  use: { baseURL: "http://127.0.0.1:4175", trace: "retain-on-failure" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }, { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } }],
  webServer: { command: "npx vite --config e2e/broker-fixture/vite.config.mts", url: "http://127.0.0.1:4175", reuseExistingServer: !process.env.CI },
});
