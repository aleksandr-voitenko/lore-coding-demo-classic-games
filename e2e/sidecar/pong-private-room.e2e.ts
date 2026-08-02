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

test("friends accept Watch and switch games without sharing links", async ({
  browser,
  page,
}, testInfo) => {
  const hostName = createPlayerName(
    "Invite Host",
    testInfo.workerIndex,
    testInfo.retry,
  );
  const friendName = createPlayerName(
    "Invite Friend",
    testInfo.workerIndex,
    testInfo.retry,
  );
  const hostBrowserIssues = collectBrowserIssues(page);
  const friendContext = await browser.newContext();
  const friendPage = await friendContext.newPage();
  const friendBrowserIssues = collectBrowserIssues(friendPage);

  await openLauncher(friendPage);
  await friendPage.getByTestId("cookie-notice-dismiss").click();
  await signUpFromLauncher(friendPage, friendName);
  await openLauncher(page);
  await page.getByTestId("cookie-notice-dismiss").click();
  await signUpFromLauncher(page, hostName);
  await page.getByTestId("social-center-trigger").click();
  const hostFriendsDialog = page.getByTestId("social-center-dialog");

  await hostFriendsDialog.getByTestId("social-discovery-input").fill(friendName);
  await hostFriendsDialog.getByTestId("social-discovery-submit").click();
  await hostFriendsDialog
    .getByTestId("social-discovery-result")
    .getByRole("button", { name: "Add friend" })
    .click();
  await expect(hostFriendsDialog.getByTestId("social-center-status")).toContainText(
    "Friend request sent",
  );

  await friendPage.reload();
  await friendPage.getByTestId("social-center-trigger").click();
  const friendDialog = friendPage.getByTestId("social-center-dialog");
  const incomingFriendRequest = friendDialog
    .getByTestId("social-incoming-requests")
    .locator("article")
    .filter({ hasText: hostName });

  await expect(incomingFriendRequest).toBeVisible();
  await incomingFriendRequest.getByRole("button", { name: "Accept" }).click();
  await expect(friendDialog.getByTestId("social-center-status")).toContainText(
    "now friends",
  );
  await friendDialog.getByTestId("social-center-close-button").click();

  await page.reload();
  await hostMultiplayerRoomFromLauncher(page, "pong");
  await expect(page.getByTestId("multiplayer-room-connection-status")).toHaveCount(0);
  const invitePanel = page.getByTestId("social-party-invite-controls");
  const invitationFriendRow = invitePanel
    .locator("li")
    .filter({ hasText: friendName });
  const watchInvitationButton = invitationFriendRow.getByRole("button", {
    name: `Invite ${friendName} to watch`,
  });
  const roomCode = (
    await page.getByTestId("multiplayer-room-code").innerText()
  ).trim();

  await expect(invitePanel).toBeVisible();
  await expect(invitePanel).not.toContainText(roomCode);
  await expect(invitationFriendRow).toContainText(
    "Available · Player spot open",
  );
  await expect(watchInvitationButton).toHaveAccessibleDescription(
    /Watch offers Watching.*Capacity is checked again/,
  );
  await expect(watchInvitationButton).toBeEnabled();
  await watchInvitationButton.click();
  const firstCancelButton = invitationFriendRow.getByRole("button", {
    name: `Cancel watch invitation to ${friendName}`,
  });

  await expect(firstCancelButton).toBeFocused();
  await firstCancelButton.click();
  const invitationFriendStatus = invitationFriendRow.getByText(
    "Available · Player spot open",
  );

  await expect(invitationFriendStatus).toBeFocused();

  await watchInvitationButton.click();
  const externallyResolvedCancelButton = invitationFriendRow.getByRole(
    "button",
    { name: `Cancel watch invitation to ${friendName}` },
  );

  await expect(externallyResolvedCancelButton).toBeFocused();
  await friendPage.reload();
  await friendPage.getByTestId("social-center-trigger").click();
  const incomingPartyInvitation = friendPage
    .getByTestId("social-party-invitations")
    .locator("article")
    .filter({ hasText: hostName });

  await expect(incomingPartyInvitation).toBeVisible();
  const invitationId = await friendPage.evaluate(async (displayName) => {
    const response = await fetch("/api/social", { cache: "no-store" });
    const payload = (await response.json()) as {
      overview?: {
        incomingPartyInvitations?: Array<{
          id: string;
          inviter: { displayName: string };
        }>;
      };
    };
    const invitation = payload.overview?.incomingPartyInvitations?.find(
      (candidate) => candidate.inviter.displayName === displayName,
    );

    if (invitation === undefined) {
      throw new Error("Expected an incoming party invitation.");
    }

    return invitation.id;
  }, hostName);

  await page.bringToFront();
  await externallyResolvedCancelButton.focus();
  await expect(externallyResolvedCancelButton).toBeFocused();
  const declineResult = await friendPage.evaluate(async (id) => {
    const response = await fetch(
      `/api/social/party-invitations/${encodeURIComponent(id)}`,
      {
        body: JSON.stringify({ decision: "decline" }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      },
    );

    return { ok: response.ok, status: response.status };
  }, invitationId);

  expect(declineResult).toEqual({ ok: true, status: 200 });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(externallyResolvedCancelButton).toHaveCount(0);
  await expect(invitationFriendStatus).toBeFocused();

  await watchInvitationButton.click();
  await expect(
    invitationFriendRow.getByRole("button", {
      name: `Cancel watch invitation to ${friendName}`,
    }),
  ).toBeFocused();

  await friendPage.reload();
  await friendPage.getByTestId("social-center-trigger").click();
  await expect(incomingPartyInvitation).toBeVisible();

  await friendDialog.getByTestId("social-center-close-button").click();
  await hostMultiplayerRoomFromLauncher(friendPage, "pong");
  await friendPage.getByTestId("social-center-trigger").click();
  await expect(incomingPartyInvitation).toBeVisible();
  const inPartyAcceptButton = incomingPartyInvitation.getByRole("button", {
    name: `Accept Watch invitation from ${hostName}`,
  });
  const inPartyDeclineButton = incomingPartyInvitation.getByRole("button", {
    name: `Decline Watch invitation from ${hostName}`,
  });

  await expect(inPartyAcceptButton).toBeDisabled();
  await expect(inPartyAcceptButton).toHaveAccessibleDescription(
    /Leave your current party before accepting another invitation/i,
  );
  await expect(inPartyDeclineButton).toBeEnabled();
  await inPartyDeclineButton.click();
  const partyInvitationsHeading = friendDialog.getByRole("heading", {
    exact: true,
    name: "Party invitations",
  });

  await expect(partyInvitationsHeading).toBeFocused();
  await expect(partyInvitationsHeading).not.toHaveCSS("box-shadow", "none");
  await friendDialog.getByTestId("social-center-close-button").click();
  await friendPage.getByTestId("multiplayer-party-leave-button").click();
  await friendPage.getByTestId("multiplayer-leave-party-confirm").click();
  await expect(
    friendPage.getByTestId("multiplayer-room-membership-ended"),
  ).toBeVisible();
  await friendPage
    .getByTestId("multiplayer-room-membership-ended-back-button")
    .click();
  await expect(friendPage.getByTestId("game-menu")).toBeVisible();

  await page.reload();
  await expect(invitationFriendRow).toContainText(
    "Available · Player spot open",
  );
  await expect(watchInvitationButton).toBeEnabled();
  await watchInvitationButton.click();

  await friendPage.reload();
  await friendPage.getByTestId("social-center-trigger").click();
  await expect(incomingPartyInvitation).toBeVisible();
  const acceptWatchInvitationButton = incomingPartyInvitation.getByRole(
    "button",
    { name: `Accept Watch invitation from ${hostName}` },
  );

  await expect(acceptWatchInvitationButton).toHaveAccessibleDescription(
    /Accepting joins as Watching.*capacity is checked when you accept/i,
  );
  await expect(acceptWatchInvitationButton).toBeEnabled();

  let acceptancePatchCount = 0;
  let interruptNextAcceptanceResponse = true;
  friendPage.on("request", (request) => {
    if (
      request.method() === "PATCH" &&
      /\/api\/social\/party-invitations\/[^/]+$/.test(
        new URL(request.url()).pathname,
      ) &&
      request.postData()?.includes('"decision":"accept"')
    ) {
      acceptancePatchCount += 1;
    }
  });
  await friendPage.route("**/api/social/party-invitations/*", async (route) => {
    const request = route.request();
    const isAcceptance =
      request.method() === "PATCH" &&
      request.postData()?.includes('"decision":"accept"');

    if (isAcceptance && interruptNextAcceptanceResponse) {
      interruptNextAcceptanceResponse = false;
      const committedResponse = await route.fetch();
      await route.fulfill({ response: committedResponse, body: "{}" });
      return;
    }

    await route.continue();
  });
  await friendPage.evaluate(() => {
    const originalFetch = window.fetch.bind(window);
    const originalPushState = window.history.pushState.bind(window.history);
    let acceptanceAttempt = 0;
    let failNextPush = true;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const requestMethod = (
        init?.method ?? (input instanceof Request ? input.method : "GET")
      ).toUpperCase();
      const requestBody =
        typeof init?.body === "string"
          ? init.body
          : input instanceof Request
            ? await input.clone().text()
            : "";
      const isAcceptance =
        requestMethod === "PATCH" &&
        /\/api\/social\/party-invitations\/[^/]+$/.test(
          new URL(requestUrl, window.location.origin).pathname,
        ) &&
        requestBody.includes('"decision":"accept"');

      if (isAcceptance) {
        acceptanceAttempt += 1;

        if (acceptanceAttempt <= 2) {
          return new Response(
            JSON.stringify({
              code: "party-invitation-acceptance-in-progress",
              error:
                "This party invitation is already being accepted. Try again shortly.",
            }),
            {
              headers: { "Content-Type": "application/json" },
              status: 409,
            },
          );
        }
      }

      return originalFetch(input, init);
    };

    Object.defineProperty(window.history, "pushState", {
      configurable: true,
      value: (
        data: unknown,
        unused: string,
        url?: string | URL | null,
      ) => {
        if (failNextPush) {
          failNextPush = false;
          throw new Error("History unavailable.");
        }

        originalPushState(data, unused, url);
      },
    });
  });

  await acceptWatchInvitationButton.click();
  const handoffRetry = friendDialog.getByTestId("social-party-handoff-retry");
  const confirmAcceptanceButton = handoffRetry.getByRole("button", {
    name: `Confirm watch invitation acceptance from ${hostName}`,
  });

  await expect(friendDialog.getByTestId("social-center-action-error")).toContainText(
    "could not be confirmed yet",
  );
  await expect(confirmAcceptanceButton).toBeFocused();
  expect(acceptancePatchCount).toBe(0);

  await confirmAcceptanceButton.click();

  await expect(friendDialog.getByTestId("social-center-action-error")).toContainText(
    "could not be recovered yet",
  );
  await expect(confirmAcceptanceButton).toBeFocused();
  expect(acceptancePatchCount).toBe(0);

  await confirmAcceptanceButton.click();

  await expect(friendDialog.getByTestId("social-center-action-error")).toContainText(
    "invitation response",
  );
  await expect(confirmAcceptanceButton).toBeFocused();
  expect(acceptancePatchCount).toBe(1);

  await confirmAcceptanceButton.click();
  const openAcceptedPartyButton = handoffRetry.getByRole("button", {
    name: `Open accepted watch invitation from ${hostName}`,
  });

  await expect(friendDialog.getByTestId("social-center-action-error")).toContainText(
    "party was accepted but could not be opened",
  );
  await expect(openAcceptedPartyButton).toBeFocused();
  expect(acceptancePatchCount).toBe(2);

  await openAcceptedPartyButton.click();
  await expect(friendPage.getByTestId("multiplayer-room-lobby")).toBeVisible();
  await expect(friendPage).toHaveURL(new RegExp(`\\?room=${roomCode}$`));
  const acceptedRoomHeading = friendPage.getByTestId(
    "multiplayer-room-heading",
  );

  await expect(acceptedRoomHeading).toBeFocused();
  await expect(acceptedRoomHeading).not.toHaveCSS("box-shadow", "none");
  await expect(
    friendPage.getByTestId("multiplayer-room-current-participant"),
  ).toHaveText(`${friendName} · Watching`);
  await expect(friendPage.getByTestId("multiplayer-room-join-outcome")).toContainText(
    `accepted ${hostName}'s Watch invitation and initially joined as Watching`,
  );
  expect(acceptancePatchCount).toBe(2);

  await friendPage.reload();
  await expect(
    friendPage.getByTestId("multiplayer-room-current-participant"),
  ).toHaveText(`${friendName} · Watching`);
  await expect(friendPage).toHaveURL(new RegExp(`\\?room=${roomCode}$`));

  await page
    .getByTestId("multiplayer-room-next-game-select")
    .selectOption("asteroids");
  await page.getByTestId("multiplayer-room-replace-match-button").click();

  for (const partyPage of [page, friendPage]) {
    await expect(partyPage.getByTestId("multiplayer-room-code")).toHaveText(
      roomCode,
    );
    await expect(partyPage.getByTestId("multiplayer-room-game")).toHaveText(
      "Asteroids",
    );
    await expect(partyPage.getByTestId("multiplayer-room-status")).toHaveText(
      "Lobby",
    );
    await expect(partyPage).toHaveURL(new RegExp(`\\?room=${roomCode}$`));
  }
  const replacementGameHeading = page.getByTestId("multiplayer-room-game");

  await expect(replacementGameHeading).toBeFocused();
  await expect(replacementGameHeading).not.toHaveCSS("box-shadow", "none");
  await expect(
    friendPage.getByTestId("multiplayer-room-transition-announcement"),
  ).toHaveText(
    "Asteroids is now the party game. You are still in the same party.",
  );
  await expect(page.getByTestId("multiplayer-room-seat-ship-a")).toContainText(
    hostName,
  );
  await expect(
    friendPage.getByTestId("multiplayer-room-current-participant"),
  ).toHaveText(`${friendName} · Watching`);

  await friendPage.getByTestId("multiplayer-party-join-game-button").click();
  await expect(
    friendPage.getByTestId("multiplayer-room-seat-ship-b"),
  ).toContainText(friendName);
  await expect(
    friendPage.getByTestId("multiplayer-room-current-participant"),
  ).toHaveText(`${friendName} · Player`);
  await expect(
    friendPage.getByTestId("multiplayer-party-watch-instead-button"),
  ).toBeFocused();

  await page
    .getByTestId("multiplayer-room-next-game-select")
    .selectOption("pong");
  await page.getByTestId("multiplayer-room-replace-match-button").click();

  for (const partyPage of [page, friendPage]) {
    await expect(partyPage.getByTestId("multiplayer-room-code")).toHaveText(
      roomCode,
    );
    await expect(partyPage.getByTestId("multiplayer-room-game")).toHaveText(
      "Pong",
    );
    await expect(partyPage.getByTestId("multiplayer-room-status")).toHaveText(
      "Lobby",
    );
    await expect(partyPage).toHaveURL(new RegExp(`\\?room=${roomCode}$`));
  }
  await expect(page.getByTestId("multiplayer-room-game")).toBeFocused();
  await expect(page.getByTestId("multiplayer-room-seat-left")).toContainText(
    hostName,
  );
  await expect(
    friendPage.getByTestId("multiplayer-room-seat-right"),
  ).toContainText(friendName);
  await expect(
    friendPage.getByTestId("multiplayer-room-current-participant"),
  ).toHaveText(`${friendName} · Player`);
  await expect(
    friendPage.getByTestId("multiplayer-party-watch-instead-button"),
  ).toBeFocused();
  await expect(
    friendPage.getByTestId("multiplayer-room-transition-announcement"),
  ).toHaveText("Pong is now the party game. You are still in the same party.");

  await page
    .getByTestId("multiplayer-room-next-game-select")
    .selectOption("asteroids");
  await page.getByTestId("multiplayer-room-replace-match-button").click();

  for (const partyPage of [page, friendPage]) {
    await expect(partyPage.getByTestId("multiplayer-room-code")).toHaveText(
      roomCode,
    );
    await expect(partyPage.getByTestId("multiplayer-room-game")).toHaveText(
      "Asteroids",
    );
    await expect(partyPage.getByTestId("multiplayer-room-status")).toHaveText(
      "Lobby",
    );
    await expect(partyPage).toHaveURL(new RegExp(`\\?room=${roomCode}$`));
  }
  await expect(page.getByTestId("multiplayer-room-game")).toBeFocused();
  await expect(page.getByTestId("multiplayer-room-seat-ship-a")).toContainText(
    hostName,
  );
  await expect(
    friendPage.getByTestId("multiplayer-room-seat-ship-b"),
  ).toContainText(friendName);
  await expect(
    friendPage.getByTestId("multiplayer-room-current-participant"),
  ).toHaveText(`${friendName} · Player`);
  await expect(
    friendPage.getByTestId("multiplayer-party-watch-instead-button"),
  ).toBeFocused();
  await expect(
    friendPage.getByTestId("multiplayer-room-transition-announcement"),
  ).toHaveText(
    "Asteroids is now the party game. You are still in the same party.",
  );

  await page.getByTestId("multiplayer-room-start-button").click();
  await expect(page.getByTestId("asteroids-multiplayer-room")).toBeVisible();
  await expect(
    friendPage.getByTestId("asteroids-multiplayer-room"),
  ).toBeVisible();
  const startedPartyHeading = page.getByTestId("multiplayer-room-heading");

  await expect(startedPartyHeading).toBeFocused();
  await expect(startedPartyHeading).not.toHaveCSS("box-shadow", "none");
  await expect(
    friendPage.getByTestId("multiplayer-room-transition-announcement"),
  ).toHaveText("Asteroids started.");
  const friendStartedPartyHeading = friendPage.getByTestId(
    "multiplayer-room-heading",
  );

  await expect(friendStartedPartyHeading).toBeFocused();
  await expect(friendStartedPartyHeading).not.toHaveCSS("box-shadow", "none");
  await expect(friendPage.getByTestId("asteroids-multiplayer-role")).toHaveText(
    `${friendName} · Ship B`,
  );

  const friendTransitionSlots = friendPage
    .getByTestId("multiplayer-room-transition-announcement")
    .locator('[role="status"]');
  const startedSlotIndex = await friendTransitionSlots.evaluateAll((slots) =>
    slots.findIndex((slot) => (slot.textContent ?? "").trim().length > 0),
  );
  const firstRestartSlotIndex = startedSlotIndex === 0 ? 1 : 0;
  const restartAnnouncement =
    "A new Asteroids match started. You are still in the same party.";

  expect(startedSlotIndex).toBeGreaterThanOrEqual(0);
  await page.getByTestId("multiplayer-room-restart-button").click();
  await expect(friendTransitionSlots.nth(firstRestartSlotIndex)).toHaveText(
    restartAnnouncement,
  );
  await expect(friendTransitionSlots.nth(startedSlotIndex)).toBeEmpty();

  await page.getByTestId("multiplayer-room-restart-button").click();
  await expect(friendTransitionSlots.nth(startedSlotIndex)).toHaveText(
    restartAnnouncement,
  );
  await expect(friendTransitionSlots.nth(firstRestartSlotIndex)).toBeEmpty();
  await expect(friendStartedPartyHeading).toBeFocused();

  await friendPage.reload();
  await expect(
    friendPage.getByTestId("asteroids-multiplayer-room"),
  ).toBeVisible();
  await expect(
    friendPage.getByTestId("multiplayer-room-current-participant"),
  ).toHaveText(`${friendName} · Player`);
  await expect(friendPage.getByTestId("asteroids-multiplayer-role")).toHaveText(
    `${friendName} · Ship B`,
  );
  await expect(friendPage).toHaveURL(new RegExp(`\\?room=${roomCode}$`));
  expect(acceptancePatchCount).toBe(2);
  expect(hostBrowserIssues).toEqual([]);
  expect(friendBrowserIssues).toEqual([]);

  await friendContext.close();
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

test("watcher queues for the next match and party leave closes cleanly", async ({
  baseURL,
  browser,
  page,
}, testInfo) => {
  const appBaseURL = baseURL ?? "http://127.0.0.1:3110";
  const hostName = createPlayerName(
    "Queue Host",
    testInfo.workerIndex,
    testInfo.retry,
  );
  const guestName = createPlayerName(
    "Queue Guest",
    testInfo.workerIndex,
    testInfo.retry,
  );
  const watcherName = createPlayerName(
    "Queue Watcher",
    testInfo.workerIndex,
    testInfo.retry,
  );

  await openLauncher(page);
  await signUpFromLauncher(page, hostName);
  await hostMultiplayerRoomFromLauncher(page, "pong");

  const roomCode = (
    await page.getByTestId("multiplayer-room-code").innerText()
  ).trim();
  const guestContext = await browser.newContext();
  const watcherContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  const watcherPage = await watcherContext.newPage();
  const guestIssues = collectBrowserIssues(guestPage);
  const watcherIssues = collectBrowserIssues(watcherPage);

  try {
    await guestPage.goto(new URL(`/?room=${roomCode}`, appBaseURL).toString());
    await guestPage
      .getByTestId("multiplayer-room-display-name-input")
      .fill(guestName);
    await guestPage.getByTestId("multiplayer-room-join-button").click();
    await expect(
      guestPage.getByTestId("multiplayer-room-current-participant"),
    ).toHaveText(`${guestName} · Player`);

    await page.getByTestId("multiplayer-room-start-button").click();
    await expect(guestPage.getByTestId("pong-multiplayer-room")).toBeVisible();

    await watcherPage.goto(
      new URL(`/?room=${roomCode}`, appBaseURL).toString(),
    );
    await watcherPage
      .getByTestId("multiplayer-room-display-name-input")
      .fill(watcherName);
    await watcherPage.getByTestId("multiplayer-room-watch-button").click();
    await expect(
      watcherPage.getByTestId("multiplayer-room-current-participant"),
    ).toHaveText(`${watcherName} · Watching`);

    await watcherPage.getByTestId("multiplayer-party-join-next-button").click();
    await expect(
      watcherPage.getByTestId("multiplayer-party-queue-position"),
    ).toHaveText("Waiting for next match · Position 1");
    await expect(
      watcherPage.getByTestId("multiplayer-party-cancel-next-button"),
    ).toBeFocused();
    await watcherPage
      .getByTestId("multiplayer-party-cancel-next-button")
      .click();
    await expect(
      watcherPage.getByTestId("multiplayer-party-queue-position"),
    ).toHaveCount(0);
    await watcherPage.getByTestId("multiplayer-party-join-next-button").click();
    await expect(
      watcherPage.getByTestId("multiplayer-party-queue-position"),
    ).toHaveText("Waiting for next match · Position 1");

    const guestLeaveButton = guestPage.getByTestId(
      "multiplayer-party-leave-button",
    );
    await guestLeaveButton.click();
    await expect(
      guestPage.getByTestId("multiplayer-leave-party-dialog"),
    ).toBeVisible();
    await guestPage.getByTestId("multiplayer-leave-party-cancel").click();
    await expect(guestLeaveButton).toBeFocused();
    await guestLeaveButton.click();
    await guestPage.getByTestId("multiplayer-leave-party-confirm").click();
    await expect(
      guestPage.getByTestId("multiplayer-room-membership-ended"),
    ).toContainText("You left the party");
    await expect(
      guestPage.getByRole("heading", { name: "You left" }),
    ).toBeFocused();
    await expect(
      watcherPage.getByTestId("multiplayer-party-queue-position"),
    ).toHaveText("Waiting for next match · Position 1");
    await expect(page.getByTestId("multiplayer-room-seat-right")).toContainText(
      "Open",
    );

    await page.getByTestId("multiplayer-room-restart-button").click();
    await expect(
      watcherPage.getByTestId("multiplayer-room-current-participant"),
    ).toHaveText(`${watcherName} · Player`);
    await expect(
      watcherPage.getByTestId("multiplayer-room-seat-right"),
    ).toContainText(watcherName);
    await expect(
      watcherPage.getByTestId("multiplayer-room-join-outcome"),
    ).toHaveCount(0);
    const promotedWatcherHeading = watcherPage.getByTestId(
      "multiplayer-room-heading",
    );

    await expect(promotedWatcherHeading).toBeFocused();
    await expect(promotedWatcherHeading).not.toHaveCSS("box-shadow", "none");

    await page.getByTestId("multiplayer-party-leave-button").click();
    await expect(
      page.getByTestId("multiplayer-leave-party-dialog"),
    ).toBeVisible();
    await page.getByTestId("multiplayer-leave-party-confirm").click();
    await expect(
      watcherPage.getByTestId("multiplayer-room-membership-ended"),
    ).toContainText("the party closed");
    await expect(
      page.getByTestId("multiplayer-room-membership-ended"),
    ).toContainText("the party closed");
    await expect(
      page.getByRole("heading", { name: "Party closed" }),
    ).toBeFocused();
    await expect(
      watcherPage.getByRole("heading", { name: "Party closed" }),
    ).toBeFocused();

    expect(guestIssues).toEqual([]);
    expect(watcherIssues).toEqual([]);
  } finally {
    await guestContext.close();
    await watcherContext.close();
  }
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
      ).toHaveText(`${fullLobbyName} · Watching`);
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
      ).toHaveText(`${lateName} · Watching`);
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
