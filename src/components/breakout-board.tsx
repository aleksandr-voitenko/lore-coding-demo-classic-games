"use client";

import type { ReactNode } from "react";

import {
  getBreakoutBallRadius,
  type BreakoutGameState,
} from "@/lib/breakout-game-engine";
import { cn } from "@/lib/utils";

type BreakoutBoardProps = {
  children?: ReactNode;
  game: BreakoutGameState;
  statusLabel: string;
};

export const breakoutBrickClassNames = [
  "bg-[var(--breakout-red)] shadow-[0_0_16px_color-mix(in_oklch,var(--breakout-red)_34%,transparent)]",
  "bg-[var(--breakout-orange)] shadow-[0_0_16px_color-mix(in_oklch,var(--breakout-orange)_34%,transparent)]",
  "bg-[var(--breakout-yellow)] shadow-[0_0_16px_color-mix(in_oklch,var(--breakout-yellow)_34%,transparent)]",
  "bg-[var(--breakout-green)] shadow-[0_0_16px_color-mix(in_oklch,var(--breakout-green)_34%,transparent)]",
  "bg-[var(--breakout-blue)] shadow-[0_0_16px_color-mix(in_oklch,var(--breakout-blue)_34%,transparent)]",
] as const;

export function BreakoutBoard({ children, game, statusLabel }: BreakoutBoardProps) {
  const ballRadius = getBreakoutBallRadius();
  const activeBrickCount = game.bricks.filter((brick) => brick.isActive).length;

  return (
    <div
      className="relative overflow-hidden rounded-md border border-[var(--breakout-board-border)] bg-[var(--breakout-board)] p-2 shadow-[0_24px_70px_color-mix(in_oklch,var(--breakout-board)_26%,transparent)]"
      style={{ aspectRatio: `${game.boardWidth} / ${game.boardHeight}` }}
    >
      <div
        aria-label={`Breakout board. Field ${game.boardWidth} by ${game.boardHeight}. Score ${game.score}. Lives ${game.lives}. ${activeBrickCount} bricks remaining. ${statusLabel}.`}
        className="relative size-full overflow-hidden rounded-[0.375rem] bg-[radial-gradient(circle_at_50%_12%,color-mix(in_oklch,var(--breakout-grid)_62%,transparent),transparent_32%),linear-gradient(180deg,var(--breakout-grid),var(--breakout-board-cell))]"
        data-testid="breakout-board"
        role="img"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-45"
          aria-hidden="true"
          style={{
            backgroundImage:
              "linear-gradient(var(--breakout-grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--breakout-grid-line) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {game.bricks.map((brick) => (
          <span
            aria-hidden="true"
            className={cn(
              "absolute rounded-[0.2rem] border border-[var(--breakout-brick-border)] transition-opacity",
              breakoutBrickClassNames[brick.row],
              !brick.isActive && "opacity-0",
            )}
            data-testid={brick.isActive ? "breakout-brick" : undefined}
            key={brick.id}
            style={{
              height: `${(brick.height / game.boardHeight) * 100}%`,
              left: `${(brick.x / game.boardWidth) * 100}%`,
              top: `${(brick.y / game.boardHeight) * 100}%`,
              width: `${(brick.width / game.boardWidth) * 100}%`,
            }}
          />
        ))}

        <span
          aria-hidden="true"
          className="absolute rounded-full bg-[var(--breakout-ball)]"
          data-testid="breakout-ball"
          style={{
            height: `${((ballRadius * 2) / game.boardHeight) * 100}%`,
            left: `${((game.ball.position.x - ballRadius) / game.boardWidth) * 100}%`,
            top: `${((game.ball.position.y - ballRadius) / game.boardHeight) * 100}%`,
            width: `${((ballRadius * 2) / game.boardWidth) * 100}%`,
          }}
        />

        <span
          aria-hidden="true"
          className="absolute rounded-full bg-[var(--breakout-paddle)]"
          data-testid="breakout-paddle"
          style={{
            height: `${(game.paddle.height / game.boardHeight) * 100}%`,
            left: `${(game.paddle.x / game.boardWidth) * 100}%`,
            top: `${(game.paddle.y / game.boardHeight) * 100}%`,
            width: `${(game.paddle.width / game.boardWidth) * 100}%`,
          }}
        />
      </div>

      {children}
    </div>
  );
}
