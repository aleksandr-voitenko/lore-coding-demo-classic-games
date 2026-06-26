import { describe, expect, it } from "vitest";

import {
  DEFAULT_PONG_PRIVATE_ROOM_SEATS,
  InProcessMultiplayerRoomStore,
  PONG_RUNTIME_CATCH_UP_TICK_LIMIT,
  type MultiplayerRoomStoreResult,
} from "./multiplayer-room-runtime";
import type { PrivateRoomSettings } from "../multiplayer/room";
import {
  getPongMaximumScore,
  getPongScoreTickDelay,
  getPongTickDelay,
} from "../pong-game-engine";

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

function serveStartedPongRoom(store: InProcessMultiplayerRoomStore) {
  const snapshot = expectStoreSuccess(store.getRoom("ROOM1"));
  const serveSide = snapshot.game!.snapshot.serveSide;

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

  it("maps Pong input participants to seats and advances the matching paddle", () => {
    let nowMs = 1_000;
    const store = createTestRoomStore({ getNowMs: () => nowMs });
    const started = createStartedPongRoom(store);
    const initialGame = started.game!.snapshot;
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

    expect(advanced.game?.heldInputs).toEqual({
      left: {
        up: true,
      },
    });
    expect(advanced.game!.snapshot.playerPaddle.y).toBeLessThan(
      initialGame.playerPaddle.y,
    );
    expect(advanced.game!.snapshot.cpuPaddle.y).toBe(initialGame.cpuPaddle.y);
  });

  it("only accepts Pong serve input from the current serving paddle", () => {
    const store = createTestRoomStore();
    const started = createStartedPongRoom(store);
    const serveSide = started.game!.snapshot.serveSide;
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

    expect(served.game!.snapshot.status).toBe("running");
    expect(served.game!.snapshot.ball.velocity.y).toBe(0);
    expect(Math.sign(served.game!.snapshot.ball.velocity.x)).toBe(
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
      error: "Game input is only supported for Pong rooms.",
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
    const pausedBallX = paused.game!.snapshot.ball.position.x;
    const pausedGameSeq = paused.game!.seq;

    nowMs += getPongTickDelay() * 5;
    const stillPaused = expectStoreSuccess(store.getRoom("ROOM1"));

    expect(stillPaused.game!.snapshot.status).toBe("paused");
    expect(stillPaused.game!.snapshot.ball.position.x).toBe(pausedBallX);
    expect(stillPaused.game!.seq).toBe(pausedGameSeq);

    const resumed = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "resume",
        participantId: "host-1",
        type: "room.lifecycle",
      }),
    );

    expect(resumed.game!.snapshot.status).toBe("running");

    nowMs += getPongScoreTickDelay();
    const scoredDown = expectStoreSuccess(store.getRoom("ROOM1"));

    expect(scoredDown.game!.snapshot.remainingScore).toBeLessThan(
      resumed.game!.snapshot.remainingScore,
    );

    const restarted = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "restart",
        participantId: "host-1",
        type: "room.lifecycle",
      }),
    );

    expect(restarted.game!.snapshot).toMatchObject({
      remainingScore: getPongMaximumScore(resumed.game!.snapshot.targetScore),
      score: {
        cpu: 0,
        player: 0,
      },
      status: "ready",
    });
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
    const initialGame = started.game!.snapshot;

    nowMs += getPongScoreTickDelay() * (PONG_RUNTIME_CATCH_UP_TICK_LIMIT + 20);
    const advanced = expectStoreSuccess(store.getRoom("ROOM1"));

    expect(advanced.game!.snapshot.ball.position.x).toBeCloseTo(
      initialGame.ball.position.x +
        initialGame.ball.velocity.x * PONG_RUNTIME_CATCH_UP_TICK_LIMIT,
    );
    expect(advanced.game!.snapshot.remainingScore).toBe(
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

  it("returns immutable Pong game snapshots", () => {
    const store = createTestRoomStore();
    const snapshot = createStartedPongRoom(store);

    snapshot.game!.snapshot.playerPaddle.y = 0;
    snapshot.game!.snapshot.score.player = 99;
    const mutableHeldInputs = snapshot.game!.heldInputs as {
      left?: { down?: boolean };
    };
    mutableHeldInputs.left = { down: true };

    const nextSnapshot = expectStoreSuccess(store.getRoom("ROOM1"));

    expect(nextSnapshot.game!.snapshot.playerPaddle.y).not.toBe(0);
    expect(nextSnapshot.game!.snapshot.score.player).toBe(0);
    expect(nextSnapshot.game!.heldInputs).toEqual({});
  });
});
