"use client";

import type { ReactNode } from "react";

import { type SpaceInvadersGameState } from "@/lib/space-invaders-game-engine";
import { cn } from "@/lib/utils";

type SpaceInvadersBoardProps = {
  children?: ReactNode;
  game: SpaceInvadersGameState;
  statusLabel: string;
};

export const spaceInvaderClassNames = [
  "bg-[var(--invaders-magenta)] shadow-[0_0_18px_color-mix(in_oklch,var(--invaders-magenta)_42%,transparent)]",
  "bg-[var(--invaders-cyan)] shadow-[0_0_18px_color-mix(in_oklch,var(--invaders-cyan)_38%,transparent)]",
  "bg-[var(--invaders-cyan)] shadow-[0_0_18px_color-mix(in_oklch,var(--invaders-cyan)_38%,transparent)]",
  "bg-[var(--invaders-lime)] shadow-[0_0_18px_color-mix(in_oklch,var(--invaders-lime)_38%,transparent)]",
  "bg-[var(--invaders-lime)] shadow-[0_0_18px_color-mix(in_oklch,var(--invaders-lime)_38%,transparent)]",
] as const;

export function SpaceInvadersBoard({
  children,
  game,
  statusLabel,
}: SpaceInvadersBoardProps) {
  const activeInvaderCount = game.invaders.filter((invader) => invader.isActive).length;

  return (
    <div
      className="relative overflow-hidden rounded-md border border-[var(--invaders-board-border)] bg-[var(--invaders-board)] p-2 shadow-[0_24px_70px_color-mix(in_oklch,var(--invaders-board)_26%,transparent)]"
      style={{ aspectRatio: `${game.boardWidth} / ${game.boardHeight}` }}
    >
      <div
        aria-label={`Space Invaders board. Field ${game.boardWidth} by ${game.boardHeight}. Score ${game.score}. Lives ${game.lives}. ${activeInvaderCount} invaders remaining. ${statusLabel}.`}
        className="relative size-full overflow-hidden rounded-[0.375rem] bg-[radial-gradient(circle_at_50%_16%,color-mix(in_oklch,var(--invaders-grid)_72%,transparent),transparent_33%),linear-gradient(180deg,var(--invaders-grid),var(--invaders-board-cell))]"
        data-testid="space-invaders-board"
        role="img"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          aria-hidden="true"
          style={{
            backgroundImage:
              "radial-gradient(circle, var(--invaders-star) 1px, transparent 1.5px), linear-gradient(var(--invaders-grid-line) 1px, transparent 1px)",
            backgroundPosition: "6px 8px, 0 0",
            backgroundSize: "34px 42px, 100% 40px",
          }}
        />

        <span
          className="absolute inset-x-4 h-px bg-[var(--invaders-base)] shadow-[0_0_14px_color-mix(in_oklch,var(--invaders-base)_58%,transparent)]"
          aria-hidden="true"
          style={{
            top: `${(game.baseY / game.boardHeight) * 100}%`,
          }}
        />

        {game.invaders.map((invader) => (
          <span
            aria-hidden="true"
            className={cn(
              "absolute rounded-[0.18rem] border border-[color-mix(in_oklch,white_26%,transparent)] transition-opacity",
              spaceInvaderClassNames[invader.row],
              !invader.isActive && "opacity-0",
            )}
            data-testid={invader.isActive ? "space-invaders-invader" : undefined}
            key={invader.id}
            style={{
              clipPath:
                "polygon(12% 34%, 24% 8%, 76% 8%, 88% 34%, 100% 34%, 100% 72%, 82% 72%, 82% 100%, 64% 100%, 64% 72%, 36% 72%, 36% 100%, 18% 100%, 18% 72%, 0 72%, 0 34%)",
              height: `${(invader.height / game.boardHeight) * 100}%`,
              left: `${(invader.x / game.boardWidth) * 100}%`,
              top: `${(invader.y / game.boardHeight) * 100}%`,
              width: `${(invader.width / game.boardWidth) * 100}%`,
            }}
          />
        ))}

        {game.playerShot ? (
          <span
            aria-hidden="true"
            className="absolute rounded-full bg-[var(--invaders-shot)] shadow-[0_0_18px_color-mix(in_oklch,var(--invaders-shot)_68%,transparent)]"
            data-testid="space-invaders-player-shot"
            style={{
              height: `${(game.playerShot.height / game.boardHeight) * 100}%`,
              left: `${(game.playerShot.x / game.boardWidth) * 100}%`,
              top: `${(game.playerShot.y / game.boardHeight) * 100}%`,
              width: `${(game.playerShot.width / game.boardWidth) * 100}%`,
            }}
          />
        ) : null}

        <span
          aria-hidden="true"
          className="absolute"
          data-testid="space-invaders-player"
          style={{
            height: `${(game.player.height / game.boardHeight) * 100}%`,
            left: `${(game.player.x / game.boardWidth) * 100}%`,
            top: `${(game.player.y / game.boardHeight) * 100}%`,
            width: `${(game.player.width / game.boardWidth) * 100}%`,
          }}
        >
          <span className="absolute inset-x-0 bottom-0 h-[62%] rounded-t-md bg-[var(--invaders-player)] shadow-[0_0_22px_color-mix(in_oklch,var(--invaders-player)_48%,transparent)]" />
          <span className="absolute left-1/2 top-0 h-[64%] w-[26%] -translate-x-1/2 rounded-t-sm bg-[var(--invaders-player)]" />
        </span>
      </div>

      {children}
    </div>
  );
}
