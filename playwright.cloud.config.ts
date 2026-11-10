import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests-cloud",
  workers: 1,
  use: {
    baseURL: "http://localhost:3002",
    channel: "chrome",
    headless: true,
    launchOptions: { executablePath: process.env.CHROME_PATH },
  },
  webServer: {
    command: "node scripts/start-cloud-test.mjs",
    url: "http://localhost:3002",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
