import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

const NEXT_PORT = 3110;
const SIDECAR_PORT = 3111;
const HOST = "127.0.0.1";
const baseURL = `http://${HOST}:${NEXT_PORT}`;
const sidecarBaseURL = `http://${HOST}:${SIDECAR_PORT}`;
const sidecarRoomServiceURL = `${sidecarBaseURL}/_internal/multiplayer/rooms`;
const sidecarWebSocketURL = `ws://${HOST}:${SIDECAR_PORT}/multiplayer/rooms`;
const testRunId = process.env.PLAYWRIGHT_TEST_RUN_ID ?? `${Date.now()}-${process.pid}`;
const leaderboardDatabasePath = join(
  tmpdir(),
  `lore-coding-demo-playwright-sidecar-${testRunId}.sqlite`,
);

export default defineConfig({
  expect: {
    timeout: 5_000,
  },
  outputDir: join(process.cwd(), "reports/playwright-sidecar/artifacts"),
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
    [
      "html",
      {
        open: "never",
        outputFolder: join(process.cwd(), "reports/playwright-sidecar/html"),
      },
    ],
  ],
  testDir: ".",
  testMatch: "sidecar/**/*.e2e.ts",
  timeout: 45_000,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run start:sidecar",
      env: {
        MULTIPLAYER_SIDECAR_HOST: HOST,
        MULTIPLAYER_SIDECAR_PORT: String(SIDECAR_PORT),
      },
      reuseExistingServer: false,
      timeout: 30_000,
      url: `${sidecarBaseURL}/healthz`,
    },
    {
      command: `npm run dev -- --hostname ${HOST} --port ${NEXT_PORT}`,
      env: {
        GAME_LEADERBOARD_SQLITE_PATH: leaderboardDatabasePath,
        MULTIPLAYER_ROOM_SERVICE_URL: sidecarRoomServiceURL,
        NEXT_PUBLIC_MULTIPLAYER_WEBSOCKET_URL: sidecarWebSocketURL,
      },
      reuseExistingServer: false,
      timeout: 120_000,
      url: baseURL,
    },
  ],
  workers: 1,
});
