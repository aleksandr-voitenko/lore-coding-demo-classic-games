import {
  BULLET_RADIUS,
  BULLET_SPEED,
  BULLET_TTL_TICKS,
  MAX_ACTIVE_BULLETS,
  SHOT_COOLDOWN_TICKS,
} from "./constants";
import { getAngleVector, wrapCoordinate } from "./geometry";
import type {
  AsteroidsBullet,
  AsteroidsGameState,
  AsteroidsSaucerShot,
} from "./types";

export function fireAsteroidsBullet(game: AsteroidsGameState): AsteroidsGameState {
  if (
    game.status !== "running" ||
    game.shipExplosion !== null ||
    game.shotCooldownTicks > 0 ||
    game.bullets.length >= MAX_ACTIVE_BULLETS
  ) {
    return game;
  }

  const heading = getAngleVector(game.ship.angle);
  const bulletX = wrapCoordinate(
    game.ship.x + heading.x * (game.ship.radius + BULLET_RADIUS + 1),
    game.boardWidth,
  );
  const bulletY = wrapCoordinate(
    game.ship.y + heading.y * (game.ship.radius + BULLET_RADIUS + 1),
    game.boardHeight,
  );
  const bullet: AsteroidsBullet = {
    id: `bullet-${game.nextBulletId}`,
    radius: BULLET_RADIUS,
    ttl: BULLET_TTL_TICKS,
    velocity: {
      x: game.ship.velocity.x + heading.x * getBulletSpeed(game),
      y: game.ship.velocity.y + heading.y * getBulletSpeed(game),
    },
    x: bulletX,
    y: bulletY,
  };

  return {
    ...game,
    bullets: [...game.bullets, bullet],
    nextBulletId: game.nextBulletId + 1,
    shotCooldownTicks: getShotCooldownTicks(game),
  };
}

function getBulletSpeed(game: Pick<AsteroidsGameState, "bulletSpeedMultiplier">) {
  return BULLET_SPEED * game.bulletSpeedMultiplier;
}

function getShotCooldownTicks(game: Pick<AsteroidsGameState, "shotIntervalMultiplier">) {
  return Math.max(1, Math.round(SHOT_COOLDOWN_TICKS * game.shotIntervalMultiplier));
}

export function advanceBullets(
  game: Pick<AsteroidsGameState, "boardHeight" | "boardWidth" | "bullets">,
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
  game: Pick<AsteroidsGameState, "boardHeight" | "boardWidth" | "saucerBullets">,
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
