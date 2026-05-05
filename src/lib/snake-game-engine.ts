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
};

export type TimedFoodKind = "bonusFood" | "speedFood";

type RandomSource = () => number;

type TimedFoodOptions = {
  now?: () => number;
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
export const BONUS_FOOD_SCORE = 2;
export const BONUS_FOOD_SPAWN_DELAY_MAX_MS = 10_000;
export const BONUS_FOOD_SPAWN_DELAY_MIN_MS = 4_000;
export const BONUS_FOOD_TIMEOUT_MAX_MS = 12_000;
export const BONUS_FOOD_TIMEOUT_MIN_MS = 6_000;
export const LEADERBOARD_LIMIT = 3;
export const MIN_GAME_TICK_DELAY_MS = 50;
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
  const occupiedCells = new Set([...snake, food, ...additionalOccupiedCells].map(getPointKey));
  const boardCells = createBoardCells(boardSize);
  const openCells = boardCells.filter(
    (cell) =>
      !occupiedCells.has(getPointKey(cell)) &&
      snake.every(
        (segment) => getManhattanDistance(cell, segment) >= BONUS_FOOD_MIN_SNAKE_DISTANCE,
      ),
  );
  const nextCell = openCells[Math.floor(random() * openCells.length)];

  return nextCell ?? null;
}

export function createTimedFood(
  boardSize: number,
  snake: Point[],
  food: Point,
  additionalOccupiedCells: Point[] = [],
  { now = Date.now, random = Math.random }: TimedFoodOptions = {},
) {
  const position = generateTimedFoodPosition(
    boardSize,
    snake,
    food,
    additionalOccupiedCells,
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
}: CreateInitialGameOptions = {}): GameState {
  const normalizedBoardSize = normalizeBoardSize(boardSize);

  return {
    bestScore,
    bonusFood: null,
    boardSize: normalizedBoardSize,
    direction: "right",
    food: createInitialFood(normalizedBoardSize),
    pendingLeaderboardEntry: null,
    queuedDirection: "right",
    score: 0,
    snake: createInitialSnake(normalizedBoardSize),
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
    otherTimedFood === null ? [] : [otherTimedFood.position],
    options,
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

  if (hitWall || hitBody) {
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
    ...(nextBonusFood === null ? [] : [nextBonusFood.position]),
    ...(nextSpeedFood === null ? [] : [nextSpeedFood.position]),
  ];

  return {
    bestScore: Math.max(current.bestScore, nextScore, leaderboardBestScore),
    bonusFood: nextBonusFood,
    boardSize: current.boardSize,
    direction,
    food: ateFood ? generateFood(current.boardSize, nextSnake, occupiedSpecialFood, random) : current.food,
    pendingLeaderboardEntry: current.pendingLeaderboardEntry,
    queuedDirection: direction,
    score: nextScore,
    snake: nextSnake,
    speedBoosts: nextSpeedBoosts,
    speedFood: nextSpeedFood,
    status: current.status,
  };
}
