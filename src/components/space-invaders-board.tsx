"use client";

import type { CSSProperties, ReactNode } from "react";

import {
  isSpaceInvaderShielded,
  SPACE_INVADERS_PLAYER_SHIELD_FLASH_TICKS,
  SPACE_INVADERS_SCORE_POPUP_TICKS,
  type SpaceInvadersExplosionKind,
  type SpaceInvadersExplosionVariant,
  type SpaceInvadersGameState,
  type SpaceInvadersInvaderShot,
  type SpaceInvadersInvaderShotKind,
  type SpaceInvadersPlayerShotKind,
  type SpaceInvader,
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
const shieldExplosionSpriteSrc = getSpaceInvadersAssetSrc("explosion-shield");
const playerShipSpriteSrc = getSpaceInvadersAssetSrc("player-ship");
const playerShotSpriteSrc = getSpaceInvadersAssetSrc("player-shot");
const playerPiercingShotSpriteSrc = getSpaceInvadersAssetSrc("player-piercing-shot");
const ufoSpriteSrc = getSpaceInvadersAssetSrc("ufo");
const hudHealthIconSrc = getSpaceInvadersAssetSrc("hud-health");
const hudScoreIconSrc = getSpaceInvadersAssetSrc("hud-score");
const invaderShotSpriteSrcByKind: Partial<Record<SpaceInvadersInvaderShotKind, string>> = {
  "armor-wave": getSpaceInvadersAssetSrc("invader-shot-armor-wave"),
  burst: getSpaceInvadersAssetSrc("invader-shot-burst"),
  commander: getSpaceInvadersAssetSrc("invader-shot-commander"),
  counterfire: getSpaceInvadersAssetSrc("invader-shot-counterfire"),
  needle: getSpaceInvadersAssetSrc("invader-shot-needle"),
  scatter: getSpaceInvadersAssetSrc("invader-shot-scatter"),
  standard: getSpaceInvadersAssetSrc("invader-shot-standard"),
  "splitter-fork": getSpaceInvadersAssetSrc("invader-shot-splitter-fork"),
  "splitter-fragment": getSpaceInvadersAssetSrc("invader-shot-splitter-fragment"),
};
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

type SpaceInvadersShieldTether = {
  path: string;
  source: SpaceInvader;
  target: SpaceInvader;
};

function getScorePopupNumberStyle(scoreScale: number | undefined): CSSProperties {
  const fontSize = Number((0.72 * (scoreScale ?? 1)).toFixed(4));

  return {
    fontSize: `${fontSize}rem`,
  };
}

function SpaceInvadersHudMetric({
  align,
  iconSrc,
  testId,
  value,
  valueTestId,
}: {
  align: "left" | "right";
  iconSrc: string;
  testId: string;
  value: number;
  valueTestId: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute top-[clamp(0.45rem,2cqw,0.85rem)] z-30 flex min-w-[clamp(3.35rem,10cqw,4.75rem)] items-center gap-[clamp(0.25rem,1cqw,0.45rem)] rounded-[0.35rem] bg-[rgb(0_0_0_/_0.46)] px-[clamp(0.35rem,1.4cqw,0.6rem)] py-[clamp(0.22rem,0.8cqw,0.35rem)] text-[var(--invaders-board-text)] shadow-[0_0_16px_rgb(0_0_0_/_0.58)] backdrop-blur-[1px]",
        align === "left"
          ? "left-[clamp(0.45rem,2cqw,0.85rem)]"
          : "right-[clamp(0.45rem,2cqw,0.85rem)] justify-end",
      )}
      data-testid={testId}
    >
      <span
        className="block size-[clamp(1.05rem,4.8cqw,1.65rem)] shrink-0 bg-contain bg-center bg-no-repeat drop-shadow-[0_0_8px_rgb(255_255_255_/_0.34)] [image-rendering:pixelated]"
        style={{ backgroundImage: `url("${iconSrc}")` }}
      />
      <span
        className="font-mono text-[clamp(0.72rem,3.8cqw,1.35rem)] font-extrabold leading-none tracking-normal tabular-nums text-white"
        data-testid={valueTestId}
      >
        {value}
      </span>
    </div>
  );
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

const shieldBearerInvaderSprite = {
  glowClassName:
    "drop-shadow-[0_0_14px_color-mix(in_oklch,var(--invaders-cyan)_64%,transparent)]",
  spriteClassName: "inset-x-[-16%] inset-y-[-24%]",
  src: getSpaceInvadersAssetSrc("alien-shield-bearer"),
} as const;

