export type Direction = "up" | "right" | "down" | "left";
export type GameStatus = "ready" | "running" | "paused" | "lost" | "won";

export type Point = {
  x: number;
  y: number;
};

export type TimedFood = {
  expiresAt: number;
  position: Point;
};

export type Door = {
  isOpen: boolean;
  position: Point;
};

export type GameState = {
  bestScore: number;
  bonusFood: TimedFood | null;
  boardSize: number;
  direction: Direction;
  door: Door;
  food: Point | null;
  key: Point | null;
  level: number;
  obstacles: Point[];
  pickedUpObjects: number;
  queuedDirection: Direction;
  score: number;
  shrinkFood: TimedFood | null;
  snake: Point[];
  slowFood: TimedFood | null;
  speedBoosts: number;
  speedFood: TimedFood | null;
  status: GameStatus;
};

export type CreateInitialGameOptions = {
  bestScore?: number;
  boardSize?: number;
  level?: number;
  random?: RandomSource;
};

export const PICKUPS_PER_ITEM_INTRODUCTION = 3;
export const SNAKE_PICKUP_INTRODUCTION_ORDER = [
  "food",
  "bonusFood",
  "speedFood",
  "slowFood",
  "shrinkFood",
] as const;

export type SnakePickupKind = (typeof SNAKE_PICKUP_INTRODUCTION_ORDER)[number];
export type TimedFoodKind = Exclude<SnakePickupKind, "food">;

export const TIMED_FOOD_KINDS: readonly TimedFoodKind[] =
  SNAKE_PICKUP_INTRODUCTION_ORDER.filter(
    (kind): kind is TimedFoodKind => kind !== "food",
  );

type RandomSource = () => number;

type TimedFoodSpeedEffect = {
  amount: number;
  direction: "decrease" | "increase";
};

type TimedFoodLengthEffect = {
  amount: number;
  direction: "grow" | "shrink";
};

export type TimedFoodRule = {
  label: string;
  lengthEffect: TimedFoodLengthEffect;
  preferredObstacleDistanceMax?: number;
  score: number;
  spawnDelayMaxMs: number;
  spawnDelayMinMs: number;
  speedEffect?: TimedFoodSpeedEffect;
  timeoutMaxMs: number;
  timeoutMinMs: number;
};

export type ActiveTimedFoodEntry = {
  kind: TimedFoodKind;
  rule: TimedFoodRule;
  timedFood: TimedFood;
};

type TimedFoodOptions = {
  now?: () => number;
  preferredDistanceTargets?: Point[];
  preferredMaxDistance?: number;
  random?: RandomSource;
  timeoutMaxMs?: number;
  timeoutMinMs?: number;
};

export type GenerateObstaclesOptions = {
  level?: number;
  random?: RandomSource;
};

type AdvanceSnakeOptions = {
  random?: RandomSource;
};

type CreateSnakeLevelStateOptions = {
  bestScore: number;
  boardSize?: number;
  level: number;
  random?: RandomSource;
  score: number;
  status: GameStatus;
};

