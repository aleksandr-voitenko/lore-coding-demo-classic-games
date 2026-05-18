import { describe, expect, it } from "vitest";

import {
  canMoveTwentyFortyEightGame,
  createInitialTwentyFortyEightGame,
  getTwentyFortyEightTileAt,
  getTwentyFortyEightTopTile,
  moveTwentyFortyEightGame,
  restartTwentyFortyEightGame,
  startTwentyFortyEightGame,
  TWENTY_FORTY_EIGHT_BOARD_SIZE,
  TWENTY_FORTY_EIGHT_STARTING_TILE_COUNT,
  type TwentyFortyEightDirection,
  type TwentyFortyEightGameState,
  type TwentyFortyEightTile,
} from "./twenty-forty-eight-game-engine";

function randomSequence(values: number[]) {
  let index = 0;

  return () => values[index++] ?? 0;
}

function createGame(
  tiles: Array<Pick<TwentyFortyEightTile, "value" | "x" | "y">>,
  overrides: Partial<TwentyFortyEightGameState> = {},
): TwentyFortyEightGameState {
  return {
    bestScore: 0,
    moveCount: 0,
    nextTileId: tiles.length + 1,
    score: 0,
    status: "running",
    tiles: tiles.map((tile, index) => ({
      id: `tile-${index + 1}`,
      ...tile,
    })),
    ...overrides,
  };
}

function move(
  game: TwentyFortyEightGameState,
  direction: TwentyFortyEightDirection,
  random = randomSequence([0, 0]),
) {
  return moveTwentyFortyEightGame(game, direction, { random });
}

function valuesByRow(game: TwentyFortyEightGameState) {
  return Array.from({ length: TWENTY_FORTY_EIGHT_BOARD_SIZE }, (_, y) =>
    Array.from(
      { length: TWENTY_FORTY_EIGHT_BOARD_SIZE },
      (_, x) => getTwentyFortyEightTileAt(game, x, y)?.value ?? 0,
    ),
  );
}

