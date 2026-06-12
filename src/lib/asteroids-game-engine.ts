export type AsteroidsStatus = "ready" | "running" | "paused" | "lost";

export type AsteroidsPoint = {
  x: number;
  y: number;
};

export type AsteroidsControlInput = {
  rotateLeft?: boolean;
  rotateRight?: boolean;
  thrust?: boolean;
};

export type AsteroidsRandom = () => number;

export type AsteroidSize = "large" | "medium" | "small";

export type AsteroidsShip = {
  angle: number;
  isThrusting: boolean;
  radius: number;
  velocity: AsteroidsPoint;
  x: number;
  y: number;
};

export type AsteroidsShipExplosion = {
  durationTicks: number;
  radius: number;
  ticksRemaining: number;
  x: number;
  y: number;
};

export type AsteroidsBullet = {
  id: string;
  radius: number;
  ttl: number;
  velocity: AsteroidsPoint;
  x: number;
  y: number;
};

export type Asteroid = {
  id: string;
  radius: number;
  shape: number[];
  size: AsteroidSize;
  velocity: AsteroidsPoint;
  x: number;
  y: number;
};

export type AsteroidsGameState = {
  asteroids: Asteroid[];
  boardHeight: number;
  boardWidth: number;
  bullets: AsteroidsBullet[];
  lives: number;
  nextAsteroidId: number;
  nextBulletId: number;
  respawnInvulnerabilityTicks: number;
  score: number;
  ship: AsteroidsShip;
  shipExplosion: AsteroidsShipExplosion | null;
  shotCooldownTicks: number;
  startingAsteroidCount: number;
  status: AsteroidsStatus;
  wave: number;
};

export type CreateAsteroidsGameOptions = {
  asteroidCount?: number;
  boardHeight?: number;
  boardWidth?: number;
  random?: AsteroidsRandom;
};

export type AdvanceAsteroidsGameOptions = {
  random?: AsteroidsRandom;
};

export const ASTEROIDS_BOARD_WIDTH = 640;
export const ASTEROIDS_BOARD_HEIGHT = 480;
export const ASTEROIDS_STARTING_ASTEROID_COUNT = 6;
export const ASTEROIDS_STARTING_LIVES = 3;
export const ASTEROIDS_TICK_DELAY_MS = 16;
export const ASTEROIDS_RESPAWN_INVULNERABILITY_TICKS = Math.ceil(
  3_000 / ASTEROIDS_TICK_DELAY_MS,
);
export const ASTEROIDS_SHIP_EXPLOSION_TICKS = Math.ceil(700 / ASTEROIDS_TICK_DELAY_MS);
export const ASTEROIDS_BOARD_SIZE_OPTIONS = [
  { height: 360, label: "480 x 360", width: 480 },
  { height: 480, label: "640 x 480", width: 640 },
  { height: 600, label: "800 x 600", width: 800 },
] as const;
export const ASTEROIDS_ASTEROID_COUNT_OPTIONS = [4, 6, 8] as const;

const ASTEROID_SCORE: Record<AsteroidSize, number> = {
  large: 20,
  medium: 50,
  small: 100,
};
const ASTEROID_SPLIT_CHILDREN = 2;
const ASTEROID_WAVE_CAP = 12;
const BULLET_RADIUS = 2.5;
const BULLET_SPEED = 8.6;
const BULLET_TTL_TICKS = 58;
const MAX_ACTIVE_BULLETS = 4;
const ASTEROIDS_MOTION_SCALE = 0.8;
const SHIP_FRICTION = 0.992;
const SHIP_MAX_SPEED = 6.2 * ASTEROIDS_MOTION_SCALE;
const SHIP_RADIUS = 14;
const SHIP_THRUST = 0.23 * ASTEROIDS_MOTION_SCALE;
const SHIP_TURN_DEGREES = 7;
const SHOT_COOLDOWN_TICKS = 10;

