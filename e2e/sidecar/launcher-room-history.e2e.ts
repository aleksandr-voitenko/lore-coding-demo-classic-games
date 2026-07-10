import type { Page } from "@playwright/test";

import { expect, test } from "../support/fixtures";
import {
  hostMultiplayerRoomFromLauncher,
  openLauncher,
  signOutFromLauncher,
  signUpFromLauncher,
} from "../support/app";

type RoomConnectionFrame = {
  participantId?: string;
  roomCode: string;
  type: "connection.hello" | "connection.resume";
};

type RoomWebSocketTracker = {
  bootstrapCount: () => number;
  connectionFrames: () => readonly RoomConnectionFrame[];
  openedCount: () => number;
};

function createPlayerName(workerIndex: number, retry: number) {
  return `History Host ${workerIndex}-${retry}-${Date.now().toString(36).slice(-5)}`;
}

function parseJsonFrame(payload: Buffer | string) {
  const text = typeof payload === "string" ? payload : payload.toString("utf8");

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function parseRoomConnectionFrame(payload: Buffer | string): RoomConnectionFrame | null {
  const message = parseJsonFrame(payload);

  if (
    typeof message !== "object" ||
    message === null ||
    !("type" in message) ||
    (message.type !== "connection.hello" && message.type !== "connection.resume") ||
    !("roomCode" in message) ||
    typeof message.roomCode !== "string"
  ) {
    return null;
  }

  const participantId =
    "participantId" in message && typeof message.participantId === "string"
      ? message.participantId
      : undefined;

  return {
    ...(participantId === undefined ? {} : { participantId }),
    roomCode: message.roomCode,
    type: message.type,
  };
}

function trackRoomWebSockets(
  page: Page,
  roomWebSocketUrl: string,
): RoomWebSocketTracker {
  let bootstrapCount = 0;
  let openedCount = 0;
  const connectionFrames: RoomConnectionFrame[] = [];

  page.on("websocket", (webSocket) => {
    if (webSocket.url() !== roomWebSocketUrl) {
      return;
    }

    openedCount += 1;
    webSocket.on("framesent", ({ payload }) => {
      const connectionFrame = parseRoomConnectionFrame(payload);

      if (connectionFrame !== null) {
        connectionFrames.push(connectionFrame);
      }
    });
    webSocket.on("framereceived", ({ payload }) => {
      const message = parseJsonFrame(payload);

      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        message.type === "connection.bootstrap"
      ) {
        bootstrapCount += 1;
      }
    });
  });

  return {
    bootstrapCount: () => bootstrapCount,
    connectionFrames: () => connectionFrames,
    openedCount: () => openedCount,
  };
}

test("Forward bootstraps authoritative room state with the cached host capability", async ({
  page,
}, testInfo) => {
  const roomWebSocketUrl =
    process.env.NEXT_PUBLIC_MULTIPLAYER_WEBSOCKET_URL ??
    "ws://127.0.0.1:3111/multiplayer/rooms";
  const hostName = createPlayerName(testInfo.workerIndex, testInfo.retry);
  const roomWebSockets = trackRoomWebSockets(page, roomWebSocketUrl);

  await openLauncher(page);
  await signUpFromLauncher(page, hostName);
  await hostMultiplayerRoomFromLauncher(page, "pong");
  await expect(page.getByTestId("multiplayer-room-lobby")).toBeVisible();
  await expect(page.getByTestId("multiplayer-room-game")).toHaveText("Pong");

  const roomCode = (await page.getByTestId("multiplayer-room-code").innerText()).trim();

  await expect.poll(() => roomWebSockets.bootstrapCount()).toBeGreaterThan(0);
  await expect.poll(() => roomWebSockets.connectionFrames().length).toBeGreaterThan(0);
  const initialConnectionFrame = roomWebSockets.connectionFrames().at(-1);

  expect(initialConnectionFrame).toMatchObject({
    roomCode,
    type: "connection.resume",
  });
  expect(initialConnectionFrame?.participantId).toMatch(/^[a-f0-9-]+$/i);
  const hostParticipantId = initialConnectionFrame?.participantId;

  if (hostParticipantId === undefined) {
    throw new Error("Initial host connection did not send its participant capability.");
  }

  await page.getByTestId("multiplayer-room-claim-seat-left").click();
  await expect(page.getByTestId("multiplayer-room-seat-left")).toContainText(hostName);

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("game-menu")).toBeVisible();

  const bootstrapCountBeforeForward = roomWebSockets.bootstrapCount();
  const connectionFrameCountBeforeForward = roomWebSockets.connectionFrames().length;
  const openedCountBeforeForward = roomWebSockets.openedCount();

  await page.goForward();

  await expect(page).toHaveURL(new RegExp(`\\?room=${roomCode}$`));
  await expect(page.getByTestId("multiplayer-room-lobby")).toBeVisible();
  await expect
    .poll(() => roomWebSockets.openedCount())
    .toBeGreaterThan(openedCountBeforeForward);
  await expect
    .poll(() => roomWebSockets.bootstrapCount())
    .toBeGreaterThan(bootstrapCountBeforeForward);
  await expect
    .poll(() => roomWebSockets.connectionFrames().length)
    .toBeGreaterThan(connectionFrameCountBeforeForward);
  expect(roomWebSockets.connectionFrames()[connectionFrameCountBeforeForward]).toEqual({
    participantId: hostParticipantId,
    roomCode,
    type: "connection.resume",
  });
  await expect(page.getByTestId("multiplayer-room-game")).toHaveText("Pong");
  await expect(page.getByTestId("multiplayer-room-status")).toHaveText("Lobby");
  await expect(page.getByTestId("multiplayer-room-seat-left")).toContainText(hostName);
  await expect(page.getByTestId("multiplayer-room-current-participant")).toHaveText(
    `${hostName} · Host`,
  );

  await page.goBack();
  await expect(page.getByTestId("game-menu")).toBeVisible();
  await signOutFromLauncher(page);

  const bootstrapCountBeforeSignedOutForward = roomWebSockets.bootstrapCount();
  const connectionFrameCountBeforeSignedOutForward =
    roomWebSockets.connectionFrames().length;

  await page.goForward();

  await expect(page).toHaveURL(new RegExp(`\\?room=${roomCode}$`));
  await expect
    .poll(() => roomWebSockets.connectionFrames().length)
    .toBeGreaterThan(connectionFrameCountBeforeSignedOutForward);
  const signedOutConnectionFrame =
    roomWebSockets.connectionFrames()[connectionFrameCountBeforeSignedOutForward];

  expect(signedOutConnectionFrame).toEqual({
    roomCode,
    type: "connection.hello",
  });
  expect(signedOutConnectionFrame).not.toHaveProperty("participantId");
  await expect
    .poll(() => roomWebSockets.bootstrapCount())
    .toBeGreaterThan(bootstrapCountBeforeSignedOutForward);
});
