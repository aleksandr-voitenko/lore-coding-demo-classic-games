import { describe, expect, it } from "vitest";

import {
  applySnakeReplayEvent,
  createInitialSnakeReplayGame,
  parseSnakeReplayPayload,
  SNAKE_REPLAY_SCHEMA_VERSION,
  type SnakeReplayPayload,
} from "./snake-replay";

function createReplayPayload(overrides: Partial<SnakeReplayPayload> = {}): SnakeReplayPayload {
  return {
    events: [
      {
        seq: 0,
        tick: 0,
        type: "start",
      },
      {
        direction: "down",
        seq: 1,
        tick: 0,
        type: "direction",
      },
      {
        seq: 2,
        tick: 0,
        type: "advance",
      },
    ],
    finalLevel: 1,
    finalScore: 0,
    finalStatus: "lost",
    finalTick: 1,
    gameId: "snake",
    leaderboardKey: "snake|mode=levels",
    runId: "run-1",
    schemaVersion: SNAKE_REPLAY_SCHEMA_VERSION,
    seed: 1234,
    startedAt: "2026-06-08T12:00:00.000Z",
    ...overrides,
  };
}

describe("snake replay", () => {
  it("parses supported replay payloads and rejects malformed events", () => {
    expect(parseSnakeReplayPayload(createReplayPayload())).toMatchObject({
      payload: {
        events: [
          {
            type: "start",
          },
          {
            direction: "down",
            type: "direction",
          },
          {
            type: "advance",
          },
        ],
        seed: 1234,
      },
      success: true,
    });
    expect(
      parseSnakeReplayPayload(
        createReplayPayload({
          events: [
            {
              direction: "north",
              seq: 0,
              tick: 0,
              type: "direction",
            } as never,
          ],
        }),
      ),
    ).toEqual({
      error: "Snake replay includes an unsupported event.",
      success: false,
    });
    expect(parseSnakeReplayPayload({})).toEqual({
      error: "Snake replay version is not supported.",
      success: false,
    });
  });

  it("rebuilds deterministic game states by applying recorded events with the seed", () => {
    const replay = createReplayPayload();
    const first = createInitialSnakeReplayGame(replay);
    const second = createInitialSnakeReplayGame(replay);

    const firstResult = replay.events.reduce(
      (game, event) => applySnakeReplayEvent(game, event, first.random),
      first.game,
    );
    const secondResult = replay.events.reduce(
      (game, event) => applySnakeReplayEvent(game, event, second.random),
      second.game,
    );

    expect(firstResult).toEqual(secondResult);
    expect(firstResult.snake[0]).toEqual({ x: 6, y: 7 });
  });
});
