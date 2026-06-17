import {
  SAUCER_RADIUS,
  SAUCER_SHOT_COOLDOWN_TICKS,
  SAUCER_SHOT_RADIUS,
  SAUCER_SHOT_SPEED,
  SAUCER_SHOT_SPREAD_RADIANS,
  SAUCER_SHOT_TTL_TICKS,
  SAUCER_SPEED,
} from "./constants";
import { getAsteroidsDifficultySettings } from "./difficulty";
import {
  getRandomRange,
  getWrappedDelta,
  wrapCoordinate,
} from "./geometry";
import type {
  AsteroidsGameState,
  AsteroidsRandom,
  AsteroidsSaucer,
  AsteroidsSaucerKind,
  AsteroidsSaucerShot,
  AsteroidsShip,
  AsteroidsShipExplosion,
} from "./types";

export function advanceSaucerMotionAndSpawn(
  game: Pick<
    AsteroidsGameState,
    | "boardHeight"
    | "boardWidth"
    | "difficulty"
    | "nextSaucerId"
    | "saucer"
    | "saucerSpawnCooldownTicks"
    | "wave"
  >,
  random?: AsteroidsRandom,
) {
  if (game.saucer !== null) {
    const saucer = {
      ...game.saucer,
      shotCooldownTicks: Math.max(0, game.saucer.shotCooldownTicks - 1),
      x: game.saucer.x + game.saucer.velocity.x,
      y: game.saucer.y + game.saucer.velocity.y,
    };

    if (hasSaucerExited(saucer, game.boardWidth)) {
      return {
        nextSaucerId: game.nextSaucerId,
        saucer: null,
        saucerSpawnCooldownTicks:
          getAsteroidsDifficultySettings(game.difficulty).saucerRespawnCooldownTicks,
      };
    }

    return {
      nextSaucerId: game.nextSaucerId,
      saucer,
      saucerSpawnCooldownTicks: game.saucerSpawnCooldownTicks,
    };
  }

  if (game.saucerSpawnCooldownTicks > 0) {
    return {
      nextSaucerId: game.nextSaucerId,
      saucer: null,
      saucerSpawnCooldownTicks: game.saucerSpawnCooldownTicks - 1,
    };
  }

  return {
    nextSaucerId: game.nextSaucerId + 1,
    saucer: createSaucer({
      boardHeight: game.boardHeight,
      boardWidth: game.boardWidth,
      idNumber: game.nextSaucerId,
      random,
      wave: game.wave,
    }),
    saucerSpawnCooldownTicks: 0,
  };
}

export function fireSaucerShotIfReady({
  boardHeight,
  boardWidth,
  nextSaucerBulletId,
  random,
  saucer,
  saucerBullets,
  ship,
  shipExplosion,
}: {
  boardHeight: number;
  boardWidth: number;
  nextSaucerBulletId: number;
  random?: AsteroidsRandom;
  saucer: AsteroidsSaucer | null;
  saucerBullets: AsteroidsSaucerShot[];
  ship: AsteroidsShip;
  shipExplosion: AsteroidsShipExplosion | null;
}) {
  if (saucer === null || saucer.shotCooldownTicks > 0 || shipExplosion !== null) {
    return {
      nextSaucerBulletId,
      saucer,
      saucerBullets,
    };
  }

  const shot: AsteroidsSaucerShot = {
    id: `saucer-shot-${nextSaucerBulletId}`,
    radius: SAUCER_SHOT_RADIUS,
    ttl: SAUCER_SHOT_TTL_TICKS,
    velocity: getSaucerShotVelocity(saucer, ship, boardWidth, boardHeight, random),
    x: wrapCoordinate(saucer.x, boardWidth),
    y: wrapCoordinate(saucer.y, boardHeight),
  };

  return {
    nextSaucerBulletId: nextSaucerBulletId + 1,
    saucer: {
      ...saucer,
      shotCooldownTicks: SAUCER_SHOT_COOLDOWN_TICKS[saucer.kind],
    },
    saucerBullets: [...saucerBullets, shot],
  };
}

function createSaucer({
  boardHeight,
  boardWidth,
  idNumber,
  random,
  wave,
}: {
  boardHeight: number;
  boardWidth: number;
  idNumber: number;
  random?: AsteroidsRandom;
  wave: number;
}): AsteroidsSaucer {
  const kind = getSaucerKind(wave, idNumber, random);
  const radius = SAUCER_RADIUS[kind];
  const direction = getSaucerDirection(idNumber, random);
  const y =
    random === undefined
      ? boardHeight * (0.24 + (((idNumber * 37 + wave * 13) % 46) / 100))
      : boardHeight * getRandomRange(random, 0.2, 0.74);

  return {
    id: `saucer-${idNumber}`,
    kind,
    radius,
    shotCooldownTicks: SAUCER_SHOT_COOLDOWN_TICKS[kind],
    velocity: {
      x: direction * SAUCER_SPEED[kind],
      y: 0,
    },
    x: direction === 1 ? -radius : boardWidth + radius,
    y: Math.min(boardHeight - radius, Math.max(radius, y)),
  };
}

function getSaucerKind(
  wave: number,
  idNumber: number,
  random?: AsteroidsRandom,
): AsteroidsSaucerKind {
  if (wave < 3) {
    return "large";
  }

  if (random === undefined) {
    return idNumber % 3 === 2 ? "small" : "large";
  }

  return random() < Math.min(0.65, 0.22 + (wave - 3) * 0.08) ? "small" : "large";
}

function getSaucerDirection(idNumber: number, random?: AsteroidsRandom) {
  if (random === undefined) {
    return idNumber % 2 === 0 ? 1 : -1;
  }

  return random() < 0.5 ? 1 : -1;
}

function getSaucerShotVelocity(
  saucer: AsteroidsSaucer,
  ship: AsteroidsShip,
  boardWidth: number,
  boardHeight: number,
  random?: AsteroidsRandom,
) {
  const aim = {
    x: getWrappedDelta(saucer.x, ship.x, boardWidth),
    y: getWrappedDelta(saucer.y, ship.y, boardHeight),
  };
  const baseAngle = Math.atan2(aim.y, aim.x);
  const spread =
    random === undefined
      ? 0
      : (random() * 2 - 1) * SAUCER_SHOT_SPREAD_RADIANS[saucer.kind];
  const angle = baseAngle + spread;
  const speed = SAUCER_SHOT_SPEED[saucer.kind];

  return {
    x: Math.cos(angle) * speed,
    y: Math.sin(angle) * speed,
  };
}

function hasSaucerExited(saucer: AsteroidsSaucer, boardWidth: number) {
  return (
    (saucer.velocity.x > 0 && saucer.x - saucer.radius > boardWidth) ||
    (saucer.velocity.x < 0 && saucer.x + saucer.radius < 0)
  );
}
