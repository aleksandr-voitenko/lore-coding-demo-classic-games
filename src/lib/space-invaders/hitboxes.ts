import { INVADER_SPRITE_SIZE } from "./constants";
import type { SpaceInvader } from "./types";

type InvaderHitboxRatio = {
  height: number;
  offsetX: number;
  offsetY: number;
  width: number;
};

function createInvaderHitboxRatio({
  height,
  offsetX,
  offsetY,
  width,
}: {
  height: number;
  offsetX: number;
  offsetY: number;
  width: number;
}): InvaderHitboxRatio {
  return {
    height: height / INVADER_SPRITE_SIZE,
    offsetX: offsetX / INVADER_SPRITE_SIZE,
    offsetY: offsetY / INVADER_SPRITE_SIZE,
    width: width / INVADER_SPRITE_SIZE,
  };
}

const SPACE_INVADERS_ROW_ALIEN_HITBOXES = {
  armored: {
    1: createInvaderHitboxRatio({ height: 85, offsetX: 3, offsetY: 13, width: 107 }),
    2: createInvaderHitboxRatio({ height: 83, offsetX: 3, offsetY: 14, width: 106 }),
    3: createInvaderHitboxRatio({ height: 81, offsetX: 3, offsetY: 16, width: 106 }),
  } as const satisfies Record<1 | 2 | 3, InvaderHitboxRatio>,
  mineLayer: createInvaderHitboxRatio({
    height: 92,
    offsetX: 20,
    offsetY: 10,
    width: 72,
  }),
  revenge: createInvaderHitboxRatio({
    height: 98,
    offsetX: 1,
    offsetY: 7,
    width: 110,
  }),
  rows: [
    createInvaderHitboxRatio({ height: 98, offsetX: 3, offsetY: 6, width: 106 }),
    createInvaderHitboxRatio({ height: 84, offsetX: 4, offsetY: 12, width: 104 }),
    createInvaderHitboxRatio({ height: 82, offsetX: 3, offsetY: 11, width: 106 }),
    createInvaderHitboxRatio({ height: 84, offsetX: 5, offsetY: 13, width: 102 }),
    createInvaderHitboxRatio({ height: 83, offsetX: 7, offsetY: 11, width: 98 }),
  ] as const satisfies readonly InvaderHitboxRatio[],
  shieldBearer: createInvaderHitboxRatio({
    height: 77,
    offsetX: 12,
    offsetY: 26,
    width: 88,
  }),
  splitter: createInvaderHitboxRatio({
    height: 60,
    offsetX: 4,
    offsetY: 29,
    width: 104,
  }),
};

export function getInvaderCollisionBounds(invader: SpaceInvader) {
  const hitbox = getInvaderHitboxRatio(invader);

  return {
    height: invader.height * hitbox.height,
    width: invader.width * hitbox.width,
    x: invader.x + invader.width * hitbox.offsetX,
    y: invader.y + invader.height * hitbox.offsetY,
  };
}

function getInvaderHitboxRatio(
  invader: Pick<SpaceInvader, "hitPoints" | "kind" | "row">,
) {
  if (invader.kind === "shield-bearer") {
    return SPACE_INVADERS_ROW_ALIEN_HITBOXES.shieldBearer;
  }

  if (invader.kind === "revenge") {
    return SPACE_INVADERS_ROW_ALIEN_HITBOXES.revenge;
  }

  if (invader.kind === "mine-layer") {
    return SPACE_INVADERS_ROW_ALIEN_HITBOXES.mineLayer;
  }

  if (invader.kind === "splitter" || invader.kind === "splitter-fragment") {
    return SPACE_INVADERS_ROW_ALIEN_HITBOXES.splitter;
  }

  if (invader.kind === "armored") {
    const hitPoints = Math.max(1, Math.min(3, Math.floor(invader.hitPoints))) as
      | 1
      | 2
      | 3;

    return SPACE_INVADERS_ROW_ALIEN_HITBOXES.armored[hitPoints];
  }

  return (
    SPACE_INVADERS_ROW_ALIEN_HITBOXES.rows[
      invader.row % SPACE_INVADERS_ROW_ALIEN_HITBOXES.rows.length
    ] ?? SPACE_INVADERS_ROW_ALIEN_HITBOXES.rows[0]
  );
}
