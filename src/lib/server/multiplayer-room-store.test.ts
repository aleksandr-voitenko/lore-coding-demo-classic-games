import { describe, expect, it } from "vitest";

import {
  DEFAULT_PONG_PRIVATE_ROOM_SEATS,
  DEFAULT_SPACE_INVADERS_PRIVATE_ROOM_SEATS,
  InProcessMultiplayerRoomStore,
  PONG_RUNTIME_CATCH_UP_TICK_LIMIT,
  type MultiplayerRoomSnapshot,
  type MultiplayerRoomStoreResult,
} from "./multiplayer-room-runtime";
import type { PrivateRoomSettings } from "../multiplayer/room";
import {
  getPongMaximumScore,
  getPongScoreTickDelay,
  getPongTickDelay,
} from "../pong-game-engine";
import type { PongMultiplayerGameSnapshot } from "../pong-multiplayer";
import { getSpaceInvadersTickDelay } from "../space-invaders-game-engine";
import type { SpaceInvadersMultiplayerServerGameSnapshot } from "./multiplayer-game-adapters";

const HOST_USER = {
  displayName: "Ada Host",
  id: "user-1",
};

function createTestRoomStore({
  getNowMs,
  participantIds = ["host-1", "guest-1", "guest-2", "observer-1"],
  roomCodes = ["ROOM1"],
}: {
  getNowMs?: () => number;
  participantIds?: string[];
  roomCodes?: string[];
} = {}) {
  let participantIdIndex = 0;
  let roomCodeIndex = 0;

  return new InProcessMultiplayerRoomStore({
    createParticipantId: ({ role }) =>
      participantIds[participantIdIndex++] ?? `${role}-${participantIdIndex}`,
    createRoomCode: () => roomCodes[roomCodeIndex++] ?? "ROOM-FALLBACK",
    getNowMs,
  });
}

function expectStoreSuccess(result: MultiplayerRoomStoreResult) {
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.snapshot;
}

function expectPongGame(snapshot: MultiplayerRoomSnapshot) {
  expect(snapshot.game?.gameId).toBe("pong");

  return snapshot.game as PongMultiplayerGameSnapshot;
}

function expectSpaceInvadersGame(snapshot: MultiplayerRoomSnapshot) {
  expect(snapshot.game?.gameId).toBe("space-invaders");

  return snapshot.game as SpaceInvadersMultiplayerServerGameSnapshot;
}

function createStartedPongRoom(
  store: InProcessMultiplayerRoomStore,
  settings: PrivateRoomSettings = { gameId: "pong" },
) {
  expectStoreSuccess(store.createRoom({ host: HOST_USER, settings }));
  expectStoreSuccess(
    store.applyCommand("ROOM1", {
      displayName: "Guest One",
      type: "room.joinObserver",
    }),
  );
  expectStoreSuccess(
    store.applyCommand("ROOM1", {
      participantId: "host-1",
      seatId: "left",
      type: "room.claimSeat",
    }),
  );
  expectStoreSuccess(
    store.applyCommand("ROOM1", {
      participantId: "guest-1",
      seatId: "right",
      type: "room.claimSeat",
    }),
  );

  return expectStoreSuccess(
    store.applyCommand("ROOM1", {
      command: "start",
      participantId: "host-1",
      type: "room.lifecycle",
    }),
  );
}

function createStartedSpaceInvadersRoom(
  store: InProcessMultiplayerRoomStore,
  settings: PrivateRoomSettings = { gameId: "space-invaders" },
) {
  expectStoreSuccess(
    store.createRoom({
      host: HOST_USER,
      settings,
    }),
  );
  expectStoreSuccess(
    store.applyCommand("ROOM1", {
      displayName: "Guest One",
      type: "room.joinObserver",
    }),
  );
  expectStoreSuccess(
    store.applyCommand("ROOM1", {
      participantId: "host-1",
      seatId: "ship-a",
      type: "room.claimSeat",
    }),
  );
  expectStoreSuccess(
    store.applyCommand("ROOM1", {
      participantId: "guest-1",
      seatId: "ship-b",
      type: "room.claimSeat",
    }),
  );

  return expectStoreSuccess(
    store.applyCommand("ROOM1", {
      command: "start",
      participantId: "host-1",
      type: "room.lifecycle",
    }),
  );
}

