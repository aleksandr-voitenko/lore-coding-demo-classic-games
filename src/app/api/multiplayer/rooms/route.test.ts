import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_MULTIPLAYER_GAME_ID,
  MULTIPLAYER_GAME_IDS,
} from "@/lib/multiplayer/game-registry";
import { InProcessMultiplayerRoomStore } from "@/lib/server/multiplayer-room-runtime";
import type { AuthenticatedUser } from "@/lib/user-profile";

import {
  POST,
  createMultiplayerRoomsRouteHandlers,
  type MultiplayerRoomUserSessionLookup,
} from "./route";

const SIGNED_IN_USER = {
  displayName: "Ada Host",
  id: "user-1",
} satisfies AuthenticatedUser;

function createUserStore(user: AuthenticatedUser | null): MultiplayerRoomUserSessionLookup {
  return {
    getUserBySessionToken: vi.fn(async () => user),
  };
}

function createCreateRoomRequest(body: unknown, signedIn = true) {
  return new Request("http://localhost/api/multiplayer/rooms", {
    body: JSON.stringify(body),
    headers: signedIn
      ? {
          cookie: "game_user_session=session-token",
        }
      : undefined,
    method: "POST",
  });
}

describe("multiplayer rooms route", () => {
  it("rejects the legacy mutation path before authentication or room creation", async () => {
    const response = await POST(createCreateRoomRequest({}, false));

    expect(response.status).toBe(426);
    await expect(response.json()).resolves.toEqual({
      code: "protocol-version-mismatch",
      error: "Multiplayer protocol version is not supported. Refresh the page.",
    });
  });

  it("requires a signed-in host before creating rooms", async () => {
    const roomStore = {
      createRoom: vi.fn(),
      getRoom: vi.fn(),
      applyCommand: vi.fn(),
    };
    const userStore = createUserStore(null);
    const handlers = createMultiplayerRoomsRouteHandlers(roomStore, userStore);
    const response = await handlers.POST(createCreateRoomRequest({}, false));

    expect(response.status).toBe(401);
    expect(userStore.getUserBySessionToken).toHaveBeenCalledWith(null);
    expect(roomStore.createRoom).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: "Sign in before creating multiplayer rooms.",
    });
  });

  it("returns a retryable capacity response without evicting active rooms", async () => {
    const roomStore = {
      applyCommand: vi.fn(),
      createRoom: vi.fn(async () => ({
        code: "room-capacity-reached" as const,
        error: "Room capacity is currently full. Try creating a room again shortly.",
        success: false as const,
      })),
      getRoom: vi.fn(),
    };
    const handlers = createMultiplayerRoomsRouteHandlers(
      roomStore,
      createUserStore(SIGNED_IN_USER),
    );
    const response = await handlers.POST(
      createCreateRoomRequest({ gameId: "pong" }),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("60");
    await expect(response.json()).resolves.toEqual({
      code: "room-capacity-reached",
      error: "Room capacity is currently full. Try creating a room again shortly.",
    });
  });

  it("creates private Pong rooms for signed-in hosts", async () => {
    const roomStore = new InProcessMultiplayerRoomStore({
      createParticipantCapability: () => "host-capability",
      createParticipantId: () => "host-1",
      createRoomCode: () => "ROOM1",
    });
    const userStore = createUserStore(SIGNED_IN_USER);
    const handlers = createMultiplayerRoomsRouteHandlers(roomStore, userStore);
    const response = await handlers.POST(
      createCreateRoomRequest({
        gameId: "pong",
        parameters: {
          targetScore: 7,
        },
      }),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(userStore.getUserBySessionToken).toHaveBeenCalledWith("session-token");
    await expect(response.json()).resolves.toMatchObject({
      participantCapability: "host-capability",
      participant: {
        id: "host-1",
        role: "host",
        userId: "user-1",
      },
      room: {
        code: "ROOM1",
        hostParticipantId: "host-1",
        matchId: 1,
        seats: [
          {
            id: "left",
            occupiedByParticipantId: null,
            required: true,
          },
          {
            id: "right",
            occupiedByParticipantId: null,
            required: true,
          },
        ],
        settings: {
          gameId: "pong",
          parameters: {
            targetScore: 7,
          },
        },
        status: "lobby",
      },
      seq: 1,
    });
  });

  it("creates private Space Invaders rooms with default ship seats", async () => {
    const roomStore = new InProcessMultiplayerRoomStore({
      createParticipantId: () => "host-1",
      createRoomCode: () => "ROOM1",
    });
    const userStore = createUserStore(SIGNED_IN_USER);
    const handlers = createMultiplayerRoomsRouteHandlers(roomStore, userStore);
    const response = await handlers.POST(
      createCreateRoomRequest({
        gameId: "space-invaders",
      }),
    );

    expect(response.status).toBe(201);
    expect(userStore.getUserBySessionToken).toHaveBeenCalledWith("session-token");
    await expect(response.json()).resolves.toMatchObject({
      room: {
        code: "ROOM1",
        seats: [
          {
            id: "ship-a",
            label: "Ship A",
            occupiedByParticipantId: null,
            required: true,
          },
          {
            id: "ship-b",
            label: "Ship B",
            occupiedByParticipantId: null,
            required: true,
          },
        ],
        settings: {
          gameId: "space-invaders",
        },
        status: "lobby",
      },
      seq: 1,
    });
  });

  it("uses the shared default when a signed-in room create omits the game id", async () => {
    const alternateDefaultGameId = MULTIPLAYER_GAME_IDS.find(
      (gameId) => gameId !== DEFAULT_MULTIPLAYER_GAME_ID,
    );

    if (alternateDefaultGameId === undefined) {
      throw new Error("The default-game route test requires another multiplayer game.");
    }

    vi.resetModules();
    vi.doMock("@/lib/multiplayer/game-registry", async (importOriginal) => ({
      ...(await importOriginal<
        typeof import("@/lib/multiplayer/game-registry")
      >()),
      DEFAULT_MULTIPLAYER_GAME_ID: alternateDefaultGameId,
    }));

    try {
      const [routeModule, runtimeModule, adapterModule] = await Promise.all([
        import("./route"),
        import("@/lib/server/multiplayer-room-runtime"),
        import("@/lib/server/multiplayer-game-adapters"),
      ]);
      const roomStore = new runtimeModule.InProcessMultiplayerRoomStore({
        createParticipantId: () => "host-1",
        createRoomCode: () => "ROOM1",
      });
      const handlers = routeModule.createMultiplayerRoomsRouteHandlers(
        roomStore,
        createUserStore(SIGNED_IN_USER),
      );
      const response = await handlers.POST(createCreateRoomRequest({}));
      const defaultAdapter = adapterModule.getDefaultMultiplayerServerGameAdapter();

      expect(response.status).toBe(201);
      expect(defaultAdapter.gameId).toBe(alternateDefaultGameId);
      await expect(response.json()).resolves.toMatchObject({
        room: {
          seats: defaultAdapter.defaultSeats.map((seat) => ({
            id: seat.id,
            label: seat.label,
            occupiedByParticipantId: null,
            required: seat.required === true,
          })),
          settings: defaultAdapter.defaultSettings,
        },
      });
    } finally {
      vi.doUnmock("@/lib/multiplayer/game-registry");
      vi.resetModules();
    }
  });
});
