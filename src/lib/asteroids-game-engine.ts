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

export type AsteroidsDifficulty = "easy" | "medium" | "hard";

export type AsteroidSize = "large" | "medium" | "small";

export type AsteroidsSaucerKind = "large" | "small";

export type AsteroidsPowerUpKind =
  | "bonus-score"
  | "bullet-speed"
  | "engine-speed"
  | "shield"
  | "shot-interval";

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

export type AsteroidsSaucerShot = AsteroidsBullet;

export type Asteroid = {
  id: string;
  radius: number;
  shape: number[];
  size: AsteroidSize;
  velocity: AsteroidsPoint;
  x: number;
  y: number;
};

export type AsteroidsSaucer = {
  id: string;
  kind: AsteroidsSaucerKind;
  radius: number;
  shotCooldownTicks: number;
  velocity: AsteroidsPoint;
  x: number;
  y: number;
};

export type AsteroidsPowerUp = {
  id: string;
  kind: AsteroidsPowerUpKind;
  radius: number;
  x: number;
  y: number;
};

export type AsteroidsGameState = {
  asteroids: Asteroid[];
  boardHeight: number;
  boardWidth: number;
  bulletSpeedMultiplier: number;
  bullets: AsteroidsBullet[];
  difficulty: AsteroidsDifficulty;
  engineSpeedMultiplier: number;
  lives: number;
  nextAsteroidId: number;
  nextBulletId: number;
  nextPowerUpId: number;
  nextSaucerBulletId: number;
  nextSaucerId: number;
  powerUp: AsteroidsPowerUp | null;
  powerUpSpawnCooldownTicks: number;
  respawnInvulnerabilityTicks: number;
  saucer: AsteroidsSaucer | null;
  saucerBullets: AsteroidsSaucerShot[];
  saucerSpawnCooldownTicks: number;
  score: number;
  ship: AsteroidsShip;
  shipExplosion: AsteroidsShipExplosion | null;
  shotCooldownTicks: number;
  shotIntervalMultiplier: number;
  startingAsteroidCount: number;
  status: AsteroidsStatus;
  wave: number;
};

export type CreateAsteroidsGameOptions = {
  difficulty?: AsteroidsDifficulty | string;
  random?: AsteroidsRandom;
};

export type AdvanceAsteroidsGameOptions = {
  random?: AsteroidsRandom;
};

export const ASTEROIDS_BOARD_WIDTH = 800;
export const ASTEROIDS_BOARD_HEIGHT = 600;
export const ASTEROIDS_DEFAULT_DIFFICULTY = "medium" satisfies AsteroidsDifficulty;
export const ASTEROIDS_STARTING_ASTEROID_COUNT = 4;
export const ASTEROIDS_STARTING_LIVES = 3;
export const ASTEROIDS_BONUS_LIFE_SCORE = 10_000;
export const ASTEROIDS_TICK_DELAY_MS = 16;
export const ASTEROIDS_RESPAWN_INVULNERABILITY_TICKS = Math.ceil(
  3_000 / ASTEROIDS_TICK_DELAY_MS,
);
export const ASTEROIDS_POWER_UP_SHIELD_TICKS = Math.ceil(
  20_000 / ASTEROIDS_TICK_DELAY_MS,
);
export const ASTEROIDS_POWER_UP_MIN_SPAWN_TICKS = Math.ceil(
  15_000 / ASTEROIDS_TICK_DELAY_MS,
);
export const ASTEROIDS_POWER_UP_MAX_SPAWN_TICKS = Math.ceil(
  30_000 / ASTEROIDS_TICK_DELAY_MS,
);
export const ASTEROIDS_BONUS_SCORE_POWER_UP_POINTS = 1_000;
export const ASTEROIDS_SHIP_EXPLOSION_TICKS = Math.ceil(700 / ASTEROIDS_TICK_DELAY_MS);
export const ASTEROIDS_DIFFICULTY_OPTIONS = [
  {
    asteroidCount: 3,
    label: "Easy",
    lives: 4,
    saucerInitialSpawnTicks: Math.ceil(24_000 / ASTEROIDS_TICK_DELAY_MS),
    saucerRespawnCooldownTicks: Math.ceil(32_000 / ASTEROIDS_TICK_DELAY_MS),
    value: "easy",
  },
  {
    asteroidCount: ASTEROIDS_STARTING_ASTEROID_COUNT,
    label: "Medium",
    lives: ASTEROIDS_STARTING_LIVES,
    saucerInitialSpawnTicks: Math.ceil(12_000 / ASTEROIDS_TICK_DELAY_MS),
    saucerRespawnCooldownTicks: Math.ceil(16_000 / ASTEROIDS_TICK_DELAY_MS),
    value: ASTEROIDS_DEFAULT_DIFFICULTY,
  },
  {
    asteroidCount: 5,
    label: "Hard",
    lives: 2,
    saucerInitialSpawnTicks: Math.ceil(6_000 / ASTEROIDS_TICK_DELAY_MS),
    saucerRespawnCooldownTicks: Math.ceil(8_000 / ASTEROIDS_TICK_DELAY_MS),
    value: "hard",
  },
] as const satisfies readonly {
  asteroidCount: number;
  label: string;
  lives: number;
  saucerInitialSpawnTicks: number;
  saucerRespawnCooldownTicks: number;
  value: AsteroidsDifficulty;
}[];
export const ASTEROIDS_SAUCER_INITIAL_SPAWN_TICKS =
  ASTEROIDS_DIFFICULTY_OPTIONS[1].saucerInitialSpawnTicks;

