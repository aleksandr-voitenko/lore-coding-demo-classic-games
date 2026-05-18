"use client";

import type { ReactNode } from "react";

import {
  getPongBallRadius,
  PONG_BOARD_HEIGHT,
  PONG_BOARD_WIDTH,
  PONG_TARGET_SCORE,
  type PongGameState,
} from "@/lib/pong-game-engine";

type PongBoardProps = {
  children?: ReactNode;
  game: PongGameState;
  statusLabel: string;
};

export const pongBoardSizeLabel = `${PONG_BOARD_WIDTH} x ${PONG_BOARD_HEIGHT}`;

export function PongBoard({ children, game, statusLabel }: PongBoardProps) {
  const ballRadius = getPongBallRadius();

  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-md border border-[#11243c] bg-[#06101f] p-2 shadow-[0_24px_70px_rgba(7,22,38,0.32)]">
      <div
        aria-label={`Pong board. Field ${PONG_BOARD_WIDTH} by ${PONG_BOARD_HEIGHT}. Player ${game.score.player}. CPU ${game.score.cpu}. First to ${PONG_TARGET_SCORE}. ${statusLabel}.`}
        className="relative size-full overflow-hidden rounded-[0.375rem] bg-[radial-gradient(circle_at_50%_48%,rgba(56,189,248,0.16),transparent_34%),linear-gradient(180deg,#071a2f,#0a1120)]"
        data-testid="pong-board"
        role="img"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-45"
          style={{
            backgroundImage:
              "linear-gradient(rgba(125, 211, 252, 0.16) 1px, transparent 1px)",
            backgroundSize: "100% 28px",
          }}
        />

        <div
          aria-hidden="true"
          className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, rgba(226, 232, 240, 0.7) 0 16px, transparent 16px 28px)",
          }}
        />

        <span
          aria-hidden="true"
          className="absolute rounded-full bg-[#f8fafc] shadow-[0_0_22px_rgba(248,250,252,0.64)]"
          data-testid="pong-ball"
          style={{
            height: `${((ballRadius * 2) / PONG_BOARD_HEIGHT) * 100}%`,
            left: `${((game.ball.position.x - ballRadius) / PONG_BOARD_WIDTH) * 100}%`,
            top: `${((game.ball.position.y - ballRadius) / PONG_BOARD_HEIGHT) * 100}%`,
            width: `${((ballRadius * 2) / PONG_BOARD_WIDTH) * 100}%`,
          }}
        />

        <span
          aria-hidden="true"
          className="absolute rounded-full bg-[#38bdf8] shadow-[0_0_24px_rgba(56,189,248,0.46)]"
          data-testid="pong-player-paddle"
          style={{
            height: `${(game.playerPaddle.height / PONG_BOARD_HEIGHT) * 100}%`,
            left: `${(game.playerPaddle.x / PONG_BOARD_WIDTH) * 100}%`,
            top: `${(game.playerPaddle.y / PONG_BOARD_HEIGHT) * 100}%`,
            width: `${(game.playerPaddle.width / PONG_BOARD_WIDTH) * 100}%`,
          }}
        />

        <span
          aria-hidden="true"
          className="absolute rounded-full bg-[#f472b6] shadow-[0_0_24px_rgba(244,114,182,0.42)]"
          data-testid="pong-cpu-paddle"
          style={{
            height: `${(game.cpuPaddle.height / PONG_BOARD_HEIGHT) * 100}%`,
            left: `${(game.cpuPaddle.x / PONG_BOARD_WIDTH) * 100}%`,
            top: `${(game.cpuPaddle.y / PONG_BOARD_HEIGHT) * 100}%`,
            width: `${(game.cpuPaddle.width / PONG_BOARD_WIDTH) * 100}%`,
          }}
        />
      </div>

      {children}
    </div>
  );
}
