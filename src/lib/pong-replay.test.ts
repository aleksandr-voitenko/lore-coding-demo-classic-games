import { describe, expect, it } from "vitest";

import { withReplayElapsed } from "./game-replay.test-helpers";
import {
  advancePongGame,
  decrementPongRemainingScore,
  startPongGame,
  type PongGameState,
} from "./pong-game-engine";
import {
  applyPongReplayEvent,
  createInitialPongReplayGame,
  createPongReplayLeaderboardKey,
  parsePongReplayPayload,
  PONG_REPLAY_SCHEMA_VERSION,
  type PongReplayEvent,
  type PongReplayPayload,
} from "./pong-replay";

function createReplayPayload(
  overrides: Partial<PongReplayPayload> = {},
): PongReplayPayload {
  const boardHeight = overrides.boardHeight ?? 480;
  const boardWidth = overrides.boardWidth ?? 360;
  const targetScore = overrides.targetScore ?? 3;

  const payload = {
    boardHeight,
    boardWidth,
    events: [
      {
        seq: 0,
        tick: 0,
        type: "moveUp",
      },
      {
        seq: 1,
        tick: 0,
        type: "start",
      },
      {
        seq: 2,
        tick: 0,
        type: "moveDown",
      },
      {
        seq: 3,
        tick: 0,
        type: "advance",
      },
      {
        seq: 4,
        tick: 1,
        type: "scoreTick",
      },
    ],
    finalCpuScore: 3,
    finalPlayerScore: 1,
    finalScore: 380,
    finalStatus: "lost",
    finalTick: 1,
    gameId: "pong",
    leaderboardKey: createPongReplayLeaderboardKey({
      boardHeight,
      boardWidth,
      targetScore,
    }),
    runId: "run-1",
    schemaVersion: PONG_REPLAY_SCHEMA_VERSION,
    seed: 1234,
    startedAt: "2026-06-08T12:00:00.000Z",
    targetScore,
    ...overrides,
  };

  return {
    ...payload,
    events: withReplayElapsed(payload.events),
  } as PongReplayPayload;
}

function applyReplayEvents(game: PongGameState, events: PongReplayEvent[]) {
  return events.reduce((current, event) => applyPongReplayEvent(current, event), game);
}

function createTerminalReplay() {
  const boardHeight = 480;
  const boardWidth = 360;
  const targetScore = 1;
  const initialReplay = createInitialPongReplayGame({
    boardHeight,
    boardWidth,
    targetScore,
  });
  const events: PongReplayEvent[] = [
    {
      elapsedMs: 0,
      seq: 0,
      tick: 0,
      type: "start",
    },
  ];
  let advanceTick = 0;
  let game = startPongGame(initialReplay.game);

  while (game.status !== "lost" && game.status !== "won" && events.length < 20_000) {
    if (game.status === "ready") {
      events.push({
        elapsedMs: advanceTick * 1_000,
        seq: events.length,
        tick: advanceTick,
        type: "start",
      });
      game = startPongGame(game);
      continue;
    }

    events.push({
      elapsedMs: advanceTick * 1_000,
      seq: events.length,
      tick: advanceTick,
      type: "advance",
    });
    game = advancePongGame(game);
    advanceTick += 1;

    if (game.status === "running" && advanceTick % 63 === 0) {
      events.push({
        elapsedMs: advanceTick * 1_000,
        seq: events.length,
        tick: advanceTick,
        type: "scoreTick",
      });
      game = decrementPongRemainingScore(game);
    }
  }

  if (game.status !== "lost" && game.status !== "won") {
    throw new Error(`Expected generated replay to finish, got ${game.status}.`);
  }

  return createReplayPayload({
    boardHeight,
    boardWidth,
    events,
    finalCpuScore: game.score.cpu,
    finalPlayerScore: game.score.player,
    finalScore: game.remainingScore,
    finalStatus: game.status,
    finalTick: advanceTick,
    leaderboardKey: createPongReplayLeaderboardKey({
      boardHeight,
      boardWidth,
      targetScore,
    }),
    targetScore,
  });
}