export const FIRST_SNAKE_LEVEL = 1;
export const FIRST_SNAKE_LEVEL_BOARD_SIZE = 12;
export const SNAKE_LEVEL_BOARD_SIZE_STEP = 1;
export const DEFAULT_BOARD_SIZE = FIRST_SNAKE_LEVEL_BOARD_SIZE;
export const MIN_BOARD_SIZE = 11;
export const MAX_BOARD_SIZE = 25;
export const BOARD_SIZE_STEP = 2;
export const BONUS_FOOD_MIN_SNAKE_DISTANCE = 5;
export const BONUS_FOOD_OBSTACLE_DISTANCE_MAX = 3;
export const BONUS_FOOD_SCORE = 2;
export const BONUS_FOOD_SPAWN_DELAY_MAX_MS = 10_000;
export const BONUS_FOOD_SPAWN_DELAY_MIN_MS = 4_000;
export const BONUS_FOOD_TIMEOUT_MAX_MS = 12_000;
export const BONUS_FOOD_TIMEOUT_MIN_MS = 6_000;
export const MIN_SNAKE_LENGTH = 3;
export const MIN_GAME_TICK_DELAY_MS = 50;
export const MAX_GAME_SPEED = Math.round(1000 / MIN_GAME_TICK_DELAY_MS);
export const OBSTACLE_CLUSTER_MAX_SIZE = 6;
export const OBSTACLE_CLUSTER_MIN_SIZE = 2;
export const OBSTACLE_FIELD_COVERAGE_RATIO = 0.06;
export const OBSTACLE_FIELD_COVERAGE_RATIO_LEVEL_STEP = 0.01;
export const SHRINK_FOOD_SCORE = 1;
export const SHRINK_FOOD_TAIL_TRIM = 1;
export const SLOW_FOOD_SCORE = 1;
export const SLOW_FOOD_SPEED_DECREASE = 1;
export const SLOW_FOOD_TIMEOUT_MAX_MS = 3_000;
export const SLOW_FOOD_TIMEOUT_MIN_MS = 2_000;
export const SPEED_FOOD_SCORE = 3;
export const SPEED_FOOD_SPEED_INCREASE = 1;
export const STARTING_GAME_SPEED = 4;
export const PICKUPS_PER_BASE_SPEED_INCREASE = 5;
export const TIMED_FOOD_RULES: Record<TimedFoodKind, TimedFoodRule> = {
  bonusFood: {
    label: "Yellow apple",
    lengthEffect: {
      amount: 1,
      direction: "grow",
    },
    preferredObstacleDistanceMax: BONUS_FOOD_OBSTACLE_DISTANCE_MAX,
    score: BONUS_FOOD_SCORE,
    spawnDelayMaxMs: BONUS_FOOD_SPAWN_DELAY_MAX_MS,
    spawnDelayMinMs: BONUS_FOOD_SPAWN_DELAY_MIN_MS,
    timeoutMaxMs: BONUS_FOOD_TIMEOUT_MAX_MS,
    timeoutMinMs: BONUS_FOOD_TIMEOUT_MIN_MS,
  },
  speedFood: {
    label: "Purple diamond",
    lengthEffect: {
      amount: 1,
      direction: "grow",
    },
    score: SPEED_FOOD_SCORE,
    spawnDelayMaxMs: BONUS_FOOD_SPAWN_DELAY_MAX_MS,
    spawnDelayMinMs: BONUS_FOOD_SPAWN_DELAY_MIN_MS,
    speedEffect: {
      amount: SPEED_FOOD_SPEED_INCREASE,
      direction: "increase",
    },
    timeoutMaxMs: BONUS_FOOD_TIMEOUT_MAX_MS,
    timeoutMinMs: BONUS_FOOD_TIMEOUT_MIN_MS,
  },
  slowFood: {
    label: "Blue triangle",
    lengthEffect: {
      amount: 1,
      direction: "grow",
    },
    score: SLOW_FOOD_SCORE,
    spawnDelayMaxMs: BONUS_FOOD_SPAWN_DELAY_MAX_MS,
    spawnDelayMinMs: BONUS_FOOD_SPAWN_DELAY_MIN_MS,
    speedEffect: {
      amount: SLOW_FOOD_SPEED_DECREASE,
      direction: "decrease",
    },
    timeoutMaxMs: SLOW_FOOD_TIMEOUT_MAX_MS,
    timeoutMinMs: SLOW_FOOD_TIMEOUT_MIN_MS,
  },
  shrinkFood: {
    label: "Cyan hexagon",
    lengthEffect: {
      amount: SHRINK_FOOD_TAIL_TRIM,
      direction: "shrink",
    },
    score: SHRINK_FOOD_SCORE,
    spawnDelayMaxMs: BONUS_FOOD_SPAWN_DELAY_MAX_MS,
    spawnDelayMinMs: BONUS_FOOD_SPAWN_DELAY_MIN_MS,
    timeoutMaxMs: BONUS_FOOD_TIMEOUT_MAX_MS,
    timeoutMinMs: BONUS_FOOD_TIMEOUT_MIN_MS,
  },
};

export const directionOffsets: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

const OBSTACLE_CLUSTER_ATTEMPT_LIMIT = 40;
const OBSTACLE_SEED_ATTEMPT_LIMIT = 80;
const ORTHOGONAL_OFFSETS = Object.values(directionOffsets);
const MAX_BASE_GAME_SPEED = Math.round(1000 / 78);

export function getPointKey(point: Point) {
  return `${point.x}:${point.y}`;
}

export function isSamePoint(first: Point, second: Point) {
  return first.x === second.x && first.y === second.y;
}

export function getManhattanDistance(first: Point, second: Point) {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
}

export function getRandomDuration(
  minMs: number,
  maxMs: number,
  random: RandomSource = Math.random,
) {
  return Math.floor(random() * (maxMs - minMs + 1)) + minMs;
}

export function normalizeSnakeLevel(value: number) {
  if (!Number.isFinite(value)) {
    return FIRST_SNAKE_LEVEL;
  }

  return Math.max(FIRST_SNAKE_LEVEL, Math.floor(value));
}

export function getSnakeLevelBoardSize(level: number) {
  return (
    FIRST_SNAKE_LEVEL_BOARD_SIZE +
    (normalizeSnakeLevel(level) - FIRST_SNAKE_LEVEL) * SNAKE_LEVEL_BOARD_SIZE_STEP
  );
}

export function getSnakeLevelKeyPickupThreshold(level: number) {
  return PICKUPS_PER_BASE_SPEED_INCREASE * normalizeSnakeLevel(level);
}

