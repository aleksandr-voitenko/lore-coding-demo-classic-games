import { describe, expect, it } from "vitest";

import {
  advanceSnakeGame,
  BONUS_FOOD_MIN_SNAKE_DISTANCE,
  BONUS_FOOD_TIMEOUT_MIN_MS,
  createInitialGame,
  expireTimedFood,
  generateTimedFoodPosition,
  getGameTickDelay,
  getManhattanDistance,
  isSamePoint,
  spawnTimedFood,
  type GameState,
  type Point,
} from "./snake-game-engine";

function createRandomSequence(values: number[]) {
  let index = 0;

  return () => values[Math.min(index++, values.length - 1)] ?? 0;
}

function createRunningGame(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createInitialGame({ boardSize: 11 }),
    status: "running",
    ...overrides,
  };
}

function expectDifferentPoint(first: Point, second: Point) {
  expect(isSamePoint(first, second)).toBe(false);
}

describe("snake game engine", () => {
  it("places timed food away from the snake without overlapping red food", () => {
    const game = createInitialGame({ boardSize: 11 });
    const position = generateTimedFoodPosition(
      game.boardSize,
      game.snake,
      game.food,
      [],
      () => 0,
    );

    expect(position).not.toBeNull();
    expect(isSamePoint(position!, game.food)).toBe(false);
    expect(game.snake.every((segment) => !isSamePoint(position!, segment))).toBe(true);
    expect(
      game.snake.every(
        (segment) => getManhattanDistance(position!, segment) >= BONUS_FOOD_MIN_SNAKE_DISTANCE,
      ),
    ).toBe(true);
  });

  it("spawns purple diamonds with deterministic timing and avoids active yellow apples", () => {
    const game = createRunningGame();
    const firstEligiblePosition = generateTimedFoodPosition(
      game.boardSize,
      game.snake,
      game.food,
      [],
      () => 0,
    );

    expect(firstEligiblePosition).not.toBeNull();

    const withYellowApple = {
      ...game,
      bonusFood: {
        expiresAt: 9_000,
        position: firstEligiblePosition!,
      },
    };

    const nextGame = spawnTimedFood(withYellowApple, "speedFood", {
      now: () => 1_000,
      random: createRandomSequence([0, 0]),
    });

    expect(nextGame.speedFood).not.toBeNull();
    expect(nextGame.speedFood?.expiresAt).toBe(1_000 + BONUS_FOOD_TIMEOUT_MIN_MS);
    expectDifferentPoint(nextGame.speedFood!.position, firstEligiblePosition!);
    expectDifferentPoint(nextGame.speedFood!.position, nextGame.food);
    expect(nextGame.snake.every((segment) => !isSamePoint(nextGame.speedFood!.position, segment))).toBe(
      true,
    );
  });

  it("eating a purple diamond scores 3, grows, clears it, and increases speed", () => {
    const game = createRunningGame({
      food: { x: 9, y: 9 },
      score: 0,
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ],
      speedFood: {
        expiresAt: 9_000,
        position: { x: 6, y: 5 },
      },
    });
    const initialSpeed = getGameTickDelay(game);

    const nextGame = advanceSnakeGame(game);

    expect(nextGame.score).toBe(3);
    expect(nextGame.snake).toHaveLength(game.snake.length + 1);
    expect(nextGame.snake[0]).toEqual({ x: 6, y: 5 });
    expect(nextGame.speedFood).toBeNull();
    expect(nextGame.speedBoosts).toBe(1);
    expect(getGameTickDelay(nextGame)).toBeLessThan(initialSpeed!);
  });

  it("expires purple diamonds only when the matching timeout is current", () => {
    const game = createRunningGame({
      speedFood: {
        expiresAt: 7_000,
        position: { x: 1, y: 1 },
      },
    });

    expect(expireTimedFood(game, "speedFood", 6_999).speedFood).toEqual(game.speedFood);
    expect(expireTimedFood(game, "speedFood", 7_000).speedFood).toBeNull();
  });

  it("clears active timed foods on game over", () => {
    const game = createRunningGame({
      bonusFood: {
        expiresAt: 8_000,
        position: { x: 1, y: 1 },
      },
      food: { x: 1, y: 9 },
      snake: [
        { x: 10, y: 5 },
        { x: 9, y: 5 },
        { x: 8, y: 5 },
      ],
      speedFood: {
        expiresAt: 9_000,
        position: { x: 2, y: 1 },
      },
    });

    const nextGame = advanceSnakeGame(game);

    expect(nextGame.status).toBe("lost");
    expect(nextGame.bonusFood).toBeNull();
    expect(nextGame.speedFood).toBeNull();
  });

  it("keeps red food from respawning over active yellow apples or purple diamonds", () => {
    const game = createRunningGame({
      bonusFood: {
        expiresAt: 8_000,
        position: { x: 0, y: 0 },
      },
      food: { x: 6, y: 5 },
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ],
      speedFood: {
        expiresAt: 9_000,
        position: { x: 1, y: 0 },
      },
    });

    const nextGame = advanceSnakeGame(game, {
      random: () => 0,
    });

    expect(nextGame.food).toEqual({ x: 2, y: 0 });
    expectDifferentPoint(nextGame.food, game.bonusFood!.position);
    expectDifferentPoint(nextGame.food, game.speedFood!.position);
  });
});
