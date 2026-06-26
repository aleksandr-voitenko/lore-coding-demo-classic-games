import { describe, expect, it } from "vitest";

import {
  advanceAsteroidsGame,
  ASTEROIDS_BONUS_LIFE_SCORE,
  ASTEROIDS_BONUS_SCORE_POWER_UP_POINTS,
  ASTEROIDS_BOARD_HEIGHT,
  ASTEROIDS_BOARD_WIDTH,
  ASTEROIDS_DEFAULT_DIFFICULTY,
  ASTEROIDS_POWER_UP_MAX_SPAWN_TICKS,
  ASTEROIDS_POWER_UP_MIN_SPAWN_TICKS,
  ASTEROIDS_POWER_UP_SHIELD_TICKS,
  ASTEROIDS_RESPAWN_INVULNERABILITY_TICKS,
  ASTEROIDS_SAUCER_INITIAL_SPAWN_TICKS,
  ASTEROIDS_SHIP_EXPLOSION_TICKS,
  ASTEROIDS_STARTING_ASTEROID_COUNT,
  ASTEROIDS_STARTING_LIVES,
  createInitialAsteroidsGame,
  fireAsteroidsBullet,
  getAsteroidsAsteroidScore,
  getAsteroidsDifficultySettings,
  getAsteroidsSaucerScore,
  getAsteroidsTickDelay,
  pauseAsteroidsGame,
  restartAsteroidsGame,
  startAsteroidsGame,
  type Asteroid,
  type AsteroidsBullet,
  type AsteroidsGameState,
  type AsteroidsPowerUp,
  type AsteroidsSaucer,
  type AsteroidsSaucerShot,
} from "./asteroids-game-engine";

function createRunningGame(
  overrides: Partial<AsteroidsGameState> = {},
): AsteroidsGameState {
  return {
    ...createInitialAsteroidsGame(),
    respawnInvulnerabilityTicks: 0,
    status: "running",
    ...overrides,
  };
}

function createAsteroid(overrides: Partial<Asteroid> = {}): Asteroid {
  return {
    id: "asteroid-test",
    radius: 42,
    shape: [1, 0.9, 1.08, 0.84, 1.03, 0.92, 1.04, 0.88, 1.06, 0.95],
    size: "large",
    velocity: { x: 0, y: 0 },
    x: 120,
    y: 120,
    ...overrides,
  };
}

function createBullet(overrides: Partial<AsteroidsBullet> = {}): AsteroidsBullet {
  return {
    id: "bullet-test",
    radius: 2.5,
    ttl: 10,
    velocity: { x: 0, y: 0 },
    x: 120,
    y: 120,
    ...overrides,
  };
}

function createSaucer(overrides: Partial<AsteroidsSaucer> = {}): AsteroidsSaucer {
  return {
    id: "saucer-test",
    kind: "large",
    radius: 18,
    shotCooldownTicks: 40,
    velocity: { x: 1.4, y: 0 },
    x: 180,
    y: 160,
    ...overrides,
  };
}

function createSaucerShot(
  overrides: Partial<AsteroidsSaucerShot> = {},
): AsteroidsSaucerShot {
  return {
    id: "saucer-shot-test",
    radius: 2.5,
    ttl: 40,
    velocity: { x: 0, y: 0 },
    x: 120,
    y: 120,
    ...overrides,
  };
}

function createPowerUp(overrides: Partial<AsteroidsPowerUp> = {}): AsteroidsPowerUp {
  return {
    id: "power-up-test",
    kind: "shield",
    radius: 12,
    x: ASTEROIDS_BOARD_WIDTH / 2,
    y: ASTEROIDS_BOARD_HEIGHT / 2,
    ...overrides,
  };
}

function createLoopingRandom(values: number[]) {
  let index = 0;

  return () => {
    const value = values[index % values.length]!;

    index += 1;
    return value;
  };
}

function advanceAsteroidsTicks(game: AsteroidsGameState, ticks: number): AsteroidsGameState {
  let advanced = game;

  for (let tick = 0; tick < ticks; tick += 1) {
    advanced = advanceAsteroidsGame(advanced);
  }

  return advanced;
}

