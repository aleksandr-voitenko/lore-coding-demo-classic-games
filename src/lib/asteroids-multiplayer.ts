import type {
  MultiplayerRealtimeGameSnapshot,
  MultiplayerTerminalSummary,
} from "./multiplayer/protocol";
import {
  ASTEROIDS_DEFAULT_DIFFICULTY,
  ASTEROIDS_RESPAWN_INVULNERABILITY_TICKS,
} from "./asteroids/constants";
import {
  createNextWave,
  splitAsteroid,
} from "./asteroids/asteroids";
import { getAsteroidsDifficultySettings } from "./asteroids/difficulty";
import {
  entitiesCollide,
  entitiesCollideWrapped,
  moveWrappedEntity,
} from "./asteroids/geometry";
import {
  advanceBullets,
  advanceSaucerBullets,
  fireAsteroidsShipBullet,
} from "./asteroids/projectiles";
import {
  applyAsteroidsPowerUpEffect,
  asteroidsShipTouchesPowerUp,
  createAsteroidsPowerUp,
  createAsteroidsPowerUpSpawnCooldown,
} from "./asteroids/power-ups";
import {
  getAsteroidsAsteroidScore,
  getAsteroidsSaucerScore,
  getBonusLivesAwarded,
} from "./asteroids/scoring";
import {
  advanceSaucerMotionAndSpawn,
  fireSaucerShotIfReady,
} from "./asteroids/saucers";
import {
  advanceShip,
  createInitialAsteroidsShipOwnedState,
  createShipExplosion,
  getAsteroidsShipOwnedState,
} from "./asteroids/ship";
import type {
  AdvanceAsteroidsGameOptions,
  Asteroid,
  AsteroidsBullet,
  AsteroidsControlInput,
  AsteroidsGameState,
  AsteroidsPoint,
  AsteroidsPowerUp,
  AsteroidsRandom,
  AsteroidsSaucer,
  AsteroidsSaucerShot,
  AsteroidsSharedWorldState,
  AsteroidsShip,
  AsteroidsShipExplosion,
  AsteroidsShipOwnedState,
  CreateAsteroidsGameOptions,
} from "./asteroids/types";
import { createInitialAsteroidsGame } from "./asteroids-game-engine";

type AsteroidsMultiplayerRespawnRatio = {
  x: number;
  y: number;
};

type AsteroidsMultiplayerWorldAdvanceResult = AsteroidsMultiplayerGameState & {
  scoreDelta: number;
};

type AsteroidsMultiplayerPlayerBulletCollisionResult = {
  asteroids: Asteroid[];
  nextAsteroidId: number;
  saucer: AsteroidsSaucer | null;
  saucerSpawnCooldownTicks: number | null;
  score: number;
  ships: AsteroidsMultiplayerShips;
};

export const ASTEROIDS_MULTIPLAYER_SHIP_SEATS = [
  "ship-a",
  "ship-b",
] as const;

export type AsteroidsShipSeat =
  (typeof ASTEROIDS_MULTIPLAYER_SHIP_SEATS)[number];

export type AsteroidsMultiplayerRoomSeat = {
  id: AsteroidsShipSeat;
  label: string;
  required: true;
};

export const ASTEROIDS_MULTIPLAYER_ROOM_SEATS = [
  {
    id: "ship-a",
    label: "Ship A",
    required: true,
  },
  {
    id: "ship-b",
    label: "Ship B",
    required: true,
  },
] as const satisfies readonly AsteroidsMultiplayerRoomSeat[];

export type AsteroidsMultiplayerShipState = AsteroidsShipOwnedState & {
  isActive: boolean;
  respawnOnExplosionEnd: boolean;
  seat: AsteroidsShipSeat;
};

export type AsteroidsMultiplayerShips = Record<
  AsteroidsShipSeat,
  AsteroidsMultiplayerShipState
>;

export type AsteroidsMultiplayerGameState = AsteroidsSharedWorldState & {
  ships: AsteroidsMultiplayerShips;
};

export type CreateAsteroidsMultiplayerGameOptions = CreateAsteroidsGameOptions;

export type AsteroidsMultiplayerClientInput =
  | {
      controls: AsteroidsControlInput;
      type: "asteroids.setShipControls";
    }
  | {
      type: "asteroids.fire";
    };

export type AsteroidsMultiplayerHeldInput = AsteroidsControlInput & {
  fire?: boolean;
};

export type AsteroidsMultiplayerHeldInputs = Readonly<
  Partial<Record<AsteroidsShipSeat, AsteroidsMultiplayerHeldInput>>