export function getSnakeLevelObstacleFieldCoverageRatio(level: number) {
  return (
    OBSTACLE_FIELD_COVERAGE_RATIO +
    (normalizeSnakeLevel(level) - FIRST_SNAKE_LEVEL) * OBSTACLE_FIELD_COVERAGE_RATIO_LEVEL_STEP
  );
}

export function getSnakeLevelPickupTypeLimit(level: number) {
  return Math.min(SNAKE_PICKUP_INTRODUCTION_ORDER.length, normalizeSnakeLevel(level));
}

export function isTimedFoodKind(value: unknown): value is TimedFoodKind {
  return typeof value === "string" && (TIMED_FOOD_KINDS as readonly string[]).includes(value);
}

export function getPickupIntroductionThreshold(kind: SnakePickupKind) {
  return (
    SNAKE_PICKUP_INTRODUCTION_ORDER.findIndex((candidateKind) => candidateKind === kind) *
    PICKUPS_PER_ITEM_INTRODUCTION
  );
}

export function isPickupAvailableInLevel(kind: SnakePickupKind, level: number) {
  const pickupIndex = SNAKE_PICKUP_INTRODUCTION_ORDER.findIndex(
    (candidateKind) => candidateKind === kind,
  );

  return pickupIndex >= 0 && pickupIndex < getSnakeLevelPickupTypeLimit(level);
}

export function isPickupIntroduced(
  kind: SnakePickupKind,
  pickedUpObjects: number,
  level?: number,
) {
  return (
    (level === undefined || isPickupAvailableInLevel(kind, level)) &&
    pickedUpObjects >= getPickupIntroductionThreshold(kind)
  );
}

export function getIntroducedTimedFoodKinds(pickedUpObjects: number, level?: number) {
  return TIMED_FOOD_KINDS.filter((kind) =>
    isPickupIntroduced(kind, pickedUpObjects, level),
  );
}

export function getTimedFoodSpawnDelay(
  kind: TimedFoodKind,
  random: RandomSource = Math.random,
) {
  const rule = TIMED_FOOD_RULES[kind];

  return getRandomDuration(rule.spawnDelayMinMs, rule.spawnDelayMaxMs, random);
}

function createSeededRandom(seed: number): RandomSource {
  let value = seed % 2_147_483_647;

  if (value <= 0) {
    value += 2_147_483_646;
  }

  return () => {
    value = (value * 16_807) % 2_147_483_647;

    return (value - 1) / 2_147_483_646;
  };
}

export function normalizeBoardSize(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_BOARD_SIZE;
  }

  const clampedValue = Math.min(MAX_BOARD_SIZE, Math.max(MIN_BOARD_SIZE, Math.round(value)));
  const steppedOffset =
    Math.round((clampedValue - MIN_BOARD_SIZE) / BOARD_SIZE_STEP) * BOARD_SIZE_STEP;

  return Math.min(MAX_BOARD_SIZE, Math.max(MIN_BOARD_SIZE, MIN_BOARD_SIZE + steppedOffset));
}

export function createBoardCells(boardSize: number) {
  return Array.from({ length: boardSize * boardSize }, (_, index) => ({
    x: index % boardSize,
    y: Math.floor(index / boardSize),
  }));
}

function isInteriorBoardCell(point: Point, boardSize: number) {
  return point.x > 0 && point.x < boardSize - 1 && point.y > 0 && point.y < boardSize - 1;
}

function getRandomItem<T>(items: T[], random: RandomSource) {
  return items[Math.floor(random() * items.length)] ?? null;
}

function getOrthogonalNeighbors(point: Point, boardSize: number) {
  return ORTHOGONAL_OFFSETS.flatMap((offset) => {
    const neighbor = {
      x: point.x + offset.x,
      y: point.y + offset.y,
    };

    return isInteriorBoardCell(neighbor, boardSize) ? [neighbor] : [];
  });
}

function hasOrthogonalObstacleNeighbor(point: Point, obstacleKeys: Set<string>) {
  return ORTHOGONAL_OFFSETS.some((offset) =>
    obstacleKeys.has(
      getPointKey({
        x: point.x + offset.x,
        y: point.y + offset.y,
      }),
    ),
  );
}

function isWithinManhattanDistance(point: Point, targets: Point[], maxDistance: number) {
  return targets.some((target) => {
    const distance = getManhattanDistance(point, target);

    return distance > 0 && distance <= maxDistance;
  });
}

export function createInitialSnake(boardSize: number): Point[] {
  const center = Math.floor(boardSize / 2);

  return Array.from({ length: MIN_SNAKE_LENGTH }, (_, index) => ({
    x: center - index,
    y: center,
  }));
}

