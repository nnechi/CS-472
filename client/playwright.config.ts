import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "runner.spec.ts",
  workers: 1,
  timeout: 240_000,
  use: { baseURL: "http://127.0.0.1:5174", launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  } },
  webServer: { command: "npm run build:test && npm run preview -- --host 127.0.0.1 --port 5174", url: "http://127.0.0.1:5174", reuseExistingServer: !process.env.CI },
});
