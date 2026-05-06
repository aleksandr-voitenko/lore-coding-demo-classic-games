export type Direction = "up" | "right" | "down" | "left";
export type GameStatus = "ready" | "running" | "paused" | "lost";

export type Point = {
  x: number;
  y: number;
};

export type LeaderboardEntry = {
  name: string;
  score: number;
};

export type TimedFood = {
  expiresAt: number;
  position: Point;
};

export type PendingLeaderboardEntry = {
  rank: number;
  score: number;
};

export type GameState = {
  bestScore: number;
  bonusFood: TimedFood | null;
  boardSize: number;
  direction: Direction;
  food: Point;
  obstacles: Point[];
  pendingLeaderboardEntry: PendingLeaderboardEntry | null;
  queuedDirection: Direction;
  score: number;
  snake: Point[];
  speedBoosts: number;
  speedFood: TimedFood | null;
  status: GameStatus;
};

export type CreateInitialGameOptions = {
  bestScore?: number;
  boardSize?: number;
  random?: RandomSource;
};

export type TimedFoodKind = "bonusFood" | "speedFood";

type RandomSource = () => number;

type TimedFoodOptions = {
  now?: () => number;
  preferredDistanceTargets?: Point[];
  preferredMaxDistance?: number;
  random?: RandomSource;
};

type AdvanceSnakeOptions = {
  leaderboard?: LeaderboardEntry[];
  leaderboardBestScore?: number;
  random?: RandomSource;
};

export const DEFAULT_BOARD_SIZE = 19;
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
export const LEADERBOARD_LIMIT = 3;
export const MIN_GAME_TICK_DELAY_MS = 50;
export const OBSTACLE_CLUSTER_MAX_SIZE = 6;
export const OBSTACLE_CLUSTER_MIN_SIZE = 2;
export const SPEED_FOOD_SCORE = 3;
export const SPEED_FOOD_SPEED_INCREASE = 1;
export const BOARD_SIZE_OPTIONS = Array.from(
  { length: Math.floor((MAX_BOARD_SIZE - MIN_BOARD_SIZE) / BOARD_SIZE_STEP) + 1 },
  (_, index) => MIN_BOARD_SIZE + index * BOARD_SIZE_STEP,
);

export const directionOffsets: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

const OBSTACLE_CLUSTER_ATTEMPT_LIMIT = 40;
const OBSTACLE_SEED_ATTEMPT_LIMIT = 80;
const ORTHOGONAL_OFFSETS = Object.values(directionOffsets);

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

  return [
    { x: center, y: center },
    { x: center - 1, y: center },
    { x: center - 2, y: center },
  ];
}

export function createInitialFood(boardSize: number): Point {
  const center = Math.floor(boardSize / 2);

  return {
    x: Math.min(boardSize - 2, center + 4),
    y: center,
  };
}

