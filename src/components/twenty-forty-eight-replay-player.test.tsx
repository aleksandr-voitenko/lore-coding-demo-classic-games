import { describe, expect, it } from "vitest";

import { advanceTwentyFortyEightReplayFrame } from "./twenty-forty-eight-replay-player";
import {
  getTwentyFortyEightTopTile,
  type TwentyFortyEightDirection,
  type TwentyFortyEightGameState,
  type TwentyFortyEightTile,
} from "@/lib/twenty-forty-eight-game-engine";
import {
  createInitialTwentyFortyEightReplayGame,
  type TwentyFortyEightReplayEvent,
} from "@/lib/twenty-forty-eight-replay";

function createGame(
  tiles: Array<Pick<TwentyFortyEightTile, "value" | "x" | "y">>,
  overrides: Partial<TwentyFortyEightGameState> = {},
): TwentyFortyEightGameState {
  const boardSize = overrides.boardSize ?? 4;
  const winTile = overrides.winTile ?? 2048;

  return {
    bestScore: 0,
    boardSize,
    moveCount: 0,
    nextTileId: tiles.length + 1,
    score: 0,
    status: "running",
    tiles: tiles.map((tile, index) => ({
      id: `tile-${index + 1}`,
      ...tile,
    })),
    winTile,
    ...overrides,
  };
}

function randomSequence(values: number[]) {
  let index = 0;

  return () => values[index++] ?? 0;
}

function createMoveEvents(directions: TwentyFortyEightDirection[]) {
  return [
    {
      seq: 0,
      tick: 0,
      type: "start" as const,
    },
    ...directions.map((direction, index) => ({
      direction,
      seq: index + 1,
      tick: index,
      type: "move" as const,
    })),
  ];
}

describe("advanceTwentyFortyEightReplayFrame", () => {
  it("skips no-op replay moves until the next visible board change", () => {
    const game = createGame([
      { value: 2, x: 0, y: 0 },
      { value: 4, x: 1, y: 0 },
    ]);
    const events = createMoveEvents(["left", "right"]);

    const frame = advanceTwentyFortyEightReplayFrame({
      eventIndex: 0,
      events,
      game,
      random: randomSequence([0, 0]),
    });

    expect(frame.eventIndex).toBe(3);
    expect(frame.game).not.toBe(game);
    expect(frame.game).toMatchObject({
      moveCount: 1,
      status: "running",
    });
    expect(frame.isFinished).toBe(true);
  });

  it("finishes playback when only no-op replay moves remain", () => {
    const game = createGame([
      { value: 2, x: 0, y: 0 },
      { value: 4, x: 1, y: 0 },
    ]);
    const events = createMoveEvents(["left"]);

    const frame = advanceTwentyFortyEightReplayFrame({
      eventIndex: 0,
      events,
      game,
      random: randomSequence([0, 0]),
    });

    expect(frame.eventIndex).toBe(2);
    expect(frame.game).toBe(game);
    expect(frame.isFinished).toBe(true);
  });

  it("plays the saved fast-input loss through to completion", () => {
    const directions: TwentyFortyEightDirection[] = [
      "down",
      "down",
      "down",
      "left",
      "down",
      "left",
      "right",
      "up",
      "up",
      "down",
      "left",
      "down",
      "right",
      "right",
      "up",
      "right",
      "right",
      "down",
      "up",
      "right",
      "down",
      "right",
      "down",
      "right",
      "right",
      "left",
      "down",
      "down",
      "left",
      "up",
      "down",
      "left",
      "right",
      "left",
      "up",
      "right",
      "down",
      "right",
      "up",
      "left",
      "right",
      "right",
      "up",
      "left",
      "right",
      "down",
      "left",
      "right",
      "up",
      "left",
      "up",
      "right",
      "down",
      "left",
      "up",
      "right",
      "up",
      "left",
      "left",
      "right",
      "left",
      "right",
      "down",
      "left",
      "right",
      "left",
      "up",
      "right",
      "left",
      "down",
      "right",
      "up",
      "down",
      "up",
      "left",
      "down",
      "up",
      "down",
      "down",
      "up",
      "up",
      "down",
      "up",
      "down",
      "up",
      "left",
      "down",
      "right",
      "up",
      "left",
      "right",
      "left",
      "right",
      "up",
      "down",
      "left",
      "down",
      "up",
      "right",
      "left",
      "right",
      "up",
      "left",
      "right",
      "up",
      "left",
      "right",
      "left",
    ];
    const events: TwentyFortyEightReplayEvent[] = createMoveEvents(directions);
    const initialReplay = createInitialTwentyFortyEightReplayGame({
      boardSize: 4,
      seed: 31761357,
      winTile: 2048,
    });
    let eventIndex = 0;
    let game = initialReplay.game;
    let isFinished = false;

    while (!isFinished) {
      const frame = advanceTwentyFortyEightReplayFrame({
        eventIndex,
        events,
        game,
        random: initialReplay.random,
      });

      eventIndex = frame.eventIndex;
      game = frame.game;
      isFinished = frame.isFinished;
    }

    expect(eventIndex).toBe(events.length);
    expect(game).toMatchObject({
      moveCount: 105,
      score: 852,
      status: "lost",
    });
    expect(getTwentyFortyEightTopTile(game)).toBe(64);
  });
});
