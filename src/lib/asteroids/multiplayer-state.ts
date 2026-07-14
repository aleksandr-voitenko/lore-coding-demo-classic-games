import { getAsteroidsShipOwnedState } from "./ship";
import type {
  Asteroid,
  AsteroidsBullet,
  AsteroidsGameState,
  AsteroidsPoint,
  AsteroidsSaucer,
  AsteroidsSharedWorldState,
  AsteroidsShip,
  AsteroidsShipExplosion,
} from "./types";
import type {
  AsteroidsMultiplayerGameState,
  AsteroidsMultiplayerShips,
  AsteroidsMultiplayerShipState,
  AsteroidsShipSeat,
} from "./multiplayer-types";

export function cloneAsteroidsMultiplayerState(
  game: AsteroidsMultiplayerGameState,
): AsteroidsMultiplayerGameState {
  return {
    ...game,
    asteroids: game.asteroids.map(cloneAsteroid),
    powerUp: cloneNullableObject(game.powerUp),
    saucer: cloneNullableSaucer(game.saucer),
    saucerBullets: game.saucerBullets.map(cloneBullet),
    ships: cloneAsteroidsMultiplayerShips(game.ships),
  };
}

export function pickAsteroidsMultiplayerSharedState(
  game: AsteroidsGameState,
): AsteroidsSharedWorldState {
  return {
    asteroids: game.asteroids,
    boardHeight: game.boardHeight,
    boardWidth: game.boardWidth,
    difficulty: game.difficulty,
    lives: game.lives,
    nextAsteroidId: game.nextAsteroidId,
    nextBulletId: game.nextBulletId,
    nextPowerUpId: game.nextPowerUpId,
    nextSaucerBulletId: game.nextSaucerBulletId,
    nextSaucerId: game.nextSaucerId,
    powerUp: game.powerUp,
    powerUpSpawnCooldownTicks: game.powerUpSpawnCooldownTicks,
    saucer: game.saucer,
    saucerBullets: game.saucerBullets,
    saucerSpawnCooldownTicks: game.saucerSpawnCooldownTicks,
    score: game.score,
    startingAsteroidCount: game.startingAsteroidCount,
    status: game.status,
    wave: game.wave,
  };
}

export function createAsteroidsSoloProjection(
  game: AsteroidsMultiplayerGameState,
  seat: AsteroidsShipSeat,
): AsteroidsGameState {
  return {
    ...game,
    ...getAsteroidsShipOwnedState(game.ships[seat]),
  };
}

export function pickAsteroidsMultiplayerShipBullets(
  ships: AsteroidsMultiplayerShips,
) {
  return {
    "ship-a": ships["ship-a"].bullets,
    "ship-b": ships["ship-b"].bullets,
  };
}

function cloneAsteroidsMultiplayerShips(
  ships: AsteroidsMultiplayerShips,
): AsteroidsMultiplayerShips {
  return {
    "ship-a": cloneAsteroidsMultiplayerShip(ships["ship-a"]),
    "ship-b": cloneAsteroidsMultiplayerShip(ships["ship-b"]),
  };
}

function cloneAsteroidsMultiplayerShip(
  ship: AsteroidsMultiplayerShipState,
): AsteroidsMultiplayerShipState {
  return {
    ...ship,
    bullets: ship.bullets.map(cloneBullet),
    ship: cloneShip(ship.ship),
    shipExplosion: cloneNullableExplosion(ship.shipExplosion),
  };
}

function cloneAsteroid(asteroid: Asteroid): Asteroid {
  return {
    ...asteroid,
    shape: [...asteroid.shape],
    velocity: clonePoint(asteroid.velocity),
  };
}

function cloneBullet(bullet: AsteroidsBullet): AsteroidsBullet {
  return {
    ...bullet,
    velocity: clonePoint(bullet.velocity),
  };
}

function cloneShip(ship: AsteroidsShip): AsteroidsShip {
  return {
    ...ship,
    velocity: clonePoint(ship.velocity),
  };
}

function cloneNullableSaucer(saucer: AsteroidsSaucer | null) {
  if (saucer === null) {
    return null;
  }

  return {
    ...saucer,
    velocity: clonePoint(saucer.velocity),
  };
}

function cloneNullableExplosion(explosion: AsteroidsShipExplosion | null) {
  return cloneNullableObject(explosion);
}

function cloneNullableObject<T extends object>(value: T | null): T | null {
  if (value === null) {
    return null;
  }

  return { ...value };
}

function clonePoint(point: AsteroidsPoint): AsteroidsPoint {
  return {
    x: point.x,
    y: point.y,
  };
}