export function createInitialAsteroidsGame({
  asteroidCount = ASTEROIDS_STARTING_ASTEROID_COUNT,
  boardHeight = ASTEROIDS_BOARD_HEIGHT,
  boardWidth = ASTEROIDS_BOARD_WIDTH,
  random,
}: CreateAsteroidsGameOptions = {}): AsteroidsGameState {
  const normalizedBoardWidth = normalizeAsteroidsDimension(
    boardWidth,
    ASTEROIDS_BOARD_WIDTH,
    320,
  );
  const normalizedBoardHeight = normalizeAsteroidsDimension(
    boardHeight,
    ASTEROIDS_BOARD_HEIGHT,
    240,
  );
  const normalizedAsteroidCount = normalizeAsteroidCount(asteroidCount);
  const spawned = createWaveAsteroids({
    boardHeight: normalizedBoardHeight,
    boardWidth: normalizedBoardWidth,
    count: normalizedAsteroidCount,
    nextAsteroidId: 0,
    random,
    wave: 1,
  });

  return {
    asteroids: spawned.asteroids,
    boardHeight: normalizedBoardHeight,
    boardWidth: normalizedBoardWidth,
    bullets: [],
    lives: ASTEROIDS_STARTING_LIVES,
    nextAsteroidId: spawned.nextAsteroidId,
    nextBulletId: 0,
    respawnInvulnerabilityTicks: 0,
    score: 0,
    ship: createCenteredShip(normalizedBoardWidth, normalizedBoardHeight),
    shipExplosion: null,
    shotCooldownTicks: 0,
    startingAsteroidCount: normalizedAsteroidCount,
    status: "ready",
    wave: 1,
  };
}

export function startAsteroidsGame(game: AsteroidsGameState): AsteroidsGameState {
  if (game.status === "running") {
    return game;
  }

  if (game.status === "paused") {
    return {
      ...game,
      status: "running" as const,
    };
  }

  if (game.status === "lost") {
    return restartAsteroidsGame(game);
  }

  return {
    ...game,
    respawnInvulnerabilityTicks: ASTEROIDS_RESPAWN_INVULNERABILITY_TICKS,
    status: "running" as const,
  };
}

export function pauseAsteroidsGame(game: AsteroidsGameState): AsteroidsGameState {
  if (game.status !== "running") {
    return game;
  }

  return {
    ...game,
    status: "paused" as const,
  };
}

export function restartAsteroidsGame(
  game: Pick<AsteroidsGameState, "boardHeight" | "boardWidth" | "startingAsteroidCount"> = {
    boardHeight: ASTEROIDS_BOARD_HEIGHT,
    boardWidth: ASTEROIDS_BOARD_WIDTH,
    startingAsteroidCount: ASTEROIDS_STARTING_ASTEROID_COUNT,
  },
  { random }: AdvanceAsteroidsGameOptions = {},
): AsteroidsGameState {
  return {
    ...createInitialAsteroidsGame({
      asteroidCount: game.startingAsteroidCount,
      boardHeight: game.boardHeight,
      boardWidth: game.boardWidth,
      random,
    }),
    respawnInvulnerabilityTicks: ASTEROIDS_RESPAWN_INVULNERABILITY_TICKS,
    status: "running" as const,
  };
}

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
      x: game.ship.velocity.x + heading.x * BULLET_SPEED,
      y: game.ship.velocity.y + heading.y * BULLET_SPEED,
    },
    x: bulletX,
    y: bulletY,
  };

  return {
    ...game,
    bullets: [...game.bullets, bullet],
    nextBulletId: game.nextBulletId + 1,
    shotCooldownTicks: SHOT_COOLDOWN_TICKS,
  };
}

export function advanceAsteroidsGame(
  game: AsteroidsGameState,
  controls: AsteroidsControlInput = {},
  { random }: AdvanceAsteroidsGameOptions = {},
): AsteroidsGameState {
  if (game.status !== "running") {
    return game;
  }

  if (game.shipExplosion !== null) {
    return advanceExplodingShipGame(game, { random });
  }

  const ship = advanceShip(game, controls);
  const { scoreDelta, ...world } = advanceAsteroidsWorld(game, { random });
  const invulnerabilityTicks = Math.max(0, game.respawnInvulnerabilityTicks - 1);
  const candidateGame = {
    ...game,
    ...world,
    respawnInvulnerabilityTicks: invulnerabilityTicks,
    score: game.score + scoreDelta,
    ship,
  };

  return resolveShipAsteroidCollision(candidateGame);
}

export function getAsteroidsTickDelay() {
  return ASTEROIDS_TICK_DELAY_MS;
}

export function getAsteroidsAsteroidScore(size: AsteroidSize) {
  return ASTEROID_SCORE[size];
}

function advanceShip(
  game: Pick<AsteroidsGameState, "boardHeight" | "boardWidth" | "ship">,
  controls: AsteroidsControlInput,
): AsteroidsShip {
  const shouldRotateLeft = controls.rotateLeft === true && controls.rotateRight !== true;
  const shouldRotateRight = controls.rotateRight === true && controls.rotateLeft !== true;
  let angle = game.ship.angle;

  if (shouldRotateLeft) {
    angle -= SHIP_TURN_DEGREES;
  } else if (shouldRotateRight) {
    angle += SHIP_TURN_DEGREES;
  }

  const heading = getAngleVector(angle);
  const acceleratedVelocity =
    controls.thrust === true
      ? {
          x: game.ship.velocity.x + heading.x * SHIP_THRUST,
          y: game.ship.velocity.y + heading.y * SHIP_THRUST,
        }
      : game.ship.velocity;
  const velocity = limitVelocity({
    x: acceleratedVelocity.x * SHIP_FRICTION,
    y: acceleratedVelocity.y * SHIP_FRICTION,
  });

  return {
    ...game.ship,
    angle: normalizeAngle(angle),
    isThrusting: controls.thrust === true,
    velocity,
    x: wrapCoordinate(game.ship.x + velocity.x, game.boardWidth),
    y: wrapCoordinate(game.ship.y + velocity.y, game.boardHeight),
  };
}

