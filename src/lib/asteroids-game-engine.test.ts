import { describe, expect, it } from "vitest";

import {
  advanceAsteroidsGame,
  ASTEROIDS_ASTEROID_COUNT_OPTIONS,
  ASTEROIDS_BONUS_LIFE_SCORE,
  ASTEROIDS_BOARD_HEIGHT,
  ASTEROIDS_BOARD_WIDTH,
  ASTEROIDS_RESPAWN_INVULNERABILITY_TICKS,
  ASTEROIDS_SHIP_EXPLOSION_TICKS,
  ASTEROIDS_STARTING_ASTEROID_COUNT,
  ASTEROIDS_STARTING_LIVES,
  createInitialAsteroidsGame,
  fireAsteroidsBullet,
  getAsteroidsAsteroidScore,
  getAsteroidsTickDelay,
  pauseAsteroidsGame,
  restartAsteroidsGame,
  startAsteroidsGame,
  type Asteroid,
  type AsteroidsBullet,
  type AsteroidsGameState,
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
    expect(game.bullets).toEqual([]);
    expect(getAsteroidsTickDelay()).toBe(16);
  });

  it("normalizes configurable board sizes and starting asteroid counts", () => {
    const configured = createInitialAsteroidsGame({
      asteroidCount: ASTEROIDS_ASTEROID_COUNT_OPTIONS[2],
      boardHeight: 600,
      boardWidth: 800,
    });
    const fallback = createInitialAsteroidsGame({
      asteroidCount: 99,
      boardHeight: Number.NaN,
      boardWidth: Number.NaN,
    });
    const restarted = restartAsteroidsGame(configured);

    expect(configured.boardWidth).toBe(800);
    expect(configured.boardHeight).toBe(600);
    expect(configured.startingAsteroidCount).toBe(8);
    expect(configured.asteroids).toHaveLength(8);
    expect(fallback.boardWidth).toBe(ASTEROIDS_BOARD_WIDTH);
    expect(fallback.boardHeight).toBe(ASTEROIDS_BOARD_HEIGHT);
    expect(fallback.startingAsteroidCount).toBe(ASTEROIDS_STARTING_ASTEROID_COUNT);
    expect(restarted.status).toBe("running");
    expect(restarted.boardWidth).toBe(800);
    expect(restarted.boardHeight).toBe(600);
    expect(restarted.startingAsteroidCount).toBe(8);
    expect(restarted.asteroids).toHaveLength(8);
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

    expect(Math.hypot(game.ship.velocity.x, game.ship.velocity.y)).toBeCloseTo(4.96);
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

    for (let tick = 0; tick < 10; tick += 1) {
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
    expect(blockedByCooldown.bullets).toBe(firstShot.bullets);
    expect(secondShot.bullets).toHaveLength(2);
    expect(saturated.bullets).toHaveLength(4);
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

  it("spawns the next capped wave when the field is cleared", () => {
    const cleared = advanceAsteroidsGame(
      createRunningGame({
        asteroids: [],
        startingAsteroidCount: 8,
        wave: 7,
      }),
    );

    expect(cleared.wave).toBe(8);
    expect(cleared.asteroids).toHaveLength(12);
    expect(cleared.asteroids.every((asteroid) => asteroid.size === "large")).toBe(true);
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
});
