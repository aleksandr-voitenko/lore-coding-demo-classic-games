import type { Page } from "@playwright/test";

import { expect, test } from "../support/fixtures";
import {
  hostMultiplayerRoomFromLauncher,
  openLauncher,
  signUpFromLauncher,
} from "../support/app";

type BrowserIssue = {
  source: "console" | "pageerror";
  text: string;
};

type RoomHttpGetTracker = {
  countRoomGets: (roomCode: string) => number;
};

type RoomWebSocketTracker = {
  bootstrapCount: () => number;
  latestGameSeq: (gameId: string) => number | null;
  openedCount: () => number;
  sawSpaceInvadersHeldInput: (
    seat: SpaceInvadersShipSeat,
    direction: SpaceInvadersHeldDirection,
  ) => boolean;
};

type SpaceInvadersHeldDirection = "left" | "right";

type SpaceInvadersShipSeat = "ship-a" | "ship-b";

const SPACE_INVADERS_HELD_INPUT_DIRECTIONS = [
  "left",
  "right",
] as const satisfies readonly SpaceInvadersHeldDirection[];

const SPACE_INVADERS_SHIP_SEATS = [
  "ship-a",
  "ship-b",
] as const satisfies readonly SpaceInvadersShipSeat[];

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

function getRealtimeMessageGame(message: unknown) {
  if (!isRecord(message) || !isRecord(message.snapshot)) {
    return null;
  }

  return isRecord(message.snapshot.game) ? message.snapshot.game : null;
}

function createSpaceInvadersHeldInputKey(
  seat: SpaceInvadersShipSeat,
  direction: SpaceInvadersHeldDirection,
) {
  return `${seat}:${direction}`;
}

function collectSpaceInvadersHeldInputs(
  game: Record<string, unknown>,
  heldInputKeys: Set<string>,
) {
  if (game.gameId !== "space-invaders" || !isRecord(game.heldInputs)) {
    return;
  }

  for (const seat of SPACE_INVADERS_SHIP_SEATS) {
    const heldInput = game.heldInputs[seat];

    if (!isRecord(heldInput)) {
      continue;
    }

    for (const direction of SPACE_INVADERS_HELD_INPUT_DIRECTIONS) {
      if (heldInput[direction] === true) {
        heldInputKeys.add(createSpaceInvadersHeldInputKey(seat, direction));
      }
    }
  }
}

