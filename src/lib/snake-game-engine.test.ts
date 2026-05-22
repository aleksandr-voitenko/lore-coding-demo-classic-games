import { describe, expect, it } from "vitest";

import {
  advanceSnakeGame,
  BONUS_FOOD_MIN_SNAKE_DISTANCE,
  BONUS_FOOD_OBSTACLE_DISTANCE_MAX,
  BONUS_FOOD_SPAWN_DELAY_MIN_MS,
  BONUS_FOOD_TIMEOUT_MIN_MS,
  createBoardCells,
  createInitialObstacleSafeCells,
  createInitialGame,
  expireTimedFood,
  generateFood,
  generateObstacles,
  generateTimedFoodPosition,
  getGameSpeed,
  getGameTickDelay,
  getManhattanDistance,
  getPointKey,
  getTimedFoodSpawnDelay,
  isSamePoint,
  MIN_SNAKE_LENGTH,
  OBSTACLE_CLUSTER_MAX_SIZE,
  OBSTACLE_CLUSTER_MIN_SIZE,
  OBSTACLE_FIELD_COVERAGE_RATIO,
  SHRINK_FOOD_SCORE,
  SHRINK_FOOD_TAIL_TRIM,
  SLOW_FOOD_TIMEOUT_MIN_MS,
  spawnTimedFood,
  STARTING_GAME_SPEED,
  TIMED_FOOD_KINDS,
  TIMED_FOOD_RULES,
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

function expectPoint(point: Point | null): asserts point is Point {
  expect(point).not.toBeNull();
}

function expectDifferentPoint(first: Point | null, second: Point | null) {
  expectPoint(first);
  expectPoint(second);
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

function getObstacleCellBudget(boardSize: number) {
  return Math.floor(boardSize * boardSize * OBSTACLE_FIELD_COVERAGE_RATIO);
}

describe("snake game engine", () => {
  it("keeps timed food rules aligned with timed food kinds", () => {
    expect(Object.keys(TIMED_FOOD_RULES)).toEqual([...TIMED_FOOD_KINDS]);
    expect(TIMED_FOOD_RULES.bonusFood).toMatchObject({
      label: "Yellow apple",
      lengthEffect: {
        amount: 1,
        direction: "grow",
      },
      preferredObstacleDistanceMax: BONUS_FOOD_OBSTACLE_DISTANCE_MAX,
      score: 2,
      timeoutMinMs: BONUS_FOOD_TIMEOUT_MIN_MS,
    });
    expect(TIMED_FOOD_RULES.speedFood).toMatchObject({
      label: "Purple diamond",
      lengthEffect: {
        amount: 1,
        direction: "grow",
      },
      score: 3,
      speedEffect: {
        amount: 1,
        direction: "increase",
      },
      timeoutMinMs: BONUS_FOOD_TIMEOUT_MIN_MS,
    });
    expect(TIMED_FOOD_RULES.slowFood).toMatchObject({
      label: "Blue triangle",
      lengthEffect: {
        amount: 1,
        direction: "grow",
      },
      score: 1,
      speedEffect: {
        amount: 1,
        direction: "decrease",
      },
      timeoutMinMs: SLOW_FOOD_TIMEOUT_MIN_MS,
    });
    expect(TIMED_FOOD_RULES.shrinkFood).toMatchObject({
      label: "Cyan hexagon",
      lengthEffect: {
        amount: SHRINK_FOOD_TAIL_TRIM,
        direction: "shrink",
      },
      score: SHRINK_FOOD_SCORE,
      timeoutMinMs: BONUS_FOOD_TIMEOUT_MIN_MS,
    });
    expect(getTimedFoodSpawnDelay("bonusFood", () => 0)).toBe(BONUS_FOOD_SPAWN_DELAY_MIN_MS);
    expect(getTimedFoodSpawnDelay("shrinkFood", () => 0)).toBe(
      BONUS_FOOD_SPAWN_DELAY_MIN_MS,
    );
  });

  it("randomizes the first red food with the initial-game random source", () => {
    const lowFoodGame = createInitialGame({
      boardSize: 11,
      random: createRandomSequence([0, 0, 0, 0, 0, 0, 0, 0]),
    });
    const middleFoodGame = createInitialGame({
      boardSize: 11,
      random: createRandomSequence([0.5, 0, 0, 0, 0, 0, 0, 0]),
    });

    expect(lowFoodGame.food).toEqual({ x: 0, y: 0 });
    expect(middleFoodGame.food).toEqual({ x: 7, y: 5 });
    const lowFood = lowFoodGame.food;
    const middleFood = middleFoodGame.food;
    expectPoint(lowFood);
    expectPoint(middleFood);
    expectDifferentPoint(lowFood, middleFood);
    [lowFoodGame, middleFoodGame].forEach((game) => {
      const food = game.food;
      expectPoint(food);
      expect(game.snake.every((segment) => !isSamePoint(food, segment))).toBe(true);
      expect(game.obstacles.every((obstacle) => !isSamePoint(food, obstacle))).toBe(true);
    });
  });

  it("returns no red-food position when every board cell is occupied", () => {
    expect(generateFood(3, createBoardCells(3), [], () => 0)).toBeNull();
  });

  it("starts running games one speed unit slower before score-based acceleration", () => {
    const game = createRunningGame();

    expect(getGameSpeed(game)).toBe(STARTING_GAME_SPEED);
    expect(getGameSpeed({ ...game, score: 3 })).toBe(STARTING_GAME_SPEED);
    expect(getGameSpeed({ ...game, score: 4 })).toBe(STARTING_GAME_SPEED + 1);
  });

  it("generates persistent obstacle islands away from the starting path", () => {
    const game = createInitialGame({
      boardSize: 11,
      random: createRandomSequence([0, 0, 0, 0, 0, 0, 0, 0]),
    });
    const food = game.food;
    expectPoint(food);
    const safeCellKeys = new Set(
      createInitialObstacleSafeCells(game.boardSize, food).map(getPointKey),
    );
    const obstacleKeys = new Set(game.obstacles.map(getPointKey));
    const clusters = getConnectedClusters(game.obstacles);
    const obstacleCellBudget = getObstacleCellBudget(game.boardSize);

    expect(game.obstacles.length).toBeGreaterThan(0);
    expect(game.obstacles.length).toBeLessThanOrEqual(obstacleCellBudget);
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

  it("scales generated obstacle cells to the configured field coverage", () => {
    const smallBoardSize = 11;
    const largeBoardSize = 25;
    const smallObstacles = generateObstacles(
      smallBoardSize,
      createInitialObstacleSafeCells(smallBoardSize),
      createRandomSequence([0]),
    );
    const largeObstacles = generateObstacles(
      largeBoardSize,
      createInitialObstacleSafeCells(largeBoardSize),
      createRandomSequence([0]),
    );
    const smallBudget = getObstacleCellBudget(smallBoardSize);
    const largeBudget = getObstacleCellBudget(largeBoardSize);
    const smallCoverage = smallObstacles.length / (smallBoardSize * smallBoardSize);
    const largeCoverage = largeObstacles.length / (largeBoardSize * largeBoardSize);

    expect(smallObstacles.length).toBeLessThan(largeObstacles.length);
    expect(smallObstacles.length).toBeLessThanOrEqual(smallBudget);
    expect(largeObstacles.length).toBeLessThanOrEqual(largeBudget);
    expect(smallBudget - smallObstacles.length).toBeLessThan(OBSTACLE_CLUSTER_MIN_SIZE);
    expect(largeBudget - largeObstacles.length).toBeLessThan(OBSTACLE_CLUSTER_MIN_SIZE);
    expect(Math.abs(smallCoverage - largeCoverage)).toBeLessThan(0.01);
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
    const food = game.food;
    expectPoint(food);
    const position = generateTimedFoodPosition(
      game.boardSize,
      game.snake,
      food,
      game.obstacles,
      () => 0,
    );

    expect(position).not.toBeNull();
    expect(isSamePoint(position!, food)).toBe(false);
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

  it("spawns blue triangles briefly and avoids active timed foods", () => {
    const game = createRunningGame();
    const firstEligiblePosition = generateTimedFoodPosition(
      game.boardSize,
      game.snake,
      game.food,
      [],
      () => 0,
    );

    expect(firstEligiblePosition).not.toBeNull();

    const secondEligiblePosition = generateTimedFoodPosition(
      game.boardSize,
      game.snake,
      game.food,
      [firstEligiblePosition!],
      () => 0,
    );

    expect(secondEligiblePosition).not.toBeNull();

    const nextGame = spawnTimedFood(
      {
        ...game,
        bonusFood: {
          expiresAt: 8_000,
          position: firstEligiblePosition!,
        },
        speedFood: {
          expiresAt: 9_000,
          position: secondEligiblePosition!,
        },
      },
      "slowFood",
      {
        now: () => 1_000,
        random: createRandomSequence([0, 0]),
      },
    );

    expect(nextGame.slowFood).not.toBeNull();
    expect(nextGame.slowFood?.expiresAt).toBe(1_000 + SLOW_FOOD_TIMEOUT_MIN_MS);
    expectDifferentPoint(nextGame.slowFood!.position, firstEligiblePosition!);
    expectDifferentPoint(nextGame.slowFood!.position, secondEligiblePosition!);
    expectDifferentPoint(nextGame.slowFood!.position, nextGame.food);
    expect(nextGame.snake.every((segment) => !isSamePoint(nextGame.slowFood!.position, segment))).toBe(
      true,
    );
  });

  it("spawns cyan hexagons with deterministic timing and avoids active timed foods", () => {
    const game = createRunningGame();
    const firstEligiblePosition = generateTimedFoodPosition(
      game.boardSize,
      game.snake,
      game.food,
      [],
      () => 0,
    );

    expect(firstEligiblePosition).not.toBeNull();

    const secondEligiblePosition = generateTimedFoodPosition(
      game.boardSize,
      game.snake,
      game.food,
      [firstEligiblePosition!],
      () => 0,
    );

    expect(secondEligiblePosition).not.toBeNull();

    const thirdEligiblePosition = generateTimedFoodPosition(
      game.boardSize,
      game.snake,
      game.food,
      [firstEligiblePosition!, secondEligiblePosition!],
      () => 0,
    );

    expect(thirdEligiblePosition).not.toBeNull();

    const nextGame = spawnTimedFood(
      {
        ...game,
        bonusFood: {
          expiresAt: 8_000,
          position: firstEligiblePosition!,
        },
        slowFood: {
          expiresAt: 10_000,
          position: thirdEligiblePosition!,
        },
        speedFood: {
          expiresAt: 9_000,
          position: secondEligiblePosition!,
        },
      },
      "shrinkFood",
      {
        now: () => 1_000,
        random: createRandomSequence([0, 0]),
      },
    );

    expect(nextGame.shrinkFood).not.toBeNull();
    expect(nextGame.shrinkFood?.expiresAt).toBe(1_000 + BONUS_FOOD_TIMEOUT_MIN_MS);
    expectDifferentPoint(nextGame.shrinkFood!.position, firstEligiblePosition!);
    expectDifferentPoint(nextGame.shrinkFood!.position, secondEligiblePosition!);
    expectDifferentPoint(nextGame.shrinkFood!.position, thirdEligiblePosition!);
    expectDifferentPoint(nextGame.shrinkFood!.position, nextGame.food);
    expect(nextGame.snake.every((segment) => !isSamePoint(nextGame.shrinkFood!.position, segment))).toBe(
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
    const food = nextGame.food;
    expectPoint(food);
    expect(game.obstacles.every((obstacle) => !isSamePoint(food, obstacle))).toBe(true);
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

  it("eating a blue triangle scores 1, grows, clears it, and decreases speed", () => {
    const game = createRunningGame({
      food: { x: 9, y: 9 },
      score: 0,
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ],
      slowFood: {
        expiresAt: 9_000,
        position: { x: 6, y: 5 },
      },
    });
    const initialSpeed = getGameSpeed(game);

    const nextGame = advanceSnakeGame(game);

    expect(nextGame.score).toBe(1);
    expect(nextGame.snake).toHaveLength(game.snake.length + 1);
    expect(nextGame.snake[0]).toEqual({ x: 6, y: 5 });
    expect(nextGame.slowFood).toBeNull();
    expect(getGameSpeed(nextGame)).toBe(initialSpeed! - 1);
    expect(getGameTickDelay(nextGame)).toBeGreaterThan(getGameTickDelay(game)!);
  });

  it("keeps blue triangles from decreasing speed below 1", () => {
    const game = createRunningGame({
      food: { x: 9, y: 9 },
      score: 3,
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ],
      slowFood: {
        expiresAt: 9_000,
        position: { x: 6, y: 5 },
      },
      speedBoosts: -5,
    });

    expect(getGameSpeed(game)).toBe(1);

    const nextGame = advanceSnakeGame(game);

    expect(nextGame.score).toBe(4);
    expect(nextGame.slowFood).toBeNull();
    expect(getGameSpeed(nextGame)).toBe(1);
  });

  it("eating a cyan hexagon scores, clears it, and trims one tail segment", () => {
    const game = createRunningGame({
      food: { x: 9, y: 9 },
      score: 0,
      shrinkFood: {
        expiresAt: 9_000,
        position: { x: 6, y: 5 },
      },
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
        { x: 2, y: 5 },
        { x: 1, y: 5 },
      ],
    });
    const initialSpeed = getGameSpeed(game);

    const nextGame = advanceSnakeGame(game);

    expect(nextGame.score).toBe(SHRINK_FOOD_SCORE);
    expect(nextGame.snake).toHaveLength(game.snake.length - SHRINK_FOOD_TAIL_TRIM);
    expect(nextGame.snake[0]).toEqual({ x: 6, y: 5 });
    expect(nextGame.snake.some((segment) => isSamePoint(segment, { x: 1, y: 5 }))).toBe(false);
    expect(nextGame.shrinkFood).toBeNull();
    expect(getGameSpeed(nextGame)).toBe(initialSpeed);
  });

  it("keeps cyan hexagons from trimming below the minimum snake length", () => {
    const game = createRunningGame({
      food: { x: 9, y: 9 },
      shrinkFood: {
        expiresAt: 9_000,
        position: { x: 6, y: 5 },
      },
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ],
    });

    const nextGame = advanceSnakeGame(game);

    expect(nextGame.score).toBe(SHRINK_FOOD_SCORE);
    expect(nextGame.snake).toHaveLength(MIN_SNAKE_LENGTH);
    expect(nextGame.shrinkFood).toBeNull();
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

  it("expires blue triangles only when the matching timeout is current", () => {
    const game = createRunningGame({
      slowFood: {
        expiresAt: 7_000,
        position: { x: 1, y: 1 },
      },
    });

    expect(expireTimedFood(game, "slowFood", 6_999).slowFood).toEqual(game.slowFood);
    expect(expireTimedFood(game, "slowFood", 7_000).slowFood).toBeNull();
  });

  it("expires cyan hexagons only when the matching timeout is current", () => {
    const game = createRunningGame({
      shrinkFood: {
        expiresAt: 7_000,
        position: { x: 1, y: 1 },
      },
    });

    expect(expireTimedFood(game, "shrinkFood", 6_999).shrinkFood).toEqual(game.shrinkFood);
    expect(expireTimedFood(game, "shrinkFood", 7_000).shrinkFood).toBeNull();
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
      shrinkFood: {
        expiresAt: 11_000,
        position: { x: 4, y: 1 },
      },
      slowFood: {
        expiresAt: 10_000,
        position: { x: 3, y: 1 },
      },
      speedFood: {
        expiresAt: 9_000,
        position: { x: 2, y: 1 },
      },
    });

    const nextGame = advanceSnakeGame(game);

    expect(nextGame.status).toBe("lost");
    expect(nextGame.bonusFood).toBeNull();
    expect(nextGame.shrinkFood).toBeNull();
    expect(nextGame.slowFood).toBeNull();
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
      shrinkFood: {
        expiresAt: 11_000,
        position: { x: 4, y: 1 },
      },
      slowFood: {
        expiresAt: 10_000,
        position: { x: 3, y: 1 },
      },
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
    expect(nextGame.shrinkFood).toBeNull();
    expect(nextGame.slowFood).toBeNull();
    expect(nextGame.speedFood).toBeNull();
  });

  it("wins instead of respawning red food when the snake fills the board", () => {
    const game = createRunningGame({
      bestScore: 0,
      boardSize: 3,
      food: { x: 2, y: 2 },
      score: 0,
      snake: [
        { x: 1, y: 2 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
        { x: 0, y: 2 },
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 1 },
      ],
    });

    const nextGame = advanceSnakeGame(game, {
      random: () => 0,
    });

    expect(nextGame.status).toBe("won");
    expect(nextGame.food).toBeNull();
    expect(nextGame.score).toBe(1);
    expect(nextGame.bestScore).toBe(1);
    expect(nextGame.snake).toHaveLength(9);
    expect(nextGame.snake[0]).toEqual({ x: 2, y: 2 });
    expect(nextGame.bonusFood).toBeNull();
    expect(nextGame.shrinkFood).toBeNull();
    expect(nextGame.slowFood).toBeNull();
    expect(nextGame.speedFood).toBeNull();
  });

  it("keeps red food from respawning over active timed foods", () => {
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
      shrinkFood: {
        expiresAt: 11_000,
        position: { x: 3, y: 0 },
      },
      slowFood: {
        expiresAt: 10_000,
        position: { x: 2, y: 0 },
      },
      speedFood: {
        expiresAt: 9_000,
        position: { x: 1, y: 0 },
      },
    });

    const nextGame = advanceSnakeGame(game, {
      random: () => 0,
    });

    expect(nextGame.food).toEqual({ x: 4, y: 0 });
    expectDifferentPoint(nextGame.food, game.bonusFood!.position);
    expectDifferentPoint(nextGame.food, game.shrinkFood!.position);
    expectDifferentPoint(nextGame.food, game.slowFood!.position);
    expectDifferentPoint(nextGame.food, game.speedFood!.position);
  });
});