function serveStartedPongRoom(store: InProcessMultiplayerRoomStore) {
  const snapshot = expectStoreSuccess(store.getRoom("ROOM1"));
  const serveSide = expectPongGame(snapshot).snapshot.serveSide;

  return expectStoreSuccess(
    store.applyCommand("ROOM1", {
      input: {
        type: "pong.serve",
      },
      participantId: serveSide === "left" ? "host-1" : "guest-1",
      type: "game.input",
    }),
  );
}

describe("in-process multiplayer room store", () => {
  it("creates signed-in host rooms with deterministic ids and default Pong seats", () => {
    const store = createTestRoomStore();
    const snapshot = expectStoreSuccess(store.createRoom({ host: HOST_USER }));

    expect(snapshot).toEqual({
      participant: {
        displayName: "Ada Host",
        id: "host-1",
        role: "host",
        userId: "user-1",
      },
      room: {
        code: "ROOM1",
        hostParticipantId: "host-1",
        participants: [
          {
            displayName: "Ada Host",
            id: "host-1",
            role: "host",
            userId: "user-1",
          },
        ],
        seats: DEFAULT_PONG_PRIVATE_ROOM_SEATS.map((seat) => ({
          ...seat,
          occupiedByParticipantId: null,
        })),
        settings: {
          gameId: "pong",
        },
        status: "lobby",
      },
      seq: 1,
    });
  });

  it("creates Space Invaders rooms with default ship seats", () => {
    const store = createTestRoomStore();
    const snapshot = expectStoreSuccess(
      store.createRoom({
        host: HOST_USER,
        settings: { gameId: "space-invaders" },
      }),
    );

    expect(snapshot.room).toMatchObject({
      code: "ROOM1",
      seats: DEFAULT_SPACE_INVADERS_PRIVATE_ROOM_SEATS.map((seat) => ({
        ...seat,
        occupiedByParticipantId: null,
      })),
      settings: {
        gameId: "space-invaders",
      },
      status: "lobby",
    });
  });

  it("records a server-ordered room event log for accepted room and game operations", () => {
    let nowMs = 1_000;
    const store = createTestRoomStore({ getNowMs: () => nowMs });

    expectStoreSuccess(store.createRoom({ host: HOST_USER }));

    nowMs += 1;
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        displayName: "Guest One",
        type: "room.joinObserver",
      }),
    );

    nowMs += 1;
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "host-1",
        seatId: "left",
        type: "room.claimSeat",
      }),
    );

    nowMs += 1;
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "guest-1",
        seatId: "right",
        type: "room.claimSeat",
      }),
    );

    nowMs += 1;
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "host-1",
        settings: {
          gameId: "pong",
          parameters: {
            targetScore: 7,
          },
        },
        type: "room.updateSettings",
      }),
    );

    nowMs += 1;
    const started = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "start",
        participantId: "host-1",
        type: "room.lifecycle",
      }),
    );

    nowMs += 1;
    const inputSnapshot = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        input: {
          direction: "up",
          type: "pong.setPaddleDirection",
        },
        participantId: "host-1",
        type: "game.input",
      }),
    );

    nowMs += 1;
    const released = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "host-1",
        seatId: "left",
        type: "room.releaseSeat",
      }),
    );

    expect(store.getRoomEventLog("room1")).toEqual([
      expect.objectContaining({
        eventSeq: 1,
        gameId: "pong",
        participantId: "host-1",
        payload: expect.objectContaining({
          displayName: "Ada Host",
          participantCount: 1,
          requiredSeatCount: 2,
          seatCount: 2,
          settingsParameterKeys: [],
          status: "lobby",
        }),
        roomCode: "ROOM1",
        roomSeq: 1,
        timestampMs: 1_000,
        type: "room.created",
      }),
      expect.objectContaining({
        eventSeq: 2,
        participantId: "guest-1",
        payload: {
          displayName: "Guest One",
          hasUserId: false,
          role: "observer",
        },
        roomSeq: 2,
        timestampMs: 1_001,
        type: "participant.observerJoined",
      }),
      expect.objectContaining({
        eventSeq: 3,
        participantId: "host-1",
        payload: {
          seatId: "left",
        },
        roomSeq: 3,
        timestampMs: 1_002,
        type: "seat.claimed",
      }),
      expect.objectContaining({
        eventSeq: 4,
        participantId: "guest-1",
        payload: {
          seatId: "right",
        },
        roomSeq: 4,
        timestampMs: 1_003,
        type: "seat.claimed",
      }),
      expect.objectContaining({
        eventSeq: 5,
        participantId: "host-1",
        payload: {
          parameterKeys: ["targetScore"],
        },
        roomSeq: 5,
        timestampMs: 1_004,
        type: "room.settingsUpdated",
      }),
      expect.objectContaining({
        eventSeq: 6,
        gameSeq: started.game?.seq,
        participantId: "host-1",
        payload: {
          command: "start",
          status: "running",
        },
        roomSeq: started.seq,
        timestampMs: 1_005,
        type: "room.lifecycle",
      }),
      expect.objectContaining({
        eventSeq: 7,
        gameSeq: inputSnapshot.game?.seq,
        participantId: "host-1",
        payload: {
          inputType: "pong.setPaddleDirection",
        },
        roomSeq: started.seq,
        timestampMs: 1_006,
        type: "game.inputAccepted",
      }),
      expect.objectContaining({
        eventSeq: 8,
        gameSeq: released.game?.seq,
        participantId: "host-1",
        payload: {
          seatId: "left",
        },
        roomSeq: released.seq,
        timestampMs: 1_007,
        type: "seat.released",
      }),
    ]);
  });

  it("reports duplicate generated codes and unknown rooms", () => {
    const store = createTestRoomStore({
      participantIds: ["host-1", "host-2"],
      roomCodes: ["ROOM1", "room1"],
    });

    expectStoreSuccess(store.createRoom({ host: HOST_USER }));

    expect(store.createRoom({ host: HOST_USER })).toEqual({
      code: "duplicate-room",
      error: "Room code is already in use.",
      success: false,
    });
    expect(store.getRoom("missing")).toEqual({
      code: "room-not-found",
      error: "Room was not found.",
      success: false,
    });
    expect(store.getRoom("bad room")).toEqual({
      code: "invalid-room-code",
      error: "Room code is not supported.",
      success: false,
    });
  });

  it("allows guest observers to join running rooms without changing occupied seats", () => {
    const store = createTestRoomStore();

    expectStoreSuccess(store.createRoom({ host: HOST_USER }));
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        displayName: "Guest One",
        type: "room.joinObserver",
      }),
    );
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        displayName: "Guest Two",
        type: "room.joinObserver",
      }),
    );
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "guest-1",
        seatId: "left",
        type: "room.claimSeat",
      }),
    );
    const seatedRoom = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "guest-2",
        seatId: "right",
        type: "room.claimSeat",
      }),
    );
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "start",
        participantId: "host-1",
        type: "room.lifecycle",
      }),
    );
    const observedRoom = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        displayName: "Late Observer",
        type: "room.joinObserver",
      }),
    );

    expect(observedRoom.room.status).toBe("running");
    expect(observedRoom.room.seats).toEqual(seatedRoom.room.seats);
    expect(observedRoom.participant).toEqual({
      displayName: "Late Observer",
      id: "observer-1",
      role: "observer",
      userId: null,
    });
  });

  it("applies seat commands while preserving host authority", () => {
    const store = createTestRoomStore();

    expectStoreSuccess(store.createRoom({ host: HOST_USER }));
    const guestSnapshot = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        displayName: "Guest One",
        type: "room.joinObserver",
      }),
    );
    const seatedGuestSnapshot = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "guest-1",
        seatId: "left",
        type: "room.claimSeat",
      }),
    );
    const releasedGuestSnapshot = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "guest-1",
        seatId: "left",
        type: "room.releaseSeat",
      }),
    );
    const seatedHostSnapshot = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "host-1",
        seatId: "right",
        type: "room.claimSeat",
      }),
    );

    expect(guestSnapshot.participant?.role).toBe("observer");
    expect(seatedGuestSnapshot.participant?.role).toBe("player");
    expect(seatedGuestSnapshot.room.seats[0]?.occupiedByParticipantId).toBe("guest-1");
    expect(releasedGuestSnapshot.participant?.role).toBe("observer");
    expect(releasedGuestSnapshot.room.seats[0]?.occupiedByParticipantId).toBeNull();
    expect(seatedHostSnapshot.participant).toMatchObject({
      id: "host-1",
      role: "host",
      userId: "user-1",
    });
  });

  it("keeps settings and lifecycle commands host-only", () => {
    const store = createTestRoomStore();

    expectStoreSuccess(store.createRoom({ host: HOST_USER }));
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        displayName: "Guest One",
        type: "room.joinObserver",
      }),
    );

    expect(
      store.applyCommand("ROOM1", {
        participantId: "guest-1",
        settings: {
          gameId: "pong",
          parameters: {
            targetScore: 7,
          },
        },
        type: "room.updateSettings",
      }),
    ).toEqual({
      code: "not-host",
      error: "Only the signed-in room host can perform this action.",
      success: false,
    });
    expect(
      store.applyCommand("ROOM1", {
        command: "start",
        participantId: "guest-1",
        type: "room.lifecycle",
      }),
    ).toEqual({
      code: "not-host",
      error: "Only the signed-in room host can perform this action.",
      success: false,
    });

    const updatedSettings = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "host-1",
        settings: {
          gameId: "pong",
          parameters: {
            targetScore: 7,
          },
        },
        type: "room.updateSettings",
      }),
    );

    expect(updatedSettings.room.settings).toEqual({
      gameId: "pong",
      parameters: {
        targetScore: 7,
      },
    });
    expect(
      store.applyCommand("ROOM1", {
        command: "start",
        participantId: "host-1",
        type: "room.lifecycle",
      }),
    ).toMatchObject({
      code: "required-seats-empty",
      success: false,
    });
  });

  it("initializes Pong game snapshots only when a full room starts", () => {
    let nowMs = 1_000;
    const store = createTestRoomStore({ getNowMs: () => nowMs });

    expectStoreSuccess(store.createRoom({ host: HOST_USER }));
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        displayName: "Guest One",
        type: "room.joinObserver",
      }),
    );
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "host-1",
        seatId: "left",
        type: "room.claimSeat",
      }),
    );

    expect(
      store.applyCommand("ROOM1", {
        command: "start",
        participantId: "host-1",
        type: "room.lifecycle",
      }),
    ).toMatchObject({
      code: "required-seats-empty",
      success: false,
    });
    expect(expectStoreSuccess(store.getRoom("ROOM1")).game).toBeUndefined();

    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "guest-1",
        seatId: "right",
        type: "room.claimSeat",
      }),
    );

    nowMs = 1_500;
    const started = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "start",
        participantId: "host-1",
        type: "room.lifecycle",
      }),
    );

    expect(started.game).toMatchObject({
      gameId: "pong",
      heldInputs: {},
      seq: 1,
      serverTimeMs: 1_500,
      snapshot: {
        score: {
          cpu: 0,
          player: 0,
        },
        status: "ready",
      },
    });
  });

  it("initializes Space Invaders only after both ship seats are occupied", () => {
    let nowMs = 1_000;
    const store = createTestRoomStore({ getNowMs: () => nowMs });

    expectStoreSuccess(
      store.createRoom({
        host: HOST_USER,
        settings: { gameId: "space-invaders" },
      }),
    );
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        displayName: "Guest One",
        type: "room.joinObserver",
      }),
    );
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "host-1",
        seatId: "ship-a",
        type: "room.claimSeat",
      }),
    );

    expect(
      store.applyCommand("ROOM1", {
        command: "start",
        participantId: "host-1",
        type: "room.lifecycle",
      }),
    ).toMatchObject({
      code: "required-seats-empty",
      success: false,
    });
    expect(expectStoreSuccess(store.getRoom("ROOM1")).game).toBeUndefined();

    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "guest-1",
        seatId: "ship-b",
        type: "room.claimSeat",
      }),
    );

    nowMs = 1_500;
    const started = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "start",
        participantId: "host-1",
        type: "room.lifecycle",
      }),
    );

    expect(started.room).toMatchObject({
      settings: {
        gameId: "space-invaders",
      },
      status: "running",
    });
    expect(started.game).toMatchObject({
      gameId: "space-invaders",
      heldInputs: {},
      seq: 1,
      serverTimeMs: 1_500,
      snapshot: {
        lives: expect.any(Number),
        score: 0,
        status: "running",
        ships: {
          "ship-a": {
            isActive: true,
            seat: "ship-a",
          },
          "ship-b": {
            isActive: true,
            seat: "ship-b",
          },
        },
      },
    });
  });

  it("starts and restarts Space Invaders with launcher-style room parameters", () => {
    let nowMs = 1_000;
    const store = createTestRoomStore({ getNowMs: () => nowMs });
    const started = createStartedSpaceInvadersRoom(store, {
      gameId: "space-invaders",
      parameters: {
        "space-invaders-aliens": "40",
        "space-invaders-board-size": "480x640",
      },
    });
    const startedGame = expectSpaceInvadersGame(started).snapshot;

    expect(startedGame).toMatchObject({
      alienCount: 40,
      boardHeight: 640,
      boardWidth: 480,
      status: "running",
    });
    expect(startedGame.invaders.filter((invader) => invader.isActive)).toHaveLength(
      40,
    );

    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        input: {
          direction: "right",
          type: "space-invaders.setShipDirection",
        },
        participantId: "host-1",
        type: "game.input",
      }),
    );
    nowMs += getSpaceInvadersTickDelay();
    const advanced = expectStoreSuccess(store.getRoom("ROOM1"));

    expect(
      expectSpaceInvadersGame(advanced).snapshot.ships["ship-a"].player.x,
    ).toBeGreaterThan(startedGame.ships["ship-a"].player.x);

    const restarted = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "restart",
        participantId: "host-1",
        type: "room.lifecycle",
      }),
    );
    const restartedGame = expectSpaceInvadersGame(restarted).snapshot;

    expect(restartedGame).toMatchObject({
      alienCount: 40,
      boardHeight: 640,
      boardWidth: 480,
      score: 0,
      status: "running",
    });
    expect(
      restartedGame.invaders.filter((invader) => invader.isActive),
    ).toHaveLength(40);
    expect(restartedGame.ships["ship-a"].player.x).toBe(
      startedGame.ships["ship-a"].player.x,
    );
  });

  it("maps Pong input participants to seats and advances the matching paddle", () => {
    let nowMs = 1_000;
    const store = createTestRoomStore({ getNowMs: () => nowMs });
    const started = createStartedPongRoom(store);
    const initialGame = expectPongGame(started).snapshot;
    const inputSnapshot = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        input: {
          direction: "up",
          type: "pong.setPaddleDirection",
        },
        participantId: "host-1",
        type: "game.input",
      }),
    );

    expect(inputSnapshot.seq).toBe(started.seq);
    expect(inputSnapshot.game?.seq).toBe(started.game!.seq + 1);
    expect(inputSnapshot.game?.heldInputs).toEqual({
      left: {
        up: true,
      },
    });

    nowMs += getPongTickDelay();
    const advanced = expectStoreSuccess(store.getRoom("ROOM1"));
    const advancedPongGame = expectPongGame(advanced).snapshot;

    expect(advanced.game?.heldInputs).toEqual({
      left: {
        up: true,
      },
    });
    expect(advancedPongGame.playerPaddle.y).toBeLessThan(initialGame.playerPaddle.y);
    expect(advancedPongGame.cpuPaddle.y).toBe(initialGame.cpuPaddle.y);
  });

  it("maps Space Invaders input participants to ships and advances held direction", () => {
    let nowMs = 1_000;
    const store = createTestRoomStore({ getNowMs: () => nowMs });
    const started = createStartedSpaceInvadersRoom(store);
    const initialGame = expectSpaceInvadersGame(started).snapshot;
    const initialShipA = initialGame.ships["ship-a"].player;
    const initialShipB = initialGame.ships["ship-b"].player;

    const inputSnapshot = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        input: {
          direction: "right",
          type: "space-invaders.setShipDirection",
        },
        participantId: "host-1",
        type: "game.input",
      }),
    );

    expect(inputSnapshot.seq).toBe(started.seq);
    expect(inputSnapshot.game?.seq).toBe(started.game!.seq + 1);
    expect(inputSnapshot.game?.heldInputs).toEqual({
      "ship-a": {
        right: true,
      },
    });

    nowMs += getSpaceInvadersTickDelay();
    const advanced = expectStoreSuccess(store.getRoom("ROOM1"));
    const advancedGame = expectSpaceInvadersGame(advanced).snapshot;

    expect(advanced.game?.heldInputs).toEqual({
      "ship-a": {
        right: true,
      },
    });
    expect(advancedGame.ships["ship-a"].player.x).toBeGreaterThan(initialShipA.x);
    expect(advancedGame.ships["ship-b"].player.x).toBe(initialShipB.x);

    const fired = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        input: {
          type: "space-invaders.fire",
        },
        participantId: "guest-1",
        type: "game.input",
      }),
    );
    const firedGame = expectSpaceInvadersGame(fired).snapshot;

    expect(firedGame.ships["ship-a"].playerShots).toHaveLength(0);
    expect(firedGame.ships["ship-b"].playerShots).toHaveLength(1);

    const released = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        participantId: "host-1",
        seatId: "ship-a",
        type: "room.releaseSeat",
      }),
    );

    expect(released.game?.heldInputs).toEqual({});
  });

  it("records compact game snapshot advancement events from server ticks", () => {
    let nowMs = 1_000;
    const store = createTestRoomStore({ getNowMs: () => nowMs });

    createStartedPongRoom(store);
    const served = serveStartedPongRoom(store);
    const eventCountBeforeTick = store.getRoomEventLog("ROOM1").length;

    nowMs += getPongTickDelay();
    const advanced = expectStoreSuccess(store.getRoom("ROOM1"));
    const tickEvents = store.getRoomEventLog("ROOM1").slice(eventCountBeforeTick);

    expect(advanced.game!.seq).toBeGreaterThan(served.game!.seq);
    expect(tickEvents).toEqual([
      expect.objectContaining({
        eventSeq: eventCountBeforeTick + 1,
        gameId: "pong",
        gameSeq: advanced.game!.seq,
        payload: {
          snapshotStatus: "running",
        },
        roomCode: "ROOM1",
        roomSeq: advanced.seq,
        timestampMs: 1_000 + getPongTickDelay(),
        type: "game.snapshotAdvanced",
      }),
    ]);
    expect(tickEvents[0]?.payload).not.toHaveProperty("snapshot");
  });

  it("only accepts Pong serve input from the current serving paddle", () => {
    const store = createTestRoomStore();
    const started = createStartedPongRoom(store);
    const serveSide = expectPongGame(started).snapshot.serveSide;
    const servingParticipantId = serveSide === "left" ? "host-1" : "guest-1";
    const receivingParticipantId = serveSide === "left" ? "guest-1" : "host-1";

    expect(
      store.applyCommand("ROOM1", {
        input: {
          type: "pong.serve",
        },
        participantId: receivingParticipantId,
        type: "game.input",
      }),
    ).toEqual({
      code: "invalid-command",
      error: "Only the serving paddle can serve the ball.",
      success: false,
    });

    const served = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        input: {
          type: "pong.serve",
        },
        participantId: servingParticipantId,
        type: "game.input",
      }),
    );

    const servedPongGame = expectPongGame(served).snapshot;

    expect(servedPongGame.status).toBe("running");
    expect(servedPongGame.ball.velocity.y).toBe(0);
    expect(Math.sign(servedPongGame.ball.velocity.x)).toBe(
      serveSide === "left" ? 1 : -1,
    );
  });

  it("rejects invalid, observer, unseated, and non-Pong game input", () => {
    const store = createTestRoomStore();

    createStartedPongRoom(store);

    expect(
      store.applyCommand("ROOM1", {
        input: {
          direction: "sideways",
          type: "pong.setPaddleDirection",
        },
        participantId: "host-1",
        type: "game.input",
      }),
    ).toEqual({
      code: "invalid-command",
      error: "Pong paddle direction must be up, down, or null.",
      success: false,
    });
    expect(
      store.applyCommand("ROOM1", {
        input: {
          direction: "down",
          type: "pong.setPaddleDirection",
        },
        participantId: "missing",
        type: "game.input",
      }),
    ).toEqual({
      code: "participant-not-found",
      error: "Participant is not in the Pong room.",
      success: false,
    });

    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        displayName: "Late Observer",
        type: "room.joinObserver",
      }),
    );
    expect(
      store.applyCommand("ROOM1", {
        input: {
          direction: "down",
          type: "pong.setPaddleDirection",
        },
        participantId: "guest-2",
        type: "game.input",
      }),
    ).toEqual({
      code: "participant-not-seated",
      error: "Participant does not occupy a Pong paddle seat.",
      success: false,
    });

    const nonPongStore = createTestRoomStore({
      participantIds: ["host-1"],
      roomCodes: ["SNAKE1"],
    });

    expectStoreSuccess(
      nonPongStore.createRoom({
        host: HOST_USER,
        settings: { gameId: "snake" },
      }),
    );
    expect(
      nonPongStore.applyCommand("SNAKE1", {
        input: {
          direction: "up",
          type: "pong.setPaddleDirection",
        },
        participantId: "host-1",
        type: "game.input",
      }),
    ).toEqual({
      code: "invalid-command",
      error: "Game input is not supported for snake rooms.",
      success: false,
    });
  });

  it("pauses, resumes, and restarts the Pong runtime with room lifecycle", () => {
    let nowMs = 1_000;
    const store = createTestRoomStore({ getNowMs: () => nowMs });

    createStartedPongRoom(store, {
      gameId: "pong",
      parameters: {
        "pong-board-size": "1200x640",
      },
    });
    serveStartedPongRoom(store);
    nowMs += getPongTickDelay();

    const paused = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "pause",
        participantId: "host-1",
        type: "room.lifecycle",
      }),
    );
    const pausedPongGame = expectPongGame(paused);
    const pausedBallX = pausedPongGame.snapshot.ball.position.x;
    const pausedGameSeq = pausedPongGame.seq;

    nowMs += getPongTickDelay() * 5;
    const stillPaused = expectStoreSuccess(store.getRoom("ROOM1"));
    const stillPausedPongGame = expectPongGame(stillPaused);

    expect(stillPausedPongGame.snapshot.status).toBe("paused");
    expect(stillPausedPongGame.snapshot.ball.position.x).toBe(pausedBallX);
    expect(stillPausedPongGame.seq).toBe(pausedGameSeq);

    const resumed = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "resume",
        participantId: "host-1",
        type: "room.lifecycle",
      }),
    );

    const resumedPongGame = expectPongGame(resumed);

    expect(resumedPongGame.snapshot.status).toBe("running");

    nowMs += getPongScoreTickDelay();
    const scoredDown = expectStoreSuccess(store.getRoom("ROOM1"));
    const scoredDownPongGame = expectPongGame(scoredDown);

    expect(scoredDownPongGame.snapshot.remainingScore).toBeLessThan(
      resumedPongGame.snapshot.remainingScore,
    );

    const restarted = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "restart",
        participantId: "host-1",
        type: "room.lifecycle",
      }),
    );

    expect(restarted.game!.snapshot).toMatchObject({
      remainingScore: getPongMaximumScore(resumedPongGame.snapshot.targetScore),
      score: {
        cpu: 0,
        player: 0,
      },
      status: "ready",
    });
  });

  it("pauses, resumes, restarts, and finishes the Space Invaders runtime", () => {
    let nowMs = 1_000;
    const store = createTestRoomStore({ getNowMs: () => nowMs });

    createStartedSpaceInvadersRoom(store);
    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        input: {
          direction: "right",
          type: "space-invaders.setShipDirection",
        },
        participantId: "host-1",
        type: "game.input",
      }),
    );

    nowMs += getSpaceInvadersTickDelay();
    const moved = expectStoreSuccess(store.getRoom("ROOM1"));
    const movedGame = expectSpaceInvadersGame(moved);
    const movedShipX = movedGame.snapshot.ships["ship-a"].player.x;

    const paused = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "pause",
        participantId: "host-1",
        type: "room.lifecycle",
      }),
    );

    expect(paused.room.status).toBe("paused");
    expect(expectSpaceInvadersGame(paused).snapshot.status).toBe("paused");

    nowMs += getSpaceInvadersTickDelay() * 5;
    const stillPaused = expectStoreSuccess(store.getRoom("ROOM1"));
    const stillPausedGame = expectSpaceInvadersGame(stillPaused);

    expect(stillPausedGame.snapshot.ships["ship-a"].player.x).toBe(movedShipX);
    expect(stillPausedGame.seq).toBe(expectSpaceInvadersGame(paused).seq);

    const resumed = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "resume",
        participantId: "host-1",
        type: "room.lifecycle",
      }),
    );

    expect(resumed.room.status).toBe("running");
    expect(expectSpaceInvadersGame(resumed).snapshot.status).toBe("running");

    nowMs += getSpaceInvadersTickDelay();
    const advancedAfterResume = expectStoreSuccess(store.getRoom("ROOM1"));

    expect(
      expectSpaceInvadersGame(advancedAfterResume).snapshot.ships["ship-a"].player.x,
    ).toBeGreaterThan(movedShipX);

    const restarted = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "restart",
        participantId: "host-1",
        type: "room.lifecycle",
      }),
    );
    const restartedGame = expectSpaceInvadersGame(restarted);

    expect(restarted.room.status).toBe("running");
    expect(restartedGame.heldInputs).toEqual({});
    expect(restartedGame.snapshot).toMatchObject({
      score: 0,
      status: "running",
      ships: {
        "ship-a": {
          playerShots: [],
          seat: "ship-a",
        },
        "ship-b": {
          playerShots: [],
          seat: "ship-b",
        },
      },
    });

    expectStoreSuccess(
      store.applyCommand("ROOM1", {
        input: {
          direction: "left",
          type: "space-invaders.setShipDirection",
        },
        participantId: "guest-1",
        type: "game.input",
      }),
    );
    const finished = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "finish",
        participantId: "host-1",
        type: "room.lifecycle",
      }),
    );
    const finishedGame = expectSpaceInvadersGame(finished);

    expect(finished.room.status).toBe("finished");
    expect(finishedGame.heldInputs).toEqual({});
    expect(finishedGame.snapshot.status).toBe("paused");
  });

  it("caps request-driven Pong catch-up deterministically", () => {
    let nowMs = 0;
    const store = createTestRoomStore({ getNowMs: () => nowMs });
    createStartedPongRoom(store, {
      gameId: "pong",
      parameters: {
        "pong-board-size": "1200x640",
      },
    });
    const started = serveStartedPongRoom(store);
    const initialGame = expectPongGame(started).snapshot;

    nowMs += getPongScoreTickDelay() * (PONG_RUNTIME_CATCH_UP_TICK_LIMIT + 20);
    const advanced = expectStoreSuccess(store.getRoom("ROOM1"));
    const advancedPongGame = expectPongGame(advanced).snapshot;

    expect(advancedPongGame.ball.position.x).toBeCloseTo(
      initialGame.ball.position.x +
        initialGame.ball.velocity.x * PONG_RUNTIME_CATCH_UP_TICK_LIMIT,
    );
    expect(advancedPongGame.remainingScore).toBe(
      initialGame.remainingScore - PONG_RUNTIME_CATCH_UP_TICK_LIMIT * 5,
    );
  });

  it("returns immutable room snapshots", () => {
    const store = createTestRoomStore();
    const snapshot = expectStoreSuccess(
      store.createRoom({
        host: HOST_USER,
        settings: {
          gameId: "pong",
          parameters: {
            nested: {
              targetScore: 5,
            },
          },
        },
      }),
    );

    snapshot.room.participants[0]!.displayName = "Changed Host";
    (
      snapshot.room.settings.parameters?.nested as {
        targetScore: number;
      }
    ).targetScore = 11;

    const nextSnapshot = expectStoreSuccess(store.getRoom("room1"));

    expect(nextSnapshot.room.participants[0]?.displayName).toBe("Ada Host");
    expect(nextSnapshot.room.settings).toEqual({
      gameId: "pong",
      parameters: {
        nested: {
          targetScore: 5,
        },
      },
    });
  });

  it("returns immutable room event log entries", () => {
    const store = createTestRoomStore();

    expectStoreSuccess(store.createRoom({ host: HOST_USER }));

    const eventLog = store.getRoomEventLog("ROOM1");
    (
      eventLog[0]!.payload as {
        participantCount: number;
      }
    ).participantCount = 99;

    expect(store.getRoomEventLog("ROOM1")[0]?.payload).toMatchObject({
      participantCount: 1,
    });
  });

  it("returns immutable Pong game snapshots", () => {
    const store = createTestRoomStore();
    const snapshot = createStartedPongRoom(store);
    const pongGame = expectPongGame(snapshot);

    pongGame.snapshot.playerPaddle.y = 0;
    pongGame.snapshot.score.player = 99;
    const mutableHeldInputs = pongGame.heldInputs as {
      left?: { down?: boolean };
    };
    mutableHeldInputs.left = { down: true };

    const nextSnapshot = expectStoreSuccess(store.getRoom("ROOM1"));
    const nextPongGame = expectPongGame(nextSnapshot);

    expect(nextPongGame.snapshot.playerPaddle.y).not.toBe(0);
    expect(nextPongGame.snapshot.score.player).toBe(0);
    expect(nextPongGame.heldInputs).toEqual({});
  });

  it("returns immutable Space Invaders game snapshots", () => {
    const store = createTestRoomStore({ getNowMs: () => 1_000 });

    createStartedSpaceInvadersRoom(store);
    const snapshot = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        input: {
          direction: "right",
          type: "space-invaders.setShipDirection",
        },
        participantId: "host-1",
        type: "game.input",
      }),
    );
    const spaceInvadersGame = expectSpaceInvadersGame(snapshot);

    spaceInvadersGame.snapshot.ships["ship-a"].player.x = 0;
    spaceInvadersGame.snapshot.score = 99;
    const mutableHeldInputs = spaceInvadersGame.heldInputs as {
      "ship-a"?: { left?: boolean };
    };
    mutableHeldInputs["ship-a"] = { left: true };

    const nextSnapshot = expectStoreSuccess(store.getRoom("ROOM1"));
    const nextSpaceInvadersGame = expectSpaceInvadersGame(nextSnapshot);

    expect(nextSpaceInvadersGame.snapshot.ships["ship-a"].player.x).not.toBe(0);
    expect(nextSpaceInvadersGame.snapshot.score).toBe(0);
    expect(nextSpaceInvadersGame.heldInputs).toEqual({
      "ship-a": {
        right: true,
      },
    });
  });
});
