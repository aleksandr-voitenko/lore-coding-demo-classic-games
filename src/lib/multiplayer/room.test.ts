import { describe, expect, it } from "vitest";

import type {
  PrivateRoomClientMessage,
  PrivateRoomServerMessage,
} from "./protocol";
import {
  addPrivateRoomGuestParticipantAsObserver,
  claimPrivateRoomSeat,
  createPrivateRoom,
  finishPrivateRoom,
  getPrivateRoomInvitePath,
  normalizePrivateRoomCode,
  pausePrivateRoom,
  releasePrivateRoomSeat,
  restartPrivateRoom,
  resumePrivateRoom,
  startPrivateRoom,
  updatePrivateRoomSettings,
  type PrivateRoom,
  type PrivateRoomSettings,
} from "./room";

const HOST_ID = "host-participant";
const HOST_USER_ID = "user-1";

const TWO_PLAYER_SEATS = [
  {
    id: "left",
    label: "Left",
    required: true,
  },
  {
    id: "right",
    label: "Right",
    required: true,
  },
] as const;

function expectRoomResult(result: ReturnType<typeof createPrivateRoom>) {
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.room;
}

function createLobbyRoom(settings: PrivateRoomSettings = { gameId: "pong" }) {
  return expectRoomResult(
    createPrivateRoom({
      code: "play-1",
      host: {
        displayName: "Host Player",
        participantId: HOST_ID,
        userId: HOST_USER_ID,
      },
      seats: TWO_PLAYER_SEATS,
      settings,
    }),
  );
}

function addObserver(room: PrivateRoom, participantId = "guest-1") {
  const result = addPrivateRoomGuestParticipantAsObserver(room, {
    displayName: "  Guest   Hero  ",
    participantId,
  });

  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.room;
}

function claimSeat(room: PrivateRoom, participantId: string, seatId: string) {
  const result = claimPrivateRoomSeat(room, { participantId, seatId });

  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.room;
}

function startRoom(room: PrivateRoom) {
  const result = startPrivateRoom(room, { participantId: HOST_ID });

  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.room;
}

function createReadyRoom() {
  return claimSeat(
    claimSeat(addObserver(addObserver(createLobbyRoom(), "guest-2")), "guest-1", "left"),
    "guest-2",
    "right",
  );
}

