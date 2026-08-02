import { describe, expect, it } from "vitest";

import type { AsteroidsMultiplayerGameSnapshot } from "../asteroids-multiplayer";
import type { PrivateRoom } from "../multiplayer/room";
import { asteroidsMultiplayerRuntimeAdapter } from "./asteroids-multiplayer-game-adapter";
import type { MultiplayerServerGameRuntimeCreateResult } from "./multiplayer-game-adapter-contract";

function createAsteroidsRoom(overrides: Partial<PrivateRoom> = {}): PrivateRoom {
  return {
    code: "ROOM1",
    hostParticipantId: "host-1",
    matchId: 1,
    nextMatchParticipantIds: [],
    observerLimit: 8,
    participants: [
      {
        displayName: "Ada Host",
        id: "host-1",
        role: "host",
        userId: "user-1",
      },
      {
        displayName: "Guest One",
        id: "guest-1",
        role: "player",
        userId: null,
      },
    ],
    seats: [
      {
        id: "ship-a",
        label: "Ship A",
        occupiedByParticipantId: "host-1",
        required: true,
      },
      {
        id: "ship-b",
        label: "Ship B",
        occupiedByParticipantId: "guest-1",
        required: true,
      },
    ],
    settings: {
      gameId: "asteroids",
    },
    status: "running",
    ...overrides,
  };
}

function expectRuntime(result: MultiplayerServerGameRuntimeCreateResult) {
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.runtime;
}

function createAsteroidsRuntime(room = createAsteroidsRoom()) {
  return expectRuntime(
    asteroidsMultiplayerRuntimeAdapter.createRuntime({
      nowMs: 1_000,
      room,
    }),
  );
}

function createAsteroidsSnapshot(
  runtime: unknown,
  room = createAsteroidsRoom(),
  matchRoom = room,
): AsteroidsMultiplayerGameSnapshot {
  const snapshot = asteroidsMultiplayerRuntimeAdapter.createSnapshot({
    matchRoom,
    room,
    runtime,
    serverTimeMs: 1_500,
  });

  expect(snapshot.gameId).toBe("asteroids");

  return snapshot as AsteroidsMultiplayerGameSnapshot;
}