export function createInitialFood(boardSize: number, random?: RandomSource): Point {
  const center = Math.floor(boardSize / 2);

  if (random === undefined) {
    return {
      x: Math.min(boardSize - 2, center + 4),
      y: center,
    };
  }

  return (
    generateFood(boardSize, createInitialSnake(boardSize), [], random) ?? {
      x: Math.min(boardSize - 2, center + 4),
      y: center,
    }
  );
}

function createInitialFoodPath(head: Point, food: Point) {
  const pathCells = new Map<string, Point>();
  const xStep = food.x >= head.x ? 1 : -1;
  const yStep = food.y >= head.y ? 1 : -1;

  for (let x = head.x; x !== food.x + xStep; x += xStep) {
    const pathCell = { x, y: head.y };
    pathCells.set(getPointKey(pathCell), pathCell);
  }

  for (let y = head.y; y !== food.y + yStep; y += yStep) {
    const pathCell = { x: food.x, y };
    pathCells.set(getPointKey(pathCell), pathCell);
  }

  return Array.from(pathCells.values());
}

export function createInitialObstacleSafeCells(boardSize: number, food = createInitialFood(boardSize)) {
  const snake = createInitialSnake(boardSize);
  const head = snake[0];
  const safeCells = new Map(
    [...snake, food, ...createInitialFoodPath(head, food)].map((cell) => [getPointKey(cell), cell]),
  );

  for (let x = head.x + 1; x < boardSize; x += 1) {
    const laneCell = { x, y: head.y };
    safeCells.set(getPointKey(laneCell), laneCell);
  }

  ORTHOGONAL_OFFSETS.forEach((offset) => {
    const neighbor = {
      x: head.x + offset.x,
      y: head.y + offset.y,
    };

    if (neighbor.x >= 0 && neighbor.x < boardSize && neighbor.y >= 0 && neighbor.y < boardSize) {
      safeCells.set(getPointKey(neighbor), neighbor);
    }
  });

  return Array.from(safeCells.values());
}

function getObstacleCellBudget(boardSize: number, level: number) {
  return Math.floor(boardSize * boardSize * getSnakeLevelObstacleFieldCoverageRatio(level));
}

function getObstacleClusterSize(random: RandomSource, maxSize = OBSTACLE_CLUSTER_MAX_SIZE) {
  const cappedMaxSize = Math.min(OBSTACLE_CLUSTER_MAX_SIZE, maxSize);

  return (
    Math.floor(random() * (cappedMaxSize - OBSTACLE_CLUSTER_MIN_SIZE + 1)) +
    OBSTACLE_CLUSTER_MIN_SIZE
  );
}

function isAvailableObstacleCell(
  cell: Point,
  boardSize: number,
  occupiedKeys: Set<string>,
  obstacleKeys: Set<string>,
  clusterKeys: Set<string> = new Set(),
) {
  const cellKey = getPointKey(cell);

  return (
    isInteriorBoardCell(cell, boardSize) &&
    !occupiedKeys.has(cellKey) &&
    !obstacleKeys.has(cellKey) &&
    !clusterKeys.has(cellKey) &&
    !hasOrthogonalObstacleNeighbor(cell, obstacleKeys)
  );
}

function generateObstacleCluster(
  boardSize: number,
  occupiedKeys: Set<string>,
  obstacleKeys: Set<string>,
  random: RandomSource,
  maxSize = OBSTACLE_CLUSTER_MAX_SIZE,
) {
  if (maxSize < OBSTACLE_CLUSTER_MIN_SIZE) {
    return [];
  }

  const boardCells = createBoardCells(boardSize);

  for (let attempt = 0; attempt < OBSTACLE_SEED_ATTEMPT_LIMIT; attempt += 1) {
    const seedCandidates = boardCells.filter((cell) =>
      isAvailableObstacleCell(cell, boardSize, occupiedKeys, obstacleKeys),
    );
    const seed = getRandomItem(seedCandidates, random);

    if (seed === null) {
      return [];
    }

    const targetSize = getObstacleClusterSize(random, maxSize);
    const cluster = [seed];
    const clusterKeys = new Set([getPointKey(seed)]);

    for (
      let growthAttempt = 0;
      cluster.length < targetSize && growthAttempt < OBSTACLE_CLUSTER_ATTEMPT_LIMIT;
      growthAttempt += 1
    ) {
      const expansionCandidates = cluster
        .flatMap((cell) => getOrthogonalNeighbors(cell, boardSize))
        .filter((cell, index, candidates) => {
          const cellKey = getPointKey(cell);

          return (
            candidates.findIndex((candidate) => getPointKey(candidate) === cellKey) === index &&
            isAvailableObstacleCell(cell, boardSize, occupiedKeys, obstacleKeys, clusterKeys)
          );
        });
      const nextCell = getRandomItem(expansionCandidates, random);

      if (nextCell === null) {
        break;
      }

      cluster.push(nextCell);
      clusterKeys.add(getPointKey(nextCell));
    }

    return cluster;
  }

  return [];
}

