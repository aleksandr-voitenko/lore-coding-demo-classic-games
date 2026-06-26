"use client";

import type { ReactNode } from "react";

import {
  isSpaceInvaderShielded,
  SPACE_INVADERS_PLAYER_SHIELD_FLASH_TICKS,
  type SpaceInvadersGameState,
  type SpaceInvaderKind,
  type SpaceInvadersPlayer,
  type SpaceInvadersPlayerShot,
} from "@/lib/space-invaders-game-engine";
import {
  getExplosionSpriteSrc,
  getPlayerShotSpriteSrc,
  getSpaceInvaderRenderSprite,
  getSpaceInvadersPowerUpSpriteSrc,
  hudHealthIconSrc,
  hudScoreIconSrc,
  playerShipSpriteSrc,
  ufoSpriteSrc,
} from "@/components/space-invaders-board-assets";
import {
  explosionClassNames,
  explosionSpriteClassNames,
  getBoardEntityStyle,
  getInvaderShotRenderStyle,
  getScorePopupNumberStyle,
  getScorePopupTextStyle,
  getShieldTethers,
  invaderShotClassNames,
  spaceInvadersBoardBackgroundStyle,
  spaceInvadersBoardShadeStyle,
} from "@/components/space-invaders-board-rendering";
import { SpaceInvadersHudMetric } from "@/components/space-invaders-board-hud";
import { cn } from "@/lib/utils";

export {
  getSpaceInvaderSprite,
  getSpaceInvadersPowerUpSpriteSrc,
  spaceInvaderSprites,
} from "@/components/space-invaders-board-assets";

export type SpaceInvadersBoardShip = {
  id: string;
  isActive?: boolean;
  player: SpaceInvadersPlayer;
  playerRespawnTicks: number;
  playerShieldTicks: number;
  playerShots: readonly SpaceInvadersPlayerShot[];
};

type SpaceInvadersBoardGame = Pick<
  SpaceInvadersGameState,
  | "baseY"
  | "boardHeight"
  | "boardWidth"
  | "explosions"
  | "invaderShots"
  | "invaders"
  | "lives"
  | "powerUps"
  | "revengeVolleys"
  | "score"
  | "scorePopups"
  | "status"
  | "ufo"
> &
  Partial<
    Pick<
      SpaceInvadersGameState,
      "player" | "playerRespawnTicks" | "playerShieldTicks" | "playerShots"
    >
  >;

type SpaceInvadersBoardProps = {
  children?: ReactNode;
  fillViewport?: boolean;
  game: SpaceInvadersBoardGame;
  ships?: readonly SpaceInvadersBoardShip[];
  statusLabel: string;
};

function getInvaderModifier(kind: SpaceInvaderKind) {
  if (kind === "shield-bearer") {
    return (
      <span
        className="pointer-events-none absolute left-1/2 top-[-18%] z-20 flex size-[34%] -translate-x-1/2 items-center justify-center rounded-full border border-[var(--invaders-cyan)] bg-[color-mix(in_oklch,var(--invaders-cyan)_22%,transparent)] shadow-[0_0_12px_color-mix(in_oklch,var(--invaders-cyan)_82%,transparent)]"
        data-testid="space-invaders-shield-bearer-blip"
      >
        <span className="block size-[42%] rounded-full bg-white/90 shadow-[0_0_8px_white]" />
      </span>
    );
  }

  if (kind === "diver") {
    return (
      <span className="pointer-events-none absolute bottom-[2%] left-1/2 z-20 size-[28%] -translate-x-1/2 rotate-45 rounded-[0.12rem] border-b-2 border-r-2 border-white/90 bg-[color-mix(in_oklch,var(--invaders-yellow)_30%,transparent)] shadow-[0_0_10px_color-mix(in_oklch,var(--invaders-yellow)_78%,transparent)]" />
    );
  }

  return null;
}

function getSoloSpaceInvadersBoardShips(
  game: SpaceInvadersBoardGame,
): SpaceInvadersBoardShip[] {
  if (
    game.player === undefined ||
    game.playerRespawnTicks === undefined ||
    game.playerShieldTicks === undefined ||
    game.playerShots === undefined
  ) {
    return [];
  }

  return [
    {
      id: "player",
      player: game.player,
      playerRespawnTicks: game.playerRespawnTicks,
      playerShieldTicks: game.playerShieldTicks,
      playerShots: game.playerShots,
    },
  ];
}

function isSpaceInvadersBoardShipVisible(
  game: SpaceInvadersBoardGame,
  ship: SpaceInvadersBoardShip,
) {
  return (ship.isActive ?? true) && game.status !== "lost" && ship.playerRespawnTicks === 0;
}