export function createInitialObstacleSafeCells(boardSize: number) {
  const snake = createInitialSnake(boardSize);
  const food = createInitialFood(boardSize);
  const head = snake[0];
  const safeCells = new Map([...snake, food].map((cell) => [getPointKey(cell), cell]));

  if (head.y === food.y) {
    const pathStart = Math.min(head.x, food.x);
    const pathEnd = Math.max(head.x, food.x);

    for (let x = pathStart; x <= pathEnd; x += 1) {
      const pathCell = { x, y: head.y };
      safeCells.set(getPointKey(pathCell), pathCell);
    }
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

function getObstacleClusterCount(boardSize: number) {
  return Math.max(1, Math.round(boardSize / 7));
}

function getObstacleClusterSize(random: RandomSource) {
  return (
    Math.floor(random() * (OBSTACLE_CLUSTER_MAX_SIZE - OBSTACLE_CLUSTER_MIN_SIZE + 1)) +
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
) {
  const boardCells = createBoardCells(boardSize);

  for (let attempt = 0; attempt < OBSTACLE_SEED_ATTEMPT_LIMIT; attempt += 1) {
    const seedCandidates = boardCells.filter((cell) =>
      isAvailableObstacleCell(cell, boardSize, occupiedKeys, obstacleKeys),
    );
    const seed = getRandomItem(seedCandidates, random);

    if (seed === null) {
      return [];
    }

    const targetSize = getObstacleClusterSize(random);
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
  random: RandomSource = Math.random,
) {
  const occupiedKeys = new Set(occupiedCells.map(getPointKey));
  const obstacleKeys = new Set<string>();
  const obstacles: Point[] = [];

  for (let clusterIndex = 0; clusterIndex < getObstacleClusterCount(boardSize); clusterIndex += 1) {
    const cluster = generateObstacleCluster(boardSize, occupiedKeys, obstacleKeys, random);

    cluster.forEach((cell) => {
      const cellKey = getPointKey(cell);

      obstacleKeys.add(cellKey);
      occupiedKeys.add(cellKey);
      obstacles.push(cell);
    });
  }

  return obstacles;
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
  const occupiedCells = new Set([...snake, ...additionalOccupiedCells].map(getPointKey));
  const boardCells = createBoardCells(boardSize);
  const openCells = boardCells.filter((cell) => !occupiedCells.has(getPointKey(cell)));
  const nextCell = openCells[Math.floor(random() * openCells.length)];

  return nextCell ?? { x: 0, y: 0 };
}

export function generateTimedFoodPosition(
  boardSize: number,
  snake: Point[],
  food: Point,
  additionalOccupiedCells: Point[] = [],
  random: RandomSource = Math.random,
) {
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
  food: Point,
  additionalOccupiedCells: Point[] = [],
  {
    now = Date.now,
    preferredDistanceTargets = [],
    preferredMaxDistance = 0,
    random = Math.random,
  }: TimedFoodOptions = {},
) {
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
    expiresAt: now() + getRandomDuration(BONUS_FOOD_TIMEOUT_MIN_MS, BONUS_FOOD_TIMEOUT_MAX_MS, random),
    position,
  };
}

export function createInitialGame({
  bestScore = 0,
  boardSize = DEFAULT_BOARD_SIZE,
  random,
}: CreateInitialGameOptions = {}): GameState {
  const normalizedBoardSize = normalizeBoardSize(boardSize);
  const randomSource = random ?? createSeededRandom(normalizedBoardSize);
  const snake = createInitialSnake(normalizedBoardSize);
  const food = createInitialFood(normalizedBoardSize);

  return {
    bestScore,
    bonusFood: null,
    boardSize: normalizedBoardSize,
    direction: "right",
    food,
    obstacles: generateObstacles(
      normalizedBoardSize,
      createInitialObstacleSafeCells(normalizedBoardSize),
      randomSource,
    ),
    pendingLeaderboardEntry: null,
    queuedDirection: "right",
    score: 0,
    snake,
    speedBoosts: 0,
    speedFood: null,
    status: "ready",
  };
}

export function getGameTickDelay(game: Pick<GameState, "score" | "speedBoosts" | "status">) {
  if (game.status !== "running") {
    return null;
  }

  const baseTickDelay = Math.max(78, 156 - Math.floor(game.score / 4) * 8);

  if (game.speedBoosts === 0) {
    return baseTickDelay;
  }

  const boostedSpeed = Math.round(1000 / baseTickDelay) + game.speedBoosts;

  return Math.max(MIN_GAME_TICK_DELAY_MS, Math.round(1000 / boostedSpeed));
}

export function getLeaderboardRank(score: number, leaderboard: LeaderboardEntry[]) {
  if (score <= 0) {
    return null;
  }

  const nextRank = leaderboard.findIndex((entry) => score > entry.score);

  if (nextRank >= 0) {
    return nextRank;
  }

  return leaderboard.length < LEADERBOARD_LIMIT ? leaderboard.length : null;
}

export function queueGameDirection(current: GameState, nextDirection: Direction): GameState {
  if (current.status === "lost" || isOppositeDirection(nextDirection, current.direction)) {
    return current;
  }

  return {
    ...current,
    direction: current.status === "ready" ? nextDirection : current.direction,
    queuedDirection: nextDirection,
    status: current.status === "ready" ? "running" : current.status,
  };
}

export function spawnTimedFood(
  current: GameState,
  kind: TimedFoodKind,
  options: TimedFoodOptions = {},
): GameState {
  if (current.status !== "running" || current[kind] !== null) {
    return current;
  }

  const otherTimedFood = kind === "bonusFood" ? current.speedFood : current.bonusFood;
  const timedFood = createTimedFood(
    current.boardSize,
    current.snake,
    current.food,
    [
      ...current.obstacles,
      ...(otherTimedFood === null ? [] : [otherTimedFood.position]),
    ],
    {
      ...options,
      preferredDistanceTargets: kind === "bonusFood" ? current.obstacles : undefined,
      preferredMaxDistance: kind === "bonusFood" ? BONUS_FOOD_OBSTACLE_DISTANCE_MAX : undefined,
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

export function advanceSnakeGame(
  current: GameState,
  {
    leaderboard = [],
    leaderboardBestScore = 0,
    random = Math.random,
  }: AdvanceSnakeOptions = {},
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
  const currentBonusFood = current.bonusFood ?? null;
  const currentSpeedFood = current.speedFood ?? null;
  const ateFood = isSamePoint(nextHead, current.food);
  const ateBonusFood =
    currentBonusFood !== null && isSamePoint(nextHead, currentBonusFood.position);
  const ateSpeedFood =
    currentSpeedFood !== null && isSamePoint(nextHead, currentSpeedFood.position);
  const ateGrowthFood = ateFood || ateBonusFood || ateSpeedFood;
  const collisionBody = ateGrowthFood ? current.snake : current.snake.slice(0, -1);
  const hitWall =
    nextHead.x < 0 ||
    nextHead.x >= current.boardSize ||
    nextHead.y < 0 ||
    nextHead.y >= current.boardSize;
  const hitBody = collisionBody.some((segment) => isSamePoint(segment, nextHead));
  const hitObstacle = current.obstacles.some((obstacle) => isSamePoint(obstacle, nextHead));

  if (hitWall || hitBody || hitObstacle) {
    const rank = getLeaderboardRank(current.score, leaderboard);

    return {
      ...current,
      bonusFood: null,
      direction,
      pendingLeaderboardEntry:
        rank === null
          ? null
          : {
              rank,
              score: current.score,
            },
      queuedDirection: direction,
      speedFood: null,
      status: "lost",
    };
  }

  const nextSnake = [nextHead, ...current.snake];

  if (!ateGrowthFood) {
    nextSnake.pop();
  }

  const nextScore =
    current.score +
    (ateFood ? 1 : 0) +
    (ateBonusFood ? BONUS_FOOD_SCORE : 0) +
    (ateSpeedFood ? SPEED_FOOD_SCORE : 0);
  const nextBonusFood = ateBonusFood ? null : currentBonusFood;
  const nextSpeedBoosts =
    current.speedBoosts + (ateSpeedFood ? SPEED_FOOD_SPEED_INCREASE : 0);
  const nextSpeedFood = ateSpeedFood ? null : currentSpeedFood;
  const occupiedSpecialFood = [
    ...current.obstacles,
    ...(nextBonusFood === null ? [] : [nextBonusFood.position]),
    ...(nextSpeedFood === null ? [] : [nextSpeedFood.position]),
  ];

  return {
    bestScore: Math.max(current.bestScore, nextScore, leaderboardBestScore),
    bonusFood: nextBonusFood,
    boardSize: current.boardSize,
    direction,
    food: ateFood
      ? generateFood(current.boardSize, nextSnake, occupiedSpecialFood, random)
      : current.food,
    obstacles: current.obstacles,
    pendingLeaderboardEntry: current.pendingLeaderboardEntry,
    queuedDirection: direction,
    score: nextScore,
    snake: nextSnake,
    speedBoosts: nextSpeedBoosts,
    speedFood: nextSpeedFood,
    status: current.status,
  };
}