function advanceBullets(
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

function advanceAsteroidsWorld(
  game: Pick<
    AsteroidsGameState,
    | "asteroids"
    | "boardHeight"
    | "boardWidth"
    | "bullets"
    | "nextAsteroidId"
    | "shotCooldownTicks"
    | "startingAsteroidCount"
    | "wave"
  >,
  { random }: AdvanceAsteroidsGameOptions = {},
) {
  const bullets = advanceBullets(game);
  const asteroids = game.asteroids.map((asteroid) =>
    moveWrappedEntity(asteroid, game.boardWidth, game.boardHeight),
  );
  const collisionResult = resolveBulletAsteroidCollisions({
    asteroids,
    boardHeight: game.boardHeight,
    boardWidth: game.boardWidth,
    bullets,
    nextAsteroidId: game.nextAsteroidId,
    random,
  });
  const waveResult =
    collisionResult.asteroids.length === 0
      ? createNextWave({
          boardHeight: game.boardHeight,
          boardWidth: game.boardWidth,
          nextAsteroidId: collisionResult.nextAsteroidId,
          random,
          startingAsteroidCount: game.startingAsteroidCount,
          wave: game.wave + 1,
        })
      : {
          asteroids: collisionResult.asteroids,
          nextAsteroidId: collisionResult.nextAsteroidId,
          wave: game.wave,
        };

  return {
    asteroids: waveResult.asteroids,
    bullets: collisionResult.bullets,
    nextAsteroidId: waveResult.nextAsteroidId,
    scoreDelta: collisionResult.score,
    shotCooldownTicks: Math.max(0, game.shotCooldownTicks - 1),
    wave: waveResult.wave,
  };
}

function advanceExplodingShipGame(
  game: AsteroidsGameState,
  { random }: AdvanceAsteroidsGameOptions = {},
): AsteroidsGameState {
  const shipExplosion = game.shipExplosion;

  if (shipExplosion === null) {
    return game;
  }

  const { scoreDelta, ...world } = advanceAsteroidsWorld(game, { random });
  const ticksRemaining = shipExplosion.ticksRemaining - 1;
  const candidateGame: AsteroidsGameState = {
    ...game,
    ...world,
    respawnInvulnerabilityTicks: 0,
    score: game.score + scoreDelta,
    shipExplosion: {
      ...shipExplosion,
      ticksRemaining,
    },
  };

  if (ticksRemaining > 0) {
    return candidateGame;
  }

  if (candidateGame.lives === 0) {
    return {
      ...candidateGame,
      bullets: [],
      shipExplosion: null,
      status: "lost" as const,
    };
  }

  return {
    ...candidateGame,
    respawnInvulnerabilityTicks: ASTEROIDS_RESPAWN_INVULNERABILITY_TICKS,
    ship: createCenteredShip(game.boardWidth, game.boardHeight),
    shipExplosion: null,
  };
}

function resolveBulletAsteroidCollisions({
  asteroids,
  boardHeight,
  boardWidth,
  bullets,
  nextAsteroidId,
  random,
}: {
  asteroids: Asteroid[];
  boardHeight: number;
  boardWidth: number;
  bullets: AsteroidsBullet[];
  nextAsteroidId: number;
  random?: AsteroidsRandom;
}) {
  let remainingAsteroids = asteroids;
  let nextId = nextAsteroidId;
  let score = 0;
  const remainingBullets: AsteroidsBullet[] = [];

  for (const bullet of bullets) {
    const hitAsteroid = remainingAsteroids.find((asteroid) =>
      entitiesCollideWrapped(bullet, asteroid, boardWidth, boardHeight),
    );

    if (hitAsteroid === undefined) {
      remainingBullets.push(bullet);
      continue;
    }

    const split = splitAsteroid(hitAsteroid, nextId, boardWidth, boardHeight, random);
    nextId = split.nextAsteroidId;
    score += ASTEROID_SCORE[hitAsteroid.size];
    remainingAsteroids = [
      ...remainingAsteroids.filter((asteroid) => asteroid.id !== hitAsteroid.id),
      ...split.asteroids,
    ];
  }

  return {
    asteroids: remainingAsteroids,
    bullets: remainingBullets,
    nextAsteroidId: nextId,
    score,
  };
}

function resolveShipAsteroidCollision(game: AsteroidsGameState): AsteroidsGameState {
  if (game.respawnInvulnerabilityTicks > 0) {
    return game;
  }

  const hitAsteroid = game.asteroids.find((asteroid) =>
    entitiesCollideWrapped(game.ship, asteroid, game.boardWidth, game.boardHeight),
  );

  if (hitAsteroid === undefined) {
    return game;
  }

  const lives = Math.max(0, game.lives - 1);

  if (lives === 0) {
    return {
      ...game,
      bullets: [],
      lives,
      respawnInvulnerabilityTicks: 0,
      shipExplosion: createShipExplosion(game.ship),
    };
  }

  return {
    ...game,
    bullets: [],
    lives,
    respawnInvulnerabilityTicks: 0,
    shipExplosion: createShipExplosion(game.ship),
  };
}

function createShipExplosion(ship: AsteroidsShip): AsteroidsShipExplosion {
  return {
    durationTicks: ASTEROIDS_SHIP_EXPLOSION_TICKS,
    radius: ship.radius,
    ticksRemaining: ASTEROIDS_SHIP_EXPLOSION_TICKS,
    x: ship.x,
    y: ship.y,
  };
}

function createNextWave({
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
      count: Math.min(ASTEROID_WAVE_CAP, startingAsteroidCount + wave - 1),
      nextAsteroidId,
      random,
      wave,
    }),
    wave,
  };
}

