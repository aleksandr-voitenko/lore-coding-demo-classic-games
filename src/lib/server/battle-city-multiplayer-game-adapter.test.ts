import { describe, expect, it } from "vitest";

import {
  BATTLE_CITY_STAGE_INTRO_TICKS,
  BATTLE_CITY_TICK_MS,
  type BattleCityMultiplayerGameState,
} from "../battle-city-game-engine";
import type { BattleCityMultiplayerGameSnapshot } from "../battle-city-multiplayer";
import type { PrivateRoom } from "../multiplayer/room";
import {
  BATTLE_CITY_RUNTIME_CATCH_UP_TICK_LIMIT,
  battleCityMultiplayerRuntimeAdapter,
} from "./battle-city-multiplayer-game-adapter";
import type { MultiplayerServerGameRuntimeCreateResult } from "./multiplayer-game-adapter-contract";

const RUNTIME_START_MS = 1_000;

function createBattleCityRoom(
  overrides: Partial<PrivateRoom> = {},
): PrivateRoom {
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
      {
        displayName: "Observer",
        id: "observer-1",
        role: "observer",
        userId: null,
      },
    ],
    seats: [
      {
        id: "player-1",
        label: "Player 1",
        occupiedByParticipantId: "host-1",
        required: true,
      },
      {
        id: "player-2",
        label: "Player 2",
        occupiedByParticipantId: "guest-1",
        required: true,
      },
    ],
    settings: {
      gameId: "battle-city",
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

function createBattleCityRuntime(room = createBattleCityRoom()) {
  return expectRuntime(
    battleCityMultiplayerRuntimeAdapter.createRuntime({
      nowMs: RUNTIME_START_MS,
      room,
    }),
  );
}

function createBattleCitySnapshot(
  runtime: unknown,
  room = createBattleCityRoom(),
  matchRoom = room,
): BattleCityMultiplayerGameSnapshot {
  const snapshot = battleCityMultiplayerRuntimeAdapter.createSnapshot({
    matchRoom,
    room,
    runtime,
    serverTimeMs: 1_500,
  });

  expect(snapshot.gameId).toBe("battle-city");

  return snapshot as BattleCityMultiplayerGameSnapshot;
}

function getRuntimeGame(runtime: unknown) {
  return (runtime as { game: BattleCityMultiplayerGameState }).game;
}

function setRuntimeGame(
  runtime: unknown,
  game: BattleCityMultiplayerGameState,
) {
  (runtime as { game: BattleCityMultiplayerGameState }).game = game;
}

describe("Tank Patrol multiplayer server adapter", () => {
  it("validates Tank Patrol-specific room seats and settings", () => {
    const invalidGameRoom = createBattleCityRoom({
      settings: { gameId: "pong" },
    });
    const missingSeatRoom = createBattleCityRoom({
      seats: [createBattleCityRoom().seats[0]],
    });
    const optionalSeatRoom = createBattleCityRoom({
      seats: createBattleCityRoom().seats.map((seat) =>
        seat.id === "player-2" ? { ...seat, required: false } : seat,
      ),
    });
    const emptySeatRoom = createBattleCityRoom({
      seats: createBattleCityRoom().seats.map((seat) =>
        seat.id === "player-2"
          ? { ...seat, occupiedByParticipantId: null }
          : seat,
      ),
    });

    expect(
      battleCityMultiplayerRuntimeAdapter.createRuntime({
        nowMs: RUNTIME_START_MS,
        room: invalidGameRoom,
      }),
    ).toEqual({
      code: "invalid-command",
      error: "Tank Patrol multiplayer only supports Tank Patrol rooms.",
      success: false,
    });

    for (const room of [missingSeatRoom, optionalSeatRoom, emptySeatRoom]) {
      expect(
        battleCityMultiplayerRuntimeAdapter.createRuntime({
          nowMs: RUNTIME_START_MS,
          room,
        }),
      ).toEqual({
        code: "invalid-status",
        error:
          "Tank Patrol multiplayer requires occupied required Player 1 and Player 2 seats.",
        success: false,
      });
    }
  });

  it("starts both players on Stage 1 and caps NTSC catch-up batches", () => {
    const room = createBattleCityRoom();
    const runtime = createBattleCityRuntime(room);
    const initialSnapshot = createBattleCitySnapshot(runtime, room);

    expect(initialSnapshot).toMatchObject({
      gameId: "battle-city",
      heldInputs: {},
      seq: 1,
      snapshot: {
        cycle: 1,
        player: { col: 8, row: 24 },
        player2: { col: 16, row: 24 },
        stage: 1,
        stageTransitionTicks: BATTLE_CITY_STAGE_INTRO_TICKS,
        status: "stage-intro",
      },
    });

    expect(
      battleCityMultiplayerRuntimeAdapter.advanceRuntimeTo({
        nowMs:
          RUNTIME_START_MS +
          BATTLE_CITY_TICK_MS *
            (BATTLE_CITY_RUNTIME_CATCH_UP_TICK_LIMIT + 20) +
          0.001,
        room,
        runtime,
      }),
    ).toBe(true);
    expect(createBattleCitySnapshot(runtime, room)).toMatchObject({
      seq: 2,
      snapshot: {
        stageTransitionTicks:
          BATTLE_CITY_STAGE_INTRO_TICKS -
          BATTLE_CITY_RUNTIME_CATCH_UP_TICK_LIMIT,
        status: "stage-intro",
      },
    });

    // The capped work remains as bounded backlog rather than being discarded.
    expect(
      battleCityMultiplayerRuntimeAdapter.advanceRuntimeTo({
        nowMs:
          RUNTIME_START_MS +
          BATTLE_CITY_TICK_MS *
            (BATTLE_CITY_RUNTIME_CATCH_UP_TICK_LIMIT + 20) +
          0.001,
        room,
        runtime,
      }),
    ).toBe(true);
    expect(createBattleCitySnapshot(runtime, room).snapshot.status).toBe(
      "stage-intro",
    );
    expect(createBattleCitySnapshot(runtime, room).snapshot.stageTransitionTicks).toBe(
      BATTLE_CITY_STAGE_INTRO_TICKS -
        BATTLE_CITY_RUNTIME_CATCH_UP_TICK_LIMIT -
        20,
    );
  });

  it("maps held direction and one-shot fire to the participant's player seat", () => {
    const room = createBattleCityRoom();
    const runtime = createBattleCityRuntime(room);

    // Advance through the intro and both players' spawn animation.
    expect(
      battleCityMultiplayerRuntimeAdapter.advanceRuntimeTo({
        nowMs: RUNTIME_START_MS + BATTLE_CITY_TICK_MS * 60 + 0.001,
        room,
        runtime,
      }),
    ).toBe(true);
    expect(
      battleCityMultiplayerRuntimeAdapter.advanceRuntimeTo({
        nowMs: RUNTIME_START_MS + BATTLE_CITY_TICK_MS * 120 + 0.001,
        room,
        runtime,
      }),
    ).toBe(true);
    expect(
      battleCityMultiplayerRuntimeAdapter.advanceRuntimeTo({
        nowMs: RUNTIME_START_MS + BATTLE_CITY_TICK_MS * 150 + 0.001,
        room,
        runtime,
      }),
    ).toBe(true);
    expect(getRuntimeGame(runtime).player2.phase).toBe("active");

    expect(
      battleCityMultiplayerRuntimeAdapter.applyInputCommand({
        command: {
          input: {
            direction: "right",
            type: "battle-city.setDirection",
          },
          participantId: " guest-1 ",
          matchId: 1,
          type: "game.input",
        },
        nowMs: 3_200,
        room,
        runtime,
      }),
    ).toEqual({ participantId: " guest-1 ", success: true });
    expect(createBattleCitySnapshot(runtime, room).heldInputs).toEqual({
      "player-2": { direction: "right" },
    });

    expect(
      battleCityMultiplayerRuntimeAdapter.applyInputCommand({
        command: {
          input: { type: "battle-city.fire" },
          participantId: "guest-1",
          matchId: 1,
          type: "game.input",
        },
        nowMs: 3_210,
        room,
        runtime,
      }),
    ).toEqual({ participantId: "guest-1", success: true });
    const latchedSnapshot = createBattleCitySnapshot(runtime, room);
    expect(latchedSnapshot.heldInputs).toEqual({
      "player-2": { direction: "right", fireRequested: true },
    });

    // Repeated fire before the next frame remains one pending request.
    expect(
      battleCityMultiplayerRuntimeAdapter.applyInputCommand({
        command: {
          input: { type: "battle-city.fire" },
          participantId: "guest-1",
          matchId: 1,
          type: "game.input",
        },
        nowMs: 3_215,
        room,
        runtime,
      }),
    ).toEqual({ participantId: "guest-1", success: true });
    expect(createBattleCitySnapshot(runtime, room).seq).toBe(
      latchedSnapshot.seq,
    );

    expect(
      battleCityMultiplayerRuntimeAdapter.advanceRuntimeTo({
        nowMs: RUNTIME_START_MS + BATTLE_CITY_TICK_MS * 151 + 0.001,
        room,
        runtime,
      }),
    ).toBe(true);
    expect(createBattleCitySnapshot(runtime, room)).toMatchObject({
      heldInputs: {
        "player-2": { direction: "right" },
      },
      snapshot: {
        bullets: [expect.objectContaining({ owner: "player2", slot: 1 })],
      },
    });

    battleCityMultiplayerRuntimeAdapter.clearInputForReleasedSeat({
      command: {
        participantId: "guest-1",
        seatId: "player-2",
        matchId: 1,
        type: "room.releaseSeat",
      },
      runtime,
    });
    expect(createBattleCitySnapshot(runtime, room).heldInputs).toEqual({});
  });

  it("rejects malformed, unsupported, unseated, and inactive input", () => {
    const room = createBattleCityRoom();
    const runtime = createBattleCityRuntime(room);

    expect(
      battleCityMultiplayerRuntimeAdapter.applyInputCommand({
        command: {
          input: null,
          matchId: 1,
          participantId: "host-1",
          type: "game.input",
        },
        nowMs: 1_000,
        room,
        runtime,
      }),
    ).toEqual({
      code: "invalid-command",
      error: "Tank Patrol input must be a JSON object.",
      success: false,
    });
    expect(
      battleCityMultiplayerRuntimeAdapter.applyInputCommand({
        command: {
          input: { direction: "up", type: "battle-city.setDirection" },
          participantId: "host-1",
          matchId: 1,
          type: "game.input",
        },
        nowMs: 1_000,
        room,
        runtime: undefined,
      }),
    ).toMatchObject({ code: "invalid-status", success: false });
    expect(
      battleCityMultiplayerRuntimeAdapter.applyInputCommand({
        command: {
          input: { direction: "forward", type: "battle-city.setDirection" },
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
      error: "Tank Patrol direction must be up, right, down, left, or null.",
      success: false,
    });
    expect(
      battleCityMultiplayerRuntimeAdapter.applyInputCommand({
        command: {
          input: { type: "battle-city.teleport" },
          participantId: "host-1",
          matchId: 1,
          type: "game.input",
        },
        nowMs: 1_000,
        room,
        runtime,
      }),
    ).toMatchObject({ code: "invalid-command", success: false });
    expect(
      battleCityMultiplayerRuntimeAdapter.applyInputCommand({
        command: {
          input: { direction: "up", type: "battle-city.setDirection" },
          participantId: "missing-1",
          matchId: 1,
          type: "game.input",
        },
        nowMs: 1_000,
        room,
        runtime,
      }),
    ).toEqual({
      code: "participant-not-found",
      error: "Participant is not in the Tank Patrol room.",
      success: false,
    });
    expect(
      battleCityMultiplayerRuntimeAdapter.applyInputCommand({
        command: {
          input: { direction: "up", type: "battle-city.setDirection" },
          participantId: "observer-1",
          matchId: 1,
          type: "game.input",
        },
        nowMs: 1_000,
        room,
        runtime,
      }),
    ).toEqual({
      code: "participant-not-seated",
      error: "Participant does not occupy a Tank Patrol player seat.",
      success: false,
    });
    expect(
      battleCityMultiplayerRuntimeAdapter.applyInputCommand({
        command: {
          input: { type: "battle-city.fire" },
          participantId: "host-1",
          matchId: 1,
          type: "game.input",
        },
        nowMs: 1_000,
        room,
        runtime,
      }),
    ).toEqual({
      code: "invalid-status",
      error: "Tank Patrol fire is only available during active battle play.",
      success: false,
    });
    expect(
      battleCityMultiplayerRuntimeAdapter.applyInputCommand({
        command: {
          input: { direction: null, type: "battle-city.setDirection" },
          participantId: "host-1",
          matchId: 1,
          type: "game.input",
        },
        nowMs: 1_000,
        room: { ...room, status: "finished" },
        runtime,
      }),
    ).toMatchObject({ code: "invalid-status", success: false });
  });

  it("uses room lifecycle state for pause and resumes exact internal phases", () => {
    const room = createBattleCityRoom();
    const runtime = createBattleCityRuntime(room);

    expect(
      battleCityMultiplayerRuntimeAdapter.advanceRuntimeTo({
        nowMs: RUNTIME_START_MS + BATTLE_CITY_TICK_MS * 10 + 0.001,
        room,
        runtime,
      }),
    ).toBe(true);
    const beforePause = createBattleCitySnapshot(runtime, room);

    expect(
      battleCityMultiplayerRuntimeAdapter.applyLifecycleCommand({
        command: {
          command: "pause",
          participantId: "host-1",
          matchId: 1,
          type: "room.lifecycle",
        },
        nowMs: 2_000,
        room,
        runtime,
      }),
    ).toEqual({ success: true });
    expect(createBattleCitySnapshot(runtime, room).snapshot).toEqual(
      beforePause.snapshot,
    );
    expect(
      battleCityMultiplayerRuntimeAdapter.advanceRuntimeTo({
        nowMs: 10_000,
        room: { ...room, status: "paused" },
        runtime,
      }),
    ).toBe(false);

    expect(
      battleCityMultiplayerRuntimeAdapter.applyLifecycleCommand({
        command: {
          command: "resume",
          participantId: "host-1",
          matchId: 1,
          type: "room.lifecycle",
        },
        nowMs: 10_000,
        room: { ...room, status: "paused" },
        runtime,
      }),
    ).toEqual({ success: true });
    expect(
      battleCityMultiplayerRuntimeAdapter.advanceRuntimeTo({
        nowMs: 10_000 + BATTLE_CITY_TICK_MS + 0.001,
        room,
        runtime,
      }),
    ).toBe(true);
    expect(createBattleCitySnapshot(runtime, room).snapshot.stageTransitionTicks).toBe(
      beforePause.snapshot.stageTransitionTicks - 1,
    );

    for (const status of [
      "stage-intro",
      "running",
      "stage-clear",
      "game-over",
      "stage-results",
    ] as const) {
      setRuntimeGame(runtime, { ...getRuntimeGame(runtime), status });
      expect(
        battleCityMultiplayerRuntimeAdapter.isActive({ room, runtime }),
      ).toBe(true);
    }
  });

  it("restarts at Stage 1, clears input, and snapshots immutable state", () => {
    const room = createBattleCityRoom();
    const runtime = createBattleCityRuntime(room);

    battleCityMultiplayerRuntimeAdapter.applyInputCommand({
      command: {
        input: { direction: "left", type: "battle-city.setDirection" },
        participantId: "host-1",
        matchId: 1,
        type: "game.input",
      },
      nowMs: 1_010,
      room,
      runtime,
    });
    const exposed = createBattleCitySnapshot(runtime, room);
    (exposed.snapshot.player as { col: number }).col = 99;
    (exposed.snapshot.terrain[0] as string[])[0] = "brick";
    (exposed.heldInputs as Record<string, { direction: string }>)["player-1"]
      .direction = "right";

    const fresh = createBattleCitySnapshot(runtime, room);
    expect(fresh.snapshot.player.col).toBe(8);
    expect(fresh.snapshot.terrain[0][0]).not.toBe("brick");
    expect(fresh.heldInputs).toEqual({
      "player-1": { direction: "left" },
    });

    setRuntimeGame(runtime, {
      ...getRuntimeGame(runtime),
      cycle: 2,
      stage: 12,
    });
    expect(
      battleCityMultiplayerRuntimeAdapter.applyLifecycleCommand({
        command: {
          command: "restart",
          participantId: "host-1",
          matchId: 1,
          type: "room.lifecycle",
        },
        nowMs: 2_000,
        room,
        runtime,
      }),
    ).toEqual({ success: true });
    expect(createBattleCitySnapshot(runtime, room)).toMatchObject({
      heldInputs: {},
      snapshot: {
        cycle: 1,
        stage: 1,
        status: "stage-intro",
      },
    });
  });

  it("classifies only lost as terminal and emits a per-player summary", () => {
    const room = createBattleCityRoom();
    const runtime = createBattleCityRuntime(room);

    for (const status of [
      "ready",
      "stage-intro",
      "running",
      "paused",
      "stage-clear",
      "game-over",
      "stage-results",
    ] as const) {
      setRuntimeGame(runtime, { ...getRuntimeGame(runtime), status });
      expect(
        battleCityMultiplayerRuntimeAdapter.isTerminal({ room, runtime }),
      ).toBe(false);
    }

    setRuntimeGame(runtime, {
      ...getRuntimeGame(runtime),
      cycle: 3,
      lives: 1,
      player: {
        ...getRuntimeGame(runtime).player,
        phase: "inactive",
      },
      player2: {
        ...getRuntimeGame(runtime).player2,
        phase: "active",
      },
      player2Lives: 2,
      player2Score: 34_500,
      score: 28_100,
      stage: 8,
      status: "lost",
    });
    expect(
      battleCityMultiplayerRuntimeAdapter.isTerminal({ room, runtime }),
    ).toBe(true);
    const terminalSummary = createBattleCitySnapshot(runtime, room).summary;
    expect(terminalSummary).toEqual({
      key: "battle-city|mode=private-room|start-stage=1",
      mode: "private-room",
      outcome: {
        cycle: 3,
        player1Lives: 1,
        player1ReserveLives: 1,
        player1Score: 28_100,
        player2Lives: 2,
        player2ReserveLives: 1,
        player2Score: 34_500,
        stage: 8,
      },
      seats: [
        {
          id: "player-1",
          label: "Player 1",
          participant: {
            displayName: "Ada Host",
            id: "host-1",
            role: "host",
            userId: "user-1",
          },
        },
        {
          id: "player-2",
          label: "Player 2",
          participant: {
            displayName: "Guest One",
            id: "guest-1",
            role: "player",
            userId: null,
          },
        },
      ],
      settings: { gameId: "battle-city" },
      status: "lost",
    });

    const releasedRoom = createBattleCityRoom({
      seats: room.seats.map((seat) =>
        seat.id === "player-2"
          ? { ...seat, occupiedByParticipantId: null }
          : seat,
      ),
    });
    expect(
      createBattleCitySnapshot(runtime, releasedRoom, room).summary,
    ).toEqual(terminalSummary);
  });
});
