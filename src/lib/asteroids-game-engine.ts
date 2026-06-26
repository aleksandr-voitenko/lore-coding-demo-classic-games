import {
  ASTEROIDS_BOARD_HEIGHT,
  ASTEROIDS_BOARD_WIDTH,
  ASTEROIDS_DEFAULT_DIFFICULTY,
  ASTEROIDS_POWER_UP_MIN_SPAWN_TICKS,
  ASTEROIDS_RESPAWN_INVULNERABILITY_TICKS,
  ASTEROIDS_TICK_DELAY_MS,
} from "./asteroids/constants";
export {
  ASTEROIDS_BOARD_HEIGHT,
  ASTEROIDS_BOARD_WIDTH,
  ASTEROIDS_BONUS_LIFE_SCORE,
  ASTEROIDS_BONUS_SCORE_POWER_UP_POINTS,
  ASTEROIDS_DEFAULT_DIFFICULTY,
  ASTEROIDS_DIFFICULTY_OPTIONS,
  ASTEROIDS_POWER_UP_MAX_SPAWN_TICKS,
  ASTEROIDS_POWER_UP_MIN_SPAWN_TICKS,
  ASTEROIDS_POWER_UP_SHIELD_TICKS,
  ASTEROIDS_RESPAWN_INVULNERABILITY_TICKS,
  ASTEROIDS_SAUCER_INITIAL_SPAWN_TICKS,
  ASTEROIDS_SHIP_EXPLOSION_TICKS,
  ASTEROIDS_STARTING_ASTEROID_COUNT,
  ASTEROIDS_STARTING_LIVES,
  ASTEROIDS_TICK_DELAY_MS,
} from "./asteroids/constants";
import {
  createNextWave,
  createWaveAsteroids,
  splitAsteroid,
} from "./asteroids/asteroids";
import {
  getAsteroidsDifficultySettings,
  normalizeAsteroidsDifficulty,
} from "./asteroids/difficulty";
export {
  getAsteroidsDifficultyLabel,
  getAsteroidsDifficultySettings,
  normalizeAsteroidsDifficulty,
} from "./asteroids/difficulty";
import {
  entitiesCollide,
  entitiesCollideWrapped,
  moveWrappedEntity,
} from "./asteroids/geometry";
import {
  advanceBullets,
  advanceSaucerBullets,
} from "./asteroids/projectiles";
export { fireAsteroidsBullet } from "./asteroids/projectiles";
import {
  advanceAsteroidsPowerUpAvailability,
  applyAsteroidsPowerUpPickup,
} from "./asteroids/power-ups";
import {
  getAsteroidsAsteroidScore,
  getAsteroidsSaucerScore,
  getBonusLivesAwarded,
} from "./asteroids/scoring";
export {
  getAsteroidsAsteroidScore,
  getAsteroidsSaucerScore,
} from "./asteroids/scoring";
import {
  advanceSaucerMotionAndSpawn,
  fireSaucerShotIfReady,
} from "./asteroids/saucers";
import {
  advanceShip,
  createInitialAsteroidsShipOwnedState,
  createCenteredShip,
  createShipExplosion,
} from "./asteroids/ship";
import type {
  AdvanceAsteroidsGameOptions,
  Asteroid,
  AsteroidsBullet,
  AsteroidsControlInput,
  AsteroidsDifficulty,
  AsteroidsGameState,
  AsteroidsRandom,
  AsteroidsSaucer,
  AsteroidsSharedWorldState,
  AsteroidsShipOwnedState,
  CreateAsteroidsGameOptions,
} from "./asteroids/types";

export type {
  AdvanceAsteroidsGameOptions,
  Asteroid,
  AsteroidsBullet,
  AsteroidsControlInput,
  AsteroidsDifficulty,
  AsteroidsGameState,
  AsteroidsPoint,
  AsteroidsPowerUp,
  AsteroidsPowerUpKind,
  AsteroidsRandom,
  AsteroidsSaucer,
  AsteroidsSaucerKind,
  AsteroidsSaucerShot,
  AsteroidsSharedWorldState,
  AsteroidsShip,
  AsteroidsShipExplosion,
  AsteroidsShipOwnedState,
  AsteroidsStatus,
  AsteroidSize,
  CreateAsteroidsGameOptions,
} from "./asteroids/types";

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
    ...createInitialAsteroidsShipOwnedState(
      ASTEROIDS_BOARD_WIDTH,
      ASTEROIDS_BOARD_HEIGHT,
    ),
    difficulty: normalizedDifficulty,
    lives: difficultySettings.lives,
    nextAsteroidId: spawned.nextAsteroidId,
    nextBulletId: 0,
    nextPowerUpId: 0,
    nextSaucerBulletId: 0,
    nextSaucerId: 0,
    powerUp: null,
    powerUpSpawnCooldownTicks: ASTEROIDS_POWER_UP_MIN_SPAWN_TICKS,
    saucer: null,
    saucerBullets: [],
    saucerSpawnCooldownTicks: difficultySettings.saucerInitialSpawnTicks,
    score: 0,
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
  // Resolve power-ups before hazards so same-tick shield pickups can protect the ship.
  const gameWithPowerUp = applyAsteroidsPowerUpPickup(
    advanceAsteroidsPowerUpAvailability(candidateGame, { random }),
    { random },
  );

  return resolveShipHazardCollision(gameWithPowerUp);
}

export function getAsteroidsTickDelay() {
  return ASTEROIDS_TICK_DELAY_MS;
}

function advanceAsteroidsWorld(
  game: Pick<
    AsteroidsSharedWorldState,
    | "asteroids"
    | "boardHeight"
    | "boardWidth"
    | "difficulty"
    | "nextAsteroidId"
    | "nextSaucerBulletId"
    | "nextSaucerId"
    | "saucer"
    | "saucerBullets"
    | "saucerSpawnCooldownTicks"
    | "startingAsteroidCount"
    | "wave"
  > &
    Pick<
      AsteroidsShipOwnedState,
      "bullets" | "shotCooldownTicks" | "ship" | "shipExplosion"
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

  // The world keeps advancing during the explosion, including score and bonus-life awards.
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
      score += getAsteroidsSaucerScore(remainingSaucer.kind);
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
    score += getAsteroidsAsteroidScore(hitAsteroid.size);
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