const ASTEROID_SCORE: Record<AsteroidSize, number> = {
  large: 20,
  medium: 50,
  small: 100,
};
const ASTEROIDS_SAUCER_SCORE: Record<AsteroidsSaucerKind, number> = {
  large: 200,
  small: 1_000,
};
const ASTEROID_SPLIT_CHILDREN = 2;
const BULLET_RADIUS = 2.5;
const ASTEROIDS_INITIAL_PLAYER_SPEED_MULTIPLIER = 0.5;
const ASTEROIDS_POWER_UP_SPEED_MULTIPLIER = 1.2;
const ASTEROIDS_POWER_UP_SHOT_INTERVAL_MULTIPLIER = 0.8;
const BULLET_SPEED = 8.6 * ASTEROIDS_INITIAL_PLAYER_SPEED_MULTIPLIER;
const BULLET_TTL_TICKS = 58;
const MAX_ACTIVE_BULLETS = 4;
const ASTEROIDS_MOTION_SCALE = 0.8;
const SAUCER_RADIUS: Record<AsteroidsSaucerKind, number> = {
  large: 18,
  small: 12,
};
const SAUCER_SHOT_COOLDOWN_TICKS: Record<AsteroidsSaucerKind, number> = {
  large: Math.ceil(1_300 / ASTEROIDS_TICK_DELAY_MS),
  small: Math.ceil(900 / ASTEROIDS_TICK_DELAY_MS),
};
const SAUCER_SHOT_RADIUS = 2.5;
const SAUCER_SHOT_SPEED: Record<AsteroidsSaucerKind, number> = {
  large: 3.8,
  small: 4.4,
};
const SAUCER_SHOT_SPREAD_RADIANS: Record<AsteroidsSaucerKind, number> = {
  large: Math.PI / 4,
  small: Math.PI / 10,
};
const SAUCER_SHOT_TTL_TICKS = 140;
const SAUCER_SPEED: Record<AsteroidsSaucerKind, number> = {
  large: 1.4,
  small: 1.8,
};
const SHIP_FRICTION = 0.992;
const SHIP_MAX_SPEED =
  6.2 * ASTEROIDS_MOTION_SCALE * ASTEROIDS_INITIAL_PLAYER_SPEED_MULTIPLIER;
