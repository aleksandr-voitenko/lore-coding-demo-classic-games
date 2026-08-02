import type { Page } from "@playwright/test";

import { expect, test } from "../support/fixtures";
import {
  hostMultiplayerRoomFromLauncher,
  openLauncher,
  signUpFromLauncher,
} from "../support/app";

type BattleCityPlayerSeat = "player-1" | "player-2";

type BrowserIssue = {
  source: "console" | "pageerror";
  text: string;
};

type RoomWebSocketTracker = {
  latestAuthoritativePlayerRow: (
    seat: BattleCityPlayerSeat,
  ) => number | null;
  bootstrapCount: () => number;
  latestGameSeq: () => number | null;
  latestGameTick: () => number | null;
  openedCount: () => number;
  sawHeldDirection: (
    seat: BattleCityPlayerSeat,
    direction: "up",
  ) => boolean;
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
    if (message.type() === "error") {
      browserIssues.push({ source: "console", text: message.text() });
    }
  });
  page.on("pageerror", (error) => {
    browserIssues.push({ source: "pageerror", text: error.message });
  });

  return browserIssues;
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
  let bootstrapCount = 0;
  let latestGameSeq: number | null = null;
  let latestGameTick: number | null = null;
  let openedCount = 0;
  const authoritativePlayerRows: Record<BattleCityPlayerSeat, number | null> = {
    "player-1": null,
    "player-2": null,
  };
  const heldDirections = new Set<string>();

  page.on("websocket", (webSocket) => {
    if (webSocket.url() !== roomWebSocketUrl) {
      return;
    }

    openedCount += 1;
    webSocket.on("framereceived", ({ payload }) => {
      const message = parseJsonFramePayload(payload);

      if (!isRecord(message)) {
        return;
      }
      if (message.type === "connection.bootstrap") {
        bootstrapCount += 1;
      }
      if (!isRecord(message.snapshot) || !isRecord(message.snapshot.game)) {
        return;
      }

      const game = message.snapshot.game;
      if (game.gameId !== "battle-city") {
        return;
      }
      if (typeof game.seq === "number") {
        latestGameSeq = game.seq;
      }
      if (isRecord(game.snapshot)) {
        if (typeof game.snapshot.tick === "number") {
          latestGameTick = game.snapshot.tick;
        }

        for (const [seat, playerKey] of [
          ["player-1", "player"],
          ["player-2", "player2"],
        ] as const) {
          const player = game.snapshot[playerKey];

          if (isRecord(player) && typeof player.row === "number") {
            authoritativePlayerRows[seat] = player.row;
          }
        }
      }
      if (!isRecord(game.heldInputs)) {
        return;
      }

      for (const seat of ["player-1", "player-2"] as const) {
        const heldInput = game.heldInputs[seat];

        if (isRecord(heldInput) && heldInput.direction === "up") {
          heldDirections.add(`${seat}:up`);
        }
      }
    });
  });

  return {
    latestAuthoritativePlayerRow: (seat) => authoritativePlayerRows[seat],
    bootstrapCount: () => bootstrapCount,
    latestGameSeq: () => latestGameSeq,
    latestGameTick: () => latestGameTick,
    openedCount: () => openedCount,
    sawHeldDirection: (seat, direction) =>
      heldDirections.has(`${seat}:${direction}`),
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

async function getPlayerRow(page: Page, testId: string) {
  const row = await page.getByTestId(testId).getAttribute("data-row");

  if (row === null) {
    throw new Error(`${testId} did not expose its authoritative board row.`);
  }

  return Number(row);
}

test("Tank Patrol private room synchronizes both players through the sidecar", async ({
  baseURL,
  browser,
  page,
}, testInfo) => {
  const appBaseURL = baseURL ?? "http://127.0.0.1:3110";
  const roomWebSocketUrl =
    process.env.NEXT_PUBLIC_MULTIPLAYER_WEBSOCKET_URL ??
    "ws://127.0.0.1:3111/multiplayer/rooms";
  const hostName = createPlayerName(
    "Tank Host",
    testInfo.workerIndex,
    testInfo.retry,
  );
  const guestName = createPlayerName(
    "Tank Guest",
    testInfo.workerIndex,
    testInfo.retry,
  );
  const hostWebSockets = trackRoomWebSockets(page, roomWebSocketUrl);

  await openLauncher(page);
  await signUpFromLauncher(page, hostName);
  await hostMultiplayerRoomFromLauncher(page, "battle-city");

  await expect(page.getByTestId("multiplayer-room-lobby")).toBeVisible();
  await expect(page.getByTestId("multiplayer-room-game")).toHaveText(
    "Tank Patrol",
  );
  await expect(page.getByTestId("multiplayer-room-status")).toHaveText("Lobby");

  const roomCode = (await page.getByTestId("multiplayer-room-code").innerText()).trim();

  expect(roomCode).toMatch(/^[A-F0-9-]+$/);
  await expectRoomWebSocketBootstrapped(hostWebSockets, "host");

  await expect(page.getByTestId("multiplayer-room-seat-player-1")).toContainText(
    hostName,
  );

  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  const guestBrowserIssues = collectBrowserIssues(guestPage);
  const guestWebSockets = trackRoomWebSockets(guestPage, roomWebSocketUrl);

  try {
    await guestPage.goto(new URL(`/?room=${roomCode}`, appBaseURL).toString());
    await expect(guestPage.getByTestId("multiplayer-room-lobby")).toBeVisible();
    await expect(guestPage.getByTestId("multiplayer-room-game")).toHaveText(
      "Tank Patrol",
    );
    await expectRoomWebSocketBootstrapped(guestWebSockets, "guest");

    await guestPage
      .getByTestId("multiplayer-room-display-name-input")
      .fill(guestName);
    await guestPage.getByTestId("multiplayer-room-join-button").click();
    await expect(
      guestPage.getByTestId("multiplayer-room-current-participant"),
    ).toContainText(guestName);

    await expect(
      guestPage.getByTestId("multiplayer-room-seat-player-2"),
    ).toContainText(guestName);
    await expect(page.getByTestId("multiplayer-room-seat-player-2")).toContainText(
      guestName,
    );

    await page.getByTestId("multiplayer-room-start-button").click();

    for (const activePage of [page, guestPage]) {
      await expect(
        activePage.getByTestId("battle-city-multiplayer-room"),
      ).toBeVisible();
      await expect(activePage.getByTestId("battle-city-board")).toBeVisible();
      await expect(activePage.getByTestId("battle-city-player")).toBeVisible();
      await expect(activePage.getByTestId("battle-city-player-2")).toBeVisible();
      await expect(
        activePage.getByTestId("battle-city-multiplayer-status"),
      ).toHaveText("Running", { timeout: 10_000 });
      await expect(activePage.getByTestId("battle-city-player")).toHaveAttribute(
        "data-player-phase",
        "active",
        { timeout: 10_000 },
      );
      await expect(activePage.getByTestId("battle-city-player-2")).toHaveAttribute(
        "data-player-phase",
        "active",
        { timeout: 10_000 },
      );
    }

    await expect(page.getByTestId("battle-city-multiplayer-role")).toContainText(
      `${hostName} · Player 1`,
    );
    await expect(
      guestPage.getByTestId("battle-city-multiplayer-role"),
    ).toContainText(`${guestName} · Player 2`);

    const initialGameSeq = guestWebSockets.latestGameSeq();
    const initialGameTick = guestWebSockets.latestGameTick();
    await expect
      .poll(
        () => guestWebSockets.latestAuthoritativePlayerRow("player-1"),
        {
          message: "guest should receive Player 1's authoritative row",
          timeout: 5_000,
        },
      )
      .not.toBeNull();
    await expect
      .poll(() => hostWebSockets.latestAuthoritativePlayerRow("player-2"), {
        message: "host should receive Player 2's authoritative row",
        timeout: 5_000,
      })
      .not.toBeNull();
    const initialAuthoritativePlayer1Row =
      guestWebSockets.latestAuthoritativePlayerRow("player-1");
    const initialAuthoritativePlayer2Row =
      hostWebSockets.latestAuthoritativePlayerRow("player-2");
    const initialPlayer1Row = await getPlayerRow(guestPage, "battle-city-player");
    const initialPlayer2Row = await getPlayerRow(page, "battle-city-player-2");

    await page.keyboard.down("ArrowUp");
    await expect
      .poll(() => guestWebSockets.sawHeldDirection("player-1", "up"), {
        message: "guest should receive Player 1's authoritative held input",
        timeout: 5_000,
      })
      .toBe(true);
    await expect
      .poll(() => getPlayerRow(guestPage, "battle-city-player"), {
        message: "Player 1 should move upward on the guest's synchronized board",
        timeout: 5_000,
      })
      .toBeLessThan(initialPlayer1Row);
    await expect
      .poll(
        () => guestWebSockets.latestAuthoritativePlayerRow("player-1"),
        {
          message: "Player 1 should move upward in authoritative snapshots",
          timeout: 5_000,
        },
      )
      .toBeLessThan(initialAuthoritativePlayer1Row ?? Number.NEGATIVE_INFINITY);
    await page.keyboard.up("ArrowUp");

    await guestPage.keyboard.down("ArrowUp");
    await expect
      .poll(() => hostWebSockets.sawHeldDirection("player-2", "up"), {
        message: "host should receive Player 2's authoritative held input",
        timeout: 5_000,
      })
      .toBe(true);
    await expect
      .poll(() => getPlayerRow(page, "battle-city-player-2"), {
        message: "Player 2 should move upward on the host's synchronized board",
        timeout: 5_000,
      })
      .toBeLessThan(initialPlayer2Row);
    await expect
      .poll(() => hostWebSockets.latestAuthoritativePlayerRow("player-2"), {
        message: "Player 2 should move upward in authoritative snapshots",
        timeout: 5_000,
      })
      .toBeLessThan(initialAuthoritativePlayer2Row ?? Number.NEGATIVE_INFINITY);
    await guestPage.keyboard.up("ArrowUp");

    await expect
      .poll(() => guestWebSockets.latestGameSeq(), {
        message: "Tank Patrol should continue publishing authoritative game snapshots",
        timeout: 5_000,
      })
      .toBeGreaterThan(initialGameSeq ?? 0);
    await expect
      .poll(() => guestWebSockets.latestGameTick(), {
        message: "Tank Patrol's authoritative game tick should advance",
        timeout: 5_000,
      })
      .toBeGreaterThan(initialGameTick ?? 0);

    expect(guestBrowserIssues).toEqual([]);
  } finally {
    await guestContext.close();
  }
});