describe("private multiplayer rooms", () => {
  it("creates a lobby room with a signed-in host, generic settings, and empty seats", () => {
    const settings: PrivateRoomSettings = {
      gameId: "space-invaders",
      parameters: {
        board: "wide",
        friendlyFire: false,
        lives: 3,
        waves: ["opening", "mid"],
      },
    };
    const result = createPrivateRoom({
      code: " alpha-7 ",
      host: {
        displayName: "  Ada   Host  ",
        participantId: HOST_ID,
        userId: HOST_USER_ID,
      },
      seats: TWO_PLAYER_SEATS,
      settings,
    });

    expect(result).toEqual({
      room: {
        code: "ALPHA-7",
        hostParticipantId: HOST_ID,
        participants: [
          {
            displayName: "Ada Host",
            id: HOST_ID,
            role: "host",
            userId: HOST_USER_ID,
          },
        ],
        seats: [
          {
            id: "left",
            label: "Left",
            occupiedByParticipantId: null,
            required: true,
          },
          {
            id: "right",
            label: "Right",
            occupiedByParticipantId: null,
            required: true,
          },
        ],
        settings,
        status: "lobby",
      },
      success: true,
    });
  });

  it("rejects room creation without a signed-in host user id", () => {
    expect(
      createPrivateRoom({
        code: "room-1",
        host: {
          displayName: "Guest Host",
          participantId: HOST_ID,
          userId: null,
        },
        seats: TWO_PLAYER_SEATS,
        settings: { gameId: "pong" },
      }),
    ).toEqual({
      code: "invalid-host",
      error: "Private rooms require a signed-in host.",
      success: false,
    });
  });

  it("rejects room creation for unsupported catalog game ids", () => {
    expect(
      createPrivateRoom({
        code: "room-1",
        host: {
          displayName: "Host Player",
          participantId: HOST_ID,
          userId: HOST_USER_ID,
        },
        seats: TWO_PLAYER_SEATS,
        settings: { gameId: "fake-game" as PrivateRoomSettings["gameId"] },
      }),
    ).toEqual({
      code: "invalid-room-settings",
      error: "Room settings require a supported game id.",
      success: false,
    });
  });

  it("normalizes room codes and invite paths for root launcher URLs", () => {
    expect(normalizePrivateRoomCode(" abc-123 ")).toBe("ABC-123");
    expect(normalizePrivateRoomCode("bad room")).toBeNull();
    expect(normalizePrivateRoomCode("")).toBeNull();
    expect(getPrivateRoomInvitePath(" abc-123 ")).toBe("/?room=ABC-123");
    expect(getPrivateRoomInvitePath("bad room")).toBeNull();
  });

  it("adds guest participants as room-scoped observers by default", () => {
    const room = createLobbyRoom();
    const updatedRoom = addObserver(room);

    expect(updatedRoom.participants.at(-1)).toEqual({
      displayName: "Guest Hero",
      id: "guest-1",
      role: "observer",
      userId: null,
    });
    expect(updatedRoom.status).toBe("lobby");
    expect(room.participants).toHaveLength(1);
  });

  it("claims and releases seats while updating non-host roles immutably", () => {
    const lobbyRoom = addObserver(createLobbyRoom());
    const seatedRoom = claimSeat(lobbyRoom, "guest-1", "left");
    const releasedRoomResult = releasePrivateRoomSeat(seatedRoom, {
      participantId: "guest-1",
      seatId: "left",
    });

    expect(seatedRoom.seats[0]).toEqual({
      id: "left",
      label: "Left",
      occupiedByParticipantId: "guest-1",
      required: true,
    });
    expect(
      seatedRoom.participants.find((participant) => participant.id === "guest-1"),
    ).toMatchObject({
      role: "player",
    });
    expect(lobbyRoom.seats[0]?.occupiedByParticipantId).toBeNull();
    expect(
      lobbyRoom.participants.find((participant) => participant.id === "guest-1"),
    ).toMatchObject({
      role: "observer",
    });
    expect(releasedRoomResult).toMatchObject({
      room: {
        participants: expect.arrayContaining([
          expect.objectContaining({
            id: "guest-1",
            role: "observer",
          }),
        ]),
        seats: expect.arrayContaining([
          expect.objectContaining({
            id: "left",
            occupiedByParticipantId: null,
          }),
        ]),
      },
      success: true,
    });
  });

  it("keeps host authority when the host claims and releases a player seat", () => {
    const room = createLobbyRoom();
    const seatedRoom = claimSeat(room, HOST_ID, "left");
    const releasedRoomResult = releasePrivateRoomSeat(seatedRoom, {
      participantId: HOST_ID,
      seatId: "left",
    });

    expect(seatedRoom.participants[0]).toMatchObject({
      id: HOST_ID,
      role: "host",
      userId: HOST_USER_ID,
    });
    expect(releasedRoomResult).toMatchObject({
      room: {
        participants: [
          expect.objectContaining({
            id: HOST_ID,
            role: "host",
            userId: HOST_USER_ID,
          }),
        ],
      },
      success: true,
    });
  });

  it("lets the host update lobby settings immutably", () => {
    const room = createLobbyRoom({
      gameId: "pong",
      parameters: {
        targetScore: 5,
      },
    });
    const nextSettings: PrivateRoomSettings = {
      gameId: "pong",
      parameters: {
        board: {
          height: 560,
          width: 420,
        },
        targetScore: 7,
      },
    };
    const result = updatePrivateRoomSettings(room, {
      participantId: HOST_ID,
      settings: nextSettings,
    });

    expect(result).toMatchObject({
      room: {
        settings: {
          gameId: "pong",
          parameters: {
            board: {
              height: 560,
              width: 420,
            },
            targetScore: 7,
          },
        },
        status: "lobby",
      },
      success: true,
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    (nextSettings.parameters?.board as { height: number; width: number }).width = 480;

    expect(room.settings).toEqual({
      gameId: "pong",
      parameters: {
        targetScore: 5,
      },
    });
    expect(result.room.settings).toEqual({
      gameId: "pong",
      parameters: {
        board: {
          height: 560,
          width: 420,
        },
        targetScore: 7,
      },
    });
  });

  it("rejects settings updates from non-host participants", () => {
    const room = addObserver(createLobbyRoom());

    expect(
      updatePrivateRoomSettings(room, {
        participantId: "guest-1",
        settings: {
          gameId: "pong",
          parameters: {
            targetScore: 7,
          },
        },
      }),
    ).toEqual({
      code: "not-host",
      error: "Only the signed-in room host can perform this action.",
      success: false,
    });
  });

  it("rejects settings updates for unsupported catalog game ids", () => {
    const room = createLobbyRoom();

    expect(
      updatePrivateRoomSettings(room, {
        participantId: HOST_ID,
        settings: { gameId: "fake-game" as PrivateRoomSettings["gameId"] },
      }),
    ).toEqual({
      code: "invalid-room-settings",
      error: "Room settings require a supported game id.",
      success: false,
    });
  });

  it("rejects settings updates after the room starts", () => {
    const runningRoom = startRoom(createReadyRoom());

    expect(
      updatePrivateRoomSettings(runningRoom, {
        participantId: HOST_ID,
        settings: {
          gameId: "pong",
          parameters: {
            targetScore: 9,
          },
        },
      }),
    ).toEqual({
      code: "invalid-status",
      error: "Only lobby rooms can update settings.",
      success: false,
    });
  });

  it("guards starting on required seats before allowing host lifecycle transitions", () => {
    const oneSeatRoom = claimSeat(addObserver(createLobbyRoom()), "guest-1", "left");

    expect(startPrivateRoom(oneSeatRoom, { participantId: HOST_ID })).toEqual({
      code: "required-seats-empty",
      error: "Required seats must be occupied before starting the room: Right.",
      success: false,
    });

    const readyRoom = claimSeat(addObserver(oneSeatRoom, "guest-2"), "guest-2", "right");
    const runningRoom = startRoom(readyRoom);
    const pausedRoomResult = pausePrivateRoom(runningRoom, { participantId: HOST_ID });

    expect(runningRoom.status).toBe("running");
    expect(pausedRoomResult).toMatchObject({
      room: {
        status: "paused",
      },
      success: true,
    });
  });

  it("rejects lifecycle commands from non-host participants", () => {
    const readyRoom = createReadyRoom();

    expect(startPrivateRoom(readyRoom, { participantId: "guest-1" })).toEqual({
      code: "not-host",
      error: "Only the signed-in room host can perform this action.",
      success: false,
    });
  });

  it("supports host pause, resume, finish, and restart commands", () => {
    const readyRoom = createReadyRoom();
    const runningRoom = startRoom(readyRoom);
    const pausedRoomResult = pausePrivateRoom(runningRoom, { participantId: HOST_ID });

    expect(pausedRoomResult.success).toBe(true);

    if (!pausedRoomResult.success) {
      throw new Error(pausedRoomResult.error);
    }

    const resumedRoomResult = resumePrivateRoom(pausedRoomResult.room, {
      participantId: HOST_ID,
    });

    expect(resumedRoomResult).toMatchObject({
      room: {
        status: "running",
      },
      success: true,
    });

    if (!resumedRoomResult.success) {
      throw new Error(resumedRoomResult.error);
    }

    const finishedRoomResult = finishPrivateRoom(resumedRoomResult.room, {
      participantId: HOST_ID,
    });

    expect(finishedRoomResult).toMatchObject({
      room: {
        status: "finished",
      },
      success: true,
    });

    if (!finishedRoomResult.success) {
      throw new Error(finishedRoomResult.error);
    }

    expect(
      restartPrivateRoom(finishedRoomResult.room, { participantId: HOST_ID }),
    ).toMatchObject({
      room: {
        status: "running",
      },
      success: true,
    });
  });

  it("allows observers to join running rooms without changing active seats", () => {
    const readyRoom = createReadyRoom();
    const runningRoom = startRoom(readyRoom);
    const observedRoom = addObserver(runningRoom, "observer-1");

    expect(observedRoom.status).toBe("running");
    expect(observedRoom.seats).toEqual(runningRoom.seats);
    expect(observedRoom.participants.at(-1)).toMatchObject({
      id: "observer-1",
      role: "observer",
      userId: null,
    });
  });

  it("defines protocol message shapes around room commands and snapshots", () => {
    const clientMessage = {
      participantId: "guest-1",
      requestId: "request-1",
      seatId: "left",
      type: "room.claimSeat",
    } satisfies PrivateRoomClientMessage;
    const serverMessage = {
      room: createLobbyRoom(),
      seq: 1,
      type: "room.snapshot",
    } satisfies PrivateRoomServerMessage;

    expect(clientMessage.type).toBe("room.claimSeat");
    expect(serverMessage.room.status).toBe("lobby");
  });

  it("clones generic settings so room snapshots do not share caller-owned parameter objects", () => {
    const settings: PrivateRoomSettings = {
      gameId: "asteroids",
      parameters: {
        difficulty: "hard",
        options: {
          saucers: true,
        },
      },
    };
    const room = createLobbyRoom(settings);

    (settings.parameters?.options as { saucers: boolean }).saucers = false;

    expect(room.settings).toEqual({
      gameId: "asteroids",
      parameters: {
        difficulty: "hard",
        options: {
          saucers: true,
        },
      },
    });
  });
});
