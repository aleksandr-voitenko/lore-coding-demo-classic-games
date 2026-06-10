import { describe, expect, it } from "vitest";

import { withReplayElapsed } from "./game-replay.test-helpers";
import {
  advanceBreakoutGame,
  startBreakoutGame,
  type BreakoutGameState,
} from "./breakout-game-engine";
import {
  applyBreakoutReplayEvent,
  createInitialBreakoutReplayGame,
  createBreakoutReplayLeaderboardKey,
  parseBreakoutReplayPayload,
  BREAKOUT_REPLAY_SCHEMA_VERSION,
  type BreakoutReplayEvent,
  type BreakoutReplayPayload,
} from "./breakout-replay";

function createReplayPayload(
  overrides: Partial<BreakoutReplayPayload> = {},
): BreakoutReplayPayload {
  const boardHeight = overrides.boardHeight ?? 480;
  const boardWidth = overrides.boardWidth ?? 360;
  const startingLives = overrides.startingLives ?? 2;

  const payload = {
    boardHeight,
    boardWidth,
    events: [
      {
        seq: 0,
        tick: 0,
        type: "moveLeft",
      },
      {
        seq: 1,
        tick: 0,
        type: "start",
      },
      {
        seq: 2,
        tick: 0,
        type: "moveRight",
      },
      {
        seq: 3,
        tick: 0,
        type: "advance",
      },
    ],
    finalActiveBrickCount: 12,
    finalLives: 0,
    finalScore: 50,
    finalStatus: "lost",
    finalTick: 1,
    gameId: "breakout",
    leaderboardKey: createBreakoutReplayLeaderboardKey({
      boardHeight,
      boardWidth,
      startingLives,
    }),
    runId: "run-1",
    schemaVersion: BREAKOUT_REPLAY_SCHEMA_VERSION,
    seed: 1234,
    startedAt: "2026-06-08T12:00:00.000Z",
    startingLives,
    ...overrides,
  };

  return {
    ...payload,
    events: withReplayElapsed(payload.events),
  } as BreakoutReplayPayload;
}

function applyReplayEvents(
  game: BreakoutGameState,
  events: BreakoutReplayEvent[],
  random: () => number,
) {
  return events.reduce(
    (current, event) => applyBreakoutReplayEvent(current, event, random),
    game,
  );
}

function createTerminalReplay(seed: number) {
  const boardHeight = 480;
  const boardWidth = 360;
  const startingLives = 1;
  const initialReplay = createInitialBreakoutReplayGame({
    boardHeight,
    boardWidth,
    seed,
    startingLives,
  });
  const random = initialReplay.random;
  const events: BreakoutReplayEvent[] = [
    {
      elapsedMs: 0,
      seq: 0,
      tick: 0,
      type: "start",
    },
  ];
  let tick = 0;
  let game = startBreakoutGame(initialReplay.game);

  while (game.status === "running" && events.length < 20_000) {
    events.push({
      elapsedMs: tick * 1_000,
      seq: events.length,
      tick,
      type: "advance",
    });
    game = advanceBreakoutGame(game, { random });
    tick += 1;
  }

  if (game.status !== "lost") {
    throw new Error(`Expected generated replay to end lost, got ${game.status}.`);
  }

  return createReplayPayload({
    boardHeight,
    boardWidth,
    events,
    finalActiveBrickCount: game.bricks.filter((brick) => brick.isActive).length,
    finalLives: game.lives,
    finalScore: game.score,
    finalStatus: game.status,
    finalTick: tick,
    leaderboardKey: createBreakoutReplayLeaderboardKey({
      boardHeight,
      boardWidth,
      startingLives,
    }),
    seed,
    startingLives,
  });
}

describe("breakout replay", () => {
  it("parses supported replay payloads and rejects malformed parameters and events", () => {
    const parsedReplay = parseBreakoutReplayPayload(createReplayPayload());

    if (!parsedReplay.success) {
      throw new Error(parsedReplay.error);
    }

    expect(parsedReplay).toMatchObject({
      payload: {
        boardHeight: 480,
        boardWidth: 360,
        events: expect.arrayContaining([
          expect.objectContaining({ type: "moveLeft" }),
          expect.objectContaining({ type: "moveRight" }),
          expect.objectContaining({ type: "advance" }),
        ]),
        finalActiveBrickCount: 12,
        finalLives: 0,
        gameId: "breakout",
        startingLives: 2,
      },
      success: true,
    });

    expect(
      parseBreakoutReplayPayload(
        createReplayPayload({
          leaderboardKey: "breakout|board=420x560|lives=2",
        }),
      ),
    ).toEqual({
      error: "Breakout replay leaderboard key is not supported.",
      success: false,
    });
    expect(
      parseBreakoutReplayPayload(
        createReplayPayload({
          boardHeight: 319,
        }),
      ),
    ).toEqual({
      error: "Breakout replay parameters are not supported.",
      success: false,
    });
    expect(
      parseBreakoutReplayPayload(
        createReplayPayload({
          events: [
            {
              seq: 0,
              tick: 0,
              type: "pause",
            } as unknown as BreakoutReplayEvent,
          ],
        }),
      ),
    ).toEqual({
      error: "Breakout replay includes an unsupported event.",
      success: false,
    });
    expect(
      parseBreakoutReplayPayload(
        createReplayPayload({
          finalLives: 1,
        }),
      ),
    ).toEqual({
      error: "Breakout replay final state is not supported.",
      success: false,
    });
  });

  it("accepts terminal won replay payloads with cleared brick counts", () => {
    const payload = createReplayPayload({
      finalActiveBrickCount: 0,
      finalLives: 2,
      finalScore: 1_500,
      finalStatus: "won",
    });

    expect(parseBreakoutReplayPayload(payload)).toMatchObject({
      payload: {
        finalActiveBrickCount: 0,
        finalLives: 2,
        finalStatus: "won",
      },
      success: true,
    });
  });

  it("applies ready paddle movement before the first start event", () => {
    const replay = createReplayPayload({
      events: [
        {
          elapsedMs: 0,
          seq: 0,
          tick: 0,
          type: "moveLeft",
        },
        {
          elapsedMs: 1,
          seq: 1,
          tick: 0,
          type: "moveLeft",
        },
        {
          elapsedMs: 2,
          seq: 2,
          tick: 0,
          type: "start",
        },
      ],
    });
    const initialReplay = createInitialBreakoutReplayGame(replay);
    const result = applyReplayEvents(
      initialReplay.game,
      replay.events,
      initialReplay.random,
    );

    expect(result.status).toBe("running");
    expect(result.paddle.x).toBeLessThan(initialReplay.game.paddle.x);
    expect(result.ball.position.x).toBe(result.paddle.x + result.paddle.width / 2);
  });

  it("replays a seeded run to the same terminal Breakout state", () => {
    const replay = createTerminalReplay(4321);
    const first = createInitialBreakoutReplayGame(replay);
    const second = createInitialBreakoutReplayGame(replay);
    const firstResult = applyReplayEvents(first.game, replay.events, first.random);
    const secondResult = applyReplayEvents(second.game, replay.events, second.random);

    expect(firstResult).toEqual(secondResult);
    expect(firstResult).toMatchObject({
      boardHeight: replay.boardHeight,
      boardWidth: replay.boardWidth,
      lives: replay.finalLives,
      score: replay.finalScore,
      startingLives: replay.startingLives,
      status: replay.finalStatus,
    });
    expect(firstResult.bricks.filter((brick) => brick.isActive)).toHaveLength(
      replay.finalActiveBrickCount,
    );
  });
});