export function generateObstacles(
  boardSize: number,
  occupiedCells: Point[],
  options: GenerateObstaclesOptions | RandomSource = {},
) {
  const obstacleOptions =
    typeof options === "function"
      ? {
          level: FIRST_SNAKE_LEVEL,
          random: options,
        }
      : {
          level: options.level ?? FIRST_SNAKE_LEVEL,
          random: options.random ?? Math.random,
        };
  const occupiedKeys = new Set(occupiedCells.map(getPointKey));
  const obstacleKeys = new Set<string>();
  const obstacles: Point[] = [];
  const obstacleCellBudget = getObstacleCellBudget(boardSize, obstacleOptions.level);

  while (obstacles.length + OBSTACLE_CLUSTER_MIN_SIZE <= obstacleCellBudget) {
    const remainingBudget = obstacleCellBudget - obstacles.length;
    const cluster = generateObstacleCluster(
      boardSize,
      occupiedKeys,
      obstacleKeys,
      obstacleOptions.random,
      remainingBudget,
    );

    if (cluster.length === 0) {
      break;
    }

    cluster.forEach((cell) => {
      const cellKey = getPointKey(cell);

      obstacleKeys.add(cellKey);
      occupiedKeys.add(cellKey);
      obstacles.push(cell);
    });
  }

  return obstacles;
}

function generateOpenCell(
  boardSize: number,
  occupiedCells: Point[] = [],
  random: RandomSource = Math.random,
) {
  const occupiedCellKeys = new Set(occupiedCells.map(getPointKey));
  const boardCells = createBoardCells(boardSize);
  const openCells = boardCells.filter((cell) => !occupiedCellKeys.has(getPointKey(cell)));

  if (openCells.length === 0) {
    return null;
  }

  return openCells[Math.floor(random() * openCells.length)] ?? null;
}

export function isOppositeDirection(first: Direction, second: Direction) {
  const firstOffset = directionOffsets[first];
  const secondOffset = directionOffsets[second];

  return firstOffset.x + secondOffset.x === 0 && firstOffset.y + secondOffset.y === 0;
}

export function generateFood(
  boardSize: number,
  snake: Point[],
  additionalOccupiedCells: Point[] = [],
  random: RandomSource = Math.random,
) {
  return generateOpenCell(boardSize, [...snake, ...additionalOccupiedCells], random);
}

export function generateDoorPosition(
  boardSize: number,
  additionalOccupiedCells: Point[] = [],
  random: RandomSource = Math.random,
) {
  return generateOpenCell(boardSize, additionalOccupiedCells, random);
}

export function generateKeyPosition(
  boardSize: number,
  snake: Point[],
  additionalOccupiedCells: Point[] = [],
  random: RandomSource = Math.random,
) {
  return generateOpenCell(boardSize, [...snake, ...additionalOccupiedCells], random);
}

export function generateTimedFoodPosition(
  boardSize: number,
  snake: Point[],
  food: Point | null,
  additionalOccupiedCells: Point[] = [],
  random: RandomSource = Math.random,
) {
  if (food === null) {
    return null;
  }

  const openCells = getTimedFoodCandidateCells(boardSize, snake, food, additionalOccupiedCells);
  const nextCell = getRandomItem(openCells, random);

  return nextCell;
}

function getTimedFoodCandidateCells(
  boardSize: number,
  snake: Point[],
  food: Point,
  additionalOccupiedCells: Point[] = [],
) {
  const occupiedCells = new Set([...snake, food, ...additionalOccupiedCells].map(getPointKey));
  const boardCells = createBoardCells(boardSize);

  return boardCells.filter(
    (cell) =>
      !occupiedCells.has(getPointKey(cell)) &&
      snake.every(
        (segment) => getManhattanDistance(cell, segment) >= BONUS_FOOD_MIN_SNAKE_DISTANCE,
      ),
  );
}

export function createTimedFood(
  boardSize: number,
  snake: Point[],
  food: Point | null,
  additionalOccupiedCells: Point[] = [],
  {
    now = Date.now,
    preferredDistanceTargets = [],
    preferredMaxDistance = 0,
    random = Math.random,
    timeoutMaxMs = BONUS_FOOD_TIMEOUT_MAX_MS,
    timeoutMinMs = BONUS_FOOD_TIMEOUT_MIN_MS,
  }: TimedFoodOptions = {},
) {
  if (food === null) {
    return null;
  }

  const candidateCells = getTimedFoodCandidateCells(
    boardSize,
    snake,
    food,
    additionalOccupiedCells,
  );
  const selectedMaxDistance =
    preferredDistanceTargets.length > 0 && preferredMaxDistance > 0
      ? Math.floor(random() * preferredMaxDistance) + 1
      : 0;
  const preferredCandidateCells =
    selectedMaxDistance > 0
      ? candidateCells.filter((cell) =>
          isWithinManhattanDistance(cell, preferredDistanceTargets, selectedMaxDistance),
        )
      : [];
  const position = getRandomItem(
    preferredCandidateCells.length > 0 ? preferredCandidateCells : candidateCells,
    random,
  );

  if (position === null) {
    return null;
  }

  return {
    expiresAt: now() + getRandomDuration(timeoutMinMs, timeoutMaxMs, random),
    position,
  };
}

