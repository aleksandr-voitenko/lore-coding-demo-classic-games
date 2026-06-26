import type { CSSProperties } from "react";

import { getInvaderShotSpriteSrc, spaceInvadersBackgroundSrc } from "@/components/space-invaders-board-assets";
import {
  isSpaceInvaderShielded,
  SPACE_INVADERS_SCORE_POPUP_TICKS,
  type SpaceInvadersExplosionKind,
  type SpaceInvadersExplosionVariant,
  type SpaceInvadersGameState,
  type SpaceInvadersInvaderShot,
  type SpaceInvadersInvaderShotKind,
  type SpaceInvader,
} from "@/lib/space-invaders-game-engine";

export const spaceInvadersBoardBackgroundStyle: CSSProperties = {
  backgroundImage: `url("${spaceInvadersBackgroundSrc}")`,
  backgroundPosition: "center",
  backgroundSize: "cover",
  containerType: "size",
};

export const spaceInvadersBoardShadeStyle: CSSProperties = {
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

export type SpaceInvadersShieldTether = {
  path: string;
  source: SpaceInvader;
  target: SpaceInvader;
};

export const invaderShotClassNames: Record<SpaceInvadersInvaderShotKind, string> = {
  "armor-wave":
    "drop-shadow-[0_0_20px_color-mix(in_oklch,var(--invaders-yellow)_84%,transparent)]",
  commander:
    "drop-shadow-[0_0_14px_color-mix(in_oklch,var(--invaders-yellow)_72%,transparent)]",
  "commander-shard":
    "drop-shadow-[0_0_10px_color-mix(in_oklch,var(--invaders-yellow)_62%,transparent)]",
  counterfire:
    "drop-shadow-[0_0_16px_color-mix(in_oklch,var(--invaders-red)_82%,transparent)]",
  mine:
    "drop-shadow-[0_0_18px_color-mix(in_oklch,var(--invaders-lime)_76%,transparent)]",
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

export const explosionClassNames: Record<SpaceInvadersExplosionKind, string> = {
  invader: "space-invaders-explosion--invader",
  mine: "space-invaders-explosion--mine",
  player: "space-invaders-explosion--player",
  projectile: "space-invaders-explosion--projectile",
  shield: "space-invaders-explosion--shield",
  ufo: "space-invaders-explosion--ufo",
};

export const explosionSpriteClassNames: Record<SpaceInvadersExplosionVariant, string> = {
  1: "space-invaders-explosion__sprite--1",
  2: "space-invaders-explosion__sprite--2",
  3: "space-invaders-explosion__sprite--3",
  4: "space-invaders-explosion__sprite--4",
};

export function getScorePopupNumberStyle(
  scoreScale: number | undefined,
): CSSProperties {
  const fontSize = Number((0.72 * (scoreScale ?? 1)).toFixed(4));

  return {
    fontSize: `${fontSize}rem`,
  };
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

export function getShieldTethers(
  invaders: SpaceInvader[],
): SpaceInvadersShieldTether[] {
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

function getInvaderShotSpriteStyle(kind: SpaceInvadersInvaderShotKind): CSSProperties {
  const spriteSrc = getInvaderShotSpriteSrc(kind);

  return spriteSrc === undefined ? {} : { backgroundImage: `url("${spriteSrc}")` };
}

function shouldFlipInvaderShotSprite(
  shot: Pick<SpaceInvadersInvaderShot, "kind" | "velocityX">,
) {
  return shot.kind === "splitter-fragment" && shot.velocityX > 0;
}

export function getInvaderShotRenderStyle(
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

export function getBoardEntityStyle({
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

export function getScorePopupTextStyle(ttlTicks: number): CSSProperties {
  return {
    ...spaceInvadersScorePopupBaseStyle,
    opacity: ttlTicks / SPACE_INVADERS_SCORE_POPUP_TICKS,
  };
}