const SHIP_PICKUP_NOSE_RADIUS_MULTIPLIER = 1.42;
const SHIP_PICKUP_WING_RADIUS_MULTIPLIER = 1.06;
const SHIP_PICKUP_REAR_RADIUS_MULTIPLIER = 0.42;
const SHIP_RADIUS = 14;
const SHIP_THRUST =
  0.23 * ASTEROIDS_MOTION_SCALE * ASTEROIDS_INITIAL_PLAYER_SPEED_MULTIPLIER;
const SHIP_TURN_DEGREES = 7;
const SHOT_COOLDOWN_TICKS = Math.ceil(10 * 1.5 * 1.25);
const POWER_UP_RADIUS = 12;
const POWER_UP_PICKUP_RING_RADIUS_MULTIPLIER = 1.28;
const POWER_UP_SPAWN_MARGIN = POWER_UP_RADIUS + 18;
const POWER_UP_SPAWN_ATTEMPTS = 8;
const POWER_UP_SHIP_SPAWN_PADDING = 72;
const POWER_UP_ENTITY_SPAWN_PADDING = 8;
const ASTEROIDS_POWER_UP_KINDS: AsteroidsPowerUpKind[] = [
  "shield",
  "bullet-speed",
  "shot-interval",
  "bonus-score",
  "engine-speed",
];

