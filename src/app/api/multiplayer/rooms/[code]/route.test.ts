import { describe, expect, it, vi } from "vitest";

import { InProcessMultiplayerRoomStore } from "@/lib/server/multiplayer-room-runtime";
import type { AuthenticatedUser } from "@/lib/user-profile";

import type { MultiplayerRoomUserSessionLookup } from "../route";
import { createMultiplayerRoomRouteHandlers } from "./route";

const SIGNED_IN_USER = {
  displayName: "Ada Host",
  id: "user-1",
} satisfies AuthenticatedUser;

function createUserStore(user: AuthenticatedUser | null): MultiplayerRoomUserSessionLookup {
  return {
    getUserBySessionToken: vi.fn(async () => user),
  };
}

function createRoomStore({ getNowMs }: { getNowMs?: () => number } = {}) {
  const participantIds = ["host-1", "guest-1", "guest-2"];
  let participantIdIndex = 0;

  return new InProcessMultiplayerRoomStore({
    createParticipantId: () => participantIds[participantIdIndex++] ?? "participant-x",
    createRoomCode: () => "ROOM1",
    getNowMs,
  });
}

function createCommandRequest(body: unknown, signedIn = false) {
  return new Request("http://localhost/api/multiplayer/rooms/ROOM1", {
    body: JSON.stringify(body),
    headers: signedIn
      ? {
          cookie: "game_user_session=session-token",
        }
      : undefined,
    method: "POST",
  });
}

function expectRoomCreated(store: InProcessMultiplayerRoomStore) {
  const result = store.createRoom({ host: SIGNED_IN_USER });

  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.snapshot;
}

function expectRoomStarted(store: InProcessMultiplayerRoomStore) {
  expectRoomCreated(store);
  store.applyCommand("ROOM1", {
    displayName: "Guest Hero",
    type: "room.joinObserver",
  });
  store.applyCommand("ROOM1", {
    participantId: "host-1",
    seatId: "left",
    type: "room.claimSeat",
  });
  store.applyCommand("ROOM1", {
    participantId: "guest-1",
    seatId: "right",
    type: "room.claimSeat",
  });
  const result = store.applyCommand("ROOM1", {
    command: "start",
    participantId: "host-1",
    type: "room.lifecycle",
  });

  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.snapshot;
}

describe("multiplayer room route", () => {
  it("returns room snapshots by normalized code", async () => {
    const roomStore = createRoomStore();
    const userStore = createUserStore(null);
    const handlers = createMultiplayerRoomRouteHandlers(roomStore, userStore);

    expectRoomCreated(roomStore);

    const response = await handlers.GET(
      new Request("http://localhost/api/multiplayer/rooms/room1"),
      { code: "room1" },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      room: {
        code: "ROOM1",
        hostParticipantId: "host-1",
        status: "lobby",
      },
      seq: 1,
    });
  });

  it("includes optional Pong game snapshots in GET responses", async () => {
    let nowMs = 1_000;
    const roomStore = createRoomStore({ getNowMs: () => nowMs });
    const userStore = createUserStore(null);
    const handlers = createMultiplayerRoomRouteHandlers(roomStore, userStore);

    expectRoomStarted(roomStore);
    nowMs = 1_100;

    const response = await handlers.GET(
      new Request("http://localhost/api/multiplayer/rooms/room1"),
      { code: "room1" },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      game: {
        gameId: "pong",
        heldInputs: {},
        serverTimeMs: 1_100,
        snapshot: {
          status: "ready",
        },
      },
      room: {
        code: "ROOM1",
      },
    });
  });

  it("lets guests join rooms as observers without a session", async () => {
    const roomStore = createRoomStore();
    const userStore = createUserStore(null);
    const handlers = createMultiplayerRoomRouteHandlers(roomStore, userStore);

    expectRoomCreated(roomStore);

    const response = await handlers.POST(
      createCommandRequest({
        displayName: "Guest Hero",
        type: "room.joinObserver",
      }),
      { code: "ROOM1" },
    );

    expect(response.status).toBe(200);
    expect(userStore.getUserBySessionToken).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      participant: {
        displayName: "Guest Hero",
        id: "guest-1",
        role: "observer",
        userId: null,
      },
      room: {
        participants: [
          expect.objectContaining({ id: "host-1", role: "host" }),
          expect.objectContaining({ id: "guest-1", role: "observer" }),
        ],
      },
      seq: 2,
    });
  });

  it("rejects host-only commands without matching host authority", async () => {
    const roomStore = createRoomStore();
    const userStore = createUserStore(SIGNED_IN_USER);
    const handlers = createMultiplayerRoomRouteHandlers(roomStore, userStore);

    expectRoomCreated(roomStore);

    const response = await handlers.POST(
      createCommandRequest(
        {
          command: "start",
          participantId: "guest-1",
          type: "room.lifecycle",
        },
        true,
      ),
      { code: "ROOM1" },
    );

    expect(response.status).toBe(403);
    expect(userStore.getUserBySessionToken).toHaveBeenCalledWith("session-token");
    await expect(response.json()).resolves.toEqual({
      code: "not-host",
      error: "Sign in as the room host before changing room settings or lifecycle.",
    });
  });

  it("parses game input without requiring host authentication", async () => {
    const roomStore = createRoomStore();
    const userStore = createUserStore(null);
    const handlers = createMultiplayerRoomRouteHandlers(roomStore, userStore);

    expectRoomStarted(roomStore);

    const response = await handlers.POST(
      createCommandRequest({
        input: {
          direction: "down",
          type: "pong.setPaddleDirection",
        },
        participantId: "guest-1",
        type: "game.input",
      }),
      { code: "ROOM1" },
    );

    expect(response.status).toBe(200);
    expect(userStore.getUserBySessionToken).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      game: {
        gameId: "pong",
        heldInputs: {
          right: {
            down: true,
          },
        },
        snapshot: {
          status: "ready",
        },
      },
      seq: 5,
    });
  });

  it("rejects invalid and unseated game input with 4xx responses", async () => {
    const roomStore = createRoomStore();
    const userStore = createUserStore(null);
    const handlers = createMultiplayerRoomRouteHandlers(roomStore, userStore);

    expectRoomStarted(roomStore);

    const invalidInputResponse = await handlers.POST(
      createCommandRequest({
        input: {
          direction: "sideways",
          type: "pong.setPaddleDirection",
        },
        participantId: "guest-1",
        type: "game.input",
      }),
      { code: "ROOM1" },
    );

    expect(invalidInputResponse.status).toBe(400);
    await expect(invalidInputResponse.json()).resolves.toEqual({
      error: "Pong paddle direction must be up, down, or null.",
    });

    roomStore.applyCommand("ROOM1", {
      displayName: "Late Observer",
      type: "room.joinObserver",
    });

    const unseatedInputResponse = await handlers.POST(
      createCommandRequest({
        input: {
          direction: "up",
          type: "pong.setPaddleDirection",
        },
        participantId: "guest-2",
        type: "game.input",
      }),
      { code: "ROOM1" },
    );

    expect(unseatedInputResponse.status).toBe(404);
    await expect(unseatedInputResponse.json()).resolves.toEqual({
      code: "participant-not-seated",
      error: "Participant does not occupy a Pong paddle seat.",
    });
  });
});