function getSpaceInvadersBoardShipShieldStyle(
  game: SpaceInvadersBoardGame,
  ship: SpaceInvadersBoardShip,
) {
  const diameter = Math.max(ship.player.width, ship.player.height) + 24;

  return getBoardEntityStyle({
    boardHeight: game.boardHeight,
    boardWidth: game.boardWidth,
    height: diameter,
    width: diameter,
    x: ship.player.x + ship.player.width / 2 - diameter / 2,
    y: ship.player.y + ship.player.height / 2 - diameter / 2,
  });
}

export function SpaceInvadersBoard({
  children,
  fillViewport = true,
  game,
  ships,
  statusLabel,
}: SpaceInvadersBoardProps) {
  const activeInvaderCount = game.invaders.filter((invader) => invader.isActive).length;
  const activePowerUpCount = game.powerUps.length;
  const powerUpSummary =
    activePowerUpCount === 1
      ? "1 power up falling"
      : `${activePowerUpCount} power ups falling`;
  const boardShips = ships ?? getSoloSpaceInvadersBoardShips(game);
  const boardPlayerShots = boardShips.flatMap((ship) =>
    ship.playerShots.map((shot) => ({
      ship,
      shot,
    })),
  );
  const revengeAuraInvaderIds = new Set(
    game.revengeVolleys.flatMap((volley) => volley.invaderIds),
  );
  const shieldTethers = getShieldTethers(game.invaders);

  return (
    <div
      data-testid="space-invaders-board-frame"
      className={cn(
        "relative w-full overflow-hidden rounded-md border border-[var(--invaders-board-border)] bg-[var(--invaders-board)] p-2 shadow-[0_24px_70px_color-mix(in_oklch,var(--invaders-board)_26%,transparent)]",
        fillViewport && "h-svh",
      )}
      style={{ aspectRatio: `${game.boardWidth} / ${game.boardHeight}` }}
    >
      <div
        aria-label={`Space Invaders board. Field ${game.boardWidth} by ${game.boardHeight}. Score ${game.score}. Lives ${game.lives}. ${activeInvaderCount} invaders remaining. ${powerUpSummary}. ${statusLabel}.`}
        className="relative z-0 size-full overflow-hidden rounded-[0.375rem] bg-[var(--invaders-board)]"
        data-testid="space-invaders-board"
        role="img"
        style={spaceInvadersBoardBackgroundStyle}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={spaceInvadersBoardShadeStyle}
        />

        <SpaceInvadersHudMetric
          align="left"
          iconSrc={hudScoreIconSrc}
          testId="space-invaders-score-hud"
          value={game.score}
          valueTestId="space-invaders-score"
        />
        <SpaceInvadersHudMetric
          align="right"
          iconSrc={hudHealthIconSrc}
          testId="space-invaders-health-hud"
          value={game.lives}
          valueTestId="space-invaders-lives"
        />

        <span
          className="absolute inset-x-4 h-px bg-[var(--invaders-base)] shadow-[0_0_14px_color-mix(in_oklch,var(--invaders-base)_58%,transparent)]"
          aria-hidden="true"
          style={{
            top: `${(game.baseY / game.boardHeight) * 100}%`,
          }}
        />

        {shieldTethers.length > 0 ? (
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            data-testid="space-invaders-shield-tethers"
            preserveAspectRatio="none"
            viewBox={`0 0 ${game.boardWidth} ${game.boardHeight}`}
          >
            {shieldTethers.map(({ path, source, target }) => (
              <g
                data-shield-source-id={source.id}
                data-shield-target-id={target.id}
                data-testid="space-invaders-shield-tether"
                key={`${source.id}:${target.id}`}
              >
                <path
                  className="space-invaders-shield-tether__glow"
                  d={path}
                  fill="none"
                  stroke="var(--invaders-cyan)"
                  strokeLinecap="round"
                  strokeOpacity="0.22"
                  strokeWidth="8"
                />
                <path
                  className="space-invaders-shield-tether__core"
                  d={path}
                  fill="none"
                  stroke="white"
                  strokeLinecap="round"
                  strokeOpacity="0.72"
                  strokeWidth="1.4"
                />
              </g>
            ))}
          </svg>
        ) : null}

        {game.invaders.map((invader) => {
          const sprite = getSpaceInvaderRenderSprite(invader);
          const isShielded = isSpaceInvaderShielded(invader, game.invaders);
          const hasRevengeAura =
            invader.isActive && revengeAuraInvaderIds.has(invader.id);

          return (
            <span
              aria-hidden="true"
              className={cn(
                "absolute left-0 top-0 transition-opacity will-change-transform",
                !invader.isActive && "opacity-0",
              )}
              data-invader-hit-points={
                invader.kind === "armored" ? invader.hitPoints : undefined
              }
              data-invader-kind={invader.kind}
              data-invader-revenge-aura={hasRevengeAura ? "true" : undefined}
              data-invader-shielded={isShielded ? "true" : undefined}
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
              {hasRevengeAura ? (
                <span
                  className="space-invaders-revenge-aura pointer-events-none absolute inset-[-26%] z-0 rounded-full border border-[color-mix(in_oklch,var(--invaders-red)_82%,transparent)] bg-[color-mix(in_oklch,var(--invaders-red)_13%,transparent)] shadow-[0_0_18px_color-mix(in_oklch,var(--invaders-red)_72%,transparent),inset_0_0_12px_color-mix(in_oklch,var(--invaders-red)_28%,transparent)]"
                  data-testid="space-invaders-revenge-aura"
                />
              ) : null}
              {isShielded ? (
                <span
                  className="space-invaders-invader-shield pointer-events-none absolute inset-[-24%] z-0 rounded-full border border-[color-mix(in_oklch,var(--invaders-cyan)_76%,transparent)] bg-[color-mix(in_oklch,var(--invaders-cyan)_14%,transparent)] shadow-[0_0_14px_color-mix(in_oklch,var(--invaders-cyan)_70%,transparent),inset_0_0_10px_color-mix(in_oklch,var(--invaders-cyan)_28%,transparent)]"
                  data-testid="space-invaders-invader-shield"
                />
              ) : null}
              <span
                className={cn(
                  "absolute z-10 bg-contain bg-center bg-no-repeat [image-rendering:pixelated]",
                  sprite.glowClassName,
                  sprite.spriteClassName,
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

        {boardPlayerShots.map(({ ship, shot }) => (
          <span
            aria-hidden="true"
            className="absolute left-0 top-0 bg-contain bg-center bg-no-repeat drop-shadow-[0_0_12px_color-mix(in_oklch,var(--invaders-shot)_72%,transparent)] will-change-transform [image-rendering:pixelated]"
            data-player-shot-kind={shot.kind}
            data-ship-id={ship.id}
            data-testid="space-invaders-player-shot"
            key={`${ship.id}:${shot.id}`}
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
              "absolute left-0 top-0 bg-contain bg-center bg-no-repeat will-change-transform [image-rendering:pixelated]",
              invaderShotClassNames[shot.kind],
            )}
            data-shot-kind={shot.kind}
            data-testid="space-invaders-invader-shot"
            key={shot.id}
            style={getInvaderShotRenderStyle(shot, game)}
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

        {boardShips.map((ship) => {
          const isPlayerVisible = isSpaceInvadersBoardShipVisible(game, ship);
          const isPlayerShieldVisible = isPlayerVisible && ship.playerShieldTicks > 0;
          const isPlayerShieldFlashing =
            isPlayerShieldVisible &&
            ship.playerShieldTicks <= SPACE_INVADERS_PLAYER_SHIELD_FLASH_TICKS;

          return isPlayerShieldVisible ? (
            <span
              aria-hidden="true"
              className="space-invaders-player-shield absolute left-0 top-0 will-change-transform"
              data-shield-flashing={isPlayerShieldFlashing ? "true" : "false"}
              data-ship-id={ship.id}
              data-testid="space-invaders-player-shield"
              key={`${ship.id}:shield`}
              style={getSpaceInvadersBoardShipShieldStyle(game, ship)}
            >
              <span
                className={cn(
                  "space-invaders-player-shield__surface",
                  isPlayerShieldFlashing &&
                    "space-invaders-player-shield__surface--flashing",
                )}
              />
            </span>
          ) : null;
        })}

        {boardShips.map((ship) => {
          if (!isSpaceInvadersBoardShipVisible(game, ship)) {
            return null;
          }

          return (
            <span
              aria-hidden="true"
              className="absolute left-0 top-0 bg-contain bg-center bg-no-repeat drop-shadow-[0_0_18px_color-mix(in_oklch,var(--invaders-player)_56%,transparent)] will-change-transform [image-rendering:pixelated]"
              data-ship-id={ship.id}
              data-testid="space-invaders-player"
              key={ship.id}
              style={{
                backgroundImage: `url("${playerShipSpriteSrc}")`,
                ...getBoardEntityStyle({
                  boardHeight: game.boardHeight,
                  boardWidth: game.boardWidth,
                  height: ship.player.height,
                  width: ship.player.width,
                  x: ship.player.x,
                  y: ship.player.y,
                }),
              }}
            />
          );
        })}

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
                backgroundImage: `url("${getExplosionSpriteSrc(
                  explosion.kind,
                  explosion.variant,
                )}")`,
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
