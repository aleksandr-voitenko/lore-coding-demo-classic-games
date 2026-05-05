"use client";

import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  SaveIcon,
} from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Direction = "up" | "right" | "down" | "left";
type GameStatus = "ready" | "running" | "paused" | "lost";

type Point = {
  x: number;
  y: number;
};

type LeaderboardEntry = {
  name: string;
  score: number;
};

type TimedFood = {
  expiresAt: number;
  position: Point;
};

type PendingLeaderboardEntry = {
  rank: number;
  score: number;
};

type GameState = {
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

type LeaderboardPanelProps = {
  slotTestIdPrefix: string;
  slots: Array<LeaderboardEntry | null>;
  testId: string;
};

type CreateInitialGameOptions = {
  bestScore?: number;
  boardSize?: number;
};

const DEFAULT_BOARD_SIZE = 19;
const MIN_BOARD_SIZE = 11;
const MAX_BOARD_SIZE = 25;
const BOARD_SIZE_STEP = 2;
const BONUS_FOOD_MIN_SNAKE_DISTANCE = 5;
const BONUS_FOOD_SCORE = 2;
const BONUS_FOOD_SPAWN_DELAY_MAX_MS = 10_000;
const BONUS_FOOD_SPAWN_DELAY_MIN_MS = 4_000;
const BONUS_FOOD_TIMEOUT_MAX_MS = 12_000;
const BONUS_FOOD_TIMEOUT_MIN_MS = 6_000;
const LEADERBOARD_LIMIT = 3;
const LEADERBOARD_CHANGE_EVENT = "classic-snake:leaderboard-change";
const EMPTY_LEADERBOARD_SNAPSHOT = "";
const LEADERBOARD_STORAGE_KEY = "classic-snake:leaderboard:v1";
const LEADERBOARD_STORAGE_VERSION = 1;
const MAX_PLAYER_NAME_LENGTH = 18;
const MIN_GAME_TICK_DELAY_MS = 50;
const SPEED_FOOD_SCORE = 3;
const SPEED_FOOD_SPEED_INCREASE = 1;
const BOARD_SIZE_OPTIONS = Array.from(
  { length: Math.floor((MAX_BOARD_SIZE - MIN_BOARD_SIZE) / BOARD_SIZE_STEP) + 1 },
  (_, index) => MIN_BOARD_SIZE + index * BOARD_SIZE_STEP,
);
const START_SCREEN_CELLS = Array.from({ length: 15 }, (_, index) => ({
  index,
  isSnake: [2, 7, 8, 9, 14].includes(index),
}));

const directionOffsets: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

const keyDirections: Record<string, Direction> = {
  ArrowUp: "up",
  w: "up",
  W: "up",
  ArrowRight: "right",
  d: "right",
  D: "right",
  ArrowDown: "down",
  s: "down",
  S: "down",
  ArrowLeft: "left",
  a: "left",
  A: "left",
};

const statusLabels: Record<GameStatus, string> = {
  ready: "Ready",
  running: "Running",
  paused: "Paused",
  lost: "Game over",
};

function getPointKey(point: Point) {
  return `${point.x}:${point.y}`;
}

function isSamePoint(first: Point, second: Point) {
  return first.x === second.x && first.y === second.y;
}

function getManhattanDistance(first: Point, second: Point) {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
}

function getRandomDuration(minMs: number, maxMs: number) {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function normalizeBoardSize(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_BOARD_SIZE;
  }

  const clampedValue = Math.min(MAX_BOARD_SIZE, Math.max(MIN_BOARD_SIZE, Math.round(value)));
  const steppedOffset =
    Math.round((clampedValue - MIN_BOARD_SIZE) / BOARD_SIZE_STEP) * BOARD_SIZE_STEP;

  return Math.min(MAX_BOARD_SIZE, Math.max(MIN_BOARD_SIZE, MIN_BOARD_SIZE + steppedOffset));
}

function createBoardCells(boardSize: number) {
  return Array.from({ length: boardSize * boardSize }, (_, index) => ({
    x: index % boardSize,
    y: Math.floor(index / boardSize),
  }));
}

function createInitialSnake(boardSize: number): Point[] {
  const center = Math.floor(boardSize / 2);

  return [
    { x: center, y: center },
    { x: center - 1, y: center },
    { x: center - 2, y: center },
  ];
}

function createInitialFood(boardSize: number): Point {
  const center = Math.floor(boardSize / 2);

  return {
    x: Math.min(boardSize - 2, center + 4),
    y: center,
  };
}

function isOppositeDirection(first: Direction, second: Direction) {
  const firstOffset = directionOffsets[first];
  const secondOffset = directionOffsets[second];

  return firstOffset.x + secondOffset.x === 0 && firstOffset.y + secondOffset.y === 0;
}

function generateFood(boardSize: number, snake: Point[], additionalOccupiedCells: Point[] = []) {
  const occupiedCells = new Set([...snake, ...additionalOccupiedCells].map(getPointKey));
  const boardCells = createBoardCells(boardSize);
  const openCells = boardCells.filter((cell) => !occupiedCells.has(getPointKey(cell)));
  const nextCell = openCells[Math.floor(Math.random() * openCells.length)];

  return nextCell ?? { x: 0, y: 0 };
}

function generateTimedFoodPosition(
  boardSize: number,
  snake: Point[],
  food: Point,
  additionalOccupiedCells: Point[] = [],
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
  const nextCell = openCells[Math.floor(Math.random() * openCells.length)];

  return nextCell ?? null;
}

function createTimedFood(
  boardSize: number,
  snake: Point[],
  food: Point,
  additionalOccupiedCells: Point[] = [],
) {
  const position = generateTimedFoodPosition(boardSize, snake, food, additionalOccupiedCells);

  if (position === null) {
    return null;
  }

  return {
    expiresAt: Date.now() + getRandomDuration(BONUS_FOOD_TIMEOUT_MIN_MS, BONUS_FOOD_TIMEOUT_MAX_MS),
    position,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePlayerName(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, MAX_PLAYER_NAME_LENGTH);
}

function normalizeLeaderboard(value: unknown): LeaderboardEntry[] {
  const candidateEntries =
    isRecord(value) && value.version === LEADERBOARD_STORAGE_VERSION
      ? value.entries
      : Array.isArray(value)
        ? value
        : [];

  if (!Array.isArray(candidateEntries)) {
    return [];
  }

  return candidateEntries
    .flatMap((entry) => {
      if (!isRecord(entry) || typeof entry.score !== "number" || !Number.isFinite(entry.score)) {
        return [];
      }

      const score = Math.floor(entry.score);

      if (score <= 0) {
        return [];
      }

      return [
        {
          name: normalizePlayerName(entry.name),
          score,
        },
      ];
    })
    .sort((first, second) => second.score - first.score)
    .slice(0, LEADERBOARD_LIMIT);
}

function getStoredLeaderboardSnapshot() {
  if (typeof window === "undefined") {
    return EMPTY_LEADERBOARD_SNAPSHOT;
  }

  try {
    return window.localStorage.getItem(LEADERBOARD_STORAGE_KEY) ?? EMPTY_LEADERBOARD_SNAPSHOT;
  } catch {
    return EMPTY_LEADERBOARD_SNAPSHOT;
  }
}

function getServerLeaderboardSnapshot() {
  return EMPTY_LEADERBOARD_SNAPSHOT;
}

function parseLeaderboardSnapshot(snapshot: string) {
  if (snapshot === EMPTY_LEADERBOARD_SNAPSHOT) {
    return [];
  }

  try {
    return normalizeLeaderboard(JSON.parse(snapshot));
  } catch {
    return [];
  }
}

function subscribeToLeaderboardStore(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("storage", onStoreChange);
  window.addEventListener(LEADERBOARD_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(LEADERBOARD_CHANGE_EVENT, onStoreChange);
  };
}

function writeStoredLeaderboard(leaderboard: LeaderboardEntry[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      LEADERBOARD_STORAGE_KEY,
      JSON.stringify({
        entries: leaderboard,
        version: LEADERBOARD_STORAGE_VERSION,
      }),
    );
    window.dispatchEvent(new Event(LEADERBOARD_CHANGE_EVENT));
  } catch {
    return;
  }
}

function getLeaderboardRank(score: number, leaderboard: LeaderboardEntry[]) {
  if (score <= 0) {
    return null;
  }

  const nextRank = leaderboard.findIndex((entry) => score > entry.score);

  if (nextRank >= 0) {
    return nextRank;
  }

  return leaderboard.length < LEADERBOARD_LIMIT ? leaderboard.length : null;
}

function insertLeaderboardEntry(leaderboard: LeaderboardEntry[], entry: LeaderboardEntry) {
  return normalizeLeaderboard({
    entries: [...leaderboard, entry],
    version: LEADERBOARD_STORAGE_VERSION,
  });
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "SELECT" ||
    target.tagName === "TEXTAREA"
  );
}

