import { describe, expect, it } from "vitest";

import {
  advanceSnakeGame,
  BONUS_FOOD_MIN_SNAKE_DISTANCE,
  BONUS_FOOD_OBSTACLE_DISTANCE_MAX,
  BONUS_FOOD_TIMEOUT_MIN_MS,
  createInitialObstacleSafeCells,
  createInitialGame,
  expireTimedFood,
  generateObstacles,
  generateTimedFoodPosition,
  getGameTickDelay,
  getManhattanDistance,
  getPointKey,
  isSamePoint,
  OBSTACLE_CLUSTER_MAX_SIZE,
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
    obstacles: [],
    status: "running",
    ...overrides,
  };
}

function expectDifferentPoint(first: Point, second: Point) {
  expect(isSamePoint(first, second)).toBe(false);
}

function getConnectedClusters(points: Point[]) {
  const pointsByKey = new Map(points.map((point) => [getPointKey(point), point]));
  const visitedKeys = new Set<string>();
  const clusters: Point[][] = [];
  const offsets = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];

  points.forEach((point) => {
    const pointKey = getPointKey(point);

    if (visitedKeys.has(pointKey)) {
      return;
    }

    const cluster: Point[] = [];
    const pendingPoints = [point];
    visitedKeys.add(pointKey);

    while (pendingPoints.length > 0) {
      const currentPoint = pendingPoints.pop()!;
      cluster.push(currentPoint);

      offsets.forEach((offset) => {
        const neighborKey = getPointKey({
          x: currentPoint.x + offset.x,
          y: currentPoint.y + offset.y,
        });
        const neighbor = pointsByKey.get(neighborKey);

        if (neighbor === undefined || visitedKeys.has(neighborKey)) {
          return;
        }

        visitedKeys.add(neighborKey);
        pendingPoints.push(neighbor);
      });
    }

    clusters.push(cluster);
  });

  return clusters;
}

