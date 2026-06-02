"use client";

import type { CSSProperties, ReactNode } from "react";

import {
  SPACE_INVADERS_PLAYER_SHIELD_FLASH_TICKS,
  SPACE_INVADERS_SCORE_POPUP_TICKS,
  type SpaceInvadersExplosionKind,
  type SpaceInvadersExplosionVariant,
  type SpaceInvadersGameState,
  type SpaceInvadersInvaderShotKind,
  type SpaceInvadersPlayerShotKind,
  type SpaceInvaderKind,
  type SpaceInvadersPowerUpKind,
} from "@/lib/space-invaders-game-engine";
import { cn } from "@/lib/utils";

type SpaceInvadersBoardProps = {
  children?: ReactNode;
  game: SpaceInvadersGameState;
  statusLabel: string;
};

const SPACE_INVADERS_ASSET_VERSION = "sprite-art-v2";
const SPACE_INVADERS_ASSET_ROOT = "/images/space-invaders";

function getSpaceInvadersAssetSrc(fileName: string) {
  return `${SPACE_INVADERS_ASSET_ROOT}/${fileName}.png?v=${SPACE_INVADERS_ASSET_VERSION}`;
}

const spaceInvadersBackgroundSrc = getSpaceInvadersAssetSrc("background");
const explosionSpriteSrcByVariant: Record<SpaceInvadersExplosionVariant, string> = {
  1: getSpaceInvadersAssetSrc("explosion-1"),
  2: getSpaceInvadersAssetSrc("explosion-2"),
  3: getSpaceInvadersAssetSrc("explosion-3"),
  4: getSpaceInvadersAssetSrc("explosion-4"),
};
const playerShipSpriteSrc = getSpaceInvadersAssetSrc("player-ship");
const playerShotSpriteSrc = getSpaceInvadersAssetSrc("player-shot");
const playerPiercingShotSpriteSrc = getSpaceInvadersAssetSrc("player-piercing-shot");
const ufoSpriteSrc = getSpaceInvadersAssetSrc("ufo");
const powerUpSpriteSrcByKind: Record<SpaceInvadersPowerUpKind, string> = {
  "bonus-score": getSpaceInvadersAssetSrc("power-up-bonus-score"),
  "burst-shot": getSpaceInvadersAssetSrc("power-up-burst-shot"),
  "extra-life": getSpaceInvadersAssetSrc("power-up-extra-life"),
  freeze: getSpaceInvadersAssetSrc("power-up-freeze"),
  "piercing-laser": getSpaceInvadersAssetSrc("power-up-piercing-laser"),
  shield: getSpaceInvadersAssetSrc("power-up-shield"),
  "shotgun-shot": getSpaceInvadersAssetSrc("power-up-shotgun-shot"),
};

export function getSpaceInvadersPowerUpSpriteSrc(kind: SpaceInvadersPowerUpKind) {
  return powerUpSpriteSrcByKind[kind];
}

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

const spaceInvadersScorePopupTextShadow = [
  "-1px -1px 0 rgb(0 0 0 / 0.95)",
  "0 -1px 0 rgb(0 0 0 / 0.95)",
  "1px -1px 0 rgb(0 0 0 / 0.95)",
  "-1px 0 0 rgb(0 0 0 / 0.95)",
  "1px 0 0 rgb(0 0 0 / 0.95)",
  "-1px 1px 0 rgb(0 0 0 / 0.95)",
  "0 1px 0 rgb(0 0 0 / 0.95)",
  "1px 1px 0 rgb(0 0 0 / 0.95)",
].join(", ");

const spaceInvadersScorePopupBaseStyle: CSSProperties = {
  color: "white",
  display: "block",
  fontWeight: 800,
  letterSpacing: 0,
  lineHeight: 1,
  paintOrder: "stroke fill",
  textShadow: spaceInvadersScorePopupTextShadow,
  WebkitTextStroke: "0.75px rgb(0 0 0 / 0.9)",
  willChange: "opacity",
};

function getScorePopupNumberStyle(scoreScale: number | undefined): CSSProperties {
  const fontSize = Number((0.72 * (scoreScale ?? 1)).toFixed(4));

  return {
    fontSize: `${fontSize}rem`,
  };
}

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