>;

export type AsteroidsMultiplayerTerminalSummary = MultiplayerTerminalSummary<
  Extract<AsteroidsMultiplayerGameState["status"], "lost">,
  {
    livesRemaining: number;
    score: number;
    wave: number;
  }
>;

export type AsteroidsMultiplayerGameSnapshot = MultiplayerRealtimeGameSnapshot<
  "asteroids",
  AsteroidsMultiplayerGameState,
  {
    heldInputs: AsteroidsMultiplayerHeldInputs;
    summary?: AsteroidsMultiplayerTerminalSummary;
  }
>;

const ASTEROIDS_MULTIPLAYER_INITIAL_SHIP_POSITIONS = {
  "ship-a": { x: 0.42, y: 0.5 },
  "ship-b": { x: 0.58, y: 0.5 },
} as const satisfies Record<AsteroidsShipSeat, AsteroidsMultiplayerRespawnRatio>;

const ASTEROIDS_MULTIPLAYER_RESPAWN_CANDIDATES = {
  "ship-a": [
    { x: 0.42, y: 0.5 },
    { x: 0.34, y: 0.36 },
    { x: 0.5, y: 0.32 },
    { x: 0.28, y: 0.64 },
    { x: 0.5, y: 0.68 },
  ],
  "ship-b": [
    { x: 0.58, y: 0.5 },
    { x: 0.66, y: 0.64 },
    { x: 0.5, y: 0.68 },
    { x: 0.72, y: 0.36 },
    { x: 0.5, y: 0.32 },
  ],
} as const satisfies Record<
  AsteroidsShipSeat,
  readonly AsteroidsMultiplayerRespawnRatio[]
>;

const ASTEROIDS_MULTIPLAYER_RESPAWN_CLEARANCE = 72;

export function createInitialAsteroidsMultiplayerGame(
  options: CreateAsteroidsMultiplayerGameOptions = {},
): AsteroidsMultiplayerGameState {
  const initialGame = createInitialAsteroidsGame(options);

  return {
    ...pickAsteroidsMultiplayerSharedState(initialGame),
    ships: createInitialAsteroidsMultiplayerShips(
      initialGame.boardWidth,
      initialGame.boardHeight,
    ),
  };
}

export function cloneAsteroidsMultiplayerGame(
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

export function isAsteroidsShipSeat(value: unknown): value is AsteroidsShipSeat {
  return ASTEROIDS_MULTIPLAYER_SHIP_SEATS.includes(value as AsteroidsShipSeat);
}

export function startAsteroidsMultiplayerGame(
  game: AsteroidsMultiplayerGameState,
): AsteroidsMultiplayerGameState {
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
    return restartAsteroidsMultiplayerGame(game);
  }

  return {
    ...setAsteroidsMultiplayerActiveShipInvulnerability(
      game,
      ASTEROIDS_RESPAWN_INVULNERABILITY_TICKS,
    ),
    status: "running" as const,
  };
}

export function pauseAsteroidsMultiplayerGame(
  game: AsteroidsMultiplayerGameState,
): AsteroidsMultiplayerGameState {
  if (game.status !== "running") {
    return game;
  }

  return {
    ...game,
    status: "paused" as const,
  };
}

export function restartAsteroidsMultiplayerGame(
  game: Pick<AsteroidsMultiplayerGameState, "difficulty"> = {
    difficulty: ASTEROIDS_DEFAULT_DIFFICULTY,
  },
  { random }: AdvanceAsteroidsGameOptions = {},
): AsteroidsMultiplayerGameState {
  return {
    ...setAsteroidsMultiplayerActiveShipInvulnerability(
      createInitialAsteroidsMultiplayerGame({
        difficulty: game.difficulty,
        random,
      }),
      ASTEROIDS_RESPAWN_INVULNERABILITY_TICKS,
    ),
    status: "running" as const,
  };
}

export function fireAsteroidsMultiplayerShipBullet(
  game: AsteroidsMultiplayerGameState,
  seat: unknown,
): AsteroidsMultiplayerGameState {
  if (!isAsteroidsShipSeat(seat)) {
    return game;
  }

  const ship = game.ships[seat];

  if (!isAsteroidsMultiplayerShipPlayable(ship)) {
    return game;
  }

  const fired = fireAsteroidsShipBullet(game, ship);

  if (fired === null) {
    return game;
  }

  return {
    ...updateAsteroidsMultiplayerShip(game, seat, {
      ...ship,
      ...fired.shipState,
    }),
    nextBulletId: fired.nextBulletId,
  };
}