describe("asteroids multiplayer server adapter", () => {
  it("validates Asteroids-specific room seats and settings", () => {
    const invalidGameRoom = createAsteroidsRoom({
      settings: {
        gameId: "pong",
      },
    });
    const missingSeatRoom = createAsteroidsRoom({
      seats: [
        {
          id: "ship-a",
          label: "Ship A",
          occupiedByParticipantId: "host-1",
          required: true,
        },
      ],
    });
    const optionalSeatRoom = createAsteroidsRoom({
      seats: [
        {
          id: "ship-a",
          label: "Ship A",
          occupiedByParticipantId: "host-1",
          required: true,
        },
        {
          id: "ship-b",
          label: "Ship B",
          occupiedByParticipantId: "guest-1",
          required: false,
        },
      ],
    });
    const emptySeatRoom = createAsteroidsRoom({
      seats: [
        {
          id: "ship-a",
          label: "Ship A",
          occupiedByParticipantId: "host-1",
          required: true,
        },
        {
          id: "ship-b",
          label: "Ship B",
          occupiedByParticipantId: null,
          required: true,
        },
      ],
    });

    expect(
      asteroidsMultiplayerRuntimeAdapter.createRuntime({
        nowMs: 1_000,
        room: invalidGameRoom,
      }),
    ).toEqual({
      code: "invalid-command",
      error: "Asteroids multiplayer only supports Asteroids rooms.",
      success: false,
    });
    for (const room of [missingSeatRoom, optionalSeatRoom, emptySeatRoom]) {
      expect(
        asteroidsMultiplayerRuntimeAdapter.createRuntime({
          nowMs: 1_000,
          room,
        }),
      ).toEqual({
        code: "invalid-status",
        error:
          "Asteroids multiplayer requires occupied required Ship A and Ship B seats.",
        success: false,
      });
    }
  });

  it("gates activity and snapshot advancement on matching running rooms", () => {
    const room = createAsteroidsRoom();
    const runtime = createAsteroidsRuntime(room);
    const snapshot = createAsteroidsSnapshot(runtime, room);

    expect(snapshot).toMatchObject({
      gameId: "asteroids",
      seq: 1,
      snapshot: {
        difficulty: "medium",
        status: "running",
      },
    });
    expect(
      asteroidsMultiplayerRuntimeAdapter.advanceRuntimeTo({
        nowMs: 1_000,
        room,
        runtime,
      }),
    ).toBe(false);
    expect(
      asteroidsMultiplayerRuntimeAdapter.isActive({
        room,
        runtime,
      }),
    ).toBe(true);
    expect(
      asteroidsMultiplayerRuntimeAdapter.isActive({
        room: {
          ...room,
          status: "paused",
        },
        runtime,
      }),
    ).toBe(false);
    expect(
      asteroidsMultiplayerRuntimeAdapter.shouldAdvanceSnapshot({
        room,
        snapshot,
      }),
    ).toBe(true);
    expect(
      asteroidsMultiplayerRuntimeAdapter.shouldAdvanceSnapshot({
        room: {
          ...room,
          status: "finished",
        },
        snapshot,
      }),
    ).toBe(false);
    expect(
      asteroidsMultiplayerRuntimeAdapter.shouldAdvanceSnapshot({
        room,
        snapshot: {
          ...snapshot,
          gameId: "pong",
        } as never,
      }),
    ).toBe(false);
  });

  it("tracks held controls idempotently and clears released Asteroids seats", () => {
    const room = createAsteroidsRoom();
    const runtime = createAsteroidsRuntime(room);

    expect(
      asteroidsMultiplayerRuntimeAdapter.applyInputCommand({
        command: {
          input: {
            controls: {
              rotateLeft: false,
              rotateRight: true,
              thrust: true,
            },
            type: "asteroids.setShipControls",
          },
          participantId: " host-1 ",
          matchId: 1,
          type: "game.input",
        },
        nowMs: 1_000,
        room,
        runtime,
      }),
    ).toEqual({
      participantId: " host-1 ",
      success: true,
    });
    expect(createAsteroidsSnapshot(runtime, room)).toMatchObject({
      heldInputs: {
        "ship-a": {
          rotateRight: true,
          thrust: true,
        },
      },
      seq: 2,
    });

    expect(
      asteroidsMultiplayerRuntimeAdapter.applyInputCommand({
        command: {
          input: {
            controls: {
              rotateRight: true,
              thrust: true,
            },
            type: "asteroids.setShipControls",
          },
          participantId: "host-1",
          matchId: 1,
          type: "game.input",
        },
        nowMs: 1_010,
        room,
        runtime,
      }),
    ).toEqual({
      participantId: "host-1",
      success: true,
    });
    expect(createAsteroidsSnapshot(runtime, room).seq).toBe(2);

    expect(
      asteroidsMultiplayerRuntimeAdapter.applyInputCommand({
        command: {
          input: {
            controls: {},
            type: "asteroids.setShipControls",
          },
          participantId: "host-1",
          matchId: 1,
          type: "game.input",
        },
        nowMs: 1_020,
        room,
        runtime,
      }),
    ).toEqual({
      participantId: "host-1",
      success: true,
    });
    expect(createAsteroidsSnapshot(runtime, room)).toMatchObject({
      heldInputs: {},
      seq: 3,
    });

    expect(
      asteroidsMultiplayerRuntimeAdapter.applyInputCommand({
        command: {
          input: {
            controls: true,
            type: "asteroids.setShipControls",
          },
          participantId: "host-1",
          matchId: 1,
          type: "game.input",
        },
        nowMs: 1_030,
        room,
        runtime,
      }),
    ).toEqual({
      code: "invalid-command",
      error: "Asteroids ship controls must be a JSON object.",
      success: false,
    });

    asteroidsMultiplayerRuntimeAdapter.clearInputForReleasedSeat({
      command: {
        participantId: "host-1",
        seatId: "observer",
        matchId: 1,
        type: "room.releaseSeat",
      },
      runtime,
    });
    expect(createAsteroidsSnapshot(runtime, room).seq).toBe(3);

    expect(
      asteroidsMultiplayerRuntimeAdapter.applyInputCommand({
        command: {
          input: {
            controls: {
              rotateLeft: true,
            },
            type: "asteroids.setShipControls",
          },
          participantId: "guest-1",
          matchId: 1,
          type: "game.input",
        },
        nowMs: 1_040,
        room,
        runtime,
      }),
    ).toEqual({
      participantId: "guest-1",
      success: true,
    });
    asteroidsMultiplayerRuntimeAdapter.clearInputForReleasedSeat({
      command: {
        participantId: "guest-1",
        seatId: "ship-b",
        matchId: 1,
        type: "room.releaseSeat",
      },
      runtime,
    });
    expect(createAsteroidsSnapshot(runtime, room)).toMatchObject({
      heldInputs: {},
      seq: 5,
    });
  });

  it("rejects input at unsupported runtime, room, and command states", () => {
    const room = createAsteroidsRoom();
    const runtime = createAsteroidsRuntime(room);

    expect(
      asteroidsMultiplayerRuntimeAdapter.applyInputCommand({
        command: {
          input: null,
          participantId: "host-1",
          matchId: 1,
          type: "game.input",
        },
        nowMs: 1_000,
        room,
        runtime,
      }),
    ).toEqual({
      code: "invalid-command",
      error: "Asteroids input must be a JSON object.",
      success: false,
    });
    expect(
      asteroidsMultiplayerRuntimeAdapter.applyInputCommand({
        command: {
          input: {
            type: "asteroids.fire",
          },
          participantId: "host-1",
          matchId: 1,
          type: "game.input",
        },
        nowMs: 1_000,
        room,
        runtime: undefined,
      }),
    ).toEqual({
      code: "invalid-status",
      error: "Asteroids input is only accepted after the room has started.",
      success: false,
    });
    expect(
      asteroidsMultiplayerRuntimeAdapter.applyInputCommand({
        command: {
          input: {
            type: "asteroids.fire",
          },
          participantId: "host-1",
          matchId: 1,
          type: "game.input",
        },
        nowMs: 1_000,
        room: {
          ...room,
          status: "finished",
        },
        runtime,
      }),
    ).toEqual({
      code: "invalid-status",
      error: "Finished rooms cannot accept Asteroids input.",
      success: false,
    });
    expect(
      asteroidsMultiplayerRuntimeAdapter.applyInputCommand({
        command: {
          input: {
            type: "asteroids.fire",
          },
          participantId: "host-1",
          matchId: 1,
          type: "game.input",
        },
        nowMs: 1_000,
        room: {
          ...room,
          settings: {
            gameId: "pong",
          },
        },
        runtime,
      }),
    ).toEqual({
      code: "invalid-command",
      error: "Asteroids multiplayer only supports Asteroids rooms.",
      success: false,
    });
    expect(
      asteroidsMultiplayerRuntimeAdapter.applyInputCommand({
        command: {
          input: {
            type: "asteroids.teleport",
          },
          participantId: "host-1",
          matchId: 1,
          type: "game.input",
        },
        nowMs: 1_000,
        room,
        runtime,
      }),
    ).toEqual({
      code: "invalid-command",
      error: "Asteroids input type is not supported.",
      success: false,
    });
    expect(
      asteroidsMultiplayerRuntimeAdapter.applyInputCommand({
        command: {
          input: {
            type: "asteroids.fire",
          },
          participantId: 42,
          matchId: 1,
          type: "game.input",
        },
        nowMs: 1_000,
        room,
        runtime,
      }),
    ).toEqual({
      code: "participant-not-found",
      error: "Participant is not in the Asteroids room.",
      success: false,
    });

    expect(
      asteroidsMultiplayerRuntimeAdapter.applyLifecycleCommand({
        command: {
          command: "pause",
          participantId: "host-1",
          matchId: 1,
          type: "room.lifecycle",
        },
        nowMs: 1_100,
        room,
        runtime,
      }),
    ).toEqual({
      success: true,
    });
    expect(
      asteroidsMultiplayerRuntimeAdapter.applyInputCommand({
        command: {
          input: {
            type: "asteroids.fire",
          },
          participantId: "host-1",
          matchId: 1,
          type: "game.input",
        },
        nowMs: 1_200,
        room,
        runtime,
      }),
    ).toEqual({
      code: "invalid-status",
      error: "Asteroids fire is only available while the game is running.",
      success: false,
    });
  });

  it("handles lifecycle idempotence and runtime resets", () => {
    const room = createAsteroidsRoom();
    const runtime = createAsteroidsRuntime(room);

    expect(
      asteroidsMultiplayerRuntimeAdapter.applyLifecycleCommand({
        command: {
          command: "pause",
          participantId: "host-1",
          matchId: 1,
          type: "room.lifecycle",
        },
        nowMs: 1_000,
        room,
        runtime: undefined,
      }),
    ).toEqual({
      success: true,
    });

    expect(
      asteroidsMultiplayerRuntimeAdapter.applyLifecycleCommand({
        command: {
          command: "start",
          participantId: "host-1",
          matchId: 1,
          type: "room.lifecycle",
        },
        nowMs: 1_000,
        room,
        runtime,
      }).success,
    ).toBe(true);

    expect(
      asteroidsMultiplayerRuntimeAdapter.applyLifecycleCommand({
        command: {
          command: "pause",
          participantId: "host-1",
          matchId: 1,
          type: "room.lifecycle",
        },
        nowMs: 1_100,
        room,
        runtime,
      }),
    ).toEqual({
      success: true,
    });
    expect(createAsteroidsSnapshot(runtime, room)).toMatchObject({
      seq: 2,
      snapshot: {
        status: "paused",
      },
    });

    expect(
      asteroidsMultiplayerRuntimeAdapter.applyLifecycleCommand({
        command: {
          command: "pause",
          participantId: "host-1",
          matchId: 1,
          type: "room.lifecycle",
        },
        nowMs: 1_200,
        room,
        runtime,
      }),
    ).toEqual({
      success: true,
    });
    expect(createAsteroidsSnapshot(runtime, room).seq).toBe(2);

    expect(
      asteroidsMultiplayerRuntimeAdapter.applyLifecycleCommand({
        command: {
          command: "resume",
          participantId: "host-1",
          matchId: 1,
          type: "room.lifecycle",
        },
        nowMs: 1_300,
        room,
        runtime,
      }),
    ).toEqual({
      success: true,
    });
    expect(createAsteroidsSnapshot(runtime, room)).toMatchObject({
      seq: 3,
      snapshot: {
        status: "running",
      },
    });

    expect(
      asteroidsMultiplayerRuntimeAdapter.applyLifecycleCommand({
        command: {
          command: "resume",
          participantId: "host-1",
          matchId: 1,
          type: "room.lifecycle",
        },
        nowMs: 1_400,
        room,
        runtime,
      }),
    ).toEqual({
      success: true,
    });
    expect(createAsteroidsSnapshot(runtime, room).seq).toBe(3);

    expect(
      asteroidsMultiplayerRuntimeAdapter.applyInputCommand({
        command: {
          input: {
            controls: {
              thrust: true,
            },
            type: "asteroids.setShipControls",
          },
          participantId: "host-1",
          matchId: 1,
          type: "game.input",
        },
        nowMs: 1_500,
        room,
        runtime,
      }),
    ).toEqual({
      participantId: "host-1",
      success: true,
    });
    expect(createAsteroidsSnapshot(runtime, room).heldInputs).toEqual({
      "ship-a": {
        thrust: true,
      },
    });

    expect(
      asteroidsMultiplayerRuntimeAdapter.applyLifecycleCommand({
        command: {
          command: "restart",
          participantId: "host-1",
          matchId: 1,
          type: "room.lifecycle",
        },
        nowMs: 1_600,
        room,
        runtime,
      }),
    ).toEqual({
      success: true,
    });
    expect(createAsteroidsSnapshot(runtime, room)).toMatchObject({
      heldInputs: {},
      seq: 5,
      snapshot: {
        score: 0,
        status: "running",
        wave: 1,
      },
    });

    expect(
      asteroidsMultiplayerRuntimeAdapter.applyLifecycleCommand({
        command: {
          command: "finish",
          participantId: "host-1",
          matchId: 1,
          type: "room.lifecycle",
        },
        nowMs: 1_700,
        room,
        runtime,
      }),
    ).toEqual({
      success: true,
    });
    expect(createAsteroidsSnapshot(runtime, room)).toMatchObject({
      heldInputs: {},
      seq: 6,
      snapshot: {
        status: "paused",
      },
    });

    expect(
      asteroidsMultiplayerRuntimeAdapter.applyLifecycleCommand({
        command: {
          command: "finish",
          participantId: "host-1",
          matchId: 1,
          type: "room.lifecycle",
        },
        nowMs: 1_800,
        room,
        runtime,
      }),
    ).toEqual({
      success: true,
    });
    expect(createAsteroidsSnapshot(runtime, room).seq).toBe(6);
  });
});