function trackRoomWebSockets(
  page: Page,
  roomWebSocketUrl: string,
): RoomWebSocketTracker {
  let openedCount = 0;
  let bootstrapCount = 0;
  const latestGameSeqByGameId = new Map<string, number>();
  const spaceInvadersHeldInputKeys = new Set<string>();

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

      const game =
        isRecord(message) && message.type === "room.snapshot"
          ? getRealtimeMessageGame(message)
          : null;

      if (
        game !== null &&
        typeof game.gameId === "string" &&
        typeof game.seq === "number"
      ) {
        latestGameSeqByGameId.set(game.gameId, game.seq);
        collectSpaceInvadersHeldInputs(game, spaceInvadersHeldInputKeys);
      }
    });
  });

  return {
    bootstrapCount: () => bootstrapCount,
    latestGameSeq: (gameId) => latestGameSeqByGameId.get(gameId) ?? null,
    openedCount: () => openedCount,
    sawSpaceInvadersHeldInput: (seat, direction) =>
      spaceInvadersHeldInputKeys.has(createSpaceInvadersHeldInputKey(seat, direction)),
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

test("Multiplayer diagnostics reports sidecar WebSocket ping", async ({
  baseURL,
  page,
}, testInfo) => {
  const appBaseURL = baseURL ?? "http://127.0.0.1:3110";
  const roomWebSocketUrl =
    process.env.NEXT_PUBLIC_MULTIPLAYER_WEBSOCKET_URL ??
    "ws://127.0.0.1:3111/multiplayer/rooms";
  const hostName = createPlayerName(
    "Diag Host",
    testInfo.workerIndex,
    testInfo.retry,
  );
  const hostWebSockets = trackRoomWebSockets(page, roomWebSocketUrl);

  await openLauncher(page);
  await signUpFromLauncher(page, hostName);

  await hostMultiplayerRoomFromLauncher(page, "pong");
  await expect(page.getByTestId("multiplayer-room-lobby")).toBeVisible();
  await expect(page.getByTestId("multiplayer-room-game")).toHaveText("Pong");

  const roomCode = (await page.getByTestId("multiplayer-room-code").innerText()).trim();

  await expectRoomWebSocketBootstrapped(hostWebSockets, "host");

  await page.goto(
    new URL(
      `/?room=${roomCode}&multiplayerDiagnostics=1`,
      appBaseURL,
    ).toString(),
  );
  await expect(page.getByTestId("multiplayer-room-lobby")).toBeVisible();
  await expect(page.getByTestId("multiplayer-room-diagnostics")).toBeVisible();
  await expect(page.getByTestId("multiplayer-room-diagnostics-ping")).toHaveText(
    /\d+ms/,
    { timeout: 5_000 },
  );
});

test("host replaces the match without replacing the party", async ({
  page,
}, testInfo) => {
  const hostName = createPlayerName(
    "Switch Host",
    testInfo.workerIndex,
    testInfo.retry,
  );

  await openLauncher(page);
  await signUpFromLauncher(page, hostName);
  await hostMultiplayerRoomFromLauncher(page, "pong");

  const roomCode = (
    await page.getByTestId("multiplayer-room-code").innerText()
  ).trim();

  await expect(page.getByTestId("multiplayer-room-game")).toHaveText("Pong");
  await expect(page.getByTestId("multiplayer-room-seat-left")).toContainText(
    hostName,
  );

  await page
    .getByTestId("multiplayer-room-next-game-select")
    .selectOption("asteroids");
  await page.getByTestId("multiplayer-room-replace-match-button").click();

  await expect(page.getByTestId("multiplayer-room-code")).toHaveText(roomCode);
  await expect(page.getByTestId("multiplayer-room-game")).toHaveText("Asteroids");
  await expect(page.getByTestId("multiplayer-room-status")).toHaveText("Lobby");
  await expect(page.getByTestId("multiplayer-room-seat-ship-a")).toContainText(
    hostName,
  );
  await expect(page).toHaveURL(new RegExp(`\\?room=${roomCode}$`));
});

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

  await hostMultiplayerRoomFromLauncher(page, "pong");
  await expect(page.getByTestId("multiplayer-room-lobby")).toBeVisible();
  await expect(page.getByTestId("multiplayer-room-game")).toHaveText("Pong");
  await expect(page.getByTestId("multiplayer-room-status")).toHaveText("Lobby");

  const roomCode = (await page.getByTestId("multiplayer-room-code").innerText()).trim();

  expect(roomCode).toMatch(/^[A-F0-9-]+$/);
  await expectRoomWebSocketBootstrapped(hostWebSockets, "host");

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

    await expect(guestPage.getByTestId("multiplayer-room-seat-right")).toContainText(
      guestName,
    );
    await expect(page.getByTestId("multiplayer-room-seat-right")).toContainText(guestName);

    const fullLobbyContext = await browser.newContext();
    const fullLobbyPage = await fullLobbyContext.newPage();
    const fullLobbyName = createPlayerName(
      "Lobby Watcher",
      testInfo.workerIndex,
      testInfo.retry,
    );

    try {
      await fullLobbyPage.goto(
        new URL(`/?room=${roomCode}`, appBaseURL).toString(),
      );
      await fullLobbyPage
        .getByTestId("multiplayer-room-display-name-input")
        .fill(fullLobbyName);
      await fullLobbyPage.getByTestId("multiplayer-room-join-button").click();
      await expect(
        fullLobbyPage.getByTestId("multiplayer-room-current-participant"),
      ).toHaveText(`${fullLobbyName} · Observer`);
      await expect(
        fullLobbyPage.getByTestId("multiplayer-room-join-outcome"),
      ).toHaveText("The game is active or full, so you joined as a watcher.");
    } finally {
      await fullLobbyContext.close();
    }

    await page.getByTestId("multiplayer-room-start-button").click();

    await expect(guestPage.getByTestId("pong-multiplayer-room")).toBeVisible();
    await expect(guestPage.getByTestId("pong-multiplayer-status")).toHaveText(
      "Ready to serve",
    );
    await expect(guestPage.getByTestId("pong-multiplayer-role")).toContainText("Right");

    await page.keyboard.press("Enter");
    await guestPage.keyboard.press("Enter");

    await expect(guestPage.getByTestId("pong-multiplayer-status")).toHaveText("Running");

    const lateContext = await browser.newContext();
    const latePage = await lateContext.newPage();
    const lateName = createPlayerName(
      "Late Watcher",
      testInfo.workerIndex,
      testInfo.retry,
    );

    try {
      await latePage.goto(new URL(`/?room=${roomCode}`, appBaseURL).toString());
      await expect(latePage.getByTestId("pong-multiplayer-room")).toBeVisible();
      await expect(
        latePage.getByTestId("multiplayer-room-active-party-panel"),
      ).toBeVisible();
      await latePage
        .getByTestId("multiplayer-room-display-name-input")
        .fill(lateName);
      await latePage.getByTestId("multiplayer-room-join-button").click();
      await expect(
        latePage.getByTestId("multiplayer-room-current-participant"),
      ).toHaveText(`${lateName} · Observer`);
      await expect(latePage.getByTestId("multiplayer-room-join-outcome")).toHaveText(
        "The game is active or full, so you joined as a watcher.",
      );
    } finally {
      await lateContext.close();
    }

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

test("Space Invaders private room reaches guest over the sidecar WebSocket path", async ({
  baseURL,
  browser,
  page,
}, testInfo) => {
  const appBaseURL = baseURL ?? "http://127.0.0.1:3110";
  const roomWebSocketUrl =
    process.env.NEXT_PUBLIC_MULTIPLAYER_WEBSOCKET_URL ??
    "ws://127.0.0.1:3111/multiplayer/rooms";
  const hostName = createPlayerName(
    "SI Host",
    testInfo.workerIndex,
    testInfo.retry,
  );
  const guestName = createPlayerName(
    "SI Guest",
    testInfo.workerIndex,
    testInfo.retry,
  );
  const hostHttpGets = trackRoomHttpGets(page);
  const hostWebSockets = trackRoomWebSockets(page, roomWebSocketUrl);

  await openLauncher(page);
  await signUpFromLauncher(page, hostName);

  await hostMultiplayerRoomFromLauncher(page, "space-invaders");
  await expect(page.getByTestId("multiplayer-room-lobby")).toBeVisible();
  await expect(page.getByTestId("multiplayer-room-game")).toHaveText(
    "Space Invaders",
  );
  await expect(page.getByTestId("multiplayer-room-status")).toHaveText("Lobby");

  const roomCode = (await page.getByTestId("multiplayer-room-code").innerText()).trim();

  expect(roomCode).toMatch(/^[A-F0-9-]+$/);
  await expectRoomWebSocketBootstrapped(hostWebSockets, "host");

  await expect(page.getByTestId("multiplayer-room-seat-ship-a")).toContainText(
    hostName,
  );

  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  const guestBrowserIssues = collectBrowserIssues(guestPage);
  const guestHttpGets = trackRoomHttpGets(guestPage);
  const guestWebSockets = trackRoomWebSockets(guestPage, roomWebSocketUrl);

  try {
    await guestPage.goto(new URL(`/?room=${roomCode}`, appBaseURL).toString());
    await expect(guestPage.getByTestId("multiplayer-room-lobby")).toBeVisible();
    await expect(guestPage.getByTestId("multiplayer-room-game")).toHaveText(
      "Space Invaders",
    );
    await expectRoomWebSocketBootstrapped(guestWebSockets, "guest");

    await guestPage.getByTestId("multiplayer-room-display-name-input").fill(guestName);
    await guestPage.getByTestId("multiplayer-room-join-button").click();
    await expect(guestPage.getByTestId("multiplayer-room-current-participant")).toContainText(
      guestName,
    );

    await expect(guestPage.getByTestId("multiplayer-room-seat-ship-b")).toContainText(
      guestName,
    );
    await expect(page.getByTestId("multiplayer-room-seat-ship-b")).toContainText(
      guestName,
    );

    await page.getByTestId("multiplayer-room-start-button").click();

    await expect(page.getByTestId("space-invaders-multiplayer-room")).toBeVisible();
    await expect(guestPage.getByTestId("space-invaders-multiplayer-room")).toBeVisible();
    await expect(page.getByTestId("space-invaders-multiplayer-status")).toHaveText(
      "Running",
    );
    await expect(
      guestPage.getByTestId("space-invaders-multiplayer-status"),
    ).toHaveText("Running");
    await expect(page.getByTestId("space-invaders-multiplayer-role")).toContainText(
      `${hostName} · Ship A`,
    );
    await expect(
      guestPage.getByTestId("space-invaders-multiplayer-role"),
    ).toContainText(`${guestName} · Ship B`);
    await expect(page.getByTestId("space-invaders-player")).toHaveCount(2);

    await page.keyboard.press("ArrowLeft");
    await guestPage.keyboard.press("ArrowRight");

    await expect
      .poll(() => hostWebSockets.sawSpaceInvadersHeldInput("ship-a", "left"), {
        message: "host should receive a Space Invaders snapshot for Ship A movement",
        timeout: 5_000,
      })
      .toBe(true);
    await expect
      .poll(() => guestWebSockets.sawSpaceInvadersHeldInput("ship-b", "right"), {
        message: "guest should receive a Space Invaders snapshot for Ship B movement",
        timeout: 5_000,
      })
      .toBe(true);
    await expect
      .poll(() => hostWebSockets.latestGameSeq("space-invaders"), {
        message: "host should receive Space Invaders game snapshots",
        timeout: 5_000,
      })
      .not.toBeNull();
    await expect
      .poll(() => guestWebSockets.latestGameSeq("space-invaders"), {
        message: "guest should receive Space Invaders game snapshots",
        timeout: 5_000,
      })
      .not.toBeNull();

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
