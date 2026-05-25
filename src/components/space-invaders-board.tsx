"use client";

import type { CSSProperties, ReactNode } from "react";

import { type SpaceInvadersGameState } from "@/lib/space-invaders-game-engine";
import { cn } from "@/lib/utils";

type SpaceInvadersBoardProps = {
  children?: ReactNode;
  game: SpaceInvadersGameState;
  statusLabel: string;
};

const SPACE_INVADERS_ASSET_VERSION = "sprite-art-v1";
const SPACE_INVADERS_ASSET_ROOT = "/images/space-invaders";

function getSpaceInvadersAssetSrc(fileName: string) {
  return `${SPACE_INVADERS_ASSET_ROOT}/${fileName}.png?v=${SPACE_INVADERS_ASSET_VERSION}`;
}

const spaceInvadersBackgroundSrc = getSpaceInvadersAssetSrc("background");
const playerShipSpriteSrc = getSpaceInvadersAssetSrc("player-ship");
const playerShotSpriteSrc = getSpaceInvadersAssetSrc("player-shot");

const spaceInvadersBoardBackgroundStyle: CSSProperties = {
  backgroundImage: `url("${spaceInvadersBackgroundSrc}")`,
  backgroundPosition: "center",
  backgroundSize: "cover",
};

const spaceInvadersBoardShadeStyle: CSSProperties = {
  background:
    "linear-gradient(180deg, rgb(0 0 0 / 0.34), rgb(0 0 0 / 0.12) 48%, rgb(0 0 0 / 0.42))",
};

export const spaceInvaderSprites = [
  {
    glowClassName:
      "drop-shadow-[0_0_12px_color-mix(in_oklch,var(--invaders-magenta)_56%,transparent)]",
    src: getSpaceInvadersAssetSrc("alien-purple"),
  },
  {
    glowClassName:
      "drop-shadow-[0_0_12px_color-mix(in_oklch,var(--invaders-red)_48%,transparent)]",
    src: getSpaceInvadersAssetSrc("alien-red"),
  },
  {
    glowClassName:
      "drop-shadow-[0_0_12px_color-mix(in_oklch,var(--invaders-yellow)_50%,transparent)]",
    src: getSpaceInvadersAssetSrc("alien-yellow"),
  },
  {
    glowClassName:
      "drop-shadow-[0_0_12px_color-mix(in_oklch,var(--invaders-cyan)_50%,transparent)]",
    src: getSpaceInvadersAssetSrc("alien-blue"),
  },
  {
    glowClassName:
      "drop-shadow-[0_0_12px_color-mix(in_oklch,var(--invaders-lime)_50%,transparent)]",
    src: getSpaceInvadersAssetSrc("alien-green"),
  },
] as const;

export function getSpaceInvaderSprite(row: number) {
  return spaceInvaderSprites[row % spaceInvaderSprites.length];
}

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
        className="relative size-full overflow-hidden rounded-[0.375rem] bg-[var(--invaders-board)]"
        data-testid="space-invaders-board"
        role="img"
        style={spaceInvadersBoardBackgroundStyle}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={spaceInvadersBoardShadeStyle}
        />

        <span
          className="absolute inset-x-4 h-px bg-[var(--invaders-base)] shadow-[0_0_14px_color-mix(in_oklch,var(--invaders-base)_58%,transparent)]"
          aria-hidden="true"
          style={{
            top: `${(game.baseY / game.boardHeight) * 100}%`,
          }}
        />

        {game.invaders.map((invader) => {
          const sprite = getSpaceInvaderSprite(invader.row);

          return (
            <span
              aria-hidden="true"
              className={cn("absolute transition-opacity", !invader.isActive && "opacity-0")}
              data-testid={invader.isActive ? "space-invaders-invader" : undefined}
              key={invader.id}
              style={{
                height: `${(invader.height / game.boardHeight) * 100}%`,
                left: `${(invader.x / game.boardWidth) * 100}%`,
                top: `${(invader.y / game.boardHeight) * 100}%`,
                width: `${(invader.width / game.boardWidth) * 100}%`,
              }}
            >
              <span
                className={cn(
                  "absolute inset-[-8%] bg-contain bg-center bg-no-repeat [image-rendering:pixelated]",
                  sprite.glowClassName,
                )}
                style={{ backgroundImage: `url("${sprite.src}")` }}
              />
            </span>
          );
        })}

        {game.playerShot ? (
          <span
            aria-hidden="true"
            className="absolute bg-contain bg-center bg-no-repeat drop-shadow-[0_0_12px_color-mix(in_oklch,var(--invaders-shot)_72%,transparent)] [image-rendering:pixelated]"
            data-testid="space-invaders-player-shot"
            style={{
              backgroundImage: `url("${playerShotSpriteSrc}")`,
              height: `${(game.playerShot.height / game.boardHeight) * 100}%`,
              left: `${(game.playerShot.x / game.boardWidth) * 100}%`,
              top: `${(game.playerShot.y / game.boardHeight) * 100}%`,
              width: `${(game.playerShot.width / game.boardWidth) * 100}%`,
            }}
          />
        ) : null}

        <span
          aria-hidden="true"
          className="absolute bg-contain bg-center bg-no-repeat drop-shadow-[0_0_18px_color-mix(in_oklch,var(--invaders-player)_56%,transparent)] [image-rendering:pixelated]"
          data-testid="space-invaders-player"
          style={{
            backgroundImage: `url("${playerShipSpriteSrc}")`,
            height: `${(game.player.height / game.boardHeight) * 100}%`,
            left: `${(game.player.x / game.boardWidth) * 100}%`,
            top: `${(game.player.y / game.boardHeight) * 100}%`,
            width: `${(game.player.width / game.boardWidth) * 100}%`,
          }}
        />
      </div>

      {children}
    </div>
  );
}
