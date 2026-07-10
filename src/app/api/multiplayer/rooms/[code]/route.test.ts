import { describe, expect, it, vi } from "vitest";

import { InProcessMultiplayerRoomStore } from "@/lib/server/multiplayer-room-runtime";
import type { AuthenticatedUser } from "@/lib/user-profile";

import type { MultiplayerRoomUserSessionLookup } from "../route";
import * as multiplayerRoomRoute from "./route";
import { createMultiplayerRoomRouteHandlers } from "./route-handlers";

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
  it("exports only the supported Next.js route fields", () => {
    expect(Object.keys(multiplayerRoomRoute).sort()).toEqual([
      "GET",
      "POST",
      "dynamic",
      "runtime",
    ]);
  });

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

  it("rejects public HTTP live room commands", async () => {
    const roomStore = createRoomStore();
    const userStore = createUserStore(null);
    const handlers = createMultiplayerRoomRouteHandlers(roomStore, userStore);

    expectRoomCreated(roomStore);

    for (const body of [
      {
        displayName: "Guest Hero",
        type: "room.joinObserver",
      },
      {
        participantId: "guest-1",
        seatId: "right",
        type: "room.claimSeat",
      },
      {
        participantId: "guest-1",
        seatId: "right",
        type: "room.releaseSeat",
      },
      {
        input: {
          direction: "down",
          type: "pong.setPaddleDirection",
        },
        participantId: "guest-1",
        type: "game.input",
      },
    ]) {
      const response = await handlers.POST(createCommandRequest(body), {
        code: "ROOM1",
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Live room commands require the WebSocket stream.",
      });
    }

    expect(userStore.getUserBySessionToken).not.toHaveBeenCalled();
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

  it("accepts authenticated host-only lifecycle and settings commands over HTTP", async () => {
    const roomStore = createRoomStore();
    const userStore = createUserStore(SIGNED_IN_USER);
    const handlers = createMultiplayerRoomRouteHandlers(roomStore, userStore);

    const settingsSnapshot = expectRoomCreated(roomStore);
    const settingsResponse = await handlers.POST(
      createCommandRequest(
        {
          participantId: settingsSnapshot.room.hostParticipantId,
          settings: {
            gameId: "pong",
            parameters: {
              targetScore: 7,
            },
          },
          type: "room.updateSettings",
        },
        true,
      ),
      { code: "ROOM1" },
    );

    expect(settingsResponse.status).toBe(200);
    await expect(settingsResponse.json()).resolves.toMatchObject({
      room: {
        settings: {
          gameId: "pong",
          parameters: {
            targetScore: 7,
          },
        },
      },
      seq: 2,
    });

    const lifecycleRoomStore = createRoomStore();
    const lifecycleHandlers = createMultiplayerRoomRouteHandlers(
      lifecycleRoomStore,
      userStore,
    );

    expectRoomStarted(lifecycleRoomStore);

    const lifecycleResponse = await lifecycleHandlers.POST(
      createCommandRequest(
        {
          command: "pause",
          participantId: "host-1",
          type: "room.lifecycle",
        },
        true,
      ),
      { code: "ROOM1" },
    );

    expect(lifecycleResponse.status).toBe(200);
    expect(userStore.getUserBySessionToken).toHaveBeenCalledWith("session-token");
    await expect(lifecycleResponse.json()).resolves.toMatchObject({
      room: {
        status: "paused",
      },
      seq: 6,
    });
  });
});
