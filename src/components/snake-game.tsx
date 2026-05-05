"use client";

import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Direction = "up" | "right" | "down" | "left";
type GameStatus = "ready" | "running" | "paused" | "lost";

type Point = {
  x: number;
  y: number;
};

type GameState = {
  bestScore: number;
  direction: Direction;
  food: Point;
  queuedDirection: Direction;
  score: number;
  snake: Point[];
  status: GameStatus;
};

const BOARD_SIZE = 19;
const BOARD_CELLS = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => ({
  x: index % BOARD_SIZE,
  y: Math.floor(index / BOARD_SIZE),
}));
const INITIAL_SNAKE: Point[] = [
  { x: 9, y: 9 },
  { x: 8, y: 9 },
  { x: 7, y: 9 },
];
const INITIAL_FOOD: Point = { x: 13, y: 9 };

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

function isOppositeDirection(first: Direction, second: Direction) {
  const firstOffset = directionOffsets[first];
  const secondOffset = directionOffsets[second];

  return firstOffset.x + secondOffset.x === 0 && firstOffset.y + secondOffset.y === 0;
}

function generateFood(snake: Point[]) {
  const occupiedCells = new Set(snake.map(getPointKey));
  const openCells = BOARD_CELLS.filter((cell) => !occupiedCells.has(getPointKey(cell)));
  const nextCell = openCells[Math.floor(Math.random() * openCells.length)];

  return nextCell ?? { x: 0, y: 0 };
}

function createInitialGame(bestScore = 0): GameState {
  return {
    bestScore,
    direction: "right",
    food: INITIAL_FOOD,
    queuedDirection: "right",
    score: 0,
    snake: INITIAL_SNAKE,
    status: "ready",
  };
}

export function SnakeGame() {
  const [game, setGame] = useState<GameState>(() => createInitialGame());

  const occupiedCells = useMemo(() => {
    const cells = new Map<string, "body" | "food" | "head">();

    cells.set(getPointKey(game.food), "food");
    game.snake.forEach((segment, index) => {
      cells.set(getPointKey(segment), index === 0 ? "head" : "body");
    });

    return cells;
  }, [game.food, game.snake]);

  const speed = useMemo(() => {
    if (game.status !== "running") {
      return null;
    }

    return Math.max(78, 156 - Math.floor(game.score / 4) * 8);
  }, [game.score, game.status]);

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
      const ateFood = isSamePoint(nextHead, current.food);
      const collisionBody = ateFood ? current.snake : current.snake.slice(0, -1);
      const hitWall =
        nextHead.x < 0 ||
        nextHead.x >= BOARD_SIZE ||
        nextHead.y < 0 ||
        nextHead.y >= BOARD_SIZE;
      const hitBody = collisionBody.some((segment) => isSamePoint(segment, nextHead));

      if (hitWall || hitBody) {
        return {
          ...current,
          direction,
          queuedDirection: direction,
          status: "lost",
        };
      }

      const nextSnake = [nextHead, ...current.snake];

      if (!ateFood) {
        nextSnake.pop();
      }

      const nextScore = ateFood ? current.score + 1 : current.score;

      return {
        bestScore: Math.max(current.bestScore, nextScore),
        direction,
        food: ateFood ? generateFood(nextSnake) : current.food,
        queuedDirection: direction,
        score: nextScore,
        snake: nextSnake,
        status: current.status,
      };
    });
  }, []);

  const toggleRunState = useCallback(() => {
    setGame((current) => {
      if (current.status === "running") {
        return { ...current, status: "paused" };
      }

      if (current.status === "paused") {
        return { ...current, status: "running" };
      }

      return {
        ...createInitialGame(current.bestScore),
        status: "running",
      };
    });
  }, []);

  const restartGame = useCallback(() => {
    setGame((current) => ({
      ...createInitialGame(current.bestScore),
      status: "running",
    }));
  }, []);

  useEffect(() => {
    if (speed === null) {
      return;
    }

    const tick = window.setInterval(advanceSnake, speed);

    return () => window.clearInterval(tick);
  }, [advanceSnake, speed]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
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
  }, [game.status, queueDirection, restartGame, toggleRunState]);

  const primaryAction = game.status === "running" ? "Pause" : game.status === "paused" ? "Resume" : "Start";
  const PrimaryIcon = game.status === "running" ? PauseIcon : PlayIcon;
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
                {game.bestScore}
              </dd>
            </div>
          </dl>

          <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-3">
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
              aria-label={`Snake board. Score ${game.score}. ${statusLabels[game.status]}.`}
              className="grid size-full gap-px rounded-[0.375rem] bg-[var(--snake-grid)] p-px"
              data-testid="snake-board"
              role="img"
              style={{
                gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
              }}
            >
              {BOARD_CELLS.map((cell) => {
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
                    )}
                    key={getPointKey(cell)}
                  />
                );
              })}
            </div>

            {showBoardState ? (
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
