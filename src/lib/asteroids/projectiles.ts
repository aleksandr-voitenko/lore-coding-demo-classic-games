import {
  BULLET_RADIUS,
  BULLET_SPEED,
  BULLET_TTL_TICKS,
  MAX_ACTIVE_BULLETS,
  SHOT_COOLDOWN_TICKS,
} from "./constants";
import { getAngleVector, wrapCoordinate } from "./geometry";
import {
  applyAsteroidsShipOwnedState,
  getAsteroidsShipOwnedState,
} from "./ship";
import type {
  AsteroidsBullet,
  AsteroidsGameState,
  AsteroidsSharedWorldState,
  AsteroidsSaucerShot,
  AsteroidsShipOwnedState,
} from "./types";

type AsteroidsShipBulletFireResult = {
  nextBulletId: number;
  shipState: AsteroidsShipOwnedState;
};

export function fireAsteroidsBullet(game: AsteroidsGameState): AsteroidsGameState {
  const fired = fireAsteroidsShipBullet(game, getAsteroidsShipOwnedState(game));

  if (fired === null) {
    return game;
  }

  return {
    ...applyAsteroidsShipOwnedState(game, fired.shipState),
    nextBulletId: fired.nextBulletId,
  };
}

export function fireAsteroidsShipBullet(
  game: Pick<
    AsteroidsGameState,
    "boardHeight" | "boardWidth" | "nextBulletId" | "status"
  >,
  shipState: AsteroidsShipOwnedState,
): AsteroidsShipBulletFireResult | null {
  if (
    game.status !== "running" ||
    shipState.shipExplosion !== null ||
    shipState.shotCooldownTicks > 0 ||
    shipState.bullets.length >= MAX_ACTIVE_BULLETS
  ) {
    return null;
  }

  const heading = getAngleVector(shipState.ship.angle);
  const bulletX = wrapCoordinate(
    shipState.ship.x + heading.x * (shipState.ship.radius + BULLET_RADIUS + 1),
    game.boardWidth,
  );
  const bulletY = wrapCoordinate(
    shipState.ship.y + heading.y * (shipState.ship.radius + BULLET_RADIUS + 1),
    game.boardHeight,
  );
  const bullet: AsteroidsBullet = {
    id: `bullet-${game.nextBulletId}`,
    radius: BULLET_RADIUS,
    ttl: BULLET_TTL_TICKS,
    velocity: {
      x: shipState.ship.velocity.x + heading.x * getBulletSpeed(shipState),
      y: shipState.ship.velocity.y + heading.y * getBulletSpeed(shipState),
    },
    x: bulletX,
    y: bulletY,
  };

  return {
    nextBulletId: game.nextBulletId + 1,
    shipState: {
      ...shipState,
      bullets: [...shipState.bullets, bullet],
      shotCooldownTicks: getShotCooldownTicks(shipState),
    },
  };
}

function getBulletSpeed(game: Pick<AsteroidsShipOwnedState, "bulletSpeedMultiplier">) {
  return BULLET_SPEED * game.bulletSpeedMultiplier;
}

function getShotCooldownTicks(
  game: Pick<AsteroidsShipOwnedState, "shotIntervalMultiplier">,
) {
  return Math.max(1, Math.round(SHOT_COOLDOWN_TICKS * game.shotIntervalMultiplier));
}

export function advanceBullets(
  game: Pick<AsteroidsSharedWorldState, "boardHeight" | "boardWidth"> &
    Pick<AsteroidsShipOwnedState, "bullets">,
) {
  return game.bullets
    .map((bullet) => ({
      ...bullet,
      ttl: bullet.ttl - 1,
      x: wrapCoordinate(bullet.x + bullet.velocity.x, game.boardWidth),
      y: wrapCoordinate(bullet.y + bullet.velocity.y, game.boardHeight),
    }))
    .filter((bullet) => bullet.ttl > 0);
}

export function advanceSaucerBullets(
  game: Pick<
    AsteroidsSharedWorldState,
    "boardHeight" | "boardWidth" | "saucerBullets"
  >,
): AsteroidsSaucerShot[] {
  return game.saucerBullets
    .map((bullet) => ({
      ...bullet,
      ttl: bullet.ttl - 1,
      x: wrapCoordinate(bullet.x + bullet.velocity.x, game.boardWidth),
      y: wrapCoordinate(bullet.y + bullet.velocity.y, game.boardHeight),
    }))
    .filter((bullet) => bullet.ttl > 0);
}
