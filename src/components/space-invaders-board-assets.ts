import type {
  SpaceInvadersExplosionKind,
  SpaceInvadersExplosionVariant,
  SpaceInvadersInvaderShotKind,
  SpaceInvadersPlayerShotKind,
  SpaceInvadersPowerUpKind,
  SpaceInvader,
} from "@/lib/space-invaders-game-engine";

const SPACE_INVADERS_ASSET_VERSION = "sprite-art-v2";
const SPACE_INVADERS_ASSET_ROOT = "/images/space-invaders";

function getSpaceInvadersAssetSrc(fileName: string) {
  return `${SPACE_INVADERS_ASSET_ROOT}/${fileName}.png?v=${SPACE_INVADERS_ASSET_VERSION}`;
}

export const spaceInvadersBackgroundSrc = getSpaceInvadersAssetSrc("background");
const explosionSpriteSrcByVariant: Record<SpaceInvadersExplosionVariant, string> = {
  1: getSpaceInvadersAssetSrc("explosion-1"),
  2: getSpaceInvadersAssetSrc("explosion-2"),
  3: getSpaceInvadersAssetSrc("explosion-3"),
  4: getSpaceInvadersAssetSrc("explosion-4"),
};
const shieldExplosionSpriteSrc = getSpaceInvadersAssetSrc("explosion-shield");
export const playerShipSpriteSrc = getSpaceInvadersAssetSrc("player-ship");
const playerShotSpriteSrc = getSpaceInvadersAssetSrc("player-shot");
const playerPiercingShotSpriteSrc = getSpaceInvadersAssetSrc("player-piercing-shot");
export const ufoSpriteSrc = getSpaceInvadersAssetSrc("ufo");
export const hudHealthIconSrc = getSpaceInvadersAssetSrc("hud-health");
export const hudScoreIconSrc = getSpaceInvadersAssetSrc("hud-score");
const invaderShotSpriteSrcByKind: Partial<Record<SpaceInvadersInvaderShotKind, string>> = {
  "armor-wave": getSpaceInvadersAssetSrc("invader-shot-armor-wave"),
  burst: getSpaceInvadersAssetSrc("invader-shot-burst"),
  commander: getSpaceInvadersAssetSrc("invader-shot-commander"),
  "commander-shard": getSpaceInvadersAssetSrc("invader-shot-commander"),
  counterfire: getSpaceInvadersAssetSrc("invader-shot-counterfire"),
  mine: getSpaceInvadersAssetSrc("invader-shot-mine"),
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

const mineLayerInvaderSprite = {
  glowClassName:
    "drop-shadow-[0_0_15px_color-mix(in_oklch,var(--invaders-lime)_58%,transparent)]",
  spriteClassName: "inset-x-[-16%] inset-y-[-24%]",
  src: getSpaceInvadersAssetSrc("alien-mine-layer"),
} as const;

export function getSpaceInvaderSprite(row: number) {
  return spaceInvaderSprites[row % spaceInvaderSprites.length];
}

export function getSpaceInvaderRenderSprite(
  invader: Pick<SpaceInvader, "hitPoints" | "kind" | "row">,
) {
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

  if (invader.kind === "mine-layer") {
    return mineLayerInvaderSprite;
  }

  return {
    ...getSpaceInvaderSprite(invader.row),
    spriteClassName: "inset-[-8%]",
  };
}

export function getPlayerShotSpriteSrc(kind: SpaceInvadersPlayerShotKind) {
  if (kind === "piercing") {
    return playerPiercingShotSpriteSrc;
  }

  return playerShotSpriteSrc;
}

export function getInvaderShotSpriteSrc(kind: SpaceInvadersInvaderShotKind) {
  return invaderShotSpriteSrcByKind[kind];
}

export function getExplosionSpriteSrc(
  kind: SpaceInvadersExplosionKind,
  variant: SpaceInvadersExplosionVariant,
) {
  if (kind === "shield") {
    return shieldExplosionSpriteSrc;
  }

  return explosionSpriteSrcByVariant[variant];
}