describe("pong replay", () => {
  it("parses supported replay payloads and rejects malformed parameters and events", () => {
    const parsedReplay = parsePongReplayPayload(createReplayPayload());

    if (!parsedReplay.success) {
      throw new Error(parsedReplay.error);
    }

    expect(parsedReplay).toMatchObject({
      payload: {
        boardHeight: 480,
        boardWidth: 360,
        events: expect.arrayContaining([
          expect.objectContaining({ type: "moveUp" }),
          expect.objectContaining({ type: "moveDown" }),
          expect.objectContaining({ type: "scoreTick" }),
        ]),
        finalCpuScore: 3,
        finalPlayerScore: 1,
        gameId: "pong",
        targetScore: 3,
      },
      success: true,
    });

    expect(
      parsePongReplayPayload(
        createReplayPayload({
          leaderboardKey: "pong|board=420x560|target=3",
        }),
      ),
    ).toEqual({
      error: "Pong replay leaderboard key is not supported.",
      success: false,
    });
    expect(
      parsePongReplayPayload(
        createReplayPayload({
          boardHeight: 319,
        }),
      ),
    ).toEqual({
      error: "Pong replay parameters are not supported.",
      success: false,
    });
    expect(
      parsePongReplayPayload(
        createReplayPayload({
          events: [
            {
              seq: 0,
              tick: 0,
              type: "pause",
            } as unknown as PongReplayEvent,
          ],
        }),
      ),
    ).toEqual({
      error: "Pong replay includes an unsupported event.",
      success: false,
    });
    expect(
      parsePongReplayPayload(
        createReplayPayload({
          finalCpuScore: 2,
        }),
      ),
    ).toEqual({
      error: "Pong replay final state is not supported.",
      success: false,
    });
  });

  it("accepts terminal won replay payloads with player target scores", () => {
    const payload = createReplayPayload({
      finalCpuScore: 1,
      finalPlayerScore: 3,
      finalScore: 525,
      finalStatus: "won",
    });

    expect(parsePongReplayPayload(payload)).toMatchObject({
      payload: {
        finalCpuScore: 1,
        finalPlayerScore: 3,
        finalStatus: "won",
      },
      success: true,
    });
  });

  it("applies ready paddle movement and score countdown events", () => {
    const replay = createReplayPayload({
      events: [
        {
          elapsedMs: 0,
          seq: 0,
          tick: 0,
          type: "moveUp",
        },
        {
          elapsedMs: 1,
          seq: 1,
          tick: 0,
          type: "moveUp",
        },
        {
          elapsedMs: 2,
          seq: 2,
          tick: 0,
          type: "start",
        },
        {
          elapsedMs: 3,
          seq: 3,
          tick: 0,
          type: "scoreTick",
        },
      ],
    });
    const initialReplay = createInitialPongReplayGame(replay);
    const result = applyReplayEvents(initialReplay.game, replay.events);

    expect(result.status).toBe("running");
    expect(result.playerPaddle.y).toBeLessThan(initialReplay.game.playerPaddle.y);
    expect(result.remainingScore).toBe(initialReplay.game.remainingScore - 5);
  });

  it("replays a generated terminal run to the same final Pong state", () => {
    const replay = createTerminalReplay();
    const first = createInitialPongReplayGame(replay);
    const second = createInitialPongReplayGame(replay);
    const firstResult = applyReplayEvents(first.game, replay.events);
    const secondResult = applyReplayEvents(second.game, replay.events);

    expect(firstResult).toEqual(secondResult);
    expect(firstResult).toMatchObject({
      boardHeight: replay.boardHeight,
      boardWidth: replay.boardWidth,
      remainingScore: replay.finalScore,
      score: {
        cpu: replay.finalCpuScore,
        player: replay.finalPlayerScore,
      },
      status: replay.finalStatus,
      targetScore: replay.targetScore,
    });
  });
});