function createWaveAsteroids({
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

function splitAsteroid(
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

function createCenteredShip(boardWidth: number, boardHeight: number): AsteroidsShip {
  return {
    angle: -90,
    isThrusting: false,
    radius: SHIP_RADIUS,
    velocity: { x: 0, y: 0 },
    x: boardWidth / 2,
    y: boardHeight / 2,
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

function getRandomRange(random: AsteroidsRandom | undefined, minimum: number, maximum: number) {
  if (random === undefined) {
    return 1;
  }

  return minimum + random() * (maximum - minimum);
}

function moveWrappedEntity<Entity extends { velocity: AsteroidsPoint; x: number; y: number }>(
  entity: Entity,
  boardWidth: number,
  boardHeight: number,
): Entity {
  return {
    ...entity,
    x: wrapCoordinate(entity.x + entity.velocity.x, boardWidth),
    y: wrapCoordinate(entity.y + entity.velocity.y, boardHeight),
  };
}

function entitiesCollideWrapped(
  first: { radius: number; x: number; y: number },
  second: { radius: number; x: number; y: number },
  boardWidth: number,
  boardHeight: number,
) {
  const dx = getWrappedDistance(first.x, second.x, boardWidth);
  const dy = getWrappedDistance(first.y, second.y, boardHeight);
  const radius = first.radius + second.radius;

  return dx * dx + dy * dy <= radius * radius;
}

function getWrappedDistance(first: number, second: number, limit: number) {
  const directDistance = Math.abs(first - second);

  return Math.min(directDistance, limit - directDistance);
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

function getAngleVector(angle: number): AsteroidsPoint {
  const radians = (angle * Math.PI) / 180;

  return {
    x: Math.cos(radians),
    y: Math.sin(radians),
  };
}

function limitVelocity(velocity: AsteroidsPoint): AsteroidsPoint {
  const speed = Math.hypot(velocity.x, velocity.y);

  if (speed <= SHIP_MAX_SPEED) {
    return velocity;
  }

  const scale = SHIP_MAX_SPEED / speed;

  return {
    x: velocity.x * scale,
    y: velocity.y * scale,
  };
}

function normalizeAngle(angle: number) {
  return ((angle % 360) + 360) % 360;
}

function wrapCoordinate(value: number, limit: number) {
  if (value < 0) {
    return value + limit;
  }

  if (value >= limit) {
    return value - limit;
  }

  return value;
}

function normalizeAsteroidsDimension(value: number, fallback: number, minimum: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(minimum, Math.floor(value));
}

function normalizeAsteroidCount(value: number) {
  const normalizedValue = Number.isFinite(value) ? Math.floor(value) : NaN;

  return ASTEROIDS_ASTEROID_COUNT_OPTIONS.includes(
    normalizedValue as (typeof ASTEROIDS_ASTEROID_COUNT_OPTIONS)[number],
  )
    ? normalizedValue
    : ASTEROIDS_STARTING_ASTEROID_COUNT;
}
