import { beforeEach, describe, expect, it, vi } from "vitest";

const stores = vi.hoisted(() => ({
  room: {
    applyCommand: vi.fn(),
    createRoom: vi.fn(),
    getRoom: vi.fn(),
  },
  user: {
    getUserBySessionToken: vi.fn(),
  },
}));

vi.mock("@/lib/server/multiplayer-room-store", () => ({
  getMultiplayerRoomStore: () => stores.room,
}));
vi.mock("@/lib/server/sqlite-user-profile-store", () => ({
  getUserProfileStore: () => stores.user,
}));

import { POST as postRoomV2 } from "./[code]/v2/route";
import { POST as postRoomV3 } from "./[code]/v3/route";
import { POST as postRoomV4 } from "./[code]/v4/route";
import { POST as postRoomsV2 } from "./v2/route";
import { POST as postRoomsV3 } from "./v3/route";
import { POST as postRoomsV4 } from "./v4/route";

const USER = {
  displayName: "Ada Host",
  id: "user-1",
};
const SNAPSHOT = {
  participant: {
    displayName: "Ada Host",
    id: "host-1",
    role: "host" as const,
    userId: "user-1",
  },
  room: {
    code: "ROOM1",
    hostParticipantId: "host-1",
    matchId: 1,
    participants: [
      {
        displayName: "Ada Host",
        id: "host-1",
        role: "host" as const,
        userId: "user-1",
      },
    ],
    seats: [],
    settings: { gameId: "pong" as const },
    status: "lobby" as const,
  },
  seq: 1,
};

function createRequest(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      cookie: "game_user_session=session-token",
    },
    method: "POST",
  });
}

describe("versioned multiplayer mutation routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stores.user.getUserBySessionToken.mockResolvedValue(USER);
    stores.room.createRoom.mockResolvedValue({
      participantCapability: "host-capability",
      snapshot: SNAPSHOT,
      success: true,
    });
    stores.room.getRoom.mockResolvedValue({
      snapshot: SNAPSHOT,
      success: true,
    });
    stores.room.applyCommand.mockResolvedValue({
      snapshot: SNAPSHOT,
      success: true,
    });
  });

  it("retires protocol-v2 and v3 mutation routes before touching stores", async () => {
    const responses = await Promise.all([
      postRoomsV2(
        createRequest("/api/multiplayer/rooms/v2", { gameId: "pong" }),
      ),
      postRoomV2(
        createRequest("/api/multiplayer/rooms/ROOM1/v2", {
          command: "start",
          matchId: 1,
          type: "room.lifecycle",
        }),
      ),
      postRoomsV3(
        createRequest("/api/multiplayer/rooms/v3", { gameId: "pong" }),
      ),
      postRoomV3(
        createRequest("/api/multiplayer/rooms/ROOM1/v3", {
          command: "start",
          matchId: 1,
          type: "room.lifecycle",
        }),
      ),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      426, 426, 426, 426,
    ]);
    expect(stores.user.getUserBySessionToken).not.toHaveBeenCalled();
    expect(stores.room.createRoom).not.toHaveBeenCalled();
    expect(stores.room.getRoom).not.toHaveBeenCalled();
    expect(stores.room.applyCommand).not.toHaveBeenCalled();
  });

  it("serves protocol-v4 room creation through the active handler", async () => {
    const response = await postRoomsV4(
      createRequest("/api/multiplayer/rooms/v4", { gameId: "pong" }),
    );

    expect(response.status).toBe(201);
    expect(stores.user.getUserBySessionToken).toHaveBeenCalledWith(
      "session-token",
    );
    expect(stores.room.createRoom).toHaveBeenCalledWith({
      host: USER,
      settings: { gameId: "pong" },
    });
  });

  it("serves protocol-v4 host commands with the authenticated actor", async () => {
    const response = await postRoomV4(
      createRequest("/api/multiplayer/rooms/ROOM1/v4", {
        command: "start",
        matchId: 1,
        participantId: "forged-participant",
        type: "room.lifecycle",
      }),
      { params: Promise.resolve({ code: "ROOM1" }) },
    );

    expect(response.status).toBe(200);
    expect(stores.room.applyCommand).toHaveBeenCalledWith("ROOM1", {
      command: "start",
      matchId: 1,
      participantId: "host-1",
      type: "room.lifecycle",
    });
  });
});
