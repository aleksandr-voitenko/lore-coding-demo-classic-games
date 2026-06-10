import { describe, expect, it } from "vitest";

import { withReplayElapsed } from "./game-replay.test-helpers";
import { hardDropTetrisPiece } from "./tetris-game-engine";
import {
  applyTetrisReplayEvent,
  createInitialTetrisReplayGame,
  createTetrisReplayLeaderboardKey,
  parseTetrisReplayPayload,
  TETRIS_REPLAY_SCHEMA_VERSION,
  type TetrisReplayEvent,
  type TetrisReplayPayload,
} from "./tetris-replay";

function createReplayPayload(
  overrides: Partial<TetrisReplayPayload> = {},
): TetrisReplayPayload {
  const boardHeight = overrides.boardHeight ?? 8;
  const boardWidth = overrides.boardWidth ?? 4;
  const startLevel = overrides.startLevel ?? 5;

  const payload = {
    boardHeight,
    boardWidth,
    events: [
      {
        seq: 0,
        tick: 0,
        type: "start",
      },
      {
        seq: 1,
        tick: 0,
        type: "moveLeft",
      },
      {
        seq: 2,
        tick: 0,
        type: "moveRight",
      },
      {
        seq: 3,
        tick: 0,
        type: "rotateClockwise",
      },
      {
        seq: 4,
        tick: 0,
        type: "rotateCounterclockwise",
      },
      {
        seq: 5,
        tick: 0,
        type: "softDrop",
      },
      {
        seq: 6,
        tick: 0,
        type: "hardDrop",
      },
      {
        seq: 7,
        tick: 0,
        type: "advance",
      },
    ],
    finalLevel: startLevel,
    finalLines: 0,
    finalScore: 4,
    finalStatus: "lost",
    finalTick: 1,
    gameId: "tetris",
    leaderboardKey: createTetrisReplayLeaderboardKey({
      boardHeight,
      boardWidth,
      startLevel,
    }),
    runId: "run-1",
    schemaVersion: TETRIS_REPLAY_SCHEMA_VERSION,
    seed: 1234,
    startLevel,
    startedAt: "2026-06-08T12:00:00.000Z",
    ...overrides,
  };

  return {
    ...payload,
    events: withReplayElapsed(payload.events),
  } as TetrisReplayPayload;
}

function createHardDropReplay(seed: number) {
  const boardHeight = 8;
  const boardWidth = 4;
  const startLevel = 5;
  const initialReplay = createInitialTetrisReplayGame({
    boardHeight,
    boardWidth,
    seed,
    startLevel,
  });
  const random = initialReplay.random;
  const events: TetrisReplayEvent[] = [
    {
      elapsedMs: 0,
      seq: 0,
      tick: 0,
      type: "start",
    },
  ];
  let game = initialReplay.game;

  while (game.status === "running" && events.length < 80) {
    events.push({
      elapsedMs: events.length,
      seq: events.length,
      tick: 0,
      type: "hardDrop",
    });
    game = hardDropTetrisPiece(game, { random });
  }

  if (game.status !== "lost") {
    throw new Error(`Expected generated replay to end lost, got ${game.status}.`);
  }

  return createReplayPayload({
    boardHeight,
    boardWidth,
    events,
    finalLevel: game.level,
    finalLines: game.lines,
    finalScore: game.score,
    finalStatus: game.status,
    finalTick: 0,
    leaderboardKey: createTetrisReplayLeaderboardKey({
      boardHeight,
      boardWidth,
      startLevel,
    }),
    seed,
    startLevel,
  });
}

describe("tetris replay", () => {
  it("parses supported replay payloads and rejects malformed parameters and events", () => {
    const parsedReplay = parseTetrisReplayPayload(createReplayPayload());

    if (!parsedReplay.success) {
      throw new Error(parsedReplay.error);
    }

    expect(parsedReplay).toMatchObject({
      payload: {
        boardHeight: 8,
        boardWidth: 4,
        events: expect.arrayContaining([
          expect.objectContaining({ type: "rotateCounterclockwise" }),
        ]),
        finalLines: 0,
        gameId: "tetris",
        startLevel: 5,
      },
      success: true,
    });

    expect(
      parseTetrisReplayPayload(
        createReplayPayload({
          leaderboardKey: "tetris|board=10x20|level=5",
        }),
      ),
    ).toEqual({
      error: "Tetris replay leaderboard key is not supported.",
      success: false,
    });
    expect(
      parseTetrisReplayPayload(
        createReplayPayload({
          boardHeight: 7,
        }),
      ),
    ).toEqual({
      error: "Tetris replay parameters are not supported.",
      success: false,
    });
    expect(
      parseTetrisReplayPayload(
        createReplayPayload({
          events: [
            {
              seq: 0,
              tick: 0,
              type: "pause",
            } as unknown as TetrisReplayEvent,
          ],
        }),
      ),
    ).toEqual({
      error: "Tetris replay includes an unsupported event.",
      success: false,
    });
    expect(
      parseTetrisReplayPayload(
        createReplayPayload({
          finalStatus: "won",
        }),
      ),
    ).toEqual({
      error: "Tetris replay final state is not supported.",
      success: false,
    });
  });

  it("replays a seeded hard-drop run to the same terminal Tetris state", () => {
    const replay = createHardDropReplay(4321);
    const first = createInitialTetrisReplayGame(replay);
    const second = createInitialTetrisReplayGame(replay);
    const firstResult = replay.events.reduce(
      (game, event) => applyTetrisReplayEvent(game, event, first.random),
      first.game,
    );
    const secondResult = replay.events.reduce(
      (game, event) => applyTetrisReplayEvent(game, event, second.random),
      second.game,
    );

    expect(firstResult).toEqual(secondResult);
    expect(firstResult).toMatchObject({
      boardHeight: replay.boardHeight,
      boardWidth: replay.boardWidth,
      level: replay.finalLevel,
      lines: replay.finalLines,
      score: replay.finalScore,
      startLevel: replay.startLevel,
      status: replay.finalStatus,
    });
  });
});