const revengeInvaderSprite = {
  glowClassName:
    "drop-shadow-[0_0_15px_color-mix(in_oklch,var(--invaders-red)_70%,transparent)]",
  spriteClassName: "inset-x-[-16%] inset-y-[-24%]",
  src: getSpaceInvadersAssetSrc("alien-revenge-alien"),
} as const;

const splitterInvaderSprite = {
  glowClassName:
    "drop-shadow-[0_0_15px_color-mix(in_oklch,var(--invaders-magenta)_58%,transparent)]",
  spriteClassName: "inset-x-[-16%] inset-y-[-24%]",
  src: getSpaceInvadersAssetSrc("alien-splitter"),
} as const;

const armoredInvaderSpriteSrcByHitPoints: Record<1 | 2 | 3, string> = {
  1: getSpaceInvadersAssetSrc("alien-armored-1"),
  2: getSpaceInvadersAssetSrc("alien-armored-2"),
  3: getSpaceInvadersAssetSrc("alien-armored-3"),
};

const armoredInvaderSprite = {
  glowClassName:
    "drop-shadow-[0_0_15px_color-mix(in_oklch,var(--invaders-yellow)_62%,transparent)]",
  spriteClassName: "inset-x-[-16%] inset-y-[-24%]",
} as const;

export function getSpaceInvaderSprite(row: number) {
  return spaceInvaderSprites[row % spaceInvaderSprites.length];
}

function getSpaceInvaderRenderSprite(invader: Pick<SpaceInvader, "hitPoints" | "kind" | "row">) {
  if (invader.kind === "shield-bearer") {
    return shieldBearerInvaderSprite;
  }

  if (invader.kind === "revenge") {
    return revengeInvaderSprite;
  }

  if (invader.kind === "splitter" || invader.kind === "splitter-fragment") {
    return splitterInvaderSprite;
  }

  if (invader.kind === "armored") {
    const hitPoints = Math.max(1, Math.min(3, Math.floor(invader.hitPoints))) as
      | 1
      | 2
      | 3;

    return {
      ...armoredInvaderSprite,
      src: armoredInvaderSpriteSrcByHitPoints[hitPoints],
    };
  }

  return {
    ...getSpaceInvaderSprite(invader.row),
    spriteClassName: "inset-[-8%]",
  };
}

const invaderShotClassNames: Record<SpaceInvadersInvaderShotKind, string> = {
  "armor-wave":
    "drop-shadow-[0_0_20px_color-mix(in_oklch,var(--invaders-yellow)_84%,transparent)]",
  commander:
    "drop-shadow-[0_0_14px_color-mix(in_oklch,var(--invaders-yellow)_72%,transparent)]",
  counterfire:
    "drop-shadow-[0_0_16px_color-mix(in_oklch,var(--invaders-red)_82%,transparent)]",
  needle:
    "drop-shadow-[0_0_12px_color-mix(in_oklch,var(--invaders-cyan)_78%,transparent)]",
  scatter:
    "drop-shadow-[0_0_10px_color-mix(in_oklch,var(--invaders-lime)_72%,transparent)]",
  standard:
    "drop-shadow-[0_0_10px_color-mix(in_oklch,var(--invaders-magenta)_70%,transparent)]",
  "splitter-fork":
    "drop-shadow-[0_0_16px_color-mix(in_oklch,var(--invaders-magenta)_82%,transparent)]",
  "splitter-fragment":
    "drop-shadow-[0_0_12px_color-mix(in_oklch,var(--invaders-magenta)_74%,transparent)]",
  burst:
    "drop-shadow-[0_0_12px_color-mix(in_oklch,var(--invaders-red)_70%,transparent)]",
};

const explosionClassNames: Record<SpaceInvadersExplosionKind, string> = {
  invader: "space-invaders-explosion--invader",
  player: "space-invaders-explosion--player",
  projectile: "space-invaders-explosion--projectile",
  shield: "space-invaders-explosion--shield",
  ufo: "space-invaders-explosion--ufo",
};