function createInitialGame({
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

function LeaderboardPanel({ slotTestIdPrefix, slots, testId }: LeaderboardPanelProps) {
  return (
    <div
      className="flex w-full max-w-xs flex-col gap-2 rounded-md border border-[color-mix(in_oklch,var(--snake-board-text)_14%,transparent)] bg-[color-mix(in_oklch,var(--snake-grid)_42%,transparent)] p-3"
      data-testid={testId}
    >
      <p className="text-sm font-semibold">Leaderboard</p>
      <ol className="flex flex-col gap-1">
        {slots.map((entry, index) => (
          <li
            className="grid grid-cols-[1.75rem_minmax(0,1fr)_3rem] items-center gap-2 rounded-md bg-[color-mix(in_oklch,var(--snake-board)_70%,transparent)] px-2 py-1.5 text-sm"
            data-testid={`${slotTestIdPrefix}-${index + 1}`}
            key={index}
          >
            <span className="font-mono text-xs font-semibold text-[color-mix(in_oklch,var(--snake-board-text)_70%,transparent)]">
              {index + 1}
            </span>
            <span className="truncate text-left font-medium">
              {entry ? entry.name || "Anonymous" : "Open"}
            </span>
            <span className="text-right font-mono font-semibold">
              {entry?.score ?? "-"}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function SnakeGame() {
  const [game, setGame] = useState<GameState>(() => createInitialGame());
  const [playerName, setPlayerName] = useState("");
  const leaderboardSnapshot = useSyncExternalStore(
    subscribeToLeaderboardStore,
    getStoredLeaderboardSnapshot,
    getServerLeaderboardSnapshot,
  );
  const leaderboard = useMemo(
    () => parseLeaderboardSnapshot(leaderboardSnapshot),
    [leaderboardSnapshot],
  );
  const leaderboardBestScore = leaderboard[0]?.score ?? 0;
  const bestScore = Math.max(game.bestScore, leaderboardBestScore);
  const pendingLeaderboardEntry = game.pendingLeaderboardEntry;
  const visibleBonusFood = game.bonusFood ?? null;
  const visibleSpeedFood = game.speedFood ?? null;
  const boardCells = useMemo(() => createBoardCells(game.boardSize), [game.boardSize]);

  const occupiedCells = useMemo(() => {
    const cells = new Map<string, "body" | "bonusFood" | "food" | "head" | "speedFood">();

    cells.set(getPointKey(game.food), "food");
    if (visibleBonusFood !== null) {
      cells.set(getPointKey(visibleBonusFood.position), "bonusFood");
    }
    if (visibleSpeedFood !== null) {
      cells.set(getPointKey(visibleSpeedFood.position), "speedFood");
    }
    game.snake.forEach((segment, index) => {
      cells.set(getPointKey(segment), index === 0 ? "head" : "body");
    });

    return cells;
  }, [game.food, game.snake, visibleBonusFood, visibleSpeedFood]);

  const speed = useMemo(() => {
    if (game.status !== "running") {
      return null;
    }

    const baseTickDelay = Math.max(78, 156 - Math.floor(game.score / 4) * 8);

    if (game.speedBoosts === 0) {
      return baseTickDelay;
    }

    const boostedSpeed = Math.round(1000 / baseTickDelay) + game.speedBoosts;

    return Math.max(MIN_GAME_TICK_DELAY_MS, Math.round(1000 / boostedSpeed));
  }, [game.score, game.speedBoosts, game.status]);

  const leaderboardSlots = useMemo(
    () => Array.from({ length: LEADERBOARD_LIMIT }, (_, index) => leaderboard[index] ?? null),
    [leaderboard],
  );
  const canSelectBoardSize =
    game.status === "ready" || (game.status === "lost" && pendingLeaderboardEntry === null);

  const selectBoardSize = useCallback(
    (nextBoardSize: number) => {
      const boardSize = normalizeBoardSize(nextBoardSize);

      setPlayerName("");
      setGame((current) => {
        if (
          current.status === "running" ||
          current.status === "paused" ||
          current.pendingLeaderboardEntry !== null ||
          current.boardSize === boardSize
        ) {
          return current;
        }

        return createInitialGame({
          bestScore: Math.max(current.bestScore, leaderboardBestScore),
          boardSize,
        });
      });
    },
    [leaderboardBestScore],
  );

  const queueDirection = useCallback((nextDirection: Direction) => {
    setGame((current) => {
      if (current.status === "lost" || isOppositeDirection(nextDirection, current.direction)) {
        return current;
      }

      return {
        ...current,
        direction: current.status === "ready" ? nextDirection : current.direction,
        queuedDirection: nextDirection,
        status: current.status === "ready" ? "running" : current.status,
      };
    });
  }, []);

  const advanceSnake = useCallback(() => {
    setGame((current) => {
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
        food: ateFood
          ? generateFood(current.boardSize, nextSnake, occupiedSpecialFood)
          : current.food,
        pendingLeaderboardEntry: current.pendingLeaderboardEntry,
        queuedDirection: direction,
        score: nextScore,
        snake: nextSnake,
        speedBoosts: nextSpeedBoosts,
        speedFood: nextSpeedFood,
        status: current.status,
      };
    });
  }, [leaderboard, leaderboardBestScore]);

  const toggleRunState = useCallback(() => {
    setPlayerName("");
    setGame((current) => {
      if (current.status === "running") {
        return { ...current, status: "paused" };
      }

      if (current.status === "paused") {
        return { ...current, status: "running" };
      }

      return {
        ...createInitialGame({
          bestScore: Math.max(current.bestScore, leaderboardBestScore),
          boardSize: current.boardSize,
        }),
        status: "running",
      };
    });
  }, [leaderboardBestScore]);

  const restartGame = useCallback(() => {
    setPlayerName("");
    setGame((current) => ({
      ...createInitialGame({
        bestScore: Math.max(current.bestScore, leaderboardBestScore),
        boardSize: current.boardSize,
      }),
      status: "running",
    }));
  }, [leaderboardBestScore]);

  const saveLeaderboardScore = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (pendingLeaderboardEntry === null) {
        return;
      }

      const nextLeaderboard = insertLeaderboardEntry(leaderboard, {
        name: playerName,
        score: pendingLeaderboardEntry.score,
      });
      const nextBestScore = nextLeaderboard[0]?.score ?? 0;

      writeStoredLeaderboard(nextLeaderboard);
      setGame((current) => ({
        ...current,
        bestScore: Math.max(current.bestScore, nextBestScore),
        pendingLeaderboardEntry: null,
      }));
      setPlayerName("");
    },
    [leaderboard, pendingLeaderboardEntry, playerName],
  );

  useEffect(() => {
    if (game.status !== "running" || visibleBonusFood !== null) {
      return;
    }

    const spawn = window.setTimeout(() => {
      setGame((current) => {
        if (current.status !== "running" || (current.bonusFood ?? null) !== null) {
          return current;
        }

        const occupiedSpecialFood =
          current.speedFood === null ? [] : [current.speedFood.position];
        const bonusFood = createTimedFood(
          current.boardSize,
          current.snake,
          current.food,
          occupiedSpecialFood,
        );

        return bonusFood === null ? current : { ...current, bonusFood };
      });
    }, getRandomDuration(BONUS_FOOD_SPAWN_DELAY_MIN_MS, BONUS_FOOD_SPAWN_DELAY_MAX_MS));

    return () => window.clearTimeout(spawn);
  }, [game.status, visibleBonusFood]);

  useEffect(() => {
    if (game.status !== "running" || visibleSpeedFood !== null) {
      return;
    }

    const spawn = window.setTimeout(() => {
      setGame((current) => {
        if (current.status !== "running" || (current.speedFood ?? null) !== null) {
          return current;
        }

        const occupiedSpecialFood =
          current.bonusFood === null ? [] : [current.bonusFood.position];
        const speedFood = createTimedFood(
          current.boardSize,
          current.snake,
          current.food,
          occupiedSpecialFood,
        );

        return speedFood === null ? current : { ...current, speedFood };
      });
    }, getRandomDuration(BONUS_FOOD_SPAWN_DELAY_MIN_MS, BONUS_FOOD_SPAWN_DELAY_MAX_MS));

    return () => window.clearTimeout(spawn);
  }, [game.status, visibleSpeedFood]);

  const bonusFoodExpiresAt = visibleBonusFood?.expiresAt ?? null;

  useEffect(() => {
    if (game.status !== "running" || bonusFoodExpiresAt === null) {
      return;
    }

    const timeout = window.setTimeout(
      () => {
        setGame((current) => {
          if (
            current.status !== "running" ||
            current.bonusFood?.expiresAt !== bonusFoodExpiresAt
          ) {
            return current;
          }

          return { ...current, bonusFood: null };
        });
      },
      Math.max(0, bonusFoodExpiresAt - Date.now()),
    );

    return () => window.clearTimeout(timeout);
  }, [bonusFoodExpiresAt, game.status]);

  const speedFoodExpiresAt = visibleSpeedFood?.expiresAt ?? null;

  useEffect(() => {
    if (game.status !== "running" || speedFoodExpiresAt === null) {
      return;
    }

    const timeout = window.setTimeout(
      () => {
        setGame((current) => {
          if (
            current.status !== "running" ||
            current.speedFood?.expiresAt !== speedFoodExpiresAt
          ) {
            return current;
          }

          return { ...current, speedFood: null };
        });
      },
      Math.max(0, speedFoodExpiresAt - Date.now()),
    );

    return () => window.clearTimeout(timeout);
  }, [game.status, speedFoodExpiresAt]);

  useEffect(() => {
    if (speed === null) {
      return;
    }

    const tick = window.setInterval(advanceSnake, speed);

    return () => window.clearInterval(tick);
  }, [advanceSnake, speed]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (pendingLeaderboardEntry !== null || isTypingTarget(event.target)) {
        return;
      }

      const nextDirection = keyDirections[event.key];

      if (nextDirection) {
        event.preventDefault();
        queueDirection(nextDirection);
        return;
      }

      if (event.key === " ") {
        event.preventDefault();
        toggleRunState();
      }

      if (event.key === "Enter" && game.status === "lost") {
        event.preventDefault();
        restartGame();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [game.status, pendingLeaderboardEntry, queueDirection, restartGame, toggleRunState]);

  const primaryAction =
    game.status === "running" ? "Pause" : game.status === "paused" ? "Resume" : "Start";
  const PrimaryIcon = game.status === "running" ? PauseIcon : PlayIcon;
  const showStartScreen = game.status === "ready";
  const showGameOverScreen = game.status === "lost";
  const showSideActions = game.status === "running" || game.status === "paused";
  const showBoardState = game.status !== "running";

  return (
    <main className="min-h-svh bg-[var(--snake-page)] px-4 py-6 text-[var(--snake-ink)] sm:px-6 lg:py-8">
      <section className="mx-auto grid w-full max-w-6xl gap-5 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[minmax(17rem,20rem)_minmax(0,1fr)] lg:items-center">
        <aside className="flex flex-col gap-4 rounded-md border border-[var(--snake-border)] bg-[var(--snake-panel)] p-4 shadow-sm">
          <div className="flex flex-col gap-2">
            <div
              className="h-2 w-14 rounded-full bg-[var(--snake-accent)]"
              aria-hidden="true"
            />
            <h1 className="text-3xl font-semibold tracking-normal text-balance">
              Classic Snake
            </h1>
            <p
              className="text-sm font-medium text-[var(--snake-muted)]"
              aria-live="polite"
              data-testid="snake-status"
            >
              {statusLabels[game.status]}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-[var(--snake-border)] p-3">
              <dt className="text-xs font-medium text-[var(--snake-muted)]">
                Score
              </dt>
              <dd
                className="font-mono text-3xl font-semibold leading-none"
                data-testid="snake-score"
              >
                {game.score}
              </dd>
            </div>
            <div className="rounded-md border border-[var(--snake-border)] p-3">
              <dt className="text-xs font-medium text-[var(--snake-muted)]">
                Best
              </dt>
              <dd
                className="font-mono text-3xl font-semibold leading-none"
                data-testid="snake-best"
              >
                {bestScore}
              </dd>
            </div>
          </dl>

          <div className="flex flex-col gap-2 rounded-md border border-[var(--snake-border)] p-3">
            <label
              className="text-xs font-medium text-[var(--snake-muted)]"
              htmlFor="snake-board-size"
            >
              Field size
            </label>
            <select
              aria-label={`Field size. Selectable from ${MIN_BOARD_SIZE} by ${MIN_BOARD_SIZE} to ${MAX_BOARD_SIZE} by ${MAX_BOARD_SIZE}.`}
              className="h-9 w-full rounded-md border border-[var(--snake-border)] bg-[var(--snake-panel)] px-3 text-sm font-semibold text-[var(--snake-ink)] outline-none transition disabled:cursor-not-allowed disabled:opacity-55 focus-visible:border-[var(--snake-head)] focus-visible:ring-3 focus-visible:ring-[color-mix(in_oklch,var(--snake-head)_25%,transparent)]"
              data-testid="snake-board-size"
              disabled={!canSelectBoardSize}
              id="snake-board-size"
              onChange={(event) => selectBoardSize(Number(event.target.value))}
              value={game.boardSize}
            >
              {BOARD_SIZE_OPTIONS.map((boardSize) => (
                <option
                  key={boardSize}
                  value={boardSize}
                >
                  {boardSize} x {boardSize}
                </option>
              ))}
            </select>
          </div>

          <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-3">
            {showSideActions ? (
              <div className="grid w-full grid-cols-[minmax(0,1fr)_2rem] gap-2">
                <Button onClick={toggleRunState} type="button">
                  <PrimaryIcon data-icon="inline-start" />
                  {primaryAction}
                </Button>
                <Button
                  aria-label="Restart"
                  onClick={restartGame}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <RotateCcwIcon />
                </Button>
              </div>
            ) : null}

            <div className="grid w-32 grid-cols-3 gap-2">
              <Button
                aria-label="Move up"
                className="col-start-2"
                onClick={() => queueDirection("up")}
                size="icon-lg"
                type="button"
                variant="outline"
              >
                <ArrowUpIcon />
              </Button>
              <Button
                aria-label="Move left"
                className="col-start-1 row-start-2"
                onClick={() => queueDirection("left")}
                size="icon-lg"
                type="button"
                variant="outline"
              >
                <ArrowLeftIcon />
              </Button>
              <Button
                aria-label="Move down"
                className="col-start-2 row-start-2"
                onClick={() => queueDirection("down")}
                size="icon-lg"
                type="button"
                variant="outline"
              >
                <ArrowDownIcon />
              </Button>
              <Button
                aria-label="Move right"
                className="col-start-3 row-start-2"
                onClick={() => queueDirection("right")}
                size="icon-lg"
                type="button"
                variant="outline"
              >
                <ArrowRightIcon />
              </Button>
            </div>
          </div>
        </aside>

        <div className="mx-auto flex w-full max-w-[min(92vw,38rem)] flex-col gap-3">
          <div className="relative aspect-square overflow-hidden rounded-md border border-[var(--snake-board-border)] bg-[var(--snake-board)] p-2 shadow-[0_24px_70px_color-mix(in_oklch,var(--snake-board)_24%,transparent)]">
            <div
              aria-label={`Snake board. Field ${game.boardSize} by ${game.boardSize}. Score ${game.score}. ${statusLabels[game.status]}.${
                visibleBonusFood === null ? "" : " Yellow apple active."
              }${visibleSpeedFood === null ? "" : " Purple diamond active."
              }`}
              className="grid size-full gap-px rounded-[0.375rem] bg-[var(--snake-grid)] p-px"
              data-testid="snake-board"
              role="img"
              style={{
                gridTemplateColumns: `repeat(${game.boardSize}, minmax(0, 1fr))`,
              }}
            >
              {boardCells.map((cell) => {
                const cellType = occupiedCells.get(getPointKey(cell));

                return (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "aspect-square rounded-[0.18rem] bg-[var(--snake-board-cell)] transition-colors",
                      cellType === "body" &&
                        "bg-[var(--snake-body)] shadow-[inset_0_-2px_0_color-mix(in_oklch,var(--snake-board)_22%,transparent)]",
                      cellType === "head" &&
                        "bg-[var(--snake-head)] shadow-[0_0_0_1px_color-mix(in_oklch,var(--snake-head)_42%,white),inset_0_-2px_0_color-mix(in_oklch,var(--snake-board)_25%,transparent)]",
                      cellType === "food" &&
                        "rounded-full bg-[var(--snake-food)] shadow-[0_0_18px_color-mix(in_oklch,var(--snake-food)_48%,transparent)]",
                      cellType === "bonusFood" &&
                        "rounded-full bg-[var(--snake-bonus-food)] shadow-[0_0_20px_color-mix(in_oklch,var(--snake-bonus-food)_58%,transparent)]",
                      cellType === "speedFood" &&
                        "scale-75 rotate-45 rounded-[0.08rem] bg-[var(--snake-speed-food)] shadow-[0_0_20px_color-mix(in_oklch,var(--snake-speed-food)_60%,transparent)]",
                    )}
                    key={getPointKey(cell)}
                  />
                );
              })}
            </div>

            {showStartScreen ? (
              <div
                className="absolute inset-2 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-[0.375rem] bg-[var(--snake-board)] px-4 py-5 text-center text-[var(--snake-board-text)]"
                data-testid="snake-start-screen"
              >
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="grid grid-cols-5 gap-1"
                    aria-hidden="true"
                  >
                    {START_SCREEN_CELLS.map(({ index, isSnake }) => (
                      <span
                        className={cn(
                          "size-3 rounded-[0.18rem] bg-[var(--snake-grid)]",
                          isSnake && "bg-[var(--snake-head)]",
                        )}
                        key={index}
                      />
                    ))}
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-3xl font-semibold tracking-normal text-balance">
                      Classic Snake
                    </p>
                    <p
                      className="text-sm font-medium text-[color-mix(in_oklch,var(--snake-board-text)_74%,transparent)]"
                      aria-live="polite"
                    >
                      {statusLabels[game.status]}
                    </p>
                  </div>
                </div>
                <LeaderboardPanel
                  slotTestIdPrefix="snake-leaderboard-slot"
                  slots={leaderboardSlots}
                  testId="snake-start-leaderboard"
                />
                <Button
                  className="min-w-32"
                  data-testid="snake-start-button"
                  onClick={toggleRunState}
                  size="lg"
                  type="button"
                  variant="secondary"
                >
                  <PlayIcon data-icon="inline-start" />
                  Start
                </Button>
              </div>
            ) : showGameOverScreen ? (
              <div
                className="absolute inset-2 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-[0.375rem] bg-[color-mix(in_oklch,var(--snake-board)_78%,transparent)] px-4 py-5 text-center text-[var(--snake-board-text)] backdrop-blur-[2px]"
                data-testid="snake-game-over-screen"
              >
                {pendingLeaderboardEntry ? (
                  <>
                    <form
                      className="flex w-full max-w-xs flex-col items-center gap-3"
                      data-testid="snake-leaderboard-form"
                      onSubmit={saveLeaderboardScore}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <p className="text-sm font-semibold">
                          Top {pendingLeaderboardEntry.rank + 1} score
                        </p>
                        <p
                          className="font-mono text-5xl font-semibold leading-none"
                          data-testid="snake-qualifying-score"
                        >
                          {pendingLeaderboardEntry.score}
                        </p>
                      </div>
                      <div className="flex w-full flex-col gap-1 text-left">
                        <label
                          className="text-xs font-medium text-[color-mix(in_oklch,var(--snake-board-text)_76%,transparent)]"
                          htmlFor="snake-player-name"
                        >
                          Name
                        </label>
                        <input
                          autoComplete="name"
                          autoFocus
                          className="h-9 w-full rounded-md border border-[color-mix(in_oklch,var(--snake-board-text)_22%,transparent)] bg-[color-mix(in_oklch,var(--snake-board-text)_10%,transparent)] px-3 text-sm font-medium text-[var(--snake-board-text)] outline-none transition placeholder:text-[color-mix(in_oklch,var(--snake-board-text)_54%,transparent)] focus-visible:border-[var(--snake-head)] focus-visible:ring-3 focus-visible:ring-[color-mix(in_oklch,var(--snake-head)_35%,transparent)]"
                          data-testid="snake-player-name"
                          id="snake-player-name"
                          maxLength={MAX_PLAYER_NAME_LENGTH}
                          onChange={(event) => setPlayerName(event.target.value)}
                          placeholder="Player name"
                          type="text"
                          value={playerName}
                        />
                      </div>
                      <div className="w-full">
                        <Button
                          className="w-full"
                          data-testid="snake-save-score-button"
                          size="lg"
                          type="submit"
                          variant="secondary"
                        >
                          <SaveIcon data-icon="inline-start" />
                          Save
                        </Button>
                      </div>
                    </form>
                    <LeaderboardPanel
                      slotTestIdPrefix="snake-final-leaderboard-slot"
                      slots={leaderboardSlots}
                      testId="snake-final-leaderboard"
                    />
                  </>
                ) : (
                  <>
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-3xl font-semibold tracking-normal text-balance">
                        {statusLabels[game.status]}
                      </p>
                      <div className="flex flex-col items-center gap-0.5">
                        <p className="text-sm font-semibold text-[color-mix(in_oklch,var(--snake-board-text)_76%,transparent)]">
                          Your score:
                        </p>
                        <p className="font-mono text-4xl font-semibold leading-none">
                          {game.score}
                        </p>
                      </div>
                    </div>
                    <LeaderboardPanel
                      slotTestIdPrefix="snake-final-leaderboard-slot"
                      slots={leaderboardSlots}
                      testId="snake-final-leaderboard"
                    />
                    <Button
                      className="min-w-36"
                      data-testid="snake-new-game-button"
                      onClick={restartGame}
                      size="lg"
                      type="button"
                      variant="secondary"
                    >
                      <RotateCcwIcon data-icon="inline-start" />
                      New game
                    </Button>
                  </>
                )}
              </div>
            ) : showBoardState ? (
              <div
                className="absolute inset-2 flex items-center justify-center rounded-[0.375rem] bg-[color-mix(in_oklch,var(--snake-board)_72%,transparent)] text-center text-[var(--snake-board-text)] backdrop-blur-[2px]"
                data-testid="snake-board-state"
              >
                <p className="text-2xl font-semibold tracking-normal">
                  {statusLabels[game.status]}
                </p>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between rounded-md border border-[var(--snake-border)] bg-[var(--snake-panel)] px-3 py-2 text-xs font-medium text-[var(--snake-muted)]">
            <span data-testid="snake-length">Length {game.snake.length}</span>
            <span data-testid="snake-speed">
              Speed {speed === null ? "0" : `${Math.round(1000 / speed)}`}
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
