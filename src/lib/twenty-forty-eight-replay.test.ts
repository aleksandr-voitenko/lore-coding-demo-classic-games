import { describe, expect, it } from "vitest";

import {
  getTwentyFortyEightTopTile,
  moveTwentyFortyEightGame,
  type TwentyFortyEightDirection,
} from "./twenty-forty-eight-game-engine";
import {
  applyTwentyFortyEightReplayEvent,
  createInitialTwentyFortyEightReplayGame,
  createTwentyFortyEightReplayLeaderboardKey,
  parseTwentyFortyEightReplayPayload,
  TWENTY_FORTY_EIGHT_REPLAY_SCHEMA_VERSION,
  type TwentyFortyEightReplayEvent,
  type TwentyFortyEightReplayPayload,
} from "./twenty-forty-eight-replay";

function createReplayPayload(
  overrides: Partial<TwentyFortyEightReplayPayload> = {},
): TwentyFortyEightReplayPayload {
  const boardSize = overrides.boardSize ?? 5;
  const winTile = overrides.winTile ?? 4096;

  return {
    boardSize,
    events: [
      {
        seq: 0,
        tick: 0,
        type: "start",
      },
      {
        direction: "left",
        seq: 1,
        tick: 0,
        type: "move",
      },
    ],
    finalMoveCount: 8,
    finalScore: 4096,
    finalStatus: "won",
    finalTick: 1,
    finalTopTile: 4096,
    gameId: "twenty-forty-eight",
    leaderboardKey: createTwentyFortyEightReplayLeaderboardKey({
      boardSize,
      winTile,
    }),
    runId: "run-1",
    schemaVersion: TWENTY_FORTY_EIGHT_REPLAY_SCHEMA_VERSION,
    seed: 1234,
    startedAt: "2026-06-08T12:00:00.000Z",
    winTile,
    ...overrides,
  };
}

function createTerminalReplay(seed: number) {
  const boardSize = 4;
  const winTile = 64;
  const initialReplay = createInitialTwentyFortyEightReplayGame({
    boardSize,
    seed,
    winTile,
  });
  const random = initialReplay.random;
  const directions: TwentyFortyEightDirection[] = ["left", "up", "right", "down"];
  const events: TwentyFortyEightReplayEvent[] = [
    {
      seq: 0,
      tick: 0,
      type: "start",
    },
  ];
  let game = initialReplay.game;

  while (game.status === "running" && events.length < 240) {
    const direction = directions[(events.length - 1) % directions.length]!;

    events.push({
      direction,
      seq: events.length,
      tick: events.length - 1,
      type: "move",
    });
    game = moveTwentyFortyEightGame(game, direction, { random });
  }

  if (game.status !== "lost" && game.status !== "won") {
    throw new Error(`Expected generated replay to finish, got ${game.status}.`);
  }

  return createReplayPayload({
    boardSize,
    events,
    finalMoveCount: game.moveCount,
    finalScore: game.score,
    finalStatus: game.status,
    finalTick: events.length - 1,
    finalTopTile: getTwentyFortyEightTopTile(game),
    leaderboardKey: createTwentyFortyEightReplayLeaderboardKey({
      boardSize,
      winTile,
    }),
    seed,
    winTile,
  });
}

describe("2048 replay", () => {
  it("parses supported replay payloads and rejects malformed parameters and events", () => {
    const parsedReplay = parseTwentyFortyEightReplayPayload(createReplayPayload());

    if (!parsedReplay.success) {
      throw new Error(parsedReplay.error);
    }

    expect(parsedReplay).toMatchObject({
      payload: {
        boardSize: 5,
        events: [
          {
            type: "start",
          },
          {
            direction: "left",
            type: "move",
          },
        ],
        finalMoveCount: 8,
        finalTopTile: 4096,
        gameId: "twenty-forty-eight",
        winTile: 4096,
      },
      success: true,
    });

    expect(
      parseTwentyFortyEightReplayPayload(
        createReplayPayload({
          leaderboardKey: "twenty-forty-eight|board=4|goal=4096",
        }),
      ),
    ).toEqual({
      error: "2048 replay leaderboard key is not supported.",
      success: false,
    });
    expect(
      parseTwentyFortyEightReplayPayload(
        createReplayPayload({
          boardSize: 1,
        }),
      ),
    ).toEqual({
      error: "2048 replay parameters are not supported.",
      success: false,
    });
    expect(
      parseTwentyFortyEightReplayPayload(
        createReplayPayload({
          events: [
            {
              direction: "north",
              seq: 0,
              tick: 0,
              type: "move",
            } as unknown as TwentyFortyEightReplayEvent,
          ],
        }),
      ),
    ).toEqual({
      error: "2048 replay includes an unsupported event.",
      success: false,
    });
    expect(
      parseTwentyFortyEightReplayPayload(
        createReplayPayload({
          finalStatus: "won",
          finalTopTile: 2048,
        }),
      ),
    ).toEqual({
      error: "2048 replay final state is not supported.",
      success: false,
    });
  });

  it("replays a seeded move run to the same terminal 2048 state", () => {
    const replay = createTerminalReplay(4321);
    const first = createInitialTwentyFortyEightReplayGame(replay);
    const second = createInitialTwentyFortyEightReplayGame(replay);
    const firstResult = replay.events.reduce(
      (game, event) => applyTwentyFortyEightReplayEvent(game, event, first.random),
      first.game,
    );
    const secondResult = replay.events.reduce(
      (game, event) => applyTwentyFortyEightReplayEvent(game, event, second.random),
      second.game,
    );

    expect(firstResult).toEqual(secondResult);
    expect(firstResult).toMatchObject({
      boardSize: replay.boardSize,
      moveCount: replay.finalMoveCount,
      score: replay.finalScore,
      status: replay.finalStatus,
      winTile: replay.winTile,
    });
    expect(getTwentyFortyEightTopTile(firstResult)).toBe(replay.finalTopTile);
  });
});
