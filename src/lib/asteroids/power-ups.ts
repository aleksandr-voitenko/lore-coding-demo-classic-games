import {
  ASTEROIDS_BONUS_SCORE_POWER_UP_POINTS,
  ASTEROIDS_POWER_UP_KINDS,
  ASTEROIDS_POWER_UP_MAX_SPAWN_TICKS,
  ASTEROIDS_POWER_UP_MIN_SPAWN_TICKS,
  ASTEROIDS_POWER_UP_SHIELD_TICKS,
  ASTEROIDS_POWER_UP_SHOT_INTERVAL_MULTIPLIER,
  ASTEROIDS_POWER_UP_SPEED_MULTIPLIER,
  POWER_UP_ENTITY_SPAWN_PADDING,
  POWER_UP_PICKUP_RING_RADIUS_MULTIPLIER,
  POWER_UP_RADIUS,
  POWER_UP_SHIP_SPAWN_PADDING,
  POWER_UP_SPAWN_ATTEMPTS,
  POWER_UP_SPAWN_MARGIN,
  SHIP_PICKUP_NOSE_RADIUS_MULTIPLIER,
  SHIP_PICKUP_REAR_RADIUS_MULTIPLIER,
  SHIP_PICKUP_WING_RADIUS_MULTIPLIER,
} from "./constants";
import {
  entitiesCollide,
  entitiesCollideWrapped,
  getPointAtAngle,
  getWrappedDelta,
} from "./geometry";
import { getBonusLivesAwarded } from "./scoring";
import {
  applyAsteroidsShipOwnedState,
  getAsteroidsShipOwnedState,
} from "./ship";
import type {
  AdvanceAsteroidsGameOptions,
  AsteroidsGameState,
  AsteroidsPoint,
  AsteroidsPowerUp,
  AsteroidsPowerUpKind,
  AsteroidsRandom,
  AsteroidsShip,
} from "./types";

export function advanceAsteroidsPowerUpAvailability(
  game: AsteroidsGameState,
  { random }: AdvanceAsteroidsGameOptions = {},
): AsteroidsGameState {
  if (game.powerUp !== null) {
    return game;
  }

  if (game.powerUpSpawnCooldownTicks > 0) {
    return {
      ...game,
      powerUpSpawnCooldownTicks: game.powerUpSpawnCooldownTicks - 1,
    };
  }

  return {
    ...game,
    nextPowerUpId: game.nextPowerUpId + 1,
    powerUp: createAsteroidsPowerUp(game, random),
    powerUpSpawnCooldownTicks: 0,
  };
}

export function applyAsteroidsPowerUpPickup(
  game: AsteroidsGameState,
  { random }: AdvanceAsteroidsGameOptions = {},
): AsteroidsGameState {
  if (
    game.powerUp === null ||
    game.shipExplosion !== null ||
    !asteroidsShipTouchesPowerUp(game)
  ) {
    return game;
  }

  const pickedUpGame = applyAsteroidsPowerUpEffect(game, game.powerUp);

  return {
    ...pickedUpGame,
    powerUp: null,
    powerUpSpawnCooldownTicks: createAsteroidsPowerUpSpawnCooldown(
      game.nextPowerUpId,
      random,
    ),
  };
}

export function applyAsteroidsPowerUpEffect(
  game: AsteroidsGameState,
  powerUp: AsteroidsPowerUp,
): AsteroidsGameState {
  switch (powerUp.kind) {
    case "bonus-score": {
      const score = game.score + ASTEROIDS_BONUS_SCORE_POWER_UP_POINTS;

      return {
        ...game,
        lives: game.lives + getBonusLivesAwarded(game.score, score),
        score,
      };
    }
    case "bullet-speed":
      return applyAsteroidsShipOwnedState(game, {
        ...getAsteroidsShipOwnedState(game),
        bulletSpeedMultiplier:
          game.bulletSpeedMultiplier * ASTEROIDS_POWER_UP_SPEED_MULTIPLIER,
      });
    case "engine-speed":
      return applyAsteroidsShipOwnedState(game, {
        ...getAsteroidsShipOwnedState(game),
        engineSpeedMultiplier:
          game.engineSpeedMultiplier * ASTEROIDS_POWER_UP_SPEED_MULTIPLIER,
      });
    case "shield":
      return applyAsteroidsShipOwnedState(game, {
        ...getAsteroidsShipOwnedState(game),
        respawnInvulnerabilityTicks: Math.max(
          game.respawnInvulnerabilityTicks,
          ASTEROIDS_POWER_UP_SHIELD_TICKS,
        ),
      });
    case "shot-interval":
      return applyAsteroidsShipOwnedState(game, {
        ...getAsteroidsShipOwnedState(game),
        shotIntervalMultiplier:
          game.shotIntervalMultiplier * ASTEROIDS_POWER_UP_SHOT_INTERVAL_MULTIPLIER,
      });
  }
}

