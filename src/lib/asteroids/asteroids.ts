import {
  ASTEROIDS_MOTION_SCALE,
  ASTEROID_SPLIT_CHILDREN,
} from "./constants";
import { getRandomRange, wrapCoordinate } from "./geometry";
import type {
  Asteroid,
  AsteroidSize,
  AsteroidsPoint,
  AsteroidsRandom,
} from "./types";

export function createNextWave({
  boardHeight,
  boardWidth,
  nextAsteroidId,
  random,
  startingAsteroidCount,
  wave,
}: {
  boardHeight: number;
  boardWidth: number;
  nextAsteroidId: number;
  random?: AsteroidsRandom;
  startingAsteroidCount: number;
  wave: number;
}) {
  return {
    ...createWaveAsteroids({
      boardHeight,
      boardWidth,
      count: startingAsteroidCount + wave - 1,
      nextAsteroidId,
      random,
      wave,
    }),
    wave,
  };
}

export function createWaveAsteroids({
  boardHeight,
  boardWidth,
  count,
  nextAsteroidId,
  random,
  wave,
}: {
  boardHeight: number;
  boardWidth: number;
  count: number;
  nextAsteroidId: number;
  random?: AsteroidsRandom;
  wave: number;
}) {
  const asteroids = Array.from({ length: count }, (_, index) =>
    createAsteroid({
      boardHeight,
      boardWidth,
      idNumber: nextAsteroidId + index,
      index,
      random,
      size: "large" as const,
      wave,
    }),
  );

  return {
    asteroids,
    nextAsteroidId: nextAsteroidId + asteroids.length,
  };
}

function createAsteroid({
  boardHeight,
  boardWidth,
  idNumber,
  index,
  random,
  size,
  velocity,
  wave,
  x,
  y,
}: {
  boardHeight: number;
  boardWidth: number;
  idNumber: number;
  index: number;
  random?: AsteroidsRandom;
  size: AsteroidSize;
  velocity?: AsteroidsPoint;
  wave: number;
  x?: number;
  y?: number;
}): Asteroid {
  const radius = getAsteroidRadius(size);
  const spawned =
    velocity === undefined || x === undefined || y === undefined
      ? getAsteroidSpawn({
          boardHeight,
          boardWidth,
          index,
          random,
          radius,
          wave,
        })
      : null;

  return {
    id: `asteroid-${idNumber}`,
    radius,
    shape: createAsteroidShape(idNumber, random),
    size,
    velocity: velocity ?? spawned!.velocity,
    x: x ?? spawned!.x,
    y: y ?? spawned!.y,
  };
}

export function splitAsteroid(
  asteroid: Asteroid,
  nextAsteroidId: number,
  boardWidth: number,
  boardHeight: number,
  random?: AsteroidsRandom,
) {
  const childSize = getAsteroidChildSize(asteroid.size);

  if (childSize === null) {
    return {
      asteroids: [],
      nextAsteroidId,
    };
  }

  const speed =
    (childSize === "medium" ? 1.55 : 1.9) *
    ASTEROIDS_MOTION_SCALE *
    getRandomRange(random, 0.9, 1.1);
  const baseAngle = Math.atan2(asteroid.velocity.y, asteroid.velocity.x);
  const asteroids = Array.from({ length: ASTEROID_SPLIT_CHILDREN }, (_, childIndex) => {
    const direction = childIndex === 0 ? -1 : 1;
    const angle =
      baseAngle + direction * (random === undefined ? 1.1 : getRandomRange(random, 0.9, 1.2));
    const offset = random === undefined ? childIndex * 2 : 2 + random() * 4;

    return createAsteroid({
      boardHeight,
      boardWidth,
      idNumber: nextAsteroidId + childIndex,
      index: childIndex,
      random,
      size: childSize,
      velocity: {
        x: asteroid.velocity.x * 0.56 + Math.cos(angle) * speed,
        y: asteroid.velocity.y * 0.56 + Math.sin(angle) * speed,
      },
      wave: nextAsteroidId + childIndex,
      x: wrapCoordinate(asteroid.x + direction * offset, boardWidth),
      y: wrapCoordinate(asteroid.y + direction * offset, boardHeight),
    });
  });

  return {
    asteroids,
    nextAsteroidId: nextAsteroidId + asteroids.length,
  };
}

function getAsteroidSpawn({
  boardHeight,
  boardWidth,
  index,
  random,
  radius,
  wave,
}: {
  boardHeight: number;
  boardWidth: number;
  index: number;
  random?: AsteroidsRandom;
  radius: number;
  wave: number;
}) {
  const edge = random === undefined ? index % 4 : Math.floor(random() * 4);
  const travel =
    random === undefined ? 0.12 + (((index * 37 + wave * 11) % 76) / 100) : 0.12 + random() * 0.76;
  const drift =
    (random === undefined ? (((index * 29 + wave * 7) % 21) - 10) / 20 : random() * 2 - 1) *
    ASTEROIDS_MOTION_SCALE;
  const speed =
    Math.min(
      2.4,
      random === undefined
        ? 1.05 + (index % 3) * 0.24 + wave * 0.04
        : 1.05 + random() * 0.48 + wave * 0.04,
    ) * ASTEROIDS_MOTION_SCALE;

  if (edge === 0) {
    return {
      velocity: { x: speed, y: drift },
      x: radius + 6,
      y: boardHeight * travel,
    };
  }

  if (edge === 1) {
    return {
      velocity: { x: -speed, y: drift },
      x: boardWidth - radius - 6,
      y: boardHeight * travel,
    };
  }

  if (edge === 2) {
    return {
      velocity: { x: drift, y: speed },
      x: boardWidth * travel,
      y: radius + 6,
    };
  }

  return {
    velocity: { x: drift, y: -speed },
    x: boardWidth * travel,
    y: boardHeight - radius - 6,
  };
}

function createAsteroidShape(seed: number, random?: AsteroidsRandom) {
  return Array.from({ length: 10 }, (_, index) => {
    if (random !== undefined) {
      return 0.78 + random() * 0.3;
    }

    const value = (seed * 37 + index * 23) % 31;

    return 0.78 + value / 100;
  });
}

function getAsteroidChildSize(size: AsteroidSize): AsteroidSize | null {
  if (size === "large") {
    return "medium";
  }

  if (size === "medium") {
    return "small";
  }

  return null;
}

function getAsteroidRadius(size: AsteroidSize) {
  if (size === "large") {
    return 42;
  }

  if (size === "medium") {
    return 25;
  }

  return 14;
}
