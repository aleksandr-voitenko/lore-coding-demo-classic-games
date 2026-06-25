"use client";

import type { ReactNode } from "react";

import {
  getPongBallRadius,
  type PongGameState,
} from "@/lib/pong-game-engine";

type PongBoardProps = {
  children?: ReactNode;
  game: PongGameState;
  smoothMotion?: boolean;
  statusLabel: string;
};

const PONG_BOARD_SMOOTH_MOTION_STYLE = {
  transitionDuration: "80ms",
  transitionProperty: "left, top",
  transitionTimingFunction: "linear",
  willChange: "left, top",
} as const;

export function PongBoard({
  children,
  game,
  smoothMotion = false,
  statusLabel,
}: PongBoardProps) {
  const ballRadius = getPongBallRadius();
  const motionStyle = smoothMotion ? PONG_BOARD_SMOOTH_MOTION_STYLE : undefined;

  return (
    <div
      className="relative overflow-hidden rounded-md border border-[var(--pong-board-border)] bg-[var(--pong-board)] p-2 shadow-[0_24px_70px_color-mix(in_oklch,var(--pong-board)_26%,transparent)]"
      style={{ aspectRatio: `${game.boardWidth} / ${game.boardHeight}` }}
    >
      <div
        aria-label={`Pong board. Field ${game.boardWidth} by ${game.boardHeight}. Score ${game.remainingScore}. Player ${game.score.player}. Computer ${game.score.cpu}. First to ${game.targetScore}. ${statusLabel}.`}
        className="relative size-full overflow-hidden rounded-[0.375rem] bg-[radial-gradient(circle_at_50%_48%,color-mix(in_oklch,var(--pong-blue)_16%,transparent),transparent_34%),linear-gradient(180deg,var(--pong-board-cell),var(--pong-board))]"
        data-testid="pong-board"
        role="img"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-45"
          style={{
            backgroundImage: "linear-gradient(var(--pong-grid-line) 1px, transparent 1px)",
            backgroundSize: "100% 28px",
          }}
        />

        <div
          aria-hidden="true"
          className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, var(--pong-score-line) 0 16px, transparent 16px 28px)",
          }}
        />

        <span
          aria-hidden="true"
          className="absolute rounded-full bg-[var(--pong-ball)]"
          data-testid="pong-ball"
          style={{
            height: `${((ballRadius * 2) / game.boardHeight) * 100}%`,
            left: `${((game.ball.position.x - ballRadius) / game.boardWidth) * 100}%`,
            top: `${((game.ball.position.y - ballRadius) / game.boardHeight) * 100}%`,
            width: `${((ballRadius * 2) / game.boardWidth) * 100}%`,
            ...motionStyle,
          }}
        />

        <span
          aria-hidden="true"
          className="absolute rounded-full bg-[var(--pong-blue)]"
          data-testid="pong-player-paddle"
          style={{
            height: `${(game.playerPaddle.height / game.boardHeight) * 100}%`,
            left: `${(game.playerPaddle.x / game.boardWidth) * 100}%`,
            top: `${(game.playerPaddle.y / game.boardHeight) * 100}%`,
            width: `${(game.playerPaddle.width / game.boardWidth) * 100}%`,
            ...motionStyle,
          }}
        />

        <span
          aria-hidden="true"
          className="absolute rounded-full bg-[var(--pong-pink)]"
          data-testid="pong-cpu-paddle"
          style={{
            height: `${(game.cpuPaddle.height / game.boardHeight) * 100}%`,
            left: `${(game.cpuPaddle.x / game.boardWidth) * 100}%`,
            top: `${(game.cpuPaddle.y / game.boardHeight) * 100}%`,
            width: `${(game.cpuPaddle.width / game.boardWidth) * 100}%`,
            ...motionStyle,
          }}
        />
      </div>

      {children}
    </div>
  );
}