export function createInitialGame({
  bestScore = 0,
  boardSize,
  level = FIRST_SNAKE_LEVEL,
  random,
}: CreateInitialGameOptions = {}): GameState {
  return createSnakeLevelState({
    bestScore,
    boardSize,
    level,
    random,
    score: 0,
    status: "ready",
  });
}

function createSnakeLevelState({
  bestScore,
  boardSize,
  level,
  random,
  score,
  status,
}: CreateSnakeLevelStateOptions): GameState {
  const normalizedLevel = normalizeSnakeLevel(level);
  const normalizedBoardSize =
    boardSize === undefined ? getSnakeLevelBoardSize(normalizedLevel) : normalizeBoardSize(boardSize);
  const randomSource = random ?? createSeededRandom(normalizedBoardSize + normalizedLevel * 1_009);
  const snake = createInitialSnake(normalizedBoardSize);
  const food = createInitialFood(normalizedBoardSize, random);
  const initialSafeCells = createInitialObstacleSafeCells(normalizedBoardSize, food);
  const doorPosition =
    generateDoorPosition(normalizedBoardSize, initialSafeCells, randomSource) ?? {
      x: normalizedBoardSize - 1,
      y: normalizedBoardSize - 1,
    };

  return {
    bestScore,
    bonusFood: null,
    boardSize: normalizedBoardSize,
    direction: "right",
    door: {
      isOpen: false,
      position: doorPosition,
    },
    food,
    key: null,
    level: normalizedLevel,
    obstacles: generateObstacles(
      normalizedBoardSize,
      [...initialSafeCells, doorPosition],
      {
        level: normalizedLevel,
        random: randomSource,
      },
    ),
    pickedUpObjects: 0,
    queuedDirection: "right",
    score,
    shrinkFood: null,
    snake,
    slowFood: null,
    speedBoosts: 0,
    speedFood: null,
    status,
  };
}

function getBaseGameTickDelay(pickedUpObjects: number) {
  return Math.max(78, Math.round(1000 / getBaseGameSpeed(pickedUpObjects)));
}

function getBaseGameSpeed(pickedUpObjects: number) {
  return Math.min(
    MAX_BASE_GAME_SPEED,
    STARTING_GAME_SPEED + Math.floor(pickedUpObjects / PICKUPS_PER_BASE_SPEED_INCREASE),
  );
}

function getAdjustedGameSpeed(pickedUpObjects: number, speedBoosts: number) {
  return Math.min(MAX_GAME_SPEED, Math.max(1, getBaseGameSpeed(pickedUpObjects) + speedBoosts));
}

function getSpeedBoostsForTargetSpeed(pickedUpObjects: number, speed: number) {
  return speed - getBaseGameSpeed(pickedUpObjects);
}

export function getGameTickDelay(
  game: Pick<GameState, "pickedUpObjects" | "speedBoosts" | "status">,
) {
  if (game.status !== "running") {
    return null;
  }

  const baseTickDelay = getBaseGameTickDelay(game.pickedUpObjects);

  if (game.speedBoosts === 0) {
    return baseTickDelay;
  }

  const adjustedSpeed = getAdjustedGameSpeed(game.pickedUpObjects, game.speedBoosts);

  return Math.max(MIN_GAME_TICK_DELAY_MS, Math.round(1000 / adjustedSpeed));
}

export function getGameSpeed(
  game: Pick<GameState, "pickedUpObjects" | "speedBoosts" | "status">,
) {
  const tickDelay = getGameTickDelay(game);

  return tickDelay === null ? null : Math.round(1000 / tickDelay);
}

export function queueGameDirection(current: GameState, nextDirection: Direction): GameState {
  if (
    current.status === "lost" ||
    current.status === "won" ||
    isOppositeDirection(nextDirection, current.direction)
  ) {
    return current;
  }

  return {
    ...current,
    direction: current.status === "ready" ? nextDirection : current.direction,
    queuedDirection: nextDirection,
    status: current.status === "ready" ? "running" : current.status,
  };
}

