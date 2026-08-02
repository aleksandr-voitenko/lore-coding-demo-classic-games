import { describe, expect, it } from "vitest";

import type {
  PrivateRoomClientMessage,
  PrivateRoomServerMessage,
} from "./protocol";
import {
  addPrivateRoomGuestParticipantAsObserver,
  addPrivateRoomGuestParticipantAsPlayer,
  cancelPrivateRoomNextMatchRequest,
  claimPrivateRoomSeat,
  createPrivateRoom,
  finishPrivateRoom,
  finishPrivateRoomAfterGameTerminal,
  getPrivateRoomGuestPlayerAdmissionRole,
  getPrivateRoomInvitePath,
  leavePrivateRoom,
  normalizePrivateRoomCode,
  pausePrivateRoom,
  queuePrivateRoomParticipantForNextMatch,
  releasePrivateRoomSeat,
  replacePrivateRoomMatch,
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
  return claimSeat(addObserver(createLobbyRoom()), "guest-1", "right");
}

describe("private multiplayer rooms", () => {
  it("creates a lobby room with a signed-in host in the first player slot", () => {
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
        matchId: 1,
        nextMatchParticipantIds: [],
        observerLimit: 8,
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
            occupiedByParticipantId: HOST_ID,
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

  it("requires exactly two required seats for party creation and replacement", () => {
    for (const seats of [
      [{ id: "only", label: "Only", required: true }],
      [
        { id: "one", label: "One", required: true },
        { id: "two", label: "Two", required: true },
        { id: "three", label: "Three", required: true },
      ],
      [
        { id: "one", label: "One", required: true },
        { id: "two", label: "Two", required: false },
      ],
    ]) {
      expect(
        createPrivateRoom({
          code: "party-room",
          host: {
            displayName: "Ada Host",
            participantId: HOST_ID,
            userId: HOST_USER_ID,
          },
          seats,
          settings: { gameId: "pong" },
        }),
      ).toEqual({
        code: "invalid-seat",
        error: "Party games require exactly two required player seats.",
        success: false,
      });
      expect(
        replacePrivateRoomMatch(createLobbyRoom(), {
          participantId: HOST_ID,
          seats,
          settings: { gameId: "asteroids" },
        }),
      ).toEqual({
        code: "invalid-seat",
        error: "Party games require exactly two required player seats.",
        success: false,
      });
    }
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

  it("caps watchers without blocking an available player slot", () => {
    const room = expectRoomResult(
      createPrivateRoom({
        code: "watch-cap",
        host: {
          displayName: "Host Player",
          participantId: HOST_ID,
          userId: HOST_USER_ID,
        },
        observerLimit: 1,
        seats: TWO_PLAYER_SEATS,
        settings: { gameId: "pong" },
      }),
    );
    const watchedRoom = addObserver(room, "watcher-1");
    const playerResult = addPrivateRoomGuestParticipantAsPlayer(watchedRoom, {
      displayName: "Player Two",
      participantId: "player-2",
    });

    expect(playerResult).toMatchObject({
      room: {
        participants: expect.arrayContaining([
          expect.objectContaining({ id: "player-2", role: "player" }),
        ]),
        seats: [
          expect.objectContaining({ occupiedByParticipantId: HOST_ID }),
          expect.objectContaining({ occupiedByParticipantId: "player-2" }),
        ],
      },
      success: true,
    });

    const fullRoom = playerResult.success ? playerResult.room : watchedRoom;

    expect(
      addPrivateRoomGuestParticipantAsObserver(fullRoom, {
        displayName: "Another Watcher",
        participantId: "watcher-2",
      }),
    ).toEqual({
      code: "observer-limit-reached",
      error: "This party already has the maximum number of watchers.",
      success: false,
    });
    expect(
      addPrivateRoomGuestParticipantAsPlayer(startRoom(fullRoom), {
        displayName: "Late Player",
        participantId: "late-player",
      }),
    ).toEqual({
      code: "observer-limit-reached",
      error: "This party already has the maximum number of watchers.",
      success: false,
    });
    expect(
      releasePrivateRoomSeat(fullRoom, {
        participantId: "player-2",
        seatId: "right",
      }),
    ).toEqual({
      code: "observer-limit-reached",
      error: "This party already has the maximum number of watchers.",
      success: false,
    });
  });

  it("does not admit a new player ahead of an existing next-match queue", () => {
    const room = expectRoomResult(
      createPrivateRoom({
        code: "queue-priority",
        host: {
          displayName: "Host Player",
          participantId: HOST_ID,
          userId: HOST_USER_ID,
        },
        observerLimit: 1,
        seats: TWO_PLAYER_SEATS,
        settings: { gameId: "pong" },
      }),
    );
    const playerRoom = expectRoomResult(
      addPrivateRoomGuestParticipantAsPlayer(room, {
        displayName: "Player Two",
        participantId: "player-2",
      }),
    );
    const runningRoom = startRoom(playerRoom);
    const watchedRoom = addObserver(runningRoom, "watcher-1");
    const queuedRoom = expectRoomResult(
      queuePrivateRoomParticipantForNextMatch(watchedRoom, {
        participantId: "watcher-1",
      }),
    );
    const leftResult = leavePrivateRoom(queuedRoom, {
      participantId: "player-2",
    });

    if (!leftResult.success || leftResult.closed) {
      throw new Error(leftResult.success ? "Party unexpectedly closed." : leftResult.error);
    }

    const finishedRoom = finishPrivateRoomAfterGameTerminal(leftResult.room);

    expect(getPrivateRoomGuestPlayerAdmissionRole(finishedRoom)).toBe("observer");
    expect(
      addPrivateRoomGuestParticipantAsPlayer(finishedRoom, {
        displayName: "Queue Skipper",
        participantId: "late-player",
      }),
    ).toEqual({
      code: "observer-limit-reached",
      error: "This party already has the maximum number of watchers.",
      success: false,
    });
  });

  it("adds a guest player atomically or falls back to watching an active match", () => {
    const lobbyRoom = createLobbyRoom();
    const playerResult = addPrivateRoomGuestParticipantAsPlayer(lobbyRoom, {
      displayName: "Guest Player",
      participantId: "guest-1",
    });

    expect(playerResult).toMatchObject({
      room: {
        participants: expect.arrayContaining([
          expect.objectContaining({ id: "guest-1", role: "player" }),
        ]),
        seats: [
          expect.objectContaining({ occupiedByParticipantId: HOST_ID }),
          expect.objectContaining({ occupiedByParticipantId: "guest-1" }),
        ],
      },
      success: true,
    });

    const runningRoom = startRoom(
      playerResult.success ? playerResult.room : lobbyRoom,
    );
    const observerResult = addPrivateRoomGuestParticipantAsPlayer(runningRoom, {
      displayName: "Late Guest",
      participantId: "guest-2",
    });

    expect(observerResult).toMatchObject({
      room: {
        participants: expect.arrayContaining([
          expect.objectContaining({ id: "guest-2", role: "observer" }),
        ]),
        seats: runningRoom.seats,
        status: "running",
      },
      success: true,
    });
  });

  it("claims and releases seats while updating non-host roles immutably", () => {
    const lobbyRoom = addObserver(createLobbyRoom());
    const seatedRoom = claimSeat(lobbyRoom, "guest-1", "right");
    const releasedRoomResult = releasePrivateRoomSeat(seatedRoom, {
      participantId: "guest-1",
      seatId: "right",
    });

    expect(seatedRoom.seats[1]).toEqual({
      id: "right",
      label: "Right",
      occupiedByParticipantId: "guest-1",
      required: true,
    });
    expect(
      seatedRoom.participants.find((participant) => participant.id === "guest-1"),
    ).toMatchObject({
      role: "player",
    });
    expect(lobbyRoom.seats[1]?.occupiedByParticipantId).toBeNull();
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
            id: "right",
            occupiedByParticipantId: null,
          }),
        ]),
      },
      success: true,
    });
  });

  it("replaces a finished match while preserving player order and party membership", () => {
    const finishedRoomResult = finishPrivateRoom(startRoom(createReadyRoom()), {
      participantId: HOST_ID,
    });

    expect(finishedRoomResult.success).toBe(true);

    if (!finishedRoomResult.success) {
      throw new Error(finishedRoomResult.error);
    }

    const result = replacePrivateRoomMatch(finishedRoomResult.room, {
      participantId: HOST_ID,
      seats: [
        { id: "blue", label: "Blue", required: true },
        { id: "green", label: "Green", required: true },
      ],
      settings: {
        gameId: "asteroids",
        parameters: { difficulty: "hard" },
      },
    });

    expect(result).toMatchObject({
      room: {
        code: finishedRoomResult.room.code,
        hostParticipantId: HOST_ID,
        matchId: 2,
        participants: finishedRoomResult.room.participants,
        seats: [
          expect.objectContaining({
            id: "blue",
            occupiedByParticipantId: HOST_ID,
          }),
          expect.objectContaining({
            id: "green",
            occupiedByParticipantId: "guest-1",
          }),
        ],
        settings: {
          gameId: "asteroids",
          parameters: { difficulty: "hard" },
        },
        status: "lobby",
      },
      success: true,
    });
    expect(finishedRoomResult.room.matchId).toBe(1);
    expect(finishedRoomResult.room.settings.gameId).toBe("pong");
  });

  it("preserves empty player slots by ordinal when replacing a match", () => {
    const releasedHostResult = releasePrivateRoomSeat(createReadyRoom(), {
      participantId: HOST_ID,
      seatId: "left",
    });

    expect(releasedHostResult.success).toBe(true);

    if (!releasedHostResult.success) {
      throw new Error(releasedHostResult.error);
    }

    const result = replacePrivateRoomMatch(releasedHostResult.room, {
      participantId: HOST_ID,
      seats: [
        { id: "blue", label: "Blue", required: true },
        { id: "green", label: "Green", required: true },
      ],
      settings: { gameId: "asteroids" },
    });

    expect(result).toMatchObject({
      room: {
        participants: [
          expect.objectContaining({ id: HOST_ID, role: "host" }),
          expect.objectContaining({ id: "guest-1", role: "player" }),
        ],
        seats: [
          expect.objectContaining({
            id: "blue",
            occupiedByParticipantId: null,
          }),
          expect.objectContaining({
            id: "green",
            occupiedByParticipantId: "guest-1",
          }),
        ],
      },
      success: true,
    });
  });

  it("rejects active match replacement and active seat changes", () => {
    const runningRoom = startRoom(createReadyRoom());

    expect(
      replacePrivateRoomMatch(runningRoom, {
        participantId: HOST_ID,
        seats: TWO_PLAYER_SEATS,
        settings: { gameId: "asteroids" },
      }),
    ).toEqual({
      code: "invalid-status",
      error: "Finish the current match before choosing another game.",
      success: false,
    });
    expect(
      releasePrivateRoomSeat(runningRoom, {
        participantId: "guest-1",
        seatId: "right",
      }),
    ).toEqual({
      code: "invalid-status",
      error: "Player seats can only change between matches.",
      success: false,
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

  it("requires an explicit match replacement before changing games", () => {
    const room = createLobbyRoom({ gameId: "pong" });

    expect(
      updatePrivateRoomSettings(room, {
        participantId: HOST_ID,
        settings: { gameId: "asteroids" },
      }),
    ).toEqual({
      code: "invalid-room-settings",
      error: "Changing games requires replacing the current match.",
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
    const oneSeatRoom = createLobbyRoom();

    expect(startPrivateRoom(oneSeatRoom, { participantId: HOST_ID })).toEqual({
      code: "required-seats-empty",
      error: "Required seats must be occupied before starting the room: Right.",
      success: false,
    });

    const readyRoom = claimSeat(addObserver(oneSeatRoom), "guest-1", "right");
    const runningRoom = startRoom(readyRoom);
    const pausedRoomResult = pausePrivateRoom(runningRoom, { participantId: HOST_ID });

    expect(runningRoom.status).toBe("running");
    expect(pausedRoomResult).toMatchObject({
      room: {
        matchId: 1,
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
        matchId: 1,
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
        matchId: 1,
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
        matchId: 2,
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

  it("queues watchers for the next match in idempotent FIFO order", () => {
    const runningRoom = startRoom(createReadyRoom());
    const watchedRoom = addObserver(
      addObserver(runningRoom, "watcher-1"),
      "watcher-2",
    );

    expect(
      queuePrivateRoomParticipantForNextMatch(watchedRoom, {
        participantId: "guest-1",
      }),
    ).toEqual({
      code: "participant-already-seated",
      error: "Only watchers can wait for the next match.",
      success: false,
    });

    const firstResult = queuePrivateRoomParticipantForNextMatch(watchedRoom, {
      participantId: "watcher-1",
    });

    expect(firstResult.success).toBe(true);

    if (!firstResult.success) {
      throw new Error(firstResult.error);
    }

    const secondResult = queuePrivateRoomParticipantForNextMatch(firstResult.room, {
      participantId: "watcher-2",
    });

    expect(secondResult).toMatchObject({
      room: {
        nextMatchParticipantIds: ["watcher-1", "watcher-2"],
      },
      success: true,
    });

    if (!secondResult.success) {
      throw new Error(secondResult.error);
    }

    expect(
      queuePrivateRoomParticipantForNextMatch(secondResult.room, {
        participantId: "watcher-1",
      }),
    ).toEqual(secondResult);

    const cancelledResult = cancelPrivateRoomNextMatchRequest(secondResult.room, {
      participantId: "watcher-1",
    });

    expect(cancelledResult).toMatchObject({
      room: {
        nextMatchParticipantIds: ["watcher-2"],
      },
      success: true,
    });
    const cancelledRoom = cancelledResult.success
      ? cancelledResult.room
      : secondResult.room;

    expect(
      cancelPrivateRoomNextMatchRequest(cancelledRoom, {
        participantId: "watcher-1",
      }),
    ).toEqual(cancelledResult);
  });

  it("never promotes a queued watcher mid-match and fills an open seat on restart", () => {
    const runningRoom = startRoom(createReadyRoom());
    const watchedRoom = addObserver(runningRoom, "watcher-1");
    const queuedResult = queuePrivateRoomParticipantForNextMatch(watchedRoom, {
      participantId: "watcher-1",
    });

    expect(queuedResult.success).toBe(true);

    if (!queuedResult.success) {
      throw new Error(queuedResult.error);
    }

    const leftResult = leavePrivateRoom(queuedResult.room, {
      participantId: "guest-1",
    });

    expect(leftResult).toMatchObject({
      closed: false,
      room: {
        nextMatchParticipantIds: ["watcher-1"],
        seats: [
          expect.objectContaining({ occupiedByParticipantId: HOST_ID }),
          expect.objectContaining({ occupiedByParticipantId: null }),
        ],
        status: "running",
      },
      success: true,
    });

    if (!leftResult.success || leftResult.closed) {
      throw new Error(leftResult.success ? "Party unexpectedly closed." : leftResult.error);
    }

    const finishedRoom = finishPrivateRoomAfterGameTerminal(leftResult.room);

    expect(finishedRoom).toMatchObject({
      nextMatchParticipantIds: ["watcher-1"],
      participants: expect.arrayContaining([
        expect.objectContaining({ id: "watcher-1", role: "observer" }),
      ]),
      seats: [
        expect.objectContaining({ occupiedByParticipantId: HOST_ID }),
        expect.objectContaining({ occupiedByParticipantId: null }),
      ],
      status: "finished",
    });

    const restartedResult = restartPrivateRoom(finishedRoom, {
      participantId: HOST_ID,
    });

    expect(restartedResult).toMatchObject({
      room: {
        matchId: 2,
        nextMatchParticipantIds: [],
        participants: expect.arrayContaining([
          expect.objectContaining({ id: "watcher-1", role: "player" }),
        ]),
        seats: [
          expect.objectContaining({ occupiedByParticipantId: HOST_ID }),
          expect.objectContaining({ occupiedByParticipantId: "watcher-1" }),
        ],
        status: "running",
      },
      success: true,
    });
  });

  it("keeps an open between-match seat reserved for the FIFO queue head", () => {
    const runningRoom = startRoom(createReadyRoom());
    const watchedRoom = addObserver(
      addObserver(runningRoom, "watcher-1"),
      "watcher-2",
    );
    const queuedResult = queuePrivateRoomParticipantForNextMatch(watchedRoom, {
      participantId: "watcher-1",
    });

    if (!queuedResult.success) {
      throw new Error(queuedResult.error);
    }

    const leftResult = leavePrivateRoom(queuedResult.room, {
      participantId: "guest-1",
    });

    if (!leftResult.success || leftResult.closed) {
      throw new Error(leftResult.success ? "Party unexpectedly closed." : leftResult.error);
    }

    const finishedRoom = finishPrivateRoomAfterGameTerminal(leftResult.room);

    expect(
      claimPrivateRoomSeat(finishedRoom, {
        participantId: "watcher-2",
        seatId: "right",
      }),
    ).toEqual({
      code: "seat-occupied",
      error: "An earlier watcher has priority for the next open seat.",
      success: false,
    });
    expect(
      claimPrivateRoomSeat(finishedRoom, {
        participantId: "watcher-1",
        seatId: "right",
      }),
    ).toMatchObject({
      room: {
        nextMatchParticipantIds: [],
        seats: [
          expect.objectContaining({ occupiedByParticipantId: HOST_ID }),
          expect.objectContaining({ occupiedByParticipantId: "watcher-1" }),
        ],
      },
      success: true,
    });
  });

  it("removes leaving members and transfers host ownership only to an eligible successor", () => {
    const signedInResult = addPrivateRoomGuestParticipantAsObserver(
      addObserver(createLobbyRoom(), "guest-1"),
      {
        displayName: "Signed In Friend",
        participantId: "member-2",
        userId: "user-2",
      },
    );

    expect(signedInResult.success).toBe(true);

    if (!signedInResult.success) {
      throw new Error(signedInResult.error);
    }

    expect(
      leavePrivateRoom(signedInResult.room, {
        participantId: HOST_ID,
        successorParticipantId: "guest-1",
      }),
    ).toEqual({
      code: "invalid-host-successor",
      error: "Party ownership can only transfer to a signed-in member.",
      success: false,
    });

    const transferredResult = leavePrivateRoom(signedInResult.room, {
      participantId: HOST_ID,
      successorParticipantId: "member-2",
    });

    expect(transferredResult).toMatchObject({
      closed: false,
      room: {
        hostParticipantId: "member-2",
        nextMatchParticipantIds: [],
        participants: [
          expect.objectContaining({ id: "guest-1", role: "observer" }),
          expect.objectContaining({ id: "member-2", role: "host" }),
        ],
        seats: [
          expect.objectContaining({ occupiedByParticipantId: null }),
          expect.objectContaining({ occupiedByParticipantId: null }),
        ],
      },
      success: true,
    });
    expect(
      leavePrivateRoom(createLobbyRoom(), { participantId: HOST_ID }),
    ).toEqual({ closed: true, success: true });
  });

  it("defines protocol message shapes around room commands and snapshots", () => {
    const clientMessage = {
      participantId: "guest-1",
      requestId: "request-1",
      seatId: "left",
      matchId: 1,
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