describe("asteroids game engine", () => {
  it("creates a ready wave with a centered ship and large asteroids", () => {
    const game = createInitialAsteroidsGame();

    expect(game.status).toBe("ready");
    expect(game.boardWidth).toBe(ASTEROIDS_BOARD_WIDTH);
    expect(game.boardHeight).toBe(ASTEROIDS_BOARD_HEIGHT);
    expect(game.difficulty).toBe(ASTEROIDS_DEFAULT_DIFFICULTY);
    expect(game.score).toBe(0);
    expect(game.wave).toBe(1);
    expect(game.lives).toBe(ASTEROIDS_STARTING_LIVES);
    expect(game.startingAsteroidCount).toBe(ASTEROIDS_STARTING_ASTEROID_COUNT);
    expect(game.ship.x).toBe(ASTEROIDS_BOARD_WIDTH / 2);
    expect(game.ship.y).toBe(ASTEROIDS_BOARD_HEIGHT / 2);
    expect(game.ship.angle).toBe(-90);
    expect(game.asteroids).toHaveLength(ASTEROIDS_STARTING_ASTEROID_COUNT);
    expect(game.asteroids.every((asteroid) => asteroid.size === "large")).toBe(true);
    expect(game.asteroids[0]?.velocity.x).toBeCloseTo(0.872);
    expect(game.asteroids[0]?.velocity.y).toBeCloseTo(-0.12);
    expect(game.bulletSpeedMultiplier).toBe(1);
    expect(game.engineSpeedMultiplier).toBe(1);
    expect(game.shotIntervalMultiplier).toBe(1);
    expect(game.bullets).toEqual([]);
    expect(game.powerUp).toBeNull();
    expect(game.powerUpSpawnCooldownTicks).toBe(ASTEROIDS_POWER_UP_MIN_SPAWN_TICKS);
    expect(game.saucer).toBeNull();
    expect(game.saucerBullets).toEqual([]);
    expect(game.saucerSpawnCooldownTicks).toBe(ASTEROIDS_SAUCER_INITIAL_SPAWN_TICKS);
    expect(getAsteroidsTickDelay()).toBe(16);
  });

  it("uses difficulty presets for lives, starting asteroids, and saucer timing", () => {
    const easy = createInitialAsteroidsGame({ difficulty: "easy" });
    const hard = createInitialAsteroidsGame({ difficulty: "hard" });
    const fallback = createInitialAsteroidsGame({
      difficulty: "legendary",
    });
    const restarted = restartAsteroidsGame(hard);

    expect(easy).toMatchObject({
      boardHeight: ASTEROIDS_BOARD_HEIGHT,
      boardWidth: ASTEROIDS_BOARD_WIDTH,
      difficulty: "easy",
      lives: 4,
      saucerSpawnCooldownTicks:
        getAsteroidsDifficultySettings("easy").saucerInitialSpawnTicks,
      startingAsteroidCount: 3,
    });
    expect(easy.asteroids).toHaveLength(3);
    expect(hard).toMatchObject({
      boardHeight: ASTEROIDS_BOARD_HEIGHT,
      boardWidth: ASTEROIDS_BOARD_WIDTH,
      difficulty: "hard",
      lives: 2,
      saucerSpawnCooldownTicks:
        getAsteroidsDifficultySettings("hard").saucerInitialSpawnTicks,
      startingAsteroidCount: 5,
    });
    expect(hard.asteroids).toHaveLength(5);
    expect(fallback.boardWidth).toBe(ASTEROIDS_BOARD_WIDTH);
    expect(fallback.boardHeight).toBe(ASTEROIDS_BOARD_HEIGHT);
    expect(fallback.difficulty).toBe(ASTEROIDS_DEFAULT_DIFFICULTY);
    expect(fallback.startingAsteroidCount).toBe(ASTEROIDS_STARTING_ASTEROID_COUNT);
    expect(restarted.status).toBe("running");
    expect(restarted.difficulty).toBe("hard");
    expect(restarted.boardWidth).toBe(ASTEROIDS_BOARD_WIDTH);
    expect(restarted.boardHeight).toBe(ASTEROIDS_BOARD_HEIGHT);
    expect(restarted.startingAsteroidCount).toBe(5);
    expect(restarted.lives).toBe(2);
    expect(restarted.asteroids).toHaveLength(5);
  });

  it("uses optional injected randomness for deterministic recorded asteroid fields", () => {
    const values = [0.92, 0.18, 0.73, 0.41, 0.06, 0.57, 0.34, 0.81, 0.25, 0.68];
    const firstRecorded = createInitialAsteroidsGame({
      random: createLoopingRandom(values),
    });
    const secondRecorded = createInitialAsteroidsGame({
      random: createLoopingRandom(values),
    });
    const defaultGame = createInitialAsteroidsGame();

    expect(firstRecorded.asteroids).toEqual(secondRecorded.asteroids);
    expect(firstRecorded.asteroids[0]?.velocity).not.toEqual(
      defaultGame.asteroids[0]?.velocity,
    );
    expect(defaultGame.asteroids[0]?.velocity.x).toBeCloseTo(0.872);
    expect(defaultGame.asteroids[0]?.velocity.y).toBeCloseTo(-0.12);
  });

  it("starts, pauses, and resumes without replacing active asteroids", () => {
    const readyGame = createInitialAsteroidsGame();
    const runningGame = startAsteroidsGame(readyGame);
    const pausedGame = pauseAsteroidsGame(runningGame);
    const resumedGame = startAsteroidsGame(pausedGame);

    expect(runningGame.status).toBe("running");
    expect(runningGame.respawnInvulnerabilityTicks).toBeGreaterThan(0);
    expect(pausedGame.status).toBe("paused");
    expect(resumedGame.status).toBe("running");
    expect(resumedGame.asteroids).toBe(pausedGame.asteroids);
  });

  it("rotates, thrusts, applies friction, and caps ship speed", () => {
    let game = createRunningGame({
      asteroids: [],
      respawnInvulnerabilityTicks: 1_000,
    });

    game = advanceAsteroidsGame(game, { rotateRight: true, thrust: true });

    expect(game.ship.angle).toBe(277);
    expect(game.ship.isThrusting).toBe(true);
    expect(game.ship.velocity.x).toBeGreaterThan(0);
    expect(game.ship.velocity.y).toBeLessThan(0);

    for (let tick = 0; tick < 80; tick += 1) {
      game = advanceAsteroidsGame(game, { thrust: true });
    }

    expect(Math.hypot(game.ship.velocity.x, game.ship.velocity.y)).toBeCloseTo(2.48);
  });

  it("coasts with friction while opposing rotation inputs cancel out", () => {
    const ship = {
      ...createInitialAsteroidsGame().ship,
      angle: 33,
      velocity: { x: 2, y: -1 },
      x: 200,
      y: 150,
    };
    const advanced = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [],
        respawnInvulnerabilityTicks: 1_000,
        ship,
      }),
      { rotateLeft: true, rotateRight: true },
    );

    expect(advanced.ship).toMatchObject({
      angle: 33,
      isThrusting: false,
      velocity: {
        x: 1.984,
        y: -0.992,
      },
      x: 201.984,
      y: 149.008,
    });
  });

  it("wraps moving ships and bullets across board edges", () => {
    const runningGame = createRunningGame({
      asteroids: [],
      bullets: [
        createBullet({
          velocity: { x: 8, y: 0 },
          x: ASTEROIDS_BOARD_WIDTH - 2,
        }),
      ],
      respawnInvulnerabilityTicks: 1,
      ship: {
        ...createInitialAsteroidsGame().ship,
        velocity: { x: 5, y: 0 },
        x: ASTEROIDS_BOARD_WIDTH - 1,
      },
    });
    const advanced = advanceAsteroidsGame(runningGame);

    expect(advanced.ship.x).toBeLessThan(5);
    expect(advanced.bullets[0]?.x).toBeLessThan(10);
  });

  it("fires only while running and respects active-shot limits and cooldown", () => {
    const readyGame = createInitialAsteroidsGame();
    const runningGame = startAsteroidsGame(readyGame);
    const firstShot = fireAsteroidsBullet(runningGame);
    const blockedByCooldown = fireAsteroidsBullet(firstShot);
    let cooledDown = firstShot;

    for (let tick = 0; tick < 19; tick += 1) {
      cooledDown = advanceAsteroidsGame(cooledDown);
    }

    const secondShot = fireAsteroidsBullet(cooledDown);
    const saturated = fireAsteroidsBullet({
      ...cooledDown,
      bullets: [
        createBullet({ id: "b1" }),
        createBullet({ id: "b2" }),
        createBullet({ id: "b3" }),
        createBullet({ id: "b4" }),
      ],
      shotCooldownTicks: 0,
    });

    expect(fireAsteroidsBullet(readyGame).bullets).toHaveLength(0);
    expect(firstShot.bullets).toHaveLength(1);
    expect(firstShot.bullets[0]).toMatchObject({
      id: "bullet-0",
      ttl: expect.any(Number),
    });
    expect(Math.hypot(firstShot.bullets[0]!.velocity.x, firstShot.bullets[0]!.velocity.y)).toBeCloseTo(
      4.3,
    );
    expect(firstShot.shotCooldownTicks).toBe(19);
    expect(blockedByCooldown.bullets).toBe(firstShot.bullets);
    expect(secondShot.bullets).toHaveLength(2);
    expect(saturated.bullets).toHaveLength(4);
  });

  it("fires from the ship nose, adds ship velocity, and cools shots down on ticks", () => {
    const ship = {
      ...createInitialAsteroidsGame().ship,
      angle: 0,
      velocity: { x: 1.5, y: -0.5 },
      x: 120,
      y: 90,
    };
    const fired = fireAsteroidsBullet(
      createRunningGame({
        asteroids: [],
        ship,
      }),
    );
    const cooled = advanceAsteroidsGame(fired);

    expect(fired.bullets).toEqual([
      {
        id: "bullet-0",
        radius: 2.5,
        ttl: 58,
        velocity: { x: 5.8, y: -0.5 },
        x: 137.5,
        y: 90,
      },
    ]);
    expect(fired.nextBulletId).toBe(1);
    expect(fired.shotCooldownTicks).toBe(19);
    expect(cooled.shotCooldownTicks).toBe(18);
    expect(cooled.bullets).toEqual([
      {
        ...fired.bullets[0]!,
        ttl: 57,
        x: 143.3,
        y: 89.5,
      },
    ]);
  });

  it("spawns one persistent power-up after a fifteen-to-thirty second cooldown", () => {
    const waiting = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [],
        powerUpSpawnCooldownTicks: 1,
      }),
    );
    const spawned = advanceAsteroidsGame(waiting);
    const stillActive = advanceAsteroidsTicks(spawned, 40);

    expect(waiting.powerUp).toBeNull();
    expect(waiting.powerUpSpawnCooldownTicks).toBe(0);
    expect(spawned.powerUp).toMatchObject({
      id: "power-up-0",
      kind: "shield",
      radius: 12,
    });
    expect(spawned.nextPowerUpId).toBe(1);
    expect(spawned.powerUpSpawnCooldownTicks).toBe(0);
    expect(stillActive.powerUp).toEqual(spawned.powerUp);
    expect(stillActive.nextPowerUpId).toBe(1);
    expect(ASTEROIDS_POWER_UP_MIN_SPAWN_TICKS).toBe(
      Math.ceil(15_000 / getAsteroidsTickDelay()),
    );
    expect(ASTEROIDS_POWER_UP_MAX_SPAWN_TICKS).toBe(
      Math.ceil(30_000 / getAsteroidsTickDelay()),
    );
    expect(ASTEROIDS_POWER_UP_SHIELD_TICKS).toBe(
      Math.ceil(20_000 / getAsteroidsTickDelay()),
    );
  });

  it("uses injected randomness to spawn power-ups at the first unblocked sampled point", () => {
    const spawned = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [
          createAsteroid({
            radius: 42,
            x: ASTEROIDS_BOARD_WIDTH / 2,
            y: ASTEROIDS_BOARD_HEIGHT / 2,
          }),
        ],
        nextPowerUpId: 7,
        powerUpSpawnCooldownTicks: 0,
        saucerSpawnCooldownTicks: 1_000,
        ship: {
          ...createInitialAsteroidsGame().ship,
          x: 80,
          y: 80,
        },
      }),
      {},
      { random: createLoopingRandom([0.75, 0.5, 0.5, 0.9, 0.1]) },
    );

    expect(spawned.powerUp).toEqual({
      id: "power-up-7",
      kind: "bonus-score",
      radius: 12,
      x: 696,
      y: 84,
    });
    expect(spawned.nextPowerUpId).toBe(8);
    expect(spawned.powerUpSpawnCooldownTicks).toBe(0);
  });

  it("schedules the next power-up only after the active one is picked up", () => {
    const ship = createInitialAsteroidsGame().ship;
    const pickedUp = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [],
        powerUp: createPowerUp({
          kind: "bonus-score",
          x: ship.x,
          y: ship.y,
        }),
        ship,
      }),
      {},
      { random: () => 0.999 },
    );

    expect(pickedUp.powerUp).toBeNull();
    expect(pickedUp.powerUpSpawnCooldownTicks).toBe(ASTEROIDS_POWER_UP_MAX_SPAWN_TICKS);
    expect(pickedUp.nextPowerUpId).toBe(0);
  });

  it("picks up a power-up when the visible ship nose touches the visible bonus ring", () => {
    const ship = {
      ...createInitialAsteroidsGame().ship,
      angle: 0,
      x: 100,
      y: 100,
    };
    const powerUp = createPowerUp({
      kind: "bonus-score",
      x: ship.x + ship.radius * 1.42 + 12 * 1.28 - 0.1,
      y: ship.y,
    });
    const pickedUp = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [],
        powerUp,
        ship,
      }),
    );

    expect(pickedUp.powerUp).toBeNull();
    expect(pickedUp.score).toBe(ASTEROIDS_BONUS_SCORE_POWER_UP_POINTS);
  });

  it("applies shield power-ups before resolving same-tick hazards", () => {
    const ship = createInitialAsteroidsGame().ship;
    const overlappingAsteroid = createAsteroid({
      x: ship.x,
      y: ship.y,
    });
    const shielded = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [overlappingAsteroid],
        powerUp: createPowerUp({
          kind: "shield",
          x: ship.x,
          y: ship.y,
        }),
        ship,
      }),
    );

    expect(shielded.powerUp).toBeNull();
    expect(shielded.respawnInvulnerabilityTicks).toBe(
      ASTEROIDS_POWER_UP_SHIELD_TICKS,
    );
    expect(shielded.lives).toBe(ASTEROIDS_STARTING_LIVES);
    expect(shielded.shipExplosion).toBeNull();
  });

  it("applies stacked shot and engine upgrade power-ups", () => {
    const ship = createInitialAsteroidsGame().ship;
    const bulletUpgrade = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [],
        powerUp: createPowerUp({
          kind: "bullet-speed",
          x: ship.x,
          y: ship.y,
        }),
        ship,
      }),
    );
    const fasterBullet = fireAsteroidsBullet(bulletUpgrade);
    const shotIntervalUpgrade = advanceAsteroidsGame({
      ...createRunningGame({
        asteroids: [],
        powerUp: createPowerUp({
          kind: "shot-interval",
          x: ship.x,
          y: ship.y,
        }),
        ship,
      }),
      shotIntervalMultiplier: bulletUpgrade.shotIntervalMultiplier,
    });
    const shorterIntervalShot = fireAsteroidsBullet(shotIntervalUpgrade);
    const engineUpgrade = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [],
        powerUp: createPowerUp({
          kind: "engine-speed",
          x: ship.x,
          y: ship.y,
        }),
        ship,
      }),
    );
    const accelerated = advanceAsteroidsGame(engineUpgrade, { thrust: true });
    const baseline = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [],
        ship,
      }),
      { thrust: true },
    );

    expect(bulletUpgrade.bulletSpeedMultiplier).toBeCloseTo(1.2);
    expect(Math.hypot(
      fasterBullet.bullets[0]!.velocity.x,
      fasterBullet.bullets[0]!.velocity.y,
    )).toBeCloseTo(5.16);
    expect(shotIntervalUpgrade.shotIntervalMultiplier).toBeCloseTo(0.8);
    expect(shorterIntervalShot.shotCooldownTicks).toBe(15);
    expect(engineUpgrade.engineSpeedMultiplier).toBeCloseTo(1.2);
    expect(Math.hypot(accelerated.ship.velocity.x, accelerated.ship.velocity.y)).toBeGreaterThan(
      Math.hypot(baseline.ship.velocity.x, baseline.ship.velocity.y),
    );
  });

  it("awards bonus-score power-ups through the shared bonus-life score path", () => {
    const ship = createInitialAsteroidsGame().ship;
    const scored = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [],
        lives: 1,
        powerUp: createPowerUp({
          kind: "bonus-score",
          x: ship.x,
          y: ship.y,
        }),
        score: ASTEROIDS_BONUS_LIFE_SCORE - ASTEROIDS_BONUS_SCORE_POWER_UP_POINTS,
        ship,
      }),
    );

    expect(scored.score).toBe(ASTEROIDS_BONUS_LIFE_SCORE);
    expect(scored.lives).toBe(2);
    expect(scored.powerUp).toBeNull();
  });

  it("expires bullets after their time to live reaches zero", () => {
    const advanced = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [],
        bullets: [createBullet({ ttl: 1 })],
      }),
    );

    expect(advanced.bullets).toEqual([]);
  });

  it("splits a hit large asteroid and awards size-based score", () => {
    const targetAsteroid = createAsteroid();
    const advanced = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [targetAsteroid],
        bullets: [createBullet()],
        nextAsteroidId: 10,
      }),
    );

    expect(advanced.score).toBe(getAsteroidsAsteroidScore("large"));
    expect(advanced.bullets).toEqual([]);
    expect(advanced.asteroids).toHaveLength(2);
    expect(advanced.asteroids.every((asteroid) => asteroid.size === "medium")).toBe(true);
    expect(
      Math.hypot(advanced.asteroids[0]!.velocity.x, advanced.asteroids[0]!.velocity.y),
    ).toBeCloseTo(1.24);
    expect(advanced.asteroids[0]!.velocity.x).toBeCloseTo(Math.cos(1.1) * 1.24);
    expect(advanced.asteroids[0]!.velocity.y).toBeCloseTo(Math.sin(-1.1) * 1.24);
    expect(advanced.asteroids[1]!.velocity.x).toBeCloseTo(Math.cos(1.1) * 1.24);
    expect(advanced.asteroids[1]!.velocity.y).toBeCloseTo(Math.sin(1.1) * 1.24);
    expect(advanced.nextAsteroidId).toBe(12);
  });

  it("removes small asteroids without creating children", () => {
    const targetAsteroid = createAsteroid({ radius: 14, size: "small" });
    const advanced = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [targetAsteroid],
        bullets: [createBullet()],
      }),
    );

    expect(advanced.score).toBe(getAsteroidsAsteroidScore("small"));
    expect(advanced.wave).toBe(2);
    expect(advanced.asteroids).toHaveLength(ASTEROIDS_STARTING_ASTEROID_COUNT + 1);
  });

  it("awards bonus lives when asteroid scoring crosses bonus thresholds", () => {
    const targetAsteroid = createAsteroid({ radius: 14, size: "small" });
    const bonusAwarded = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [targetAsteroid],
        bullets: [createBullet()],
        lives: 1,
        score: ASTEROIDS_BONUS_LIFE_SCORE - getAsteroidsAsteroidScore("small"),
      }),
    );
    const noDuplicateBonus = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [targetAsteroid],
        bullets: [createBullet()],
        lives: bonusAwarded.lives,
        score: ASTEROIDS_BONUS_LIFE_SCORE,
      }),
    );
    const secondThresholdBonus = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [targetAsteroid],
        bullets: [createBullet()],
        lives: 1,
        score: ASTEROIDS_BONUS_LIFE_SCORE * 2 - getAsteroidsAsteroidScore("small"),
      }),
    );

    expect(bonusAwarded.score).toBe(ASTEROIDS_BONUS_LIFE_SCORE);
    expect(bonusAwarded.lives).toBe(2);
    expect(noDuplicateBonus.score).toBe(
      ASTEROIDS_BONUS_LIFE_SCORE + getAsteroidsAsteroidScore("small"),
    );
    expect(noDuplicateBonus.lives).toBe(2);
    expect(secondThresholdBonus.score).toBe(ASTEROIDS_BONUS_LIFE_SCORE * 2);
    expect(secondThresholdBonus.lives).toBe(2);
  });

  it("adds one big rock for each cleared wave", () => {
    const cleared = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [],
        difficulty: "hard",
        startingAsteroidCount: 5,
        wave: 12,
      }),
    );

    expect(cleared.wave).toBe(13);
    expect(cleared.asteroids).toHaveLength(17);
    expect(cleared.asteroids.every((asteroid) => asteroid.size === "large")).toBe(true);
  });

  it("uses injected randomness when creating the next wave asteroid field", () => {
    const randomValues = [
      0.3, 0.65, 0.2, 0.7, 0.11, 0.42, 0.83, 0.24, 0.55, 0.96, 0.37, 0.68,
      0.09, 0.5,
    ];
    const firstWave = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [],
        nextAsteroidId: 20,
        powerUpSpawnCooldownTicks: 1_000,
        saucerSpawnCooldownTicks: 1_000,
        wave: 3,
      }),
      {},
      { random: createLoopingRandom(randomValues) },
    );
    const secondWave = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [],
        nextAsteroidId: 20,
        powerUpSpawnCooldownTicks: 1_000,
        saucerSpawnCooldownTicks: 1_000,
        wave: 3,
      }),
      {},
      { random: createLoopingRandom(randomValues) },
    );
    const defaultWave = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [],
        nextAsteroidId: 20,
        powerUpSpawnCooldownTicks: 1_000,
        saucerSpawnCooldownTicks: 1_000,
        wave: 3,
      }),
    );

    expect(firstWave.wave).toBe(4);
    expect(firstWave.asteroids).toHaveLength(ASTEROIDS_STARTING_ASTEROID_COUNT + 3);
    expect(firstWave.nextAsteroidId).toBe(27);
    expect(firstWave.asteroids).toEqual(secondWave.asteroids);
    expect(firstWave.asteroids[0]).toMatchObject({
      id: "asteroid-20",
      size: "large",
      x: 752,
    });
    expect(firstWave.asteroids[0]?.y).toBeCloseTo(368.4);
    expect(firstWave.asteroids[0]?.velocity.x).toBeCloseTo(-1.2368);
    expect(firstWave.asteroids[0]?.velocity.y).toBeCloseTo(-0.48);
    expect(firstWave.asteroids[0]?.shape).not.toEqual(defaultWave.asteroids[0]?.shape);
  });

  it("spawns, moves, and retires UFO saucers from alternating edges", () => {
    const safeAsteroid = createAsteroid({ radius: 14, size: "small", x: 48, y: 48 });
    const spawned = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [safeAsteroid],
        saucerSpawnCooldownTicks: 0,
        wave: 2,
      }),
    );
    const spawnedSaucer = spawned.saucer;

    if (spawnedSaucer === null) {
      throw new Error("Expected saucer to spawn.");
    }

    const moved = advanceAsteroidsGame({
      ...spawned,
      asteroids: [safeAsteroid],
      respawnInvulnerabilityTicks: 10,
    });
    const exited = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [safeAsteroid],
        nextSaucerId: 1,
        saucer: createSaucer({
          x: ASTEROIDS_BOARD_WIDTH + 20,
        }),
        saucerSpawnCooldownTicks: 0,
      }),
    );
    const hardExited = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [safeAsteroid],
        difficulty: "hard",
        nextSaucerId: 1,
        saucer: createSaucer({
          x: ASTEROIDS_BOARD_WIDTH + 20,
        }),
        saucerSpawnCooldownTicks: 0,
      }),
    );
    const respawnedFromRight = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [safeAsteroid],
        nextSaucerId: exited.nextSaucerId,
        saucerSpawnCooldownTicks: 0,
      }),
    );

    expect(spawnedSaucer).toMatchObject({
      id: "saucer-0",
      kind: "large",
      velocity: { x: expect.any(Number), y: 0 },
      x: -spawnedSaucer.radius,
    });
    expect(spawned.nextSaucerId).toBe(1);
    expect(spawnedSaucer.velocity.x).toBeGreaterThan(0);
    expect(moved.saucer?.x).toBeCloseTo(spawnedSaucer.x + spawnedSaucer.velocity.x);
    expect(exited.saucer).toBeNull();
    expect(exited.saucerSpawnCooldownTicks).toBe(
      getAsteroidsDifficultySettings("medium").saucerRespawnCooldownTicks,
    );
    expect(hardExited.saucerSpawnCooldownTicks).toBe(
      getAsteroidsDifficultySettings("hard").saucerRespawnCooldownTicks,
    );
    expect(respawnedFromRight.saucer).toMatchObject({
      id: "saucer-1",
      x: ASTEROIDS_BOARD_WIDTH + spawnedSaucer.radius,
    });
    expect(respawnedFromRight.saucer?.velocity.x).toBeLessThan(0);
  });

  it("lets player bullets destroy saucers for size-based points", () => {
    const safeAsteroid = createAsteroid({ radius: 14, size: "small", x: 48, y: 48 });
    const targetSaucer = createSaucer({
      kind: "small",
      radius: 12,
      x: 220,
      y: 180,
    });
    const advanced = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [safeAsteroid],
        bullets: [createBullet({ x: targetSaucer.x, y: targetSaucer.y })],
        saucer: targetSaucer,
      }),
    );

    expect(advanced.score).toBe(getAsteroidsSaucerScore("small"));
    expect(advanced.bullets).toEqual([]);
    expect(advanced.saucer).toBeNull();
    expect(advanced.saucerSpawnCooldownTicks).toBeGreaterThan(0);
    expect(advanced.asteroids).toEqual([safeAsteroid]);
  });

  it("fires saucer shots toward the ship and damages unshielded ships", () => {
    const safeAsteroid = createAsteroid({ radius: 14, size: "small", x: 48, y: 48 });
    const ship = {
      ...createInitialAsteroidsGame().ship,
      x: 240,
      y: 160,
    };
    const firingSaucer = createSaucer({
      shotCooldownTicks: 0,
      x: 160,
      y: 160,
    });
    const fired = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [safeAsteroid],
        saucer: firingSaucer,
        ship,
      }),
    );
    const saucerShot = fired.saucerBullets[0];

    if (saucerShot === undefined) {
      throw new Error("Expected saucer shot to fire.");
    }

    const damaged = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [safeAsteroid],
        lives: 2,
        saucerBullets: [createSaucerShot({ x: ship.x, y: ship.y })],
        ship,
      }),
    );

    expect(saucerShot.id).toBe("saucer-shot-0");
    expect(saucerShot.velocity.x).toBeGreaterThan(0);
    expect(Math.abs(saucerShot.velocity.y)).toBeLessThan(0.001);
    expect(fired.nextSaucerBulletId).toBe(1);
    expect(fired.saucer?.shotCooldownTicks).toBeGreaterThan(0);
    expect(damaged.lives).toBe(1);
    expect(damaged.saucerBullets).toEqual([]);
    expect(damaged.shipExplosion).toMatchObject({
      x: ship.x,
      y: ship.y,
    });
  });

  it("spends one life for simultaneous saucer, asteroid, and saucer-shot hazards", () => {
    const ship = {
      ...createInitialAsteroidsGame().ship,
      x: 240,
      y: 160,
    };
    const damaged = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [
          createAsteroid({
            x: ship.x,
            y: ship.y,
          }),
        ],
        bullets: [createBullet({ id: "active-player-shot" })],
        lives: 3,
        saucer: createSaucer({
          shotCooldownTicks: 12,
          velocity: { x: 0, y: 0 },
          x: ship.x,
          y: ship.y,
        }),
        saucerBullets: [
          createSaucerShot({ id: "hitting-shot", x: ship.x, y: ship.y }),
          createSaucerShot({ id: "nearby-shot", x: ship.x + 4, y: ship.y }),
        ],
        ship,
      }),
    );

    expect(damaged).toMatchObject({
      lives: 2,
      respawnInvulnerabilityTicks: 0,
      status: "running",
    });
    expect(damaged.bullets).toEqual([]);
    expect(damaged.saucerBullets).toEqual([]);
    expect(damaged.saucer).not.toBeNull();
    expect(damaged.shipExplosion).toMatchObject({
      x: ship.x,
      y: ship.y,
    });
  });

  it("lets respawn shields absorb saucer shots without losing a life", () => {
    const ship = createInitialAsteroidsGame().ship;
    const shielded = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [createAsteroid({ radius: 14, size: "small", x: 48, y: 48 })],
        respawnInvulnerabilityTicks: 2,
        saucerBullets: [createSaucerShot({ x: ship.x, y: ship.y })],
        ship,
      }),
    );

    expect(shielded.lives).toBe(ASTEROIDS_STARTING_LIVES);
    expect(shielded.shipExplosion).toBeNull();
    expect(shielded.saucerBullets).toEqual([]);
  });

  it("clears active saucers and saucer shots when the final ship explosion ends", () => {
    const explodingGame = createRunningGame({
      asteroids: [],
      lives: 0,
      saucer: createSaucer(),
      saucerBullets: [createSaucerShot()],
      shipExplosion: {
        durationTicks: ASTEROIDS_SHIP_EXPLOSION_TICKS,
        radius: 10,
        ticksRemaining: 1,
        x: 320,
        y: 240,
      },
    });

    const lostGame = advanceAsteroidsGame(explodingGame);

    expect(lostGame.status).toBe("lost");
    expect(lostGame.saucer).toBeNull();
    expect(lostGame.saucerBullets).toEqual([]);
  });

  it("continues scoring and wave advancement while the ship explosion countdown runs", () => {
    const ship = createInitialAsteroidsGame().ship;
    const exploding = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [createAsteroid({ radius: 14, size: "small" })],
        bullets: [createBullet()],
        lives: 1,
        powerUpSpawnCooldownTicks: 1_000,
        saucerSpawnCooldownTicks: 1_000,
        ship,
        shipExplosion: {
          durationTicks: ASTEROIDS_SHIP_EXPLOSION_TICKS,
          radius: ship.radius,
          ticksRemaining: 2,
          x: ship.x,
          y: ship.y,
        },
      }),
    );

    expect(exploding).toMatchObject({
      lives: 1,
      score: getAsteroidsAsteroidScore("small"),
      status: "running",
      wave: 2,
    });
    expect(exploding.asteroids).toHaveLength(ASTEROIDS_STARTING_ASTEROID_COUNT + 1);
    expect(exploding.shipExplosion).toMatchObject({
      ticksRemaining: 1,
      x: ship.x,
      y: ship.y,
    });
  });

  it("animates ship collisions before respawning a shielded ship or ending the run", () => {
    const ship = {
      ...createInitialAsteroidsGame().ship,
      x: 180,
      y: 160,
    };
    const overlappingAsteroid = createAsteroid({
      radius: 42,
      x: ship.x,
      y: ship.y,
    });
    const protectedGame = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [overlappingAsteroid],
        respawnInvulnerabilityTicks: 2,
        ship,
      }),
    );
    const damagedGame = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [overlappingAsteroid],
        bullets: [createBullet()],
        lives: 2,
        ship,
      }),
    );
    const lostGame = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [overlappingAsteroid],
        lives: 1,
        ship,
      }),
    );

    expect(protectedGame.lives).toBe(ASTEROIDS_STARTING_LIVES);
    expect(protectedGame.status).toBe("running");
    expect(protectedGame.shipExplosion).toBeNull();

    expect(damagedGame.lives).toBe(1);
    expect(damagedGame.bullets).toEqual([]);
    expect(damagedGame.respawnInvulnerabilityTicks).toBe(0);
    expect(damagedGame.ship.x).toBe(ship.x);
    expect(damagedGame.ship.y).toBe(ship.y);
    expect(damagedGame.shipExplosion).toMatchObject({
      durationTicks: ASTEROIDS_SHIP_EXPLOSION_TICKS,
      radius: ship.radius,
      ticksRemaining: ASTEROIDS_SHIP_EXPLOSION_TICKS,
      x: ship.x,
      y: ship.y,
    });
    expect(fireAsteroidsBullet(damagedGame).bullets).toHaveLength(0);

    const almostRespawned = advanceAsteroidsTicks(
      damagedGame,
      ASTEROIDS_SHIP_EXPLOSION_TICKS - 1,
    );
    const respawned = advanceAsteroidsGame(almostRespawned);

    expect(almostRespawned.shipExplosion?.ticksRemaining).toBe(1);
    expect(almostRespawned.ship.x).toBe(ship.x);
    expect(respawned.shipExplosion).toBeNull();
    expect(respawned.ship.x).toBe(ASTEROIDS_BOARD_WIDTH / 2);
    expect(respawned.ship.y).toBe(ASTEROIDS_BOARD_HEIGHT / 2);
    expect(respawned.respawnInvulnerabilityTicks).toBe(
      ASTEROIDS_RESPAWN_INVULNERABILITY_TICKS,
    );

    expect(lostGame.lives).toBe(0);
    expect(lostGame.status).toBe("running");
    expect(lostGame.bullets).toEqual([]);
    expect(lostGame.shipExplosion).not.toBeNull();
    expect(advanceAsteroidsTicks(lostGame, ASTEROIDS_SHIP_EXPLOSION_TICKS)).toMatchObject({
      lives: 0,
      shipExplosion: null,
      status: "lost",
    });
  });

  it("repeats the explosion cycle when a shield expires inside an asteroid", () => {
    const ship = createInitialAsteroidsGame().ship;
    const overlappingAsteroid = createAsteroid({
      radius: 42,
      x: ship.x,
      y: ship.y,
    });
    const respawnedInsideAsteroid = createRunningGame({
      asteroids: [overlappingAsteroid],
      lives: 2,
      respawnInvulnerabilityTicks: 1,
      ship,
    });
    const nextExplosion = advanceAsteroidsGame(respawnedInsideAsteroid);

    expect(nextExplosion.lives).toBe(1);
    expect(nextExplosion.respawnInvulnerabilityTicks).toBe(0);
    expect(nextExplosion.shipExplosion).toMatchObject({
      x: ship.x,
      y: ship.y,
    });
  });

  it("awards explosion-time bonus lives before resolving a final respawn", () => {
    const ship = createInitialAsteroidsGame().ship;
    const targetAsteroid = createAsteroid({
      radius: 14,
      size: "small",
    });
    const explodingGame = createRunningGame({
      asteroids: [targetAsteroid],
      bullets: [createBullet()],
      lives: 0,
      score: ASTEROIDS_BONUS_LIFE_SCORE - getAsteroidsAsteroidScore("small"),
      ship,
      shipExplosion: {
        durationTicks: ASTEROIDS_SHIP_EXPLOSION_TICKS,
        radius: ship.radius,
        ticksRemaining: ASTEROIDS_SHIP_EXPLOSION_TICKS,
        x: ship.x,
        y: ship.y,
      },
    });
    const bonusAwarded = advanceAsteroidsGame(explodingGame);
    const respawned = advanceAsteroidsTicks(
      bonusAwarded,
      ASTEROIDS_SHIP_EXPLOSION_TICKS - 1,
    );

    expect(bonusAwarded.score).toBe(ASTEROIDS_BONUS_LIFE_SCORE);
    expect(bonusAwarded.lives).toBe(1);
    expect(respawned.status).toBe("running");
    expect(respawned.shipExplosion).toBeNull();
    expect(respawned.respawnInvulnerabilityTicks).toBe(
      ASTEROIDS_RESPAWN_INVULNERABILITY_TICKS,
    );
  });

  it("keeps lost games inert until starting a difficulty-preserving restart", () => {
    const lostGame = createRunningGame({
      asteroids: [createAsteroid()],
      bullets: [createBullet()],
      difficulty: "hard",
      lives: 0,
      powerUp: createPowerUp({ kind: "engine-speed" }),
      saucer: createSaucer(),
      saucerBullets: [createSaucerShot()],
      score: 12_340,
      status: "lost",
      wave: 7,
    });
    const advanced = advanceAsteroidsGame(lostGame, { rotateRight: true, thrust: true });
    const restarted = startAsteroidsGame(lostGame);

    expect(advanced).toBe(lostGame);
    expect(fireAsteroidsBullet(lostGame)).toBe(lostGame);
    expect(restarted).toMatchObject({
      difficulty: "hard",
      lives: 2,
      powerUp: null,
      saucer: null,
      saucerBullets: [],
      score: 0,
      status: "running",
      wave: 1,
    });
    expect(restarted.asteroids).toHaveLength(5);
    expect(restarted.ship).toMatchObject({
      angle: -90,
      velocity: { x: 0, y: 0 },
      x: ASTEROIDS_BOARD_WIDTH / 2,
      y: ASTEROIDS_BOARD_HEIGHT / 2,
    });
    expect(restarted.respawnInvulnerabilityTicks).toBe(
      ASTEROIDS_RESPAWN_INVULNERABILITY_TICKS,
    );
  });
});
