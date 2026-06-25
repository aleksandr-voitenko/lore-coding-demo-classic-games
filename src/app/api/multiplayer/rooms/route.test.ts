import { describe, expect, it, vi } from "vitest";

import { InProcessMultiplayerRoomStore } from "@/lib/server/multiplayer-room-runtime";
import type { AuthenticatedUser } from "@/lib/user-profile";

import {
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

  it("creates private Pong rooms for signed-in hosts", async () => {
    const roomStore = new InProcessMultiplayerRoomStore({
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
    expect(userStore.getUserBySessionToken).toHaveBeenCalledWith("session-token");
    await expect(response.json()).resolves.toMatchObject({
      participant: {
        id: "host-1",
        role: "host",
        userId: "user-1",
      },
      room: {
        code: "ROOM1",
        hostParticipantId: "host-1",
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
});
