import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

const NEXT_PORT = 3120;
const SIDECAR_PORT = 3121;
const LATENCY_PROXY_PORT = 3122;
const HOST = "127.0.0.1";
const latencyProfile = process.env.MULTIPLAYER_LATENCY_PROXY_PROFILE ?? "normal";
const baseURL = `http://${HOST}:${NEXT_PORT}`;
const sidecarBaseURL = `http://${HOST}:${SIDECAR_PORT}`;
const latencyProxyBaseURL = `http://${HOST}:${LATENCY_PROXY_PORT}`;
const sidecarRoomServiceURL = `${sidecarBaseURL}/_internal/multiplayer/rooms`;
const latencyProxyWebSocketURL = `ws://${HOST}:${LATENCY_PROXY_PORT}/multiplayer/rooms`;
const testRunId = process.env.PLAYWRIGHT_TEST_RUN_ID ?? `${Date.now()}-${process.pid}`;
const leaderboardDatabasePath = join(
  tmpdir(),
  `lore-coding-demo-playwright-sidecar-latency-${testRunId}.sqlite`,
);

process.env.NEXT_PUBLIC_MULTIPLAYER_WEBSOCKET_URL = latencyProxyWebSocketURL;

export default defineConfig({
  expect: {
    timeout: 7_500,
  },
  outputDir: join(process.cwd(), "reports/playwright-sidecar-latency/artifacts"),
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
        outputFolder: join(process.cwd(), "reports/playwright-sidecar-latency/html"),
      },
    ],
  ],
  testDir: ".",
  testMatch: "sidecar/**/*.e2e.ts",
  timeout: 60_000,
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
      command: "npm run start:latency-proxy",
      env: {
        MULTIPLAYER_LATENCY_PROXY_HOST: HOST,
        MULTIPLAYER_LATENCY_PROXY_PORT: String(LATENCY_PROXY_PORT),
        MULTIPLAYER_LATENCY_PROXY_PROFILE: latencyProfile,
        MULTIPLAYER_LATENCY_PROXY_TARGET: sidecarBaseURL,
      },
      reuseExistingServer: false,
      timeout: 30_000,
      url: `${latencyProxyBaseURL}/healthz`,
    },
    {
      command: `npm run dev -- --hostname ${HOST} --port ${NEXT_PORT}`,
      env: {
        GAME_LEADERBOARD_SQLITE_PATH: leaderboardDatabasePath,
        MULTIPLAYER_ROOM_SERVICE_URL: sidecarRoomServiceURL,
        NEXT_PUBLIC_MULTIPLAYER_WEBSOCKET_URL: latencyProxyWebSocketURL,
      },
      reuseExistingServer: false,
      timeout: 120_000,
      url: baseURL,
    },
  ],
  workers: 1,
});