const invaderShotClassNames: Record<SpaceInvadersInvaderShotKind, string> = {
  commander:
    "rounded-[0.2rem] bg-[var(--invaders-yellow)] shadow-[0_0_14px_color-mix(in_oklch,var(--invaders-yellow)_72%,transparent)]",
  needle:
    "rounded-full bg-[var(--invaders-cyan)] shadow-[0_0_12px_color-mix(in_oklch,var(--invaders-cyan)_78%,transparent)]",
  scatter:
    "rounded-full bg-[var(--invaders-lime)] shadow-[0_0_10px_color-mix(in_oklch,var(--invaders-lime)_72%,transparent)]",
  standard:
    "rounded-full bg-[var(--invaders-magenta)] shadow-[0_0_10px_color-mix(in_oklch,var(--invaders-magenta)_70%,transparent)]",
  burst:
    "rounded-[0.35rem] bg-[var(--invaders-red)] shadow-[0_0_12px_color-mix(in_oklch,var(--invaders-red)_70%,transparent)]",
};

const explosionClassNames: Record<SpaceInvadersExplosionKind, string> = {
  invader: "space-invaders-explosion--invader",
  player: "space-invaders-explosion--player",
  ufo: "space-invaders-explosion--ufo",
};

const explosionSpriteClassNames: Record<SpaceInvadersExplosionVariant, string> = {
  1: "space-invaders-explosion__sprite--1",
  2: "space-invaders-explosion__sprite--2",
  3: "space-invaders-explosion__sprite--3",
  4: "space-invaders-explosion__sprite--4",
};

function getInvaderModifier(kind: SpaceInvaderKind) {
  if (kind !== "diver") {
    return null;
  }

  return (
    <span className="pointer-events-none absolute bottom-[2%] left-1/2 size-[28%] -translate-x-1/2 rotate-45 rounded-[0.12rem] border-b-2 border-r-2 border-white/90 bg-[color-mix(in_oklch,var(--invaders-yellow)_30%,transparent)] shadow-[0_0_10px_color-mix(in_oklch,var(--invaders-yellow)_78%,transparent)]" />
  );
}

