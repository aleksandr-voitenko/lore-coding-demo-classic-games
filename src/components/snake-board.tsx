"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";

import {
  createBoardCells,
  getActiveTimedFoodEntries,
  getPointKey,
  isTimedFoodKind,
  type GameState,
  type TimedFoodKind,
} from "@/lib/snake-game-engine";
import type { FoodFeedback } from "@/lib/snake-food-feedback";
import { cn } from "@/lib/utils";

type BoardCellType = "body" | "food" | "head" | "obstacle" | TimedFoodKind;

type SnakeBoardProps = {
  children?: ReactNode;
  foodFeedbacks: FoodFeedback[];
  game: GameState;
  onFoodFeedbackAnimationEnd: (id: number) => void;
  statusLabel: string;
};

const timedFoodCellClassNames: Record<TimedFoodKind, string> = {
  bonusFood:
    "rounded-full bg-[var(--snake-bonus-food)] shadow-[0_0_20px_color-mix(in_oklch,var(--snake-bonus-food)_58%,transparent)]",
  speedFood:
    "scale-75 rotate-45 rounded-[0.08rem] bg-[var(--snake-speed-food)] shadow-[0_0_20px_color-mix(in_oklch,var(--snake-speed-food)_60%,transparent)]",
  slowFood:
    "scale-90 rounded-none bg-[var(--snake-slow-food)] shadow-[0_0_20px_color-mix(in_oklch,var(--snake-slow-food)_62%,transparent)] [clip-path:polygon(50%_8%,92%_88%,8%_88%)]",
};

export function SnakeBoard({
  children,
  foodFeedbacks,
  game,
  onFoodFeedbackAnimationEnd,
  statusLabel,
}: SnakeBoardProps) {
  const boardCells = useMemo(() => createBoardCells(game.boardSize), [game.boardSize]);
  const activeTimedFoodEntries = useMemo(
    () =>
      getActiveTimedFoodEntries({
        bonusFood: game.bonusFood,
        slowFood: game.slowFood,
        speedFood: game.speedFood,
      }),
    [game.bonusFood, game.slowFood, game.speedFood],
  );
  const activeTimedFoodLabel = activeTimedFoodEntries
    .map(({ rule }) => ` ${rule.label} active.`)
    .join("");

  const occupiedCells = useMemo(() => {
    const cells = new Map<string, BoardCellType>();

    game.obstacles.forEach((obstacle) => {
      cells.set(getPointKey(obstacle), "obstacle");
    });
    if (game.food !== null) {
      cells.set(getPointKey(game.food), "food");
    }
    activeTimedFoodEntries.forEach(({ kind, timedFood }) => {
      cells.set(getPointKey(timedFood.position), kind);
    });
    game.snake.forEach((segment, index) => {
      cells.set(getPointKey(segment), index === 0 ? "head" : "body");
    });

    return cells;
  }, [activeTimedFoodEntries, game.food, game.obstacles, game.snake]);

  return (
    <div className="relative aspect-square overflow-hidden rounded-md border border-[var(--snake-board-border)] bg-[var(--snake-board)] p-2 shadow-[0_24px_70px_color-mix(in_oklch,var(--snake-board)_24%,transparent)]">
      <div
        aria-label={`Snake board. Field ${game.boardSize} by ${game.boardSize}. Score ${game.score}. ${statusLabel}.${
          game.obstacles.length === 0 ? "" : ` ${game.obstacles.length} obstacle blocks.`
        }${activeTimedFoodLabel}`}
        className="grid size-full gap-px rounded-[0.375rem] bg-[var(--snake-grid)] p-px"
        data-testid="snake-board"
        role="img"
        style={{
          gridTemplateColumns: `repeat(${game.boardSize}, minmax(0, 1fr))`,
        }}
      >
        {boardCells.map((cell) => {
          const cellType = occupiedCells.get(getPointKey(cell));
          const timedFoodCellClassName = isTimedFoodKind(cellType)
            ? timedFoodCellClassNames[cellType]
            : null;

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
                cellType === "obstacle" &&
                  "rounded-[0.12rem] bg-[var(--snake-obstacle)] shadow-[inset_0_1px_0_color-mix(in_oklch,var(--snake-obstacle-edge)_65%,transparent),inset_0_-2px_0_color-mix(in_oklch,black_28%,transparent)]",
                timedFoodCellClassName,
              )}
              key={getPointKey(cell)}
            />
          );
        })}
      </div>

      {game.status === "running" ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-2 overflow-hidden rounded-[0.375rem]"
        >
          {foodFeedbacks.map((feedback) => (
            <div
              className="snake-food-feedback absolute z-10 flex min-w-12 flex-col items-center justify-center gap-0.5 rounded-md border border-[color-mix(in_oklch,var(--snake-board-text)_28%,transparent)] bg-[color-mix(in_oklch,var(--snake-board)_80%,transparent)] px-2 py-1 text-center text-sm font-black leading-none text-[var(--snake-board-text)] shadow-[0_10px_24px_color-mix(in_oklch,var(--snake-board)_38%,transparent)] backdrop-blur-[1px]"
              data-testid="snake-food-feedback"
              key={feedback.id}
              onAnimationEnd={() => onFoodFeedbackAnimationEnd(feedback.id)}
              style={{
                left: `${((feedback.position.x + 0.5) / game.boardSize) * 100}%`,
                top: `${((feedback.position.y + 0.5) / game.boardSize) * 100}%`,
              }}
            >
              {feedback.lines.map((line, index) => (
                <span className="whitespace-nowrap" key={`${feedback.id}-${index}`}>
                  {line}
                </span>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {children}
    </div>
  );
}