export function createInitialAsteroidsGame({
  difficulty = ASTEROIDS_DEFAULT_DIFFICULTY,
  random,
}: CreateAsteroidsGameOptions = {}): AsteroidsGameState {
  const normalizedDifficulty = normalizeAsteroidsDifficulty(difficulty);
  const difficultySettings = getAsteroidsDifficultySettings(normalizedDifficulty);
  const spawned = createWaveAsteroids({
    boardHeight: ASTEROIDS_BOARD_HEIGHT,
    boardWidth: ASTEROIDS_BOARD_WIDTH,
    count: difficultySettings.asteroidCount,
    nextAsteroidId: 0,
    random,
    wave: 1,
  });

  return {
    asteroids: spawned.asteroids,
    boardHeight: ASTEROIDS_BOARD_HEIGHT,
    boardWidth: ASTEROIDS_BOARD_WIDTH,
    bulletSpeedMultiplier: 1,
    bullets: [],
    difficulty: normalizedDifficulty,
    engineSpeedMultiplier: 1,
    lives: difficultySettings.lives,
    nextAsteroidId: spawned.nextAsteroidId,
    nextBulletId: 0,
    nextPowerUpId: 0,
    nextSaucerBulletId: 0,
    nextSaucerId: 0,
    powerUp: null,
    powerUpSpawnCooldownTicks: ASTEROIDS_POWER_UP_MIN_SPAWN_TICKS,
    respawnInvulnerabilityTicks: 0,
    saucer: null,
    saucerBullets: [],
    saucerSpawnCooldownTicks: difficultySettings.saucerInitialSpawnTicks,
    score: 0,
    ship: createCenteredShip(ASTEROIDS_BOARD_WIDTH, ASTEROIDS_BOARD_HEIGHT),
    shipExplosion: null,
    shotCooldownTicks: 0,
    shotIntervalMultiplier: 1,
    startingAsteroidCount: difficultySettings.asteroidCount,
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
  game: Pick<AsteroidsGameState, "difficulty"> = {
    difficulty: ASTEROIDS_DEFAULT_DIFFICULTY,
  },
  { random }: AdvanceAsteroidsGameOptions = {},
): AsteroidsGameState {
  return {
    ...createInitialAsteroidsGame({
      difficulty: game.difficulty,
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
  const score = game.score + scoreDelta;
  const candidateGame = {
    ...game,
    ...world,
    lives: game.lives + getBonusLivesAwarded(game.score, score),
    respawnInvulnerabilityTicks: invulnerabilityTicks,
    score,
    ship,
  };
  const gameWithPowerUp = applyAsteroidsPowerUpPickup(
    advanceAsteroidsPowerUpAvailability(candidateGame, { random }),
    { random },
  );

  return resolveShipHazardCollision(gameWithPowerUp);
}

export function getAsteroidsTickDelay() {
  return ASTEROIDS_TICK_DELAY_MS;
}

export function getAsteroidsAsteroidScore(size: AsteroidSize) {
  return ASTEROID_SCORE[size];
}

export function getAsteroidsSaucerScore(kind: AsteroidsSaucerKind) {
  return ASTEROIDS_SAUCER_SCORE[kind];
}

function advanceShip(
  game: Pick<
    AsteroidsGameState,
    "boardHeight" | "boardWidth" | "engineSpeedMultiplier" | "ship"
  >,
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
          x: game.ship.velocity.x + heading.x * getShipThrust(game),
          y: game.ship.velocity.y + heading.y * getShipThrust(game),
        }
      : game.ship.velocity;
  const velocity = limitVelocity({
      x: acceleratedVelocity.x * SHIP_FRICTION,
      y: acceleratedVelocity.y * SHIP_FRICTION,
    },
    getShipMaxSpeed(game),
  );

  return {
    ...game.ship,
    angle: normalizeAngle(angle),
    isThrusting: controls.thrust === true,
    velocity,
    x: wrapCoordinate(game.ship.x + velocity.x, game.boardWidth),
    y: wrapCoordinate(game.ship.y + velocity.y, game.boardHeight),
  };
}

function getBulletSpeed(game: Pick<AsteroidsGameState, "bulletSpeedMultiplier">) {
  return BULLET_SPEED * game.bulletSpeedMultiplier;
}

function getShipMaxSpeed(game: Pick<AsteroidsGameState, "engineSpeedMultiplier">) {
  return SHIP_MAX_SPEED * game.engineSpeedMultiplier;
}

function getShipThrust(game: Pick<AsteroidsGameState, "engineSpeedMultiplier">) {
  return SHIP_THRUST * game.engineSpeedMultiplier;
}

function getShotCooldownTicks(game: Pick<AsteroidsGameState, "shotIntervalMultiplier">) {
  return Math.max(1, Math.round(SHOT_COOLDOWN_TICKS * game.shotIntervalMultiplier));
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

function advanceSaucerBullets(
  game: Pick<AsteroidsGameState, "boardHeight" | "boardWidth" | "saucerBullets">,
) {
  return game.saucerBullets
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
    | "difficulty"
    | "nextAsteroidId"
    | "nextSaucerBulletId"
    | "nextSaucerId"
    | "saucer"
    | "saucerBullets"
    | "saucerSpawnCooldownTicks"
    | "shotCooldownTicks"
    | "ship"
    | "shipExplosion"
    | "startingAsteroidCount"
    | "wave"
  >,
  { random }: AdvanceAsteroidsGameOptions = {},
) {
  const bullets = advanceBullets(game);
  const saucerBullets = advanceSaucerBullets(game);
  const asteroids = game.asteroids.map((asteroid) =>
    moveWrappedEntity(asteroid, game.boardWidth, game.boardHeight),
  );
  const movedSaucer = advanceSaucerMotionAndSpawn(game, random);
  const collisionResult = resolvePlayerBulletCollisions({
    asteroids,
    boardHeight: game.boardHeight,
    boardWidth: game.boardWidth,
    bullets,
    difficulty: game.difficulty,
    nextAsteroidId: game.nextAsteroidId,
    random,
    saucer: movedSaucer.saucer,
  });
  const saucerFireResult = fireSaucerShotIfReady({
    boardHeight: game.boardHeight,
    boardWidth: game.boardWidth,
    nextSaucerBulletId: game.nextSaucerBulletId,
    random,
    saucer: collisionResult.saucer,
    saucerBullets,
    ship: game.ship,
    shipExplosion: game.shipExplosion,
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
    nextSaucerBulletId: saucerFireResult.nextSaucerBulletId,
    nextSaucerId: movedSaucer.nextSaucerId,
    saucer: saucerFireResult.saucer,
    saucerBullets: saucerFireResult.saucerBullets,
    saucerSpawnCooldownTicks:
      collisionResult.saucerSpawnCooldownTicks ?? movedSaucer.saucerSpawnCooldownTicks,
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
  const score = game.score + scoreDelta;
  const candidateGame: AsteroidsGameState = advanceAsteroidsPowerUpAvailability({
    ...game,
    ...world,
    lives: game.lives + getBonusLivesAwarded(game.score, score),
    respawnInvulnerabilityTicks: 0,
    score,
    shipExplosion: {
      ...shipExplosion,
      ticksRemaining,
    },
  }, { random });

  if (ticksRemaining > 0) {
    return candidateGame;
  }

  if (candidateGame.lives === 0) {
    return {
      ...candidateGame,
      bullets: [],
      powerUp: null,
      saucer: null,
      saucerBullets: [],
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

function resolvePlayerBulletCollisions({
  asteroids,
  boardHeight,
  boardWidth,
  bullets,
  difficulty,
  nextAsteroidId,
  random,
  saucer,
}: {
  asteroids: Asteroid[];
  boardHeight: number;
  boardWidth: number;
  bullets: AsteroidsBullet[];
  difficulty: AsteroidsDifficulty;
  nextAsteroidId: number;
  random?: AsteroidsRandom;
  saucer: AsteroidsSaucer | null;
}) {
  let remainingAsteroids = asteroids;
  let nextId = nextAsteroidId;
  let remainingSaucer = saucer;
  let score = 0;
  let saucerSpawnCooldownTicks: number | null = null;
  const remainingBullets: AsteroidsBullet[] = [];

  for (const bullet of bullets) {
    if (
      remainingSaucer !== null &&
      entitiesCollide(bullet, remainingSaucer)
    ) {
      score += ASTEROIDS_SAUCER_SCORE[remainingSaucer.kind];
      remainingSaucer = null;
      saucerSpawnCooldownTicks =
        getAsteroidsDifficultySettings(difficulty).saucerRespawnCooldownTicks;
      continue;
    }

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
    saucer: remainingSaucer,
    saucerSpawnCooldownTicks,
    score,
  };
}

function resolveShipHazardCollision(game: AsteroidsGameState): AsteroidsGameState {
  const hittingSaucerShots = game.saucerBullets.filter((shot) =>
    entitiesCollideWrapped(shot, game.ship, game.boardWidth, game.boardHeight),
  );

  if (game.respawnInvulnerabilityTicks > 0) {
    if (hittingSaucerShots.length > 0) {
      return {
        ...game,
        saucerBullets: game.saucerBullets.filter(
          (shot) => !hittingSaucerShots.includes(shot),
        ),
      };
    }

    return game;
  }

  const hitAsteroid = game.asteroids.find((asteroid) =>
    entitiesCollideWrapped(game.ship, asteroid, game.boardWidth, game.boardHeight),
  );
  const hitSaucer =
    game.saucer !== null && entitiesCollide(game.ship, game.saucer);

  if (hitAsteroid === undefined && !hitSaucer && hittingSaucerShots.length === 0) {
    return game;
  }

  const lives = Math.max(0, game.lives - 1);

  return {
    ...game,
    bullets: [],
    saucerBullets: [],
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

function getBonusLivesAwarded(previousScore: number, nextScore: number) {
  if (nextScore <= previousScore) {
    return 0;
  }

  return (
    Math.floor(nextScore / ASTEROIDS_BONUS_LIFE_SCORE) -
    Math.floor(previousScore / ASTEROIDS_BONUS_LIFE_SCORE)
  );
}

function advanceAsteroidsPowerUpAvailability(
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

function applyAsteroidsPowerUpPickup(
  game: AsteroidsGameState,
  { random }: AdvanceAsteroidsGameOptions = {},
): AsteroidsGameState {
  if (
    game.powerUp === null ||
    game.shipExplosion !== null ||
    !shipTouchesPowerUp(game)
  ) {
    return game;
  }

  const pickedUpGame = applyAsteroidsPowerUpEffect(game, game.powerUp);

  return {
    ...pickedUpGame,
    powerUp: null,
    powerUpSpawnCooldownTicks: createPowerUpSpawnCooldown(game.nextPowerUpId, random),
  };
}

function applyAsteroidsPowerUpEffect(
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
      return {
        ...game,
        bulletSpeedMultiplier:
          game.bulletSpeedMultiplier * ASTEROIDS_POWER_UP_SPEED_MULTIPLIER,
      };
    case "engine-speed":
      return {
        ...game,
        engineSpeedMultiplier:
          game.engineSpeedMultiplier * ASTEROIDS_POWER_UP_SPEED_MULTIPLIER,
      };
    case "shield":
      return {
        ...game,
        respawnInvulnerabilityTicks: Math.max(
          game.respawnInvulnerabilityTicks,
          ASTEROIDS_POWER_UP_SHIELD_TICKS,
        ),
      };
    case "shot-interval":
      return {
        ...game,
        shotIntervalMultiplier:
          game.shotIntervalMultiplier * ASTEROIDS_POWER_UP_SHOT_INTERVAL_MULTIPLIER,
      };
  }
}

function shipTouchesPowerUp(
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

function createAsteroidsPowerUp(
  game: Pick<
    AsteroidsGameState,
    | "asteroids"
    | "boardHeight"
    | "boardWidth"
    | "nextPowerUpId"
    | "saucer"
    | "ship"
  >,
  random?: AsteroidsRandom,
): AsteroidsPowerUp {
  const kind = getPowerUpKind(game.nextPowerUpId, random);
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

function createPowerUpSpawnCooldown(idNumber: number, random?: AsteroidsRandom) {
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
  game: Pick<AsteroidsGameState, "asteroids" | "boardHeight" | "boardWidth" | "saucer" | "ship">,
) {
  const candidate = {
    ...powerUp,
    radius: POWER_UP_RADIUS,
  };

  if (
    entitiesCollideWrapped(
      { ...candidate, radius: candidate.radius + POWER_UP_SHIP_SPAWN_PADDING },
      game.ship,
      game.boardWidth,
      game.boardHeight,
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

function advanceSaucerMotionAndSpawn(
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

function fireSaucerShotIfReady({
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
      count: startingAsteroidCount + wave - 1,
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

function entitiesCollide(
  first: { radius: number; x: number; y: number },
  second: { radius: number; x: number; y: number },
) {
  const dx = first.x - second.x;
  const dy = first.y - second.y;
  const radius = first.radius + second.radius;

  return dx * dx + dy * dy <= radius * radius;
}

function getWrappedDistance(first: number, second: number, limit: number) {
  const directDistance = Math.abs(first - second);

  return Math.min(directDistance, limit - directDistance);
}

function getWrappedDelta(first: number, second: number, limit: number) {
  const directDelta = second - first;

  if (Math.abs(directDelta) <= limit / 2) {
    return directDelta;
  }

  return directDelta - Math.sign(directDelta) * limit;
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

function getPointAtAngle(
  origin: { x: number; y: number },
  angle: number,
  distance: number,
): AsteroidsPoint {
  return {
    x: origin.x + Math.cos(angle) * distance,
    y: origin.y + Math.sin(angle) * distance,
  };
}

function limitVelocity(velocity: AsteroidsPoint, maxSpeed: number): AsteroidsPoint {
  const speed = Math.hypot(velocity.x, velocity.y);

  if (speed <= maxSpeed) {
    return velocity;
  }

  const scale = maxSpeed / speed;

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

export function normalizeAsteroidsDifficulty(
  value: string | null | undefined,
): AsteroidsDifficulty {
  return ASTEROIDS_DIFFICULTY_OPTIONS.find((option) => option.value === value)?.value ??
    ASTEROIDS_DEFAULT_DIFFICULTY;
}

export function getAsteroidsDifficultySettings(difficulty: AsteroidsDifficulty) {
  return (
    ASTEROIDS_DIFFICULTY_OPTIONS.find((option) => option.value === difficulty) ??
    ASTEROIDS_DIFFICULTY_OPTIONS[1]
  );
}

export function getAsteroidsDifficultyLabel(difficulty: AsteroidsDifficulty) {
  return getAsteroidsDifficultySettings(difficulty).label;
}