describe("snake game engine", () => {
  it("generates persistent obstacle islands away from the starting path", () => {
    const game = createInitialGame({
      boardSize: 11,
      random: createRandomSequence([0, 0, 0, 0, 0, 0, 0, 0]),
    });
    const safeCellKeys = new Set(createInitialObstacleSafeCells(game.boardSize).map(getPointKey));
    const obstacleKeys = new Set(game.obstacles.map(getPointKey));
    const clusters = getConnectedClusters(game.obstacles);

    expect(game.obstacles.length).toBeGreaterThan(0);
    expect(obstacleKeys.size).toBe(game.obstacles.length);
    expect(game.obstacles.every((obstacle) => obstacle.x > 0 && obstacle.x < game.boardSize - 1)).toBe(
      true,
    );
    expect(game.obstacles.every((obstacle) => obstacle.y > 0 && obstacle.y < game.boardSize - 1)).toBe(
      true,
    );
    expect(game.obstacles.every((obstacle) => !safeCellKeys.has(getPointKey(obstacle)))).toBe(true);
    expect(clusters.every((cluster) => cluster.length <= OBSTACLE_CLUSTER_MAX_SIZE)).toBe(true);
  });

  it("caps each generated obstacle cluster at six cells", () => {
    const obstacles = generateObstacles(
      19,
      createInitialObstacleSafeCells(19),
      createRandomSequence([0.99, 0.99, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    );
    const clusters = getConnectedClusters(obstacles);

    expect(clusters.length).toBeGreaterThan(0);
    expect(clusters.every((cluster) => cluster.length <= OBSTACLE_CLUSTER_MAX_SIZE)).toBe(true);
  });

  it("places timed food away from the snake without overlapping red food or obstacles", () => {
    const game = createInitialGame({ boardSize: 11 });
    const position = generateTimedFoodPosition(
      game.boardSize,
      game.snake,
      game.food,
      game.obstacles,
      () => 0,
    );

    expect(position).not.toBeNull();
    expect(isSamePoint(position!, game.food)).toBe(false);
    expect(game.obstacles.every((obstacle) => !isSamePoint(position!, obstacle))).toBe(true);
    expect(game.snake.every((segment) => !isSamePoint(position!, segment))).toBe(true);
    expect(
      game.snake.every(
        (segment) => getManhattanDistance(position!, segment) >= BONUS_FOOD_MIN_SNAKE_DISTANCE,
      ),
    ).toBe(true);
  });

  it("spawns yellow apples next to obstacle islands when possible", () => {
    const obstacle = { x: 8, y: 2 };
    const game = createRunningGame({
      obstacles: [obstacle],
    });

    const nextGame = spawnTimedFood(game, "bonusFood", {
      now: () => 1_000,
      random: createRandomSequence([0, 0, 0]),
    });

    expect(nextGame.bonusFood).not.toBeNull();
    expect(nextGame.bonusFood?.expiresAt).toBe(1_000 + BONUS_FOOD_TIMEOUT_MIN_MS);
    expect(nextGame.bonusFood?.position).toEqual({ x: 8, y: 1 });
    expect(getManhattanDistance(nextGame.bonusFood!.position, obstacle)).toBe(1);
    expectDifferentPoint(nextGame.bonusFood!.position, nextGame.food);
    expect(nextGame.snake.every((segment) => !isSamePoint(nextGame.bonusFood!.position, segment))).toBe(
      true,
    );
  });

  it("spawns yellow apples near obstacle islands without requiring contact", () => {
    const obstacle = { x: 8, y: 2 };
    const game = createRunningGame({
      obstacles: [obstacle],
    });

    const nextGame = spawnTimedFood(game, "bonusFood", {
      now: () => 1_000,
      random: createRandomSequence([0.99, 0, 0]),
    });

    expect(nextGame.bonusFood).not.toBeNull();
    expect(nextGame.bonusFood?.position).toEqual({ x: 7, y: 0 });
    expect(getManhattanDistance(nextGame.bonusFood!.position, obstacle)).toBeGreaterThan(1);
    expect(getManhattanDistance(nextGame.bonusFood!.position, obstacle)).toBeLessThanOrEqual(
      BONUS_FOOD_OBSTACLE_DISTANCE_MAX,
    );
    expectDifferentPoint(nextGame.bonusFood!.position, nextGame.food);
    expect(nextGame.snake.every((segment) => !isSamePoint(nextGame.bonusFood!.position, segment))).toBe(
      true,
    );
  });

  it("falls back to generic yellow apple placement when near-obstacle cells are unsafe", () => {
    const obstacle = { x: 5, y: 4 };
    const game = createRunningGame({
      obstacles: [obstacle],
    });

    const nextGame = spawnTimedFood(game, "bonusFood", {
      now: () => 1_000,
      random: createRandomSequence([0.99, 0, 0]),
    });

    expect(nextGame.bonusFood).not.toBeNull();
    expect(nextGame.bonusFood?.position).toEqual({ x: 0, y: 0 });
    expect(getManhattanDistance(nextGame.bonusFood!.position, obstacle)).toBeGreaterThan(
      BONUS_FOOD_OBSTACLE_DISTANCE_MAX,
    );
  });

  it("keeps purple diamonds on generic timed food placement near obstacle islands", () => {
    const obstacle = { x: 8, y: 2 };
    const game = createRunningGame({
      obstacles: [obstacle],
    });

    const nextGame = spawnTimedFood(game, "speedFood", {
      now: () => 1_000,
      random: createRandomSequence([0, 0]),
    });

    expect(nextGame.speedFood).not.toBeNull();
    expect(nextGame.speedFood?.position).toEqual({ x: 0, y: 0 });
    expect(getManhattanDistance(nextGame.speedFood!.position, obstacle)).not.toBe(1);
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

  it("keeps red food from respawning over obstacle islands", () => {
    const game = createRunningGame({
      food: { x: 6, y: 5 },
      obstacles: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ],
    });

    const nextGame = advanceSnakeGame(game, {
      random: () => 0,
    });

    expect(nextGame.food).toEqual({ x: 2, y: 0 });
    expect(game.obstacles.every((obstacle) => !isSamePoint(nextGame.food, obstacle))).toBe(true);
  });

  it("keeps timed food from spawning over obstacle islands", () => {
    const game = createRunningGame();
    const blockedPosition = generateTimedFoodPosition(
      game.boardSize,
      game.snake,
      game.food,
      [],
      () => 0,
    );

    expect(blockedPosition).not.toBeNull();

    const nextGame = spawnTimedFood(
      {
        ...game,
        obstacles: [blockedPosition!],
      },
      "bonusFood",
      {
        now: () => 1_000,
        random: createRandomSequence([0, 0]),
      },
    );

    expect(nextGame.bonusFood).not.toBeNull();
    expectDifferentPoint(nextGame.bonusFood!.position, blockedPosition!);
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

  it("ends the game when the snake hits an obstacle", () => {
    const game = createRunningGame({
      bonusFood: {
        expiresAt: 8_000,
        position: { x: 1, y: 1 },
      },
      food: { x: 9, y: 9 },
      obstacles: [{ x: 6, y: 5 }],
      score: 4,
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ],
      speedFood: {
        expiresAt: 9_000,
        position: { x: 2, y: 1 },
      },
    });

    const nextGame = advanceSnakeGame(game);

    expect(nextGame.status).toBe("lost");
    expect(nextGame.score).toBe(4);
    expect(nextGame.snake).toEqual(game.snake);
    expect(nextGame.obstacles).toEqual(game.obstacles);
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