export function getActiveTimedFoodEntries(
  current: Pick<GameState, TimedFoodKind>,
): ActiveTimedFoodEntry[] {
  return TIMED_FOOD_KINDS.flatMap((timedFoodKind) => {
    const timedFood = current[timedFoodKind];

    return timedFood === null
      ? []
      : [
          {
            kind: timedFoodKind,
            rule: TIMED_FOOD_RULES[timedFoodKind],
            timedFood,
          },
        ];
  });
}

function getActiveTimedFoodPositions(
  current: Pick<GameState, TimedFoodKind>,
  excludedKind?: TimedFoodKind,
) {
  return getActiveTimedFoodEntries(current).flatMap(({ kind, timedFood }) =>
    kind === excludedKind ? [] : [timedFood.position],
  );
}

function getActiveLevelItemPositions(
  current: Pick<GameState, "door" | "key">,
  { excludeKey = false }: { excludeKey?: boolean } = {},
) {
  return [
    current.door.position,
    ...(current.key === null || excludeKey ? [] : [current.key]),
  ];
}

function getClearedTimedFoodState() {
  return {
    bonusFood: null,
    shrinkFood: null,
    slowFood: null,
    speedFood: null,
  };
}

function getEatenTimedFoodKinds(current: GameState, nextHead: Point) {
  return getActiveTimedFoodEntries(current).flatMap(({ kind, timedFood }) =>
    isSamePoint(nextHead, timedFood.position) ? [kind] : [],
  );
}

function getTimedFoodScore(kinds: TimedFoodKind[]) {
  return kinds.reduce((score, kind) => score + TIMED_FOOD_RULES[kind].score, 0);
}

function getTimedFoodLengthDelta(kinds: TimedFoodKind[]) {
  return kinds.reduce((lengthDelta, kind) => {
    const lengthEffect = TIMED_FOOD_RULES[kind].lengthEffect;
    const amount = lengthEffect.direction === "grow" ? lengthEffect.amount : -lengthEffect.amount;

    return lengthDelta + amount;
  }, 0);
}

function getTimedFoodStateAfterEating(current: GameState, eatenKinds: TimedFoodKind[]) {
  const eatenKindSet = new Set(eatenKinds);

  return {
    bonusFood: eatenKindSet.has("bonusFood") ? null : current.bonusFood,
    shrinkFood: eatenKindSet.has("shrinkFood") ? null : current.shrinkFood,
    slowFood: eatenKindSet.has("slowFood") ? null : current.slowFood,
    speedFood: eatenKindSet.has("speedFood") ? null : current.speedFood,
  };
}

function getSpeedBoostsAfterEatingTimedFood(
  current: GameState,
  nextPickedUpObjects: number,
  eatenKinds: TimedFoodKind[],
) {
  return eatenKinds.reduce((nextSpeedBoosts, kind) => {
    const speedEffect = TIMED_FOOD_RULES[kind].speedEffect;

    if (speedEffect === undefined) {
      return nextSpeedBoosts;
    }

    if (speedEffect.direction === "increase") {
      return nextSpeedBoosts + speedEffect.amount;
    }

    const currentSpeed = getGameSpeed(current) ?? 1;
    const nextSpeed = Math.max(1, currentSpeed - speedEffect.amount);

    return getSpeedBoostsForTargetSpeed(nextPickedUpObjects, nextSpeed);
  }, current.speedBoosts);
}

function advanceSnakeSegments(snake: Point[], nextHead: Point, lengthDelta: number) {
  const targetLength = Math.max(MIN_SNAKE_LENGTH, snake.length + lengthDelta);

  return [nextHead, ...snake].slice(0, targetLength);
}

export function spawnTimedFood(
  current: GameState,
  kind: TimedFoodKind,
  options: TimedFoodOptions = {},
): GameState {
  if (
    current.status !== "running" ||
    current[kind] !== null ||
    !isPickupIntroduced(kind, current.pickedUpObjects, current.level)
  ) {
    return current;
  }

  const rule = TIMED_FOOD_RULES[kind];
  const timedFood = createTimedFood(
    current.boardSize,
    current.snake,
    current.food,
    [
      ...current.obstacles,
      ...getActiveLevelItemPositions(current),
      ...getActiveTimedFoodPositions(current, kind),
    ],
    {
      ...options,
      preferredDistanceTargets:
        rule.preferredObstacleDistanceMax === undefined ? undefined : current.obstacles,
      preferredMaxDistance: rule.preferredObstacleDistanceMax,
      timeoutMaxMs: rule.timeoutMaxMs,
      timeoutMinMs: rule.timeoutMinMs,
    },
  );

  if (timedFood === null) {
    return current;
  }

  return {
    ...current,
    [kind]: timedFood,
  };
}

export function expireTimedFood(
  current: GameState,
  kind: TimedFoodKind,
  expiresAt: number,
): GameState {
  if (current.status !== "running" || current[kind]?.expiresAt !== expiresAt) {
    return current;
  }

  return {
    ...current,
    [kind]: null,
  };
}