export function advanceAsteroidsMultiplayerGameTick(
  game: AsteroidsMultiplayerGameState,
  inputs: AsteroidsMultiplayerHeldInputs = {},
  { random }: AdvanceAsteroidsGameOptions = {},
): AsteroidsMultiplayerGameState {
  if (game.status !== "running") {
    return game;
  }

  const explodingSeatsAtTickStart = getAsteroidsMultiplayerExplodingSeats(game);
  const gameAfterShipMotion = advanceAsteroidsMultiplayerShips(game, inputs);
  const gameAfterInput = applyAsteroidsMultiplayerHeldFire(
    gameAfterShipMotion,
    inputs,
  );
  const { scoreDelta, ...worldAdvancedGame } = advanceAsteroidsMultiplayerWorld(
    gameAfterInput,
    { random },
  );
  const score = worldAdvancedGame.score + scoreDelta;
  const gameAfterScoring = {
    ...worldAdvancedGame,
    lives:
      worldAdvancedGame.lives +
      getBonusLivesAwarded(worldAdvancedGame.score, score),
    score,
  };
  const gameAfterPowerUps = applyAsteroidsMultiplayerPowerUpPickup(
    advanceAsteroidsMultiplayerPowerUpAvailability(gameAfterScoring, { random }),
    { random },
  );
  const gameAfterHazards = resolveAsteroidsMultiplayerShipHazards(
    gameAfterPowerUps,
    { random },
  );

  return advanceAsteroidsMultiplayerExplosions(
    gameAfterHazards,
    explodingSeatsAtTickStart,
  );
}

function advanceAsteroidsMultiplayerShips(
  game: AsteroidsMultiplayerGameState,
  inputs: AsteroidsMultiplayerHeldInputs,
): AsteroidsMultiplayerGameState {
  let nextGame = game;

  for (const seat of ASTEROIDS_MULTIPLAYER_SHIP_SEATS) {
    const ship = nextGame.ships[seat];

    if (!isAsteroidsMultiplayerShipPlayable(ship)) {
      continue;
    }

    nextGame = updateAsteroidsMultiplayerShip(nextGame, seat, {
      ...ship,
      ship: advanceShip(
        {
          ...nextGame,
          ...ship,
        },
        inputs[seat] ?? {},
      ),
    });
  }

  return nextGame;
}

function applyAsteroidsMultiplayerHeldFire(
  game: AsteroidsMultiplayerGameState,
  inputs: AsteroidsMultiplayerHeldInputs,
): AsteroidsMultiplayerGameState {
  let nextGame = game;

  for (const seat of ASTEROIDS_MULTIPLAYER_SHIP_SEATS) {
    if (inputs[seat]?.fire === true) {
      nextGame = fireAsteroidsMultiplayerShipBullet(nextGame, seat);
    }
  }

  return nextGame;
}