export function asteroidsShipTouchesPowerUp(
  game: Pick<AsteroidsGameState, "boardHeight" | "boardWidth" | "powerUp" | "ship">,
) {
  if (game.powerUp === null) {
    return false;
  }

  const nearestPowerUp = {
    ...game.powerUp,
    radius: game.powerUp.radius * POWER_UP_PICKUP_RING_RADIUS_MULTIPLIER,
    x: game.ship.x + getWrappedDelta(game.ship.x, game.powerUp.x, game.boardWidth),
    y: game.ship.y + getWrappedDelta(game.ship.y, game.powerUp.y, game.boardHeight),
  };

  return circleIntersectsPolygon(nearestPowerUp, getShipPickupPolygon(game.ship));
}

function getShipPickupPolygon(ship: AsteroidsShip): AsteroidsPoint[] {
  const angle = (ship.angle * Math.PI) / 180;

  return [
    getPointAtAngle(ship, angle, ship.radius * SHIP_PICKUP_NOSE_RADIUS_MULTIPLIER),
    getPointAtAngle(ship, angle + 2.44, ship.radius * SHIP_PICKUP_WING_RADIUS_MULTIPLIER),
    getPointAtAngle(ship, angle + Math.PI, ship.radius * SHIP_PICKUP_REAR_RADIUS_MULTIPLIER),
    getPointAtAngle(ship, angle - 2.44, ship.radius * SHIP_PICKUP_WING_RADIUS_MULTIPLIER),
  ];
}

function circleIntersectsPolygon(
  circle: { radius: number; x: number; y: number },
  polygon: AsteroidsPoint[],
) {
  if (pointIsInsidePolygon(circle, polygon)) {
    return true;
  }

  return polygon.some((point, index) =>
    circleIntersectsSegment(
      circle,
      point,
      polygon[(index + 1) % polygon.length] ?? polygon[0]!,
    ),
  );
}

function pointIsInsidePolygon(point: AsteroidsPoint, polygon: AsteroidsPoint[]) {
  let isInside = false;

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index]!;
    const previousPoint = polygon[previous]!;
    const crossesY =
      currentPoint.y > point.y !== previousPoint.y > point.y;
    const crossingX =
      ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
        (previousPoint.y - currentPoint.y) +
      currentPoint.x;

    if (crossesY && point.x < crossingX) {
      isInside = !isInside;
    }
  }

  return isInside;
}

