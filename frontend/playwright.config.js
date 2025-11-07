const { defineConfig, devices } = require("@playwright/test");

const UI_HOST = process.env.PLAYWRIGHT_UI_HOST || "127.0.0.1";
const UI_PORT = Number(process.env.PLAYWRIGHT_UI_PORT || 4173);
const API_BASE =
  process.env.PLAYWRIGHT_API_BASE || "http://127.0.0.1:3001/api";

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: `http://${UI_HOST}:${UI_PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `yarn preview -- --host ${UI_HOST} --port ${UI_PORT}`,
    port: UI_PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_API_BASE: API_BASE,
    },
  },
});