function advanceAsteroidsMultiplayerWorld(
  game: AsteroidsMultiplayerGameState,
  { random }: AdvanceAsteroidsGameOptions,
): AsteroidsMultiplayerWorldAdvanceResult {
  const shipsWithAdvancedProjectiles =
    advanceAsteroidsMultiplayerShipProjectiles(game);
  const saucerBullets = advanceSaucerBullets(game);
  const asteroids = game.asteroids.map((asteroid) =>
    moveWrappedEntity(asteroid, game.boardWidth, game.boardHeight),
  );
  const movedSaucer = advanceSaucerMotionAndSpawn(game, random);
  const collisionResult = resolveAsteroidsMultiplayerPlayerBulletCollisions({
    asteroids,
    boardHeight: game.boardHeight,
    boardWidth: game.boardWidth,
    bulletsBySeat: pickAsteroidsMultiplayerShipBullets(
      shipsWithAdvancedProjectiles,
    ),
    difficulty: game.difficulty,
    nextAsteroidId: game.nextAsteroidId,
    random,
    saucer: movedSaucer.saucer,
    ships: shipsWithAdvancedProjectiles,
  });
  const saucerFireResult = fireAsteroidsMultiplayerSaucerShotIfReady({
    boardHeight: game.boardHeight,
    boardWidth: game.boardWidth,
    nextSaucerBulletId: game.nextSaucerBulletId,
    random,
    saucer: collisionResult.saucer,
    saucerBullets,
    ships: collisionResult.ships,
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
    ...game,
    asteroids: waveResult.asteroids,
    nextAsteroidId: waveResult.nextAsteroidId,
    nextSaucerBulletId: saucerFireResult.nextSaucerBulletId,
    nextSaucerId: movedSaucer.nextSaucerId,
    saucer: saucerFireResult.saucer,
    saucerBullets: saucerFireResult.saucerBullets,
    saucerSpawnCooldownTicks:
      collisionResult.saucerSpawnCooldownTicks ??
      movedSaucer.saucerSpawnCooldownTicks,
    scoreDelta: collisionResult.score,
    ships: collisionResult.ships,
    wave: waveResult.wave,
  };
}

function advanceAsteroidsMultiplayerShipProjectiles(
  game: AsteroidsMultiplayerGameState,
): AsteroidsMultiplayerShips {
  return {
    "ship-a": advanceAsteroidsMultiplayerShipProjectileState(
      game,
      game.ships["ship-a"],
    ),
    "ship-b": advanceAsteroidsMultiplayerShipProjectileState(
      game,
      game.ships["ship-b"],
    ),
  };
}

function advanceAsteroidsMultiplayerShipProjectileState(
  game: AsteroidsMultiplayerGameState,
  ship: AsteroidsMultiplayerShipState,
): AsteroidsMultiplayerShipState {
  return {
    ...ship,
    bullets: advanceBullets({
      ...game,
      bullets: ship.bullets,
    }),
    respawnInvulnerabilityTicks:
      ship.shipExplosion === null
        ? Math.max(0, ship.respawnInvulnerabilityTicks - 1)
        : 0,
    shotCooldownTicks: Math.max(0, ship.shotCooldownTicks - 1),
  };
}

function resolveAsteroidsMultiplayerPlayerBulletCollisions({
  asteroids,
  boardHeight,
  boardWidth,
  bulletsBySeat,
  difficulty,
  nextAsteroidId,
  random,
  saucer,
  ships,
}: {
  asteroids: Asteroid[];
  boardHeight: number;
  boardWidth: number;
  bulletsBySeat: Record<AsteroidsShipSeat, AsteroidsBullet[]>;
  difficulty: AsteroidsMultiplayerGameState["difficulty"];
  nextAsteroidId: number;
  random?: AsteroidsRandom;
  saucer: AsteroidsSaucer | null;
  ships: AsteroidsMultiplayerShips;
}): AsteroidsMultiplayerPlayerBulletCollisionResult {
  let remainingAsteroids = asteroids;
  let remainingSaucer = saucer;
  let nextId = nextAsteroidId;
  let score = 0;
  let saucerSpawnCooldownTicks: number | null = null;
  const nextShips: AsteroidsMultiplayerShips = { ...ships };

  for (const seat of ASTEROIDS_MULTIPLAYER_SHIP_SEATS) {
    const remainingBullets: AsteroidsBullet[] = [];

    for (const bullet of bulletsBySeat[seat]) {
      if (remainingSaucer !== null && entitiesCollide(bullet, remainingSaucer)) {
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

    nextShips[seat] = {
      ...nextShips[seat],
      bullets: remainingBullets,
    };
  }

  return {
    asteroids: remainingAsteroids,
    nextAsteroidId: nextId,
    saucer: remainingSaucer,
    saucerSpawnCooldownTicks,
    score,
    ships: nextShips,
  };
}

function fireAsteroidsMultiplayerSaucerShotIfReady({
  boardHeight,
  boardWidth,
  nextSaucerBulletId,
  random,
  saucer,
  saucerBullets,
  ships,
}: {
  boardHeight: number;
  boardWidth: number;
  nextSaucerBulletId: number;
  random?: AsteroidsRandom;
  saucer: AsteroidsSaucer | null;
  saucerBullets: AsteroidsSaucerShot[];
  ships: AsteroidsMultiplayerShips;
}) {
  if (saucer === null || saucer.shotCooldownTicks > 0) {
    return {
      nextSaucerBulletId,
      saucer,
      saucerBullets,
    };
  }

  const targetSeat = chooseAsteroidsMultiplayerSaucerTargetSeat(ships, random);

  if (targetSeat === null) {
    return {
      nextSaucerBulletId,
      saucer,
      saucerBullets,
    };
  }

  const targetShip = ships[targetSeat];

  return fireSaucerShotIfReady({
    boardHeight,
    boardWidth,
    nextSaucerBulletId,
    random,
    saucer,
    saucerBullets,
    ship: targetShip.ship,
    shipExplosion: targetShip.shipExplosion,
  });
}

function chooseAsteroidsMultiplayerSaucerTargetSeat(
  ships: AsteroidsMultiplayerShips,
  random?: AsteroidsRandom,
): AsteroidsShipSeat | null {
  const targetableSeats = ASTEROIDS_MULTIPLAYER_SHIP_SEATS.filter((seat) =>
    isAsteroidsMultiplayerShipPlayable(ships[seat]),
  );

  if (targetableSeats.length === 0) {
    return null;
  }

  return (
    targetableSeats[
      getAsteroidsMultiplayerRandomIndex(targetableSeats.length, random)
    ] ?? targetableSeats[0]!
  );
}

function advanceAsteroidsMultiplayerPowerUpAvailability(
  game: AsteroidsMultiplayerGameState,
  { random }: AdvanceAsteroidsGameOptions,
): AsteroidsMultiplayerGameState {
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
    powerUp: createAsteroidsPowerUp(
      {
        ...game,
        ship: game.ships["ship-a"].ship,
        ships: ASTEROIDS_MULTIPLAYER_SHIP_SEATS.map(
          (seat) => game.ships[seat].ship,
        ),
      },
      random,
    ),
    powerUpSpawnCooldownTicks: 0,
  };
}

function applyAsteroidsMultiplayerPowerUpPickup(
  game: AsteroidsMultiplayerGameState,
  { random }: AdvanceAsteroidsGameOptions,
): AsteroidsMultiplayerGameState {
  if (game.powerUp === null) {
    return game;
  }

  const powerUp = game.powerUp;
  const collectingSeats = ASTEROIDS_MULTIPLAYER_SHIP_SEATS.filter((seat) =>
    canAsteroidsMultiplayerShipCollectPowerUp(game, seat, powerUp),
  );

  if (collectingSeats.length === 0) {
    return game;
  }

  const collector =
    collectingSeats[
      getAsteroidsMultiplayerRandomIndex(collectingSeats.length, random)
    ] ?? collectingSeats[0]!;
  const pickedUpGame = applyAsteroidsMultiplayerPowerUpEffect(
    game,
    collector,
    powerUp,
  );

  return {
    ...pickedUpGame,
    powerUp: null,
    powerUpSpawnCooldownTicks: createAsteroidsPowerUpSpawnCooldown(
      game.nextPowerUpId,
      random,
    ),
  };
}

function canAsteroidsMultiplayerShipCollectPowerUp(
  game: AsteroidsMultiplayerGameState,
  seat: AsteroidsShipSeat,
  powerUp: AsteroidsPowerUp,
) {
  const ship = game.ships[seat];

  return (
    isAsteroidsMultiplayerShipPlayable(ship) &&
    asteroidsShipTouchesPowerUp({
      ...game,
      powerUp,
      ship: ship.ship,
    })
  );
}

function applyAsteroidsMultiplayerPowerUpEffect(
  game: AsteroidsMultiplayerGameState,
  seat: AsteroidsShipSeat,
  powerUp: AsteroidsPowerUp,
): AsteroidsMultiplayerGameState {
  const projectedGame = applyAsteroidsPowerUpEffect(
    createAsteroidsSoloProjection(game, seat),
    powerUp,
  );

  return {
    ...pickAsteroidsMultiplayerSharedState(projectedGame),
    ships: {
      ...game.ships,
      [seat]: {
        ...game.ships[seat],
        ...getAsteroidsShipOwnedState(projectedGame),
      },
    },
  };
}

function resolveAsteroidsMultiplayerShipHazards(
  game: AsteroidsMultiplayerGameState,
  { random }: AdvanceAsteroidsGameOptions,
): AsteroidsMultiplayerGameState {
  const destroyedSeats = new Set<AsteroidsShipSeat>();

  for (const seat of ASTEROIDS_MULTIPLAYER_SHIP_SEATS) {
    if (isAsteroidsMultiplayerShipVulnerableToBodyHazards(game.ships[seat])) {
      if (asteroidsMultiplayerShipTouchesBodyHazard(game, seat)) {
        destroyedSeats.add(seat);
      }
    }
  }

  const consumedSaucerShotIds = new Set<string>();

  for (const shot of game.saucerBullets) {
    const hitSeats = getAsteroidsMultiplayerSaucerShotHitSeats(game, shot);

    if (hitSeats.length === 0) {
      continue;
    }

    consumedSaucerShotIds.add(shot.id);

    const vulnerableHitSeats = hitSeats.filter(
      (seat) => game.ships[seat].respawnInvulnerabilityTicks === 0,
    );

    if (vulnerableHitSeats.length === 0) {
      continue;
    }

    const destroyedSeat =
      vulnerableHitSeats[
        getAsteroidsMultiplayerRandomIndex(vulnerableHitSeats.length, random)
      ] ?? vulnerableHitSeats[0]!;

    destroyedSeats.add(destroyedSeat);
  }

  if (destroyedSeats.size === 0) {
    if (consumedSaucerShotIds.size === 0) {
      return game;
    }

    return {
      ...game,
      saucerBullets: game.saucerBullets.filter(
        (shot) => !consumedSaucerShotIds.has(shot.id),
      ),
    };
  }

  return damageAsteroidsMultiplayerShips(
    game,
    ASTEROIDS_MULTIPLAYER_SHIP_SEATS.filter((seat) => destroyedSeats.has(seat)),
    game.saucerBullets.filter((shot) => !consumedSaucerShotIds.has(shot.id)),
    random,
  );
}

function damageAsteroidsMultiplayerShips(
  game: AsteroidsMultiplayerGameState,
  destroyedSeats: AsteroidsShipSeat[],
  saucerBullets: AsteroidsSaucerShot[],
  random?: AsteroidsRandom,
): AsteroidsMultiplayerGameState {
  const respawningSeats = chooseAsteroidsMultiplayerRespawningSeats(
    destroyedSeats,
    game.lives,
    random,
  );
  const ships: AsteroidsMultiplayerShips = { ...game.ships };

  for (const seat of destroyedSeats) {
    const ship = game.ships[seat];
    const shouldRespawn = respawningSeats.has(seat);

    ships[seat] = {
      ...ship,
      bullets: [],
      isActive: shouldRespawn,
      respawnInvulnerabilityTicks: 0,
      respawnOnExplosionEnd: shouldRespawn,
      ship: {
        ...ship.ship,
        isThrusting: false,
      },
      shipExplosion: createShipExplosion(ship.ship),
    };
  }

  return {
    ...game,
    lives: Math.max(0, game.lives - destroyedSeats.length),
    saucerBullets,
    ships,
  };
}

function chooseAsteroidsMultiplayerRespawningSeats(
  destroyedSeats: AsteroidsShipSeat[],
  lives: number,
  random?: AsteroidsRandom,
) {
  const respawnCount = Math.min(lives, destroyedSeats.length);

  if (respawnCount <= 0) {
    return new Set<AsteroidsShipSeat>();
  }

  if (respawnCount >= destroyedSeats.length) {
    return new Set(destroyedSeats);
  }

  const chosenSeat =
    destroyedSeats[
      getAsteroidsMultiplayerRandomIndex(destroyedSeats.length, random)
    ] ?? destroyedSeats[0];

  return new Set(chosenSeat === undefined ? [] : [chosenSeat]);
}

function advanceAsteroidsMultiplayerExplosions(
  game: AsteroidsMultiplayerGameState,
  explodingSeatsAtTickStart: ReadonlySet<AsteroidsShipSeat>,
): AsteroidsMultiplayerGameState {
  let nextGame = game;
  const ships: AsteroidsMultiplayerShips = { ...game.ships };

  for (const seat of ASTEROIDS_MULTIPLAYER_SHIP_SEATS) {
    const ship = ships[seat];

    if (
      !explodingSeatsAtTickStart.has(seat) ||
      ship.shipExplosion === null
    ) {
      continue;
    }

    const ticksRemaining = ship.shipExplosion.ticksRemaining - 1;

    if (ticksRemaining > 0) {
      ships[seat] = {
        ...ship,
        shipExplosion: {
          ...ship.shipExplosion,
          ticksRemaining,
        },
      };
      nextGame = {
        ...nextGame,
        ships,
      };
      continue;
    }

    if (ship.respawnOnExplosionEnd || nextGame.lives > 0) {
      ships[seat] = respawnAsteroidsMultiplayerShip(
        {
          ...nextGame,
          ships,
        },
        ship,
      );
    } else {
      ships[seat] = deactivateAsteroidsMultiplayerShip(ship);
    }

    nextGame = {
      ...nextGame,
      ships,
    };
  }

  return finalizeAsteroidsMultiplayerLoss(nextGame);
}

function respawnAsteroidsMultiplayerShip(
  game: AsteroidsMultiplayerGameState,
  ship: AsteroidsMultiplayerShipState,
): AsteroidsMultiplayerShipState {
  return {
    ...ship,
    bullets: [],
    isActive: true,
    respawnInvulnerabilityTicks: ASTEROIDS_RESPAWN_INVULNERABILITY_TICKS,
    respawnOnExplosionEnd: false,
    ship: createAsteroidsMultiplayerRespawnShip(game, ship.seat),
    shipExplosion: null,
  };
}

function deactivateAsteroidsMultiplayerShip(
  ship: AsteroidsMultiplayerShipState,
): AsteroidsMultiplayerShipState {
  return {
    ...ship,
    bullets: [],
    isActive: false,
    respawnInvulnerabilityTicks: 0,
    respawnOnExplosionEnd: false,
    ship: {
      ...ship.ship,
      isThrusting: false,
    },
    shipExplosion: null,
  };
}

function finalizeAsteroidsMultiplayerLoss(
  game: AsteroidsMultiplayerGameState,
): AsteroidsMultiplayerGameState {
  if (
    ASTEROIDS_MULTIPLAYER_SHIP_SEATS.some(
      (seat) => game.ships[seat].isActive || game.ships[seat].shipExplosion !== null,
    )
  ) {
    return game;
  }

  return {
    ...game,
    powerUp: null,
    saucer: null,
    saucerBullets: [],
    ships: {
      "ship-a": {
        ...game.ships["ship-a"],
        bullets: [],
      },
      "ship-b": {
        ...game.ships["ship-b"],
        bullets: [],
      },
    },
    status: "lost" as const,
  };
}

function asteroidsMultiplayerShipTouchesBodyHazard(
  game: AsteroidsMultiplayerGameState,
  seat: AsteroidsShipSeat,
) {
  const ship = game.ships[seat].ship;

  return (
    game.asteroids.some((asteroid) =>
      entitiesCollideWrapped(ship, asteroid, game.boardWidth, game.boardHeight),
    ) ||
    (game.saucer !== null && entitiesCollide(ship, game.saucer))
  );
}

function getAsteroidsMultiplayerSaucerShotHitSeats(
  game: AsteroidsMultiplayerGameState,
  shot: AsteroidsSaucerShot,
) {
  return ASTEROIDS_MULTIPLAYER_SHIP_SEATS.filter((seat) => {
    const ship = game.ships[seat];

    return (
      isAsteroidsMultiplayerShipPlayable(ship) &&
      entitiesCollideWrapped(shot, ship.ship, game.boardWidth, game.boardHeight)
    );
  });
}

function isAsteroidsMultiplayerShipPlayable(
  ship: AsteroidsMultiplayerShipState,
) {
  return ship.isActive && ship.shipExplosion === null;
}

function isAsteroidsMultiplayerShipVulnerableToBodyHazards(
  ship: AsteroidsMultiplayerShipState,
) {
  return (
    isAsteroidsMultiplayerShipPlayable(ship) &&
    ship.respawnInvulnerabilityTicks === 0
  );
}

function createInitialAsteroidsMultiplayerShips(
  boardWidth: number,
  boardHeight: number,
): AsteroidsMultiplayerShips {
  return {
    "ship-a": createInitialAsteroidsMultiplayerShipState(
      "ship-a",
      boardWidth,
      boardHeight,
    ),
    "ship-b": createInitialAsteroidsMultiplayerShipState(
      "ship-b",
      boardWidth,
      boardHeight,
    ),
  };
}

function createInitialAsteroidsMultiplayerShipState(
  seat: AsteroidsShipSeat,
  boardWidth: number,
  boardHeight: number,
): AsteroidsMultiplayerShipState {
  const shipState = createInitialAsteroidsShipOwnedState(boardWidth, boardHeight);

  return {
    ...shipState,
    isActive: true,
    respawnOnExplosionEnd: false,
    seat,
    ship: createAsteroidsMultiplayerShipAtRatio(
      shipState.ship,
      boardWidth,
      boardHeight,
      ASTEROIDS_MULTIPLAYER_INITIAL_SHIP_POSITIONS[seat],
    ),
  };
}

function createAsteroidsMultiplayerRespawnShip(
  game: AsteroidsMultiplayerGameState,
  seat: AsteroidsShipSeat,
) {
  const baseShip = createInitialAsteroidsShipOwnedState(
    game.boardWidth,
    game.boardHeight,
  ).ship;
  const candidates = ASTEROIDS_MULTIPLAYER_RESPAWN_CANDIDATES[seat];

  for (const ratio of candidates) {
    const candidate = createAsteroidsMultiplayerShipAtRatio(
      baseShip,
      game.boardWidth,
      game.boardHeight,
      ratio,
    );

    if (!isAsteroidsMultiplayerRespawnBlocked(game, seat, candidate)) {
      return candidate;
    }
  }

  return createAsteroidsMultiplayerShipAtRatio(
    baseShip,
    game.boardWidth,
    game.boardHeight,
    ASTEROIDS_MULTIPLAYER_INITIAL_SHIP_POSITIONS[seat],
  );
}

function createAsteroidsMultiplayerShipAtRatio(
  ship: AsteroidsShip,
  boardWidth: number,
  boardHeight: number,
  ratio: AsteroidsMultiplayerRespawnRatio,
): AsteroidsShip {
  return {
    ...ship,
    isThrusting: false,
    velocity: { x: 0, y: 0 },
    x: boardWidth * ratio.x,
    y: boardHeight * ratio.y,
  };
}

function isAsteroidsMultiplayerRespawnBlocked(
  game: AsteroidsMultiplayerGameState,
  seat: AsteroidsShipSeat,
  ship: AsteroidsShip,
) {
  const candidate = {
    ...ship,
    radius: ship.radius + ASTEROIDS_MULTIPLAYER_RESPAWN_CLEARANCE,
  };

  if (
    game.asteroids.some((asteroid) =>
      entitiesCollideWrapped(candidate, asteroid, game.boardWidth, game.boardHeight),
    )
  ) {
    return true;
  }

  if (game.saucer !== null && entitiesCollide(candidate, game.saucer)) {
    return true;
  }

  return ASTEROIDS_MULTIPLAYER_SHIP_SEATS.some((otherSeat) => {
    if (otherSeat === seat) {
      return false;
    }

    const otherShip = game.ships[otherSeat];

    return (
      isAsteroidsMultiplayerShipPlayable(otherShip) &&
      entitiesCollideWrapped(candidate, otherShip.ship, game.boardWidth, game.boardHeight)
    );
  });
}

function updateAsteroidsMultiplayerShip(
  game: AsteroidsMultiplayerGameState,
  seat: AsteroidsShipSeat,
  ship: AsteroidsMultiplayerShipState,
): AsteroidsMultiplayerGameState {
  return {
    ...game,
    ships: {
      ...game.ships,
      [seat]: ship,
    },
  };
}

function setAsteroidsMultiplayerActiveShipInvulnerability(
  game: AsteroidsMultiplayerGameState,
  ticks: number,
): AsteroidsMultiplayerGameState {
  return {
    ...game,
    ships: {
      "ship-a": setAsteroidsMultiplayerShipInvulnerability(
        game.ships["ship-a"],
        ticks,
      ),
      "ship-b": setAsteroidsMultiplayerShipInvulnerability(
        game.ships["ship-b"],
        ticks,
      ),
    },
  };
}

function setAsteroidsMultiplayerShipInvulnerability(
  ship: AsteroidsMultiplayerShipState,
  ticks: number,
): AsteroidsMultiplayerShipState {
  if (!ship.isActive) {
    return ship;
  }

  return {
    ...ship,
    respawnInvulnerabilityTicks: ticks,
  };
}

function getAsteroidsMultiplayerExplodingSeats(
  game: AsteroidsMultiplayerGameState,
) {
  return new Set(
    ASTEROIDS_MULTIPLAYER_SHIP_SEATS.filter(
      (seat) => game.ships[seat].shipExplosion !== null,
    ),
  );
}

function pickAsteroidsMultiplayerSharedState(
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

function createAsteroidsSoloProjection(
  game: AsteroidsMultiplayerGameState,
  seat: AsteroidsShipSeat,
): AsteroidsGameState {
  return {
    ...game,
    ...getAsteroidsShipOwnedState(game.ships[seat]),
  };
}

function pickAsteroidsMultiplayerShipBullets(
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

function getAsteroidsMultiplayerRandomIndex(
  candidateCount: number,
  random?: AsteroidsRandom,
) {
  if (candidateCount <= 1) {
    return 0;
  }

  const randomValue = getAsteroidsMultiplayerRandomValue(random);

  return Math.max(
    0,
    Math.min(candidateCount - 1, Math.floor(randomValue * candidateCount)),
  );
}

function getAsteroidsMultiplayerRandomValue(random?: AsteroidsRandom) {
  if (random === undefined) {
    return 0;
  }

  const randomValue = random();

  if (!Number.isFinite(randomValue)) {
    return 0;
  }

  return Math.max(0, Math.min(1, randomValue));
}
