import type { Page } from "@playwright/test";

import { expect, test } from "../support/fixtures";
import { openLauncher, signUpFromLauncher } from "../support/app";

type BrowserIssue = {
  source: "console" | "pageerror";
  text: string;
};

type RoomHttpGetTracker = {
  countRoomGets: (roomCode: string) => number;
};

type RoomWebSocketTracker = {
  bootstrapCount: () => number;
  openedCount: () => number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createPlayerName(prefix: string, workerIndex: number, retry: number) {
  return `${prefix} ${workerIndex}-${retry}-${Date.now().toString(36).slice(-5)}`;
}

function collectBrowserIssues(page: Page) {
  const browserIssues: BrowserIssue[] = [];

  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }

    browserIssues.push({
      source: "console",
      text: message.text(),
    });
  });

  page.on("pageerror", (error) => {
    browserIssues.push({
      source: "pageerror",
      text: error.message,
    });
  });

  return browserIssues;
}

function trackRoomHttpGets(page: Page): RoomHttpGetTracker {
  const roomGetPaths: string[] = [];

  page.on("request", (request) => {
    const url = new URL(request.url());

    if (
      request.method() === "GET" &&
      /^\/api\/multiplayer\/rooms\/[^/]+$/.test(url.pathname)
    ) {
      roomGetPaths.push(url.pathname);
    }
  });

  return {
    countRoomGets: (roomCode) => {
      const normalizedRoomCode = roomCode.trim().toLocaleUpperCase("en-US");

      return roomGetPaths.filter((path) =>
        path.endsWith(`/api/multiplayer/rooms/${normalizedRoomCode}`),
      ).length;
    },
  };
}

function parseJsonFramePayload(payload: Buffer | string) {
  const text = typeof payload === "string" ? payload : payload.toString("utf8");

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function trackRoomWebSockets(
  page: Page,
  roomWebSocketUrl: string,
): RoomWebSocketTracker {
  let openedCount = 0;
  let bootstrapCount = 0;

  page.on("websocket", (webSocket) => {
    if (webSocket.url() !== roomWebSocketUrl) {
      return;
    }

    openedCount += 1;

    webSocket.on("framereceived", ({ payload }) => {
      const message = parseJsonFramePayload(payload);

      if (isRecord(message) && message.type === "connection.bootstrap") {
        bootstrapCount += 1;
      }
    });
  });

  return {
    bootstrapCount: () => bootstrapCount,
    openedCount: () => openedCount,
  };
}

async function expectRoomWebSocketBootstrapped(
  tracker: RoomWebSocketTracker,
  label: string,
) {
  await expect
    .poll(() => tracker.openedCount(), {
      message: `${label} should open the sidecar room WebSocket`,
      timeout: 5_000,
    })
    .toBeGreaterThan(0);
  await expect
    .poll(() => tracker.bootstrapCount(), {
      message: `${label} should receive a sidecar WebSocket bootstrap`,
      timeout: 5_000,
    })
    .toBeGreaterThan(0);
}

async function expectNoRepeatedRoomGetPolling({
  guestHttpGets,
  hostHttpGets,
  page,
  roomCode,
}: {
  guestHttpGets: RoomHttpGetTracker;
  hostHttpGets: RoomHttpGetTracker;
  page: Page;
  roomCode: string;
}) {
  const hostRoomGetsAfterBootstrap = hostHttpGets.countRoomGets(roomCode);
  const guestRoomGetsAfterBootstrap = guestHttpGets.countRoomGets(roomCode);

  expect(hostRoomGetsAfterBootstrap).toBeLessThanOrEqual(1);
  expect(guestRoomGetsAfterBootstrap).toBeLessThanOrEqual(1);

  await page.waitForTimeout(1_600);

  expect(hostHttpGets.countRoomGets(roomCode)).toBe(hostRoomGetsAfterBootstrap);
  expect(guestHttpGets.countRoomGets(roomCode)).toBe(guestRoomGetsAfterBootstrap);
}

test("Pong private room reaches guest over the sidecar WebSocket path", async ({
  baseURL,
  browser,
  page,
}, testInfo) => {
  const appBaseURL = baseURL ?? "http://127.0.0.1:3110";
  const roomWebSocketUrl =
    process.env.NEXT_PUBLIC_MULTIPLAYER_WEBSOCKET_URL ??
    "ws://127.0.0.1:3111/multiplayer/rooms";
  const hostName = createPlayerName("Sidecar Host", testInfo.workerIndex, testInfo.retry);
  const guestName = createPlayerName("Sidecar Guest", testInfo.workerIndex, testInfo.retry);
  const hostHttpGets = trackRoomHttpGets(page);
  const hostWebSockets = trackRoomWebSockets(page, roomWebSocketUrl);

  await openLauncher(page);
  await signUpFromLauncher(page, hostName);

  await page.getByTestId("private-room-host-pong-button").click();
  await expect(page.getByTestId("multiplayer-room-lobby")).toBeVisible();
  await expect(page.getByTestId("multiplayer-room-game")).toHaveText("Pong");
  await expect(page.getByTestId("multiplayer-room-status")).toHaveText("Lobby");

  const roomCode = (await page.getByTestId("multiplayer-room-code").innerText()).trim();

  expect(roomCode).toMatch(/^[A-F0-9-]+$/);
  await expectRoomWebSocketBootstrapped(hostWebSockets, "host");

  await page.getByTestId("multiplayer-room-claim-seat-left").click();
  await expect(page.getByTestId("multiplayer-room-seat-left")).toContainText(hostName);

  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  const guestBrowserIssues = collectBrowserIssues(guestPage);
  const guestHttpGets = trackRoomHttpGets(guestPage);
  const guestWebSockets = trackRoomWebSockets(guestPage, roomWebSocketUrl);

  try {
    await guestPage.goto(new URL(`/?room=${roomCode}`, appBaseURL).toString());
    await expect(guestPage.getByTestId("multiplayer-room-lobby")).toBeVisible();
    await expect(guestPage.getByTestId("multiplayer-room-game")).toHaveText("Pong");
    await expectRoomWebSocketBootstrapped(guestWebSockets, "guest");

    await guestPage.getByTestId("multiplayer-room-display-name-input").fill(guestName);
    await guestPage.getByTestId("multiplayer-room-join-button").click();
    await expect(guestPage.getByTestId("multiplayer-room-current-participant")).toContainText(
      guestName,
    );

    await guestPage.getByTestId("multiplayer-room-claim-seat-right").click();
    await expect(guestPage.getByTestId("multiplayer-room-seat-right")).toContainText(
      guestName,
    );
    await expect(page.getByTestId("multiplayer-room-seat-right")).toContainText(guestName);

    await page.getByTestId("multiplayer-room-start-button").click();

    await expect(guestPage.getByTestId("pong-multiplayer-room")).toBeVisible();
    await expect(guestPage.getByTestId("pong-multiplayer-status")).toHaveText("Running");
    await expect(guestPage.getByTestId("pong-multiplayer-role")).toContainText("Right");

    await expectNoRepeatedRoomGetPolling({
      guestHttpGets,
      hostHttpGets,
      page,
      roomCode,
    });
    expect(guestBrowserIssues).toEqual([]);
  } finally {
    await guestContext.close();
  }
});
