import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 3100;
const HOST = "127.0.0.1";
const baseURL = `http://${HOST}:${PORT}`;
const testRunId = process.env.PLAYWRIGHT_TEST_RUN_ID ?? `${Date.now()}-${process.pid}`;
const leaderboardDatabasePath = join(
  tmpdir(),
  `lore-coding-demo-playwright-${testRunId}.sqlite`,
);

export default defineConfig({
  expect: {
    timeout: 5_000,
  },
  outputDir: "reports/playwright/artifacts",
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "reports/playwright/html" }],
  ],
  testDir: "e2e",
  timeout: 30_000,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `npm run dev -- --hostname ${HOST} --port ${PORT}`,
    env: {
      GAME_LEADERBOARD_SQLITE_PATH: leaderboardDatabasePath,
    },
    reuseExistingServer: false,
    timeout: 120_000,
    url: baseURL,
  },
  workers: 1,
});
