import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  use: {
    baseURL: process.env.TEST_BASE_URL || "http://localhost:3000",
    headless: true,
    channel: "chrome",
    launchOptions: { executablePath: process.env.CHROME_PATH },
  },
});