function createNextLevelGame(current: GameState, random: RandomSource) {
  return createSnakeLevelState({
    bestScore: Math.max(current.bestScore, current.score),
    level: current.level + 1,
    random,
    score: current.score,
    status: "running",
  });
}

export function advanceSnakeGame(
  current: GameState,
  { random = Math.random }: AdvanceSnakeOptions = {},
): GameState {
  if (current.status !== "running") {
    return current;
  }

  const direction = current.queuedDirection;
  const offset = directionOffsets[direction];
  const head = current.snake[0];
  const nextHead = {
    x: head.x + offset.x,
    y: head.y + offset.y,
  };
  const ateFood = current.food !== null && isSamePoint(nextHead, current.food);
  const ateKey = current.key !== null && isSamePoint(nextHead, current.key);
  const eatenTimedFoodKinds = getEatenTimedFoodKinds(current, nextHead);
  const pickedUpObjectCount = (ateFood ? 1 : 0) + eatenTimedFoodKinds.length;
  const lengthDelta = (ateFood ? 1 : 0) + getTimedFoodLengthDelta(eatenTimedFoodKinds);
  const collisionBody = lengthDelta > 0 ? current.snake : current.snake.slice(0, -1);
  const hitWall =
    nextHead.x < 0 ||
    nextHead.x >= current.boardSize ||
    nextHead.y < 0 ||
    nextHead.y >= current.boardSize;
  const hitBody = collisionBody.some((segment) => isSamePoint(segment, nextHead));
  const hitObstacle = current.obstacles.some((obstacle) => isSamePoint(obstacle, nextHead));
  const hitDoor = isSamePoint(current.door.position, nextHead);

  if (hitDoor && current.door.isOpen) {
    return createNextLevelGame(current, random);
  }

  if (hitWall || hitBody || hitObstacle || hitDoor) {
    return {
      ...current,
      direction,
      queuedDirection: direction,
      ...getClearedTimedFoodState(),
      key: null,
      status: "lost",
    };
  }

  const nextSnake = advanceSnakeSegments(current.snake, nextHead, lengthDelta);
  const nextDoor = ateKey ? { ...current.door, isOpen: true } : current.door;
  const nextKeyBeforeSpawn = nextDoor.isOpen ? null : current.key;
  const nextScore =
    current.score + (ateFood ? 1 : 0) + getTimedFoodScore(eatenTimedFoodKinds);
  const nextPickedUpObjects = current.pickedUpObjects + pickedUpObjectCount;
  const nextTimedFoodState = getTimedFoodStateAfterEating(current, eatenTimedFoodKinds);
  const nextSpeedBoosts = getSpeedBoostsAfterEatingTimedFood(
    current,
    nextPickedUpObjects,
    eatenTimedFoodKinds,
  );
  const occupiedSpecialFood = [
    ...current.obstacles,
    ...getActiveLevelItemPositions({
      door: nextDoor,
      key: nextKeyBeforeSpawn,
    }),
    ...getActiveTimedFoodPositions(nextTimedFoodState),
  ];
  const nextFood = ateFood
    ? generateFood(current.boardSize, nextSnake, occupiedSpecialFood, random)
    : current.food;

  if (ateFood && nextFood === null) {
    return {
      bestScore: Math.max(current.bestScore, nextScore),
      ...getClearedTimedFoodState(),
      boardSize: current.boardSize,
      direction,
      door: nextDoor,
      food: null,
      key: null,
      level: current.level,
      obstacles: current.obstacles,
      pickedUpObjects: nextPickedUpObjects,
      queuedDirection: direction,
      score: nextScore,
      snake: nextSnake,
      speedBoosts: nextSpeedBoosts,
      status: "won",
    };
  }

  const shouldSpawnKey =
    !nextDoor.isOpen &&
    nextKeyBeforeSpawn === null &&
    nextPickedUpObjects >= getSnakeLevelKeyPickupThreshold(current.level);
  const nextKey = shouldSpawnKey
    ? generateKeyPosition(
        current.boardSize,
        nextSnake,
        [
          ...current.obstacles,
          nextDoor.position,
          ...(nextFood === null ? [] : [nextFood]),
          ...getActiveTimedFoodPositions(nextTimedFoodState),
        ],
        random,
      )
    : nextKeyBeforeSpawn;

  return {
    bestScore: Math.max(current.bestScore, nextScore),
    ...nextTimedFoodState,
    boardSize: current.boardSize,
    direction,
    door: nextDoor,
    food: nextFood,
    key: nextKey,
    level: current.level,
    obstacles: current.obstacles,
    pickedUpObjects: nextPickedUpObjects,
    queuedDirection: direction,
    score: nextScore,
    snake: nextSnake,
    speedBoosts: nextSpeedBoosts,
    status: current.status,
  };
}
