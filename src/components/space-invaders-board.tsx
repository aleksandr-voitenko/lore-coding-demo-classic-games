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
  containerType: "size",
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

function getBoardEntityStyle({
  boardHeight,
  boardWidth,
  height,
  width,
  x,
  y,
}: {
  boardHeight: number;
  boardWidth: number;
  height: number;
  width: number;
  x: number;
  y: number;
}): CSSProperties {
  return {
    height: `${(height / boardHeight) * 100}%`,
    transform: `translate3d(${(x / boardWidth) * 100}cqw, ${(y / boardHeight) * 100}cqh, 0)`,
    width: `${(width / boardWidth) * 100}%`,
  };
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
              className={cn(
                "absolute left-0 top-0 transition-opacity will-change-transform",
                !invader.isActive && "opacity-0",
              )}
              data-testid={invader.isActive ? "space-invaders-invader" : undefined}
              key={invader.id}
              style={getBoardEntityStyle({
                boardHeight: game.boardHeight,
                boardWidth: game.boardWidth,
                height: invader.height,
                width: invader.width,
                x: invader.x,
                y: invader.y,
              })}
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
            className="absolute left-0 top-0 bg-contain bg-center bg-no-repeat drop-shadow-[0_0_12px_color-mix(in_oklch,var(--invaders-shot)_72%,transparent)] will-change-transform [image-rendering:pixelated]"
            data-testid="space-invaders-player-shot"
            style={{
              backgroundImage: `url("${playerShotSpriteSrc}")`,
              ...getBoardEntityStyle({
                boardHeight: game.boardHeight,
                boardWidth: game.boardWidth,
                height: game.playerShot.height,
                width: game.playerShot.width,
                x: game.playerShot.x,
                y: game.playerShot.y,
              }),
            }}
          />
        ) : null}

        {game.invaderShots.map((shot) => (
          <span
            aria-hidden="true"
            className="absolute left-0 top-0 rounded-full bg-[var(--invaders-magenta)] shadow-[0_0_10px_color-mix(in_oklch,var(--invaders-magenta)_70%,transparent)] will-change-transform"
            data-testid="space-invaders-invader-shot"
            key={shot.id}
            style={getBoardEntityStyle({
              boardHeight: game.boardHeight,
              boardWidth: game.boardWidth,
              height: shot.height,
              width: shot.width,
              x: shot.x,
              y: shot.y,
            })}
          />
        ))}

        <span
          aria-hidden="true"
          className="absolute left-0 top-0 bg-contain bg-center bg-no-repeat drop-shadow-[0_0_18px_color-mix(in_oklch,var(--invaders-player)_56%,transparent)] will-change-transform [image-rendering:pixelated]"
          data-testid="space-invaders-player"
          style={{
            backgroundImage: `url("${playerShipSpriteSrc}")`,
            ...getBoardEntityStyle({
              boardHeight: game.boardHeight,
              boardWidth: game.boardWidth,
              height: game.player.height,
              width: game.player.width,
              x: game.player.x,
              y: game.player.y,
            }),
          }}
        />
      </div>

      {children}
    </div>
  );
}