describe("twenty forty eight game engine", () => {
  it("creates a ready board with two deterministic starting tiles", () => {
    const game = createInitialTwentyFortyEightGame({
      random: randomSequence([0, 0, 0, 0.95]),
    });

    expect(game.status).toBe("ready");
    expect(game.score).toBe(0);
    expect(game.bestScore).toBe(0);
    expect(game.moveCount).toBe(0);
    expect(game.nextTileId).toBe(TWENTY_FORTY_EIGHT_STARTING_TILE_COUNT + 1);
    expect(valuesByRow(game)).toEqual([
      [2, 4, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
  });

  it("starts from ready without replacing the board", () => {
    const readyGame = createInitialTwentyFortyEightGame({
      random: randomSequence([0, 0, 0, 0]),
    });
    const runningGame = startTwentyFortyEightGame(readyGame);

    expect(runningGame.status).toBe("running");
    expect(runningGame.tiles).toBe(readyGame.tiles);
  });

  it("slides and merges each row toward the left once per tile", () => {
    const game = createGame([
      { value: 2, x: 0, y: 0 },
      { value: 2, x: 1, y: 0 },
      { value: 2, x: 2, y: 0 },
      { value: 2, x: 3, y: 0 },
      { value: 4, x: 0, y: 1 },
      { value: 4, x: 2, y: 1 },
    ]);
    const moved = move(game, "left", randomSequence([0.999, 0]));

    expect(moved.score).toBe(16);
    expect(moved.bestScore).toBe(16);
    expect(moved.moveCount).toBe(1);
    expect(valuesByRow(moved)).toEqual([
      [4, 4, 0, 0],
      [8, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 2],
    ]);
  });

  it("slides and merges toward the right using the movement edge as the merge target", () => {
    const game = createGame([
      { value: 2, x: 0, y: 0 },
      { value: 2, x: 1, y: 0 },
      { value: 2, x: 2, y: 0 },
    ]);
    const moved = move(game, "right", randomSequence([0, 0]));

    expect(moved.score).toBe(4);
    expect(valuesByRow(moved)).toEqual([
      [2, 0, 2, 4],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
  });

  it("slides and merges vertically", () => {
    const game = createGame([
      { value: 2, x: 0, y: 0 },
      { value: 2, x: 0, y: 2 },
      { value: 4, x: 1, y: 1 },
      { value: 4, x: 1, y: 3 },
    ]);
    const moved = move(game, "up", randomSequence([0.999, 0.95]));

    expect(moved.score).toBe(12);
    expect(valuesByRow(moved)).toEqual([
      [4, 8, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 4],
    ]);
  });

  it("does not spawn a tile or count a move when the board does not change", () => {
    const game = createGame([
      { value: 2, x: 0, y: 0 },
      { value: 4, x: 1, y: 0 },
    ]);
    const moved = move(game, "left", randomSequence([0, 0]));

    expect(moved).toBe(game);
    expect(moved.tiles).toHaveLength(2);
    expect(moved.moveCount).toBe(0);
  });

  it("wins when a move creates a 2048 tile", () => {
    const game = createGame([
      { value: 1024, x: 0, y: 0 },
      { value: 1024, x: 1, y: 0 },
    ]);
    const moved = move(game, "left", randomSequence([0, 0]));

    expect(moved.status).toBe("won");
    expect(moved.score).toBe(2048);
    expect(getTwentyFortyEightTopTile(moved)).toBe(2048);
  });

  it("loses when the board is full and no adjacent tiles can merge", () => {
    const game = createGame([
      { value: 2, x: 0, y: 0 },
      { value: 4, x: 1, y: 0 },
      { value: 2, x: 2, y: 0 },
      { value: 4, x: 3, y: 0 },
      { value: 4, x: 0, y: 1 },
      { value: 2, x: 1, y: 1 },
      { value: 4, x: 2, y: 1 },
      { value: 2, x: 3, y: 1 },
      { value: 2, x: 0, y: 2 },
      { value: 4, x: 1, y: 2 },
      { value: 2, x: 2, y: 2 },
      { value: 4, x: 3, y: 2 },
      { value: 4, x: 0, y: 3 },
      { value: 2, x: 1, y: 3 },
      { value: 4, x: 2, y: 3 },
      { value: 2, x: 3, y: 3 },
    ]);
    const moved = move(game, "left", randomSequence([0, 0]));

    expect(canMoveTwentyFortyEightGame(game)).toBe(false);
    expect(moved.status).toBe("lost");
    expect(moved.tiles).toBe(game.tiles);
  });

  it("loses after a valid move when the spawned tile leaves no remaining moves", () => {
    const game = createGame([
      { value: 2, x: 0, y: 0 },
      { value: 2, x: 1, y: 0 },
      { value: 8, x: 2, y: 0 },
      { value: 16, x: 3, y: 0 },
      { value: 8, x: 0, y: 1 },
      { value: 16, x: 1, y: 1 },
      { value: 32, x: 2, y: 1 },
      { value: 4, x: 3, y: 1 },
      { value: 4, x: 0, y: 2 },
      { value: 8, x: 1, y: 2 },
      { value: 16, x: 2, y: 2 },
      { value: 32, x: 3, y: 2 },
      { value: 16, x: 0, y: 3 },
      { value: 32, x: 1, y: 3 },
      { value: 4, x: 2, y: 3 },
      { value: 8, x: 3, y: 3 },
    ]);
    const moved = move(game, "left", randomSequence([0, 0]));

    expect(moved.status).toBe("lost");
    expect(moved.score).toBe(4);
    expect(valuesByRow(moved)).toEqual([
      [4, 8, 16, 2],
      [8, 16, 32, 4],
      [4, 8, 16, 32],
      [16, 32, 4, 8],
    ]);
  });

  it("restarts to a ready board while preserving the best score", () => {
    const game = createGame([], {
      bestScore: 512,
      score: 128,
      status: "lost",
    });
    const restarted = restartTwentyFortyEightGame(game, {
      random: randomSequence([0, 0, 0, 0.95]),
    });

    expect(restarted.status).toBe("ready");
    expect(restarted.score).toBe(0);
    expect(restarted.bestScore).toBe(512);
    expect(restarted.moveCount).toBe(0);
    expect(valuesByRow(restarted)).toEqual([
      [2, 4, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
  });
});