function getPlayerShotSpriteSrc(kind: SpaceInvadersPlayerShotKind) {
  if (kind === "piercing") {
    return playerPiercingShotSpriteSrc;
  }

  return playerShotSpriteSrc;
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

function getPlayerShieldStyle(game: SpaceInvadersGameState): CSSProperties {
  const diameter = Math.max(game.player.width, game.player.height) + 24;

  return getBoardEntityStyle({
    boardHeight: game.boardHeight,
    boardWidth: game.boardWidth,
    height: diameter,
    width: diameter,
    x: game.player.x + game.player.width / 2 - diameter / 2,
    y: game.player.y + game.player.height / 2 - diameter / 2,
  });
}

function getScorePopupTextStyle(ttlTicks: number): CSSProperties {
  return {
    ...spaceInvadersScorePopupBaseStyle,
    opacity: ttlTicks / SPACE_INVADERS_SCORE_POPUP_TICKS,
  };
}

export function SpaceInvadersBoard({
  children,
  game,
  statusLabel,
}: SpaceInvadersBoardProps) {
  const activeInvaderCount = game.invaders.filter((invader) => invader.isActive).length;
  const activePowerUpCount = game.powerUps.length;
  const powerUpSummary =
    activePowerUpCount === 1
      ? "1 power up falling"
      : `${activePowerUpCount} power ups falling`;
  const isPlayerVisible = game.status !== "lost" && game.playerRespawnTicks === 0;
  const isPlayerShieldVisible = isPlayerVisible && game.playerShieldTicks > 0;
  const isPlayerShieldFlashing =
    isPlayerShieldVisible &&
    game.playerShieldTicks <= SPACE_INVADERS_PLAYER_SHIELD_FLASH_TICKS;

  return (
    <div
      className="relative overflow-hidden rounded-md border border-[var(--invaders-board-border)] bg-[var(--invaders-board)] p-2 shadow-[0_24px_70px_color-mix(in_oklch,var(--invaders-board)_26%,transparent)]"
      style={{ aspectRatio: `${game.boardWidth} / ${game.boardHeight}` }}
    >
      <div
        aria-label={`Space Invaders board. Field ${game.boardWidth} by ${game.boardHeight}. Score ${game.score}. Lives ${game.lives}. ${activeInvaderCount} invaders remaining. ${powerUpSummary}. ${statusLabel}.`}
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
              data-invader-kind={invader.kind}
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
              {getInvaderModifier(invader.kind)}
            </span>
          );
        })}

        {game.ufo.isActive ? (
          <span
            aria-hidden="true"
            className="absolute left-0 top-0 bg-contain bg-center bg-no-repeat drop-shadow-[0_0_16px_color-mix(in_oklch,var(--invaders-red)_62%,transparent)] will-change-transform [image-rendering:pixelated]"
            data-testid="space-invaders-ufo"
            data-ufo-points={game.ufo.points}
            style={{
              backgroundImage: `url("${ufoSpriteSrc}")`,
              ...getBoardEntityStyle({
                boardHeight: game.boardHeight,
                boardWidth: game.boardWidth,
                height: game.ufo.height,
                width: game.ufo.width,
                x: game.ufo.x,
                y: game.ufo.y,
              }),
            }}
          />
        ) : null}

        {game.playerShots.map((shot) => (
          <span
            aria-hidden="true"
            className="absolute left-0 top-0 bg-contain bg-center bg-no-repeat drop-shadow-[0_0_12px_color-mix(in_oklch,var(--invaders-shot)_72%,transparent)] will-change-transform [image-rendering:pixelated]"
            data-player-shot-kind={shot.kind}
            data-testid="space-invaders-player-shot"
            key={shot.id}
            style={{
              backgroundImage: `url("${getPlayerShotSpriteSrc(shot.kind)}")`,
              ...getBoardEntityStyle({
                boardHeight: game.boardHeight,
                boardWidth: game.boardWidth,
                height: shot.height,
                width: shot.width,
                x: shot.x,
                y: shot.y,
              }),
            }}
          />
        ))}

        {game.invaderShots.map((shot) => (
          <span
            aria-hidden="true"
            className={cn(
              "absolute left-0 top-0 will-change-transform",
              invaderShotClassNames[shot.kind],
            )}
            data-shot-kind={shot.kind}
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

        {game.powerUps.map((powerUp) => (
          <span
            aria-hidden="true"
            className="absolute left-0 top-0 bg-contain bg-center bg-no-repeat drop-shadow-[0_0_14px_rgb(255_255_255_/_0.42)] will-change-transform [image-rendering:pixelated]"
            data-power-up-kind={powerUp.kind}
            data-testid="space-invaders-power-up"
            key={powerUp.id}
            style={{
              backgroundImage: `url("${getSpaceInvadersPowerUpSpriteSrc(powerUp.kind)}")`,
              ...getBoardEntityStyle({
                boardHeight: game.boardHeight,
                boardWidth: game.boardWidth,
                height: powerUp.height,
                width: powerUp.width,
                x: powerUp.x,
                y: powerUp.y,
              }),
            }}
          />
        ))}

        {isPlayerShieldVisible ? (
          <span
            aria-hidden="true"
            className="space-invaders-player-shield absolute left-0 top-0 will-change-transform"
            data-shield-flashing={isPlayerShieldFlashing ? "true" : "false"}
            data-testid="space-invaders-player-shield"
            style={getPlayerShieldStyle(game)}
          >
            <span
              className={cn(
                "space-invaders-player-shield__surface",
                isPlayerShieldFlashing && "space-invaders-player-shield__surface--flashing",
              )}
            />
          </span>
        ) : null}

        {isPlayerVisible ? (
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
        ) : null}

        {game.explosions.map((explosion) => (
          <span
            aria-hidden="true"
            className="space-invaders-explosion absolute left-0 top-0"
            data-explosion-kind={explosion.kind}
            data-explosion-variant={explosion.variant}
            data-testid="space-invaders-explosion"
            key={explosion.id}
            style={getBoardEntityStyle({
              boardHeight: game.boardHeight,
              boardWidth: game.boardWidth,
              height: explosion.height,
              width: explosion.width,
              x: explosion.x,
              y: explosion.y,
            })}
          >
            <span
              className={cn(
                "space-invaders-explosion__sprite",
                explosionClassNames[explosion.kind],
                explosionSpriteClassNames[explosion.variant],
              )}
              style={{
                backgroundImage: `url("${explosionSpriteSrcByVariant[explosion.variant]}")`,
              }}
            />
          </span>
        ))}

        {game.scorePopups.map((popup) => (
          <span
            aria-hidden="true"
            className="absolute left-0 top-0 z-20 flex items-center justify-center"
            data-score-popup-label={popup.label}
            data-score-popup-points={popup.points}
            data-score-popup-scale={popup.scoreScale ?? 1}
            data-testid="space-invaders-score-popup"
            key={popup.id}
            style={getBoardEntityStyle({
              boardHeight: game.boardHeight,
              boardWidth: game.boardWidth,
              height: popup.height,
              width: popup.width,
              x: popup.x,
              y: popup.y,
            })}
          >
            <span
              className="space-invaders-score-popup__text flex flex-col items-center gap-0.5"
              style={getScorePopupTextStyle(popup.ttlTicks)}
            >
              <span style={getScorePopupNumberStyle(popup.scoreScale)}>
                +{popup.points}
              </span>
              {popup.label === undefined ? null : (
                <span className="text-[0.44rem] font-extrabold leading-none tracking-normal">
                  {popup.label}
                </span>
              )}
            </span>
          </span>
        ))}
      </div>

      {children}
    </div>
  );
}