const explosionSpriteClassNames: Record<SpaceInvadersExplosionVariant, string> = {
  1: "space-invaders-explosion__sprite--1",
  2: "space-invaders-explosion__sprite--2",
  3: "space-invaders-explosion__sprite--3",
  4: "space-invaders-explosion__sprite--4",
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

function getEntityCenter(entity: Pick<SpaceInvader, "height" | "width" | "x" | "y">) {
  return {
    x: entity.x + entity.width / 2,
    y: entity.y + entity.height / 2,
  };
}

function formatBoardCoordinate(value: number) {
  return String(Number(value.toFixed(2)));
}

function getShieldTetherPath(source: SpaceInvader, target: SpaceInvader) {
  const sourceCenter = getEntityCenter(source);
  const targetCenter = getEntityCenter(target);
  const distance = Math.hypot(
    targetCenter.x - sourceCenter.x,
    targetCenter.y - sourceCenter.y,
  );
  const arcLift = Math.min(80, Math.max(18, distance * 0.18));
  const controlX = (sourceCenter.x + targetCenter.x) / 2;
  const controlY = Math.min(sourceCenter.y, targetCenter.y) - arcLift;

  return [
    "M",
    formatBoardCoordinate(sourceCenter.x),
    formatBoardCoordinate(sourceCenter.y),
    "Q",
    formatBoardCoordinate(controlX),
    formatBoardCoordinate(controlY),
    formatBoardCoordinate(targetCenter.x),
    formatBoardCoordinate(targetCenter.y),
  ].join(" ");
}

function getShieldSource(
  target: SpaceInvader,
  invaders: SpaceInvader[],
): SpaceInvader | null {
  if (!isSpaceInvaderShielded(target, invaders)) {
    return null;
  }

  const targetCenter = getEntityCenter(target);

  return invaders
    .filter(
      (invader) =>
        invader.isActive &&
        invader.kind === "shield-bearer" &&
        invader.row === target.row,
    )
    .sort((first, second) => {
      const firstDistance = Math.abs(getEntityCenter(first).x - targetCenter.x);
      const secondDistance = Math.abs(getEntityCenter(second).x - targetCenter.x);

      return firstDistance - secondDistance;
    })[0] ?? null;
}

function getShieldTethers(invaders: SpaceInvader[]): SpaceInvadersShieldTether[] {
  return invaders.flatMap((target) => {
    if (!isShieldTetherTarget(target)) {
      return [];
    }

    const source = getShieldSource(target, invaders);

    return source === null
      ? []
      : [
          {
            path: getShieldTetherPath(source, target),
            source,
            target,
          },
        ];
  });
}

function isShieldTetherTarget(invader: SpaceInvader) {
  return (
    invader.isActive &&
    invader.isDiving &&
    (invader.kind === "diver" || invader.kind === "splitter-fragment")
  );
}

function getPlayerShotSpriteSrc(kind: SpaceInvadersPlayerShotKind) {
  if (kind === "piercing") {
    return playerPiercingShotSpriteSrc;
  }

  return playerShotSpriteSrc;
}

function getInvaderShotSpriteStyle(kind: SpaceInvadersInvaderShotKind): CSSProperties {
  const spriteSrc = invaderShotSpriteSrcByKind[kind];

  return spriteSrc === undefined ? {} : { backgroundImage: `url("${spriteSrc}")` };
}

function shouldFlipInvaderShotSprite(
  shot: Pick<SpaceInvadersInvaderShot, "kind" | "velocityX">,
) {
  return shot.kind === "splitter-fragment" && shot.velocityX > 0;
}

function getInvaderShotRenderStyle(
  shot: SpaceInvadersInvaderShot,
  game: Pick<SpaceInvadersGameState, "boardHeight" | "boardWidth">,
): CSSProperties {
  const entityStyle = getBoardEntityStyle({
    boardHeight: game.boardHeight,
    boardWidth: game.boardWidth,
    height: shot.height,
    width: shot.width,
    x: shot.x,
    y: shot.y,
  });
  const style = {
    ...getInvaderShotSpriteStyle(shot.kind),
    ...entityStyle,
  };

  if (!shouldFlipInvaderShotSprite(shot) || entityStyle.transform === undefined) {
    return style;
  }

  return {
    ...style,
    transform: `${entityStyle.transform} scaleX(-1)`,
  };
}

function getExplosionSpriteSrc(
  kind: SpaceInvadersExplosionKind,
  variant: SpaceInvadersExplosionVariant,
) {
  if (kind === "shield") {
    return shieldExplosionSpriteSrc;
  }

  return explosionSpriteSrcByVariant[variant];
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
  const shieldTethers = getShieldTethers(game.invaders);

  return (
    <div
      data-testid="space-invaders-board-frame"
      className="relative h-svh w-full overflow-hidden rounded-md border border-[var(--invaders-board-border)] bg-[var(--invaders-board)] p-2 shadow-[0_24px_70px_color-mix(in_oklch,var(--invaders-board)_26%,transparent)]"
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