function circleIntersectsSegment(
  circle: { radius: number; x: number; y: number },
  start: AsteroidsPoint,
  end: AsteroidsPoint,
) {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;
  const projectedRatio =
    segmentLengthSquared === 0
      ? 0
      : ((circle.x - start.x) * segmentX + (circle.y - start.y) * segmentY) /
        segmentLengthSquared;
  const clampedRatio = Math.max(0, Math.min(1, projectedRatio));
  const closestX = start.x + segmentX * clampedRatio;
  const closestY = start.y + segmentY * clampedRatio;
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;

  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

export function createAsteroidsPowerUp(
  game: Pick<
    AsteroidsGameState,
    | "asteroids"
    | "boardHeight"
    | "boardWidth"
    | "nextPowerUpId"
    | "saucer"
    | "ship"
  > & {
    ships?: readonly AsteroidsShip[];
  },
  random?: AsteroidsRandom,
): AsteroidsPowerUp {
  const kind = getPowerUpKind(game.nextPowerUpId, random);
  // If every candidate is blocked, still spawn at the last sampled position instead of skipping.
  let fallbackPosition = getPowerUpSpawnPosition(game, 0, random);

  for (let attempt = 0; attempt < POWER_UP_SPAWN_ATTEMPTS; attempt += 1) {
    const position =
      attempt === 0 ? fallbackPosition : getPowerUpSpawnPosition(game, attempt, random);
    fallbackPosition = position;

    if (!isPowerUpSpawnBlocked(position, game)) {
      return {
        ...position,
        id: `power-up-${game.nextPowerUpId}`,
        kind,
        radius: POWER_UP_RADIUS,
      };
    }
  }

  return {
    ...fallbackPosition,
    id: `power-up-${game.nextPowerUpId}`,
    kind,
    radius: POWER_UP_RADIUS,
  };
}

export function createAsteroidsPowerUpSpawnCooldown(
  idNumber: number,
  random?: AsteroidsRandom,
) {
  const spawnRange =
    ASTEROIDS_POWER_UP_MAX_SPAWN_TICKS - ASTEROIDS_POWER_UP_MIN_SPAWN_TICKS;

  if (random === undefined) {
    return ASTEROIDS_POWER_UP_MIN_SPAWN_TICKS + ((idNumber * 97) % (spawnRange + 1));
  }

  return ASTEROIDS_POWER_UP_MIN_SPAWN_TICKS + Math.floor(random() * (spawnRange + 1));
}

function getPowerUpKind(idNumber: number, random?: AsteroidsRandom): AsteroidsPowerUpKind {
  const index =
    random === undefined
      ? idNumber % ASTEROIDS_POWER_UP_KINDS.length
      : Math.min(
          ASTEROIDS_POWER_UP_KINDS.length - 1,
          Math.floor(random() * ASTEROIDS_POWER_UP_KINDS.length),
        );

  return ASTEROIDS_POWER_UP_KINDS[index] ?? "shield";
}

function getPowerUpSpawnPosition(
  game: Pick<AsteroidsGameState, "boardHeight" | "boardWidth" | "nextPowerUpId">,
  attempt: number,
  random?: AsteroidsRandom,
): AsteroidsPoint {
  if (random !== undefined) {
    return {
      x: getRandomPowerUpCoordinate(game.boardWidth, random),
      y: getRandomPowerUpCoordinate(game.boardHeight, random),
    };
  }

  return {
    x: getDeterministicPowerUpCoordinate(game.boardWidth, game.nextPowerUpId, attempt, 17),
    y: getDeterministicPowerUpCoordinate(game.boardHeight, game.nextPowerUpId, attempt, 61),
  };
}

function getRandomPowerUpCoordinate(limit: number, random: AsteroidsRandom) {
  return POWER_UP_SPAWN_MARGIN + random() * (limit - POWER_UP_SPAWN_MARGIN * 2);
}

function getDeterministicPowerUpCoordinate(
  limit: number,
  idNumber: number,
  attempt: number,
  seed: number,
) {
  const usableSize = limit - POWER_UP_SPAWN_MARGIN * 2;
  const ratio = ((idNumber * 53 + attempt * 29 + seed) % 100) / 100;

  return POWER_UP_SPAWN_MARGIN + ratio * usableSize;
}

function isPowerUpSpawnBlocked(
  powerUp: AsteroidsPoint,
  game: Pick<
    AsteroidsGameState,
    "asteroids" | "boardHeight" | "boardWidth" | "saucer" | "ship"
  > & {
    ships?: readonly AsteroidsShip[];
  },
) {
  const candidate = {
    ...powerUp,
    radius: POWER_UP_RADIUS,
  };
  const ships = game.ships ?? [game.ship];

  if (
    ships.some((ship) =>
      entitiesCollideWrapped(
        { ...candidate, radius: candidate.radius + POWER_UP_SHIP_SPAWN_PADDING },
        ship,
        game.boardWidth,
        game.boardHeight,
      ),
    )
  ) {
    return true;
  }

  if (
    game.asteroids.some((asteroid) =>
      entitiesCollideWrapped(
        { ...candidate, radius: candidate.radius + POWER_UP_ENTITY_SPAWN_PADDING },
        asteroid,
        game.boardWidth,
        game.boardHeight,
      ),
    )
  ) {
    return true;
  }

  return (
    game.saucer !== null &&
    entitiesCollide(
      { ...candidate, radius: candidate.radius + POWER_UP_ENTITY_SPAWN_PADDING },
      game.saucer,
    )
  );
}
