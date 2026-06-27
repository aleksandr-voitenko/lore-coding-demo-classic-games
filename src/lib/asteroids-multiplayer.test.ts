import { describe, expect, it } from "vitest";

import {
  ASTEROIDS_BOARD_HEIGHT,
  ASTEROIDS_BOARD_WIDTH,
  ASTEROIDS_BONUS_SCORE_POWER_UP_POINTS,
  ASTEROIDS_POWER_UP_SHIELD_TICKS,
  ASTEROIDS_RESPAWN_INVULNERABILITY_TICKS,
  ASTEROIDS_SHIP_EXPLOSION_TICKS,
  ASTEROIDS_STARTING_ASTEROID_COUNT,
  ASTEROIDS_STARTING_LIVES,
  createInitialAsteroidsGame,
  getAsteroidsTickDelay,
  type Asteroid,
  type AsteroidsBullet,
  type AsteroidsPowerUp,
  type AsteroidsSaucer,
  type AsteroidsSaucerShot,
} from "./asteroids-game-engine";
import {
  advanceAsteroidsMultiplayerGameTick,
  ASTEROIDS_MULTIPLAYER_PROJECTION_MAX_MS,
  ASTEROIDS_MULTIPLAYER_ROOM_SEATS,
  ASTEROIDS_MULTIPLAYER_SHIP_SEATS,
  cloneAsteroidsMultiplayerGame,
  createInitialAsteroidsMultiplayerGame,
  fireAsteroidsMultiplayerShipBullet,
  getAsteroidsMultiplayerProjectionTicks,
  isAsteroidsShipSeat,
  pauseAsteroidsMultiplayerGame,
  projectAsteroidsMultiplayerGame,
  restartAsteroidsMultiplayerGame,
  startAsteroidsMultiplayerGame,
  type AsteroidsMultiplayerClientInput,
  type AsteroidsMultiplayerGameState,
  type AsteroidsMultiplayerShipState,
  type AsteroidsShipSeat,
} from "./asteroids-multiplayer";

function createRunningMultiplayerGame(
  overrides: Partial<AsteroidsMultiplayerGameState> = {},
): AsteroidsMultiplayerGameState {
  const initialGame = createInitialAsteroidsMultiplayerGame();

  return {
    ...initialGame,
    powerUpSpawnCooldownTicks: 1_000,
    saucerSpawnCooldownTicks: 1_000,
    ships: {
      "ship-a": {
        ...initialGame.ships["ship-a"],
        respawnInvulnerabilityTicks: 0,
      },
      "ship-b": {
        ...initialGame.ships["ship-b"],
        respawnInvulnerabilityTicks: 0,
      },
    },
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

function createSafeAsteroid(overrides: Partial<Asteroid> = {}) {
  return createAsteroid({
    id: "safe-asteroid",
    radius: 14,
    size: "small",
    x: 48,
    y: 48,
    ...overrides,
  });
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
    velocity: { x: 0, y: 0 },
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

function createRandomSequence(values: number[]) {
  let index = 0;

  return () => {
    const value = values[index] ?? values.at(-1) ?? 0;

    index += 1;
    return value;
  };
}

function withShip(
  game: AsteroidsMultiplayerGameState,
  seat: AsteroidsShipSeat,
  overrides: Partial<AsteroidsMultiplayerShipState>,
): AsteroidsMultiplayerGameState {
  return {
    ...game,
    ships: {
      ...game.ships,
      [seat]: {
        ...game.ships[seat],
        ...overrides,
      },
    },
  };
}

function withShipBody(
  game: AsteroidsMultiplayerGameState,
  seat: AsteroidsShipSeat,
  shipOverrides: Partial<AsteroidsMultiplayerShipState["ship"]>,
): AsteroidsMultiplayerGameState {
  return withShip(game, seat, {
    ship: {
      ...game.ships[seat].ship,
      ...shipOverrides,
    },
  });
}

function withBothShipsAt(
  game: AsteroidsMultiplayerGameState,
  x: number,
  y: number,
): AsteroidsMultiplayerGameState {
  return withShipBody(withShipBody(game, "ship-a", { x, y }), "ship-b", { x, y });
}

function advanceMultiplayerTicks(
  game: AsteroidsMultiplayerGameState,
  ticks: number,
): AsteroidsMultiplayerGameState {
  let advanced = game;

  for (let tick = 0; tick < ticks; tick += 1) {
    advanced = advanceAsteroidsMultiplayerGameTick(advanced);
  }

  return advanced;
}

describe("asteroids multiplayer state model", () => {
  it("creates a two-ship shared-world state from solo Asteroids defaults", () => {
    const soloGame = createInitialAsteroidsGame({ random: () => 0 });
    const game = createInitialAsteroidsMultiplayerGame({ random: () => 0 });
    const cloned = cloneAsteroidsMultiplayerGame(game);
    const shipA = game.ships["ship-a"].ship;
    const shipB = game.ships["ship-b"].ship;
    const clientInputs = [
      {
        controls: { rotateRight: true, thrust: true },
        type: "asteroids.setShipControls",
      },
      {
        type: "asteroids.fire",
      },
    ] satisfies AsteroidsMultiplayerClientInput[];

    expect("ship" in game).toBe(false);
    expect("bullets" in game).toBe(false);
    expect(ASTEROIDS_MULTIPLAYER_SHIP_SEATS).toEqual(["ship-a", "ship-b"]);
    expect(ASTEROIDS_MULTIPLAYER_ROOM_SEATS).toEqual([
      { id: "ship-a", label: "Ship A", required: true },
      { id: "ship-b", label: "Ship B", required: true },
    ]);
    expect(clientInputs.map((input) => input.type)).toEqual([
      "asteroids.setShipControls",
      "asteroids.fire",
    ]);
    expect(isAsteroidsShipSeat("ship-a")).toBe(true);
    expect(isAsteroidsShipSeat("left")).toBe(false);
    expect(game).toMatchObject({
      boardHeight: ASTEROIDS_BOARD_HEIGHT,
      boardWidth: ASTEROIDS_BOARD_WIDTH,
      lives: ASTEROIDS_STARTING_LIVES,
      score: 0,
      status: "ready",
      wave: 1,
    });
    expect(game.asteroids).toEqual(soloGame.asteroids);
    expect(game.asteroids).toHaveLength(ASTEROIDS_STARTING_ASTEROID_COUNT);
    expect(shipA.x).toBeCloseTo(ASTEROIDS_BOARD_WIDTH * 0.42);
    expect(shipB.x).toBeCloseTo(ASTEROIDS_BOARD_WIDTH * 0.58);
    expect(shipA.y).toBe(shipB.y);
    expect(shipA.x + shipA.radius).toBeLessThan(shipB.x - shipB.radius);
    expect(game.ships["ship-a"]).toMatchObject({
      bulletSpeedMultiplier: 1,
      engineSpeedMultiplier: 1,
      isActive: true,
      respawnOnExplosionEnd: false,
      seat: "ship-a",
      shotIntervalMultiplier: 1,
    });
    expect(game.ships["ship-b"].bullets).toEqual([]);
    expect(cloned).toEqual(game);
    expect(cloned.asteroids).not.toBe(game.asteroids);
    expect(cloned.asteroids[0]?.shape).not.toBe(game.asteroids[0]?.shape);
    expect(cloned.ships["ship-a"].ship).not.toBe(game.ships["ship-a"].ship);
  });

  it("starts, pauses, and restarts without changing the solo public game", () => {
    const soloGame = createInitialAsteroidsGame();
    const readyGame = createInitialAsteroidsMultiplayerGame();
    const started = startAsteroidsMultiplayerGame(readyGame);
    const alreadyStarted = startAsteroidsMultiplayerGame(started);
    const paused = pauseAsteroidsMultiplayerGame(started);
    const alreadyPaused = pauseAsteroidsMultiplayerGame(paused);
    const resumed = startAsteroidsMultiplayerGame(paused);
    const lostRestarted = startAsteroidsMultiplayerGame({
      ...resumed,
      lives: 0,
      score: 600,
      status: "lost",
      wave: 3,
    });
    const startedWithInactiveShip = startAsteroidsMultiplayerGame(
      withShip(createInitialAsteroidsMultiplayerGame(), "ship-b", {
        isActive: false,
      }),
    );
    const restarted = restartAsteroidsMultiplayerGame({
      ...resumed,
      difficulty: "hard",
    });
    const defaultRestarted = restartAsteroidsMultiplayerGame();

    expect(started.status).toBe("running");
    expect(alreadyStarted).toBe(started);
    expect(started.ships["ship-a"].respawnInvulnerabilityTicks).toBe(
      ASTEROIDS_RESPAWN_INVULNERABILITY_TICKS,
    );
    expect(started.ships["ship-b"].respawnInvulnerabilityTicks).toBe(
      ASTEROIDS_RESPAWN_INVULNERABILITY_TICKS,
    );
    expect(paused.status).toBe("paused");
    expect(alreadyPaused).toBe(paused);
    expect(resumed.status).toBe("running");
    expect(lostRestarted).toMatchObject({
      score: 0,
      status: "running",
      wave: 1,
    });
    expect(startedWithInactiveShip.ships["ship-a"].respawnInvulnerabilityTicks).toBe(
      ASTEROIDS_RESPAWN_INVULNERABILITY_TICKS,
    );
    expect(startedWithInactiveShip.ships["ship-b"].respawnInvulnerabilityTicks).toBe(0);
    expect(restarted).toMatchObject({
      difficulty: "hard",
      lives: 2,
      score: 0,
      status: "running",
      wave: 1,
    });
    expect(restarted.asteroids).toHaveLength(5);
    expect(defaultRestarted.difficulty).toBe("medium");
    expect(advanceAsteroidsMultiplayerGameTick(paused)).toBe(paused);
    expect("ships" in soloGame).toBe(false);
    expect(soloGame.ship.x).toBe(ASTEROIDS_BOARD_WIDTH / 2);
  });

  it("moves and fires each ship independently with per-ship bullet caps", () => {
    const movingGame = advanceAsteroidsMultiplayerGameTick(
      createRunningMultiplayerGame({
        asteroids: [createSafeAsteroid()],
      }),
      {
        "ship-a": { rotateRight: true, thrust: true },
        "ship-b": { rotateLeft: true },
      },
    );
    const firedA = fireAsteroidsMultiplayerShipBullet(movingGame, "ship-a");
    const invalidSeatFire = fireAsteroidsMultiplayerShipBullet(firedA, "left");
    const firedB = fireAsteroidsMultiplayerShipBullet(firedA, "ship-b");
    const saturated = {
      ...firedB,
      nextBulletId: 10,
      ships: {
        ...firedB.ships,
        "ship-a": {
          ...firedB.ships["ship-a"],
          bullets: [
            createBullet({ id: "a1" }),
            createBullet({ id: "a2" }),
            createBullet({ id: "a3" }),
            createBullet({ id: "a4" }),
          ],
          shotCooldownTicks: 0,
        },
        "ship-b": {
          ...firedB.ships["ship-b"],
          bullets: [],
          shotCooldownTicks: 0,
        },
      },
    } satisfies AsteroidsMultiplayerGameState;
    const blockedA = fireAsteroidsMultiplayerShipBullet(saturated, "ship-a");
    const firedBAfterAIsCapped = fireAsteroidsMultiplayerShipBullet(
      blockedA,
      "ship-b",
    );

    expect(movingGame.ships["ship-a"].ship).toMatchObject({
      angle: 277,
      isThrusting: true,
    });
    expect(movingGame.ships["ship-a"].ship.velocity.x).toBeGreaterThan(0);
    expect(movingGame.ships["ship-b"].ship).toMatchObject({
      angle: 263,
      isThrusting: false,
    });
    expect(firedA.ships["ship-a"].bullets.map((bullet) => bullet.id)).toEqual([
      "bullet-0",
    ]);
    expect(firedA.ships["ship-b"].bullets).toEqual([]);
    expect(invalidSeatFire).toBe(firedA);
    expect(firedB.ships["ship-b"].bullets.map((bullet) => bullet.id)).toEqual([
      "bullet-1",
    ]);
    expect(firedB.nextBulletId).toBe(2);
    expect(blockedA.ships["ship-a"].bullets).toHaveLength(4);
    expect(firedBAfterAIsCapped.ships["ship-b"].bullets.map((bullet) => bullet.id)).toEqual([
      "bullet-10",
    ]);
    expect(firedBAfterAIsCapped.nextBulletId).toBe(11);
  });

  it("ignores fire for inactive ships while held fire is per playable ship", () => {
    const runningGame = createRunningMultiplayerGame({
      asteroids: [createSafeAsteroid()],
    });
    const inactiveShipA = withShip(runningGame, "ship-a", {
      isActive: false,
    });
    const explodingShipB = withShip(runningGame, "ship-b", {
      shipExplosion: {
        durationTicks: ASTEROIDS_SHIP_EXPLOSION_TICKS,
        radius: runningGame.ships["ship-b"].ship.radius,
        ticksRemaining: ASTEROIDS_SHIP_EXPLOSION_TICKS,
        x: runningGame.ships["ship-b"].ship.x,
        y: runningGame.ships["ship-b"].ship.y,
      },
    });
    const heldFireGame = advanceAsteroidsMultiplayerGameTick(runningGame, {
      "ship-a": { fire: true },
      "ship-b": { fire: true },
    });

    expect(fireAsteroidsMultiplayerShipBullet(inactiveShipA, "ship-a")).toBe(
      inactiveShipA,
    );
    expect(fireAsteroidsMultiplayerShipBullet(explodingShipB, "ship-b")).toBe(
      explodingShipB,
    );
    expect(heldFireGame.ships["ship-a"].bullets.map((bullet) => bullet.id)).toEqual([
      "bullet-0",
    ]);
    expect(heldFireGame.ships["ship-b"].bullets.map((bullet) => bullet.id)).toEqual([
      "bullet-1",
    ]);
    expect(heldFireGame.nextBulletId).toBe(2);
  });

  it("does not apply friendly fire, ship collision, or player bullet-bullet collisions", () => {
    const overlappedShips = withBothShipsAt(
      createRunningMultiplayerGame({
        asteroids: [createSafeAsteroid()],
      }),
      320,
      300,
    );
    const armedGame = withShip(
      withShip(overlappedShips, "ship-a", {
        bullets: [createBullet({ id: "a-shot", x: 320, y: 300 })],
      }),
      "ship-b",
      {
        bullets: [createBullet({ id: "b-shot", x: 320, y: 300 })],
      },
    );
    const advanced = advanceAsteroidsMultiplayerGameTick(armedGame);

    expect(advanced.lives).toBe(ASTEROIDS_STARTING_LIVES);
    expect(advanced.ships["ship-a"].shipExplosion).toBeNull();
    expect(advanced.ships["ship-b"].shipExplosion).toBeNull();
    expect(advanced.ships["ship-a"].bullets).toMatchObject([
      { id: "a-shot", ttl: 9, x: 320, y: 300 },
    ]);
    expect(advanced.ships["ship-b"].bullets).toMatchObject([
      { id: "b-shot", ttl: 9, x: 320, y: 300 },
    ]);
  });

  it("uses injected randomness to choose the active saucer shot target", () => {
    const game = withShipBody(
      withShipBody(
        createRunningMultiplayerGame({
          asteroids: [createSafeAsteroid()],
          saucer: createSaucer({
            shotCooldownTicks: 0,
            x: 400,
            y: 300,
          }),
        }),
        "ship-a",
        { x: 250, y: 300 },
      ),
      "ship-b",
      { x: 550, y: 300 },
    );
    const advanced = advanceAsteroidsMultiplayerGameTick(
      game,
      {},
      { random: createRandomSequence([0.75, 0.5]) },
    );
    const saucerShot = advanced.saucerBullets[0];

    if (saucerShot === undefined) {
      throw new Error("Expected saucer to fire.");
    }

    expect(saucerShot.id).toBe("saucer-shot-0");
    expect(saucerShot.x).toBe(400);
    expect(saucerShot.velocity.x).toBeGreaterThan(0);
    expect(Math.abs(saucerShot.velocity.y)).toBeLessThan(0.001);
    expect(advanced.nextSaucerBulletId).toBe(1);
    expect(advanced.saucer?.shotCooldownTicks).toBeGreaterThan(0);
  });

  it("lets player bullets destroy saucers and advance an empty wave", () => {
    const game = withShip(
      createRunningMultiplayerGame({
        asteroids: [],
        saucer: createSaucer({
          kind: "small",
          shotCooldownTicks: 99,
          x: 320,
          y: 300,
        }),
        saucerSpawnCooldownTicks: 0,
      }),
      "ship-a",
      {
        bullets: [
          createBullet({
            id: "saucer-hit-shot",
            x: 320,
            y: 300,
          }),
        ],
      },
    );
    const advanced = advanceAsteroidsMultiplayerGameTick(game, {}, {
      random: createRandomSequence([0.25, 0.5, 0.75, 0.1]),
    });

    expect(advanced.saucer).toBeNull();
    expect(advanced.saucerSpawnCooldownTicks).toBeGreaterThan(0);
    expect(advanced.ships["ship-a"].bullets).toEqual([]);
    expect(advanced.score).toBeGreaterThan(game.score);
    expect(advanced.wave).toBe(2);
    expect(advanced.asteroids.length).toBeGreaterThan(0);
  });

  it("does not fire saucer shots when no playable ship can be targeted", () => {
    const game = withShip(
      withShip(
        createRunningMultiplayerGame({
          asteroids: [createSafeAsteroid()],
          saucer: createSaucer({
            shotCooldownTicks: 0,
            x: 400,
            y: 300,
          }),
        }),
        "ship-a",
        { isActive: false },
      ),
      "ship-b",
      {
        shipExplosion: {
          durationTicks: ASTEROIDS_SHIP_EXPLOSION_TICKS,
          radius: 14,
          ticksRemaining: ASTEROIDS_SHIP_EXPLOSION_TICKS,
          x: 550,
          y: 300,
        },
      },
    );
    const advanced = advanceAsteroidsMultiplayerGameTick(game);

    expect(advanced.saucerBullets).toEqual([]);
    expect(advanced.nextSaucerBulletId).toBe(game.nextSaucerBulletId);
    expect(advanced.saucer).toMatchObject({
      id: "saucer-test",
      shotCooldownTicks: 0,
    });
  });

  it("spawns and preserves power-ups without forcing collection", () => {
    const spawnReady = createRunningMultiplayerGame({
      asteroids: [createSafeAsteroid({ x: 760, y: 560 })],
      nextPowerUpId: 7,
      powerUpSpawnCooldownTicks: 0,
    });
    const spawned = advanceAsteroidsMultiplayerGameTick(spawnReady, {}, {
      random: createRandomSequence([Number.NaN, 0.98, 0.98]),
    });
    const uncollected = advanceAsteroidsMultiplayerGameTick({
      ...spawnReady,
      powerUp: createPowerUp({
        x: 40,
        y: 40,
      }),
    });

    expect(spawned.nextPowerUpId).toBe(8);
    expect(spawned.powerUp).toMatchObject({
      id: "power-up-7",
      kind: "shield",
    });
    expect(uncollected.powerUp).toMatchObject({
      id: "power-up-test",
      x: 40,
      y: 40,
    });
  });

  it("lets asteroid body hazards destroy both ships and spend two shared lives", () => {
    const damaged = advanceAsteroidsMultiplayerGameTick(
      withBothShipsAt(
        createRunningMultiplayerGame({
          asteroids: [createAsteroid({ x: 320, y: 300 })],
          lives: 3,
        }),
        320,
        300,
      ),
    );

    expect(damaged.lives).toBe(1);
    expect(damaged.status).toBe("running");
    expect(damaged.ships["ship-a"]).toMatchObject({
      bullets: [],
      isActive: true,
      respawnInvulnerabilityTicks: 0,
      respawnOnExplosionEnd: true,
    });
    expect(damaged.ships["ship-b"]).toMatchObject({
      bullets: [],
      isActive: true,
      respawnInvulnerabilityTicks: 0,
      respawnOnExplosionEnd: true,
    });
    expect(damaged.ships["ship-a"].shipExplosion).toMatchObject({
      ticksRemaining: ASTEROIDS_SHIP_EXPLOSION_TICKS,
      x: 320,
      y: 300,
    });
    expect(damaged.ships["ship-b"].shipExplosion).toMatchObject({
      ticksRemaining: ASTEROIDS_SHIP_EXPLOSION_TICKS,
      x: 320,
      y: 300,
    });
  });

  it("randomly chooses the final respawn path for simultaneous saucer body damage", () => {
    const damaged = advanceAsteroidsMultiplayerGameTick(
      withBothShipsAt(
        createRunningMultiplayerGame({
          asteroids: [createSafeAsteroid()],
          lives: 1,
          saucer: createSaucer({
            shotCooldownTicks: 99,
            x: 320,
            y: 300,
          }),
        }),
        320,
        300,
      ),
      {},
      { random: createRandomSequence([0.75]) },
    );
    const resolved = advanceMultiplayerTicks(
      damaged,
      ASTEROIDS_SHIP_EXPLOSION_TICKS,
    );

    expect(damaged.lives).toBe(0);
    expect(damaged.ships["ship-a"]).toMatchObject({
      isActive: false,
      respawnOnExplosionEnd: false,
    });
    expect(damaged.ships["ship-b"]).toMatchObject({
      isActive: true,
      respawnOnExplosionEnd: true,
    });
    expect(resolved.status).toBe("running");
    expect(resolved.ships["ship-a"]).toMatchObject({
      isActive: false,
      shipExplosion: null,
    });
    expect(resolved.ships["ship-b"].shipExplosion).toBeNull();
    expect(resolved.ships["ship-b"].respawnInvulnerabilityTicks).toBe(
      ASTEROIDS_RESPAWN_INVULNERABILITY_TICKS,
    );
  });

  it("consumes a saucer shot and randomly destroys only one hit ship", () => {
    const damaged = advanceAsteroidsMultiplayerGameTick(
      withBothShipsAt(
        createRunningMultiplayerGame({
          asteroids: [createSafeAsteroid()],
          lives: 2,
          saucerBullets: [
            createSaucerShot({
              id: "double-hit-shot",
              x: 320,
              y: 300,
            }),
          ],
        }),
        320,
        300,
      ),
      {},
      { random: createRandomSequence([0.75]) },
    );

    expect(damaged.lives).toBe(1);
    expect(damaged.saucerBullets).toEqual([]);
    expect(damaged.ships["ship-a"].shipExplosion).toBeNull();
    expect(damaged.ships["ship-a"].isActive).toBe(true);
    expect(damaged.ships["ship-b"].shipExplosion).toMatchObject({
      x: 320,
      y: 300,
    });
    expect(damaged.ships["ship-b"].respawnOnExplosionEnd).toBe(true);
  });

  it("consumes saucer shots blocked by invulnerability without spending lives", () => {
    const game = withShip(
      withShip(
        withBothShipsAt(
          createRunningMultiplayerGame({
            asteroids: [createSafeAsteroid()],
            lives: 2,
            saucerBullets: [
              createSaucerShot({
                id: "shielded-double-hit-shot",
                x: 320,
                y: 300,
              }),
            ],
          }),
          320,
          300,
        ),
        "ship-a",
        { respawnInvulnerabilityTicks: 5 },
      ),
      "ship-b",
      { respawnInvulnerabilityTicks: 8 },
    );
    const advanced = advanceAsteroidsMultiplayerGameTick(game);

    expect(advanced.lives).toBe(2);
    expect(advanced.saucerBullets).toEqual([]);
    expect(advanced.ships["ship-a"].shipExplosion).toBeNull();
    expect(advanced.ships["ship-b"].shipExplosion).toBeNull();
  });

  it("applies power-up ship upgrades only to the collecting ship", () => {
    const game = createRunningMultiplayerGame({
      asteroids: [createSafeAsteroid()],
    });
    const collector = game.ships["ship-a"].ship;
    const pickedUp = advanceAsteroidsMultiplayerGameTick({
      ...game,
      powerUp: createPowerUp({
        kind: "bullet-speed",
        x: collector.x,
        y: collector.y,
      }),
    });

    expect(pickedUp.powerUp).toBeNull();
    expect(pickedUp.ships["ship-a"].bulletSpeedMultiplier).toBeCloseTo(1.2);
    expect(pickedUp.ships["ship-b"].bulletSpeedMultiplier).toBe(1);
    expect(pickedUp.score).toBe(0);
  });

  it("randomly chooses one collector when both active ships touch a power-up", () => {
    const game = withBothShipsAt(
      createRunningMultiplayerGame({
        asteroids: [createSafeAsteroid()],
        nextPowerUpId: 5,
      }),
      320,
      300,
    );
    const pickedUp = advanceAsteroidsMultiplayerGameTick(
      {
        ...game,
        powerUp: createPowerUp({
          kind: "engine-speed",
          x: 320,
          y: 300,
        }),
      },
      {},
      { random: createRandomSequence([0.75, 0]) },
    );

    expect(pickedUp.powerUp).toBeNull();
    expect(pickedUp.ships["ship-a"].engineSpeedMultiplier).toBe(1);
    expect(pickedUp.ships["ship-b"].engineSpeedMultiplier).toBeCloseTo(1.2);
  });

  it("chooses the first simultaneous power-up collector without injected randomness", () => {
    const game = withBothShipsAt(
      createRunningMultiplayerGame({
        asteroids: [createSafeAsteroid()],
      }),
      320,
      300,
    );
    const pickedUp = advanceAsteroidsMultiplayerGameTick({
      ...game,
      powerUp: createPowerUp({
        kind: "shot-interval",
        x: 320,
        y: 300,
      }),
    });
    const pickedUpWithNonFiniteRandom = advanceAsteroidsMultiplayerGameTick(
      {
        ...game,
        powerUp: createPowerUp({
          kind: "engine-speed",
          x: 320,
          y: 300,
        }),
      },
      {},
      { random: createRandomSequence([Number.NaN, 0]) },
    );

    expect(pickedUp.powerUp).toBeNull();
    expect(pickedUp.ships["ship-a"].shotIntervalMultiplier).toBeLessThan(1);
    expect(pickedUp.ships["ship-b"].shotIntervalMultiplier).toBe(1);
    expect(pickedUpWithNonFiniteRandom.ships["ship-a"].engineSpeedMultiplier).toBeGreaterThan(1);
    expect(pickedUpWithNonFiniteRandom.ships["ship-b"].engineSpeedMultiplier).toBe(1);
  });

  it("keeps score and bonus-life power-up effects shared", () => {
    const game = createRunningMultiplayerGame({
      asteroids: [createSafeAsteroid()],
      lives: 1,
      score: 9_000,
    });
    const collector = game.ships["ship-b"].ship;
    const pickedUp = advanceAsteroidsMultiplayerGameTick({
      ...game,
      powerUp: createPowerUp({
        kind: "bonus-score",
        x: collector.x,
        y: collector.y,
      }),
    });

    expect(pickedUp.score).toBe(9_000 + ASTEROIDS_BONUS_SCORE_POWER_UP_POINTS);
    expect(pickedUp.lives).toBe(2);
    expect(pickedUp.ships["ship-a"].bulletSpeedMultiplier).toBe(1);
    expect(pickedUp.ships["ship-b"].respawnInvulnerabilityTicks).toBe(0);
  });

  it("applies same-tick shield pickups before resolving hazards for that ship", () => {
    const game = createRunningMultiplayerGame({
      asteroids: [],
    });
    const shipA = game.ships["ship-a"].ship;
    const shipB = game.ships["ship-b"].ship;
    const advanced = advanceAsteroidsMultiplayerGameTick({
      ...game,
      asteroids: [
        createAsteroid({
          id: "ship-a-hazard",
          x: shipA.x,
          y: shipA.y,
        }),
        createAsteroid({
          id: "ship-b-hazard",
          x: shipB.x,
          y: shipB.y,
        }),
      ],
      powerUp: createPowerUp({
        kind: "shield",
        x: shipA.x,
        y: shipA.y,
      }),
    });

    expect(advanced.powerUp).toBeNull();
    expect(advanced.ships["ship-a"].respawnInvulnerabilityTicks).toBe(
      ASTEROIDS_POWER_UP_SHIELD_TICKS,
    );
    expect(advanced.ships["ship-a"].shipExplosion).toBeNull();
    expect(advanced.ships["ship-b"].shipExplosion).toMatchObject({
      x: shipB.x,
      y: shipB.y,
    });
  });

  it("respawns destroyed ships independently while the other ship keeps playing", () => {
    const game = createRunningMultiplayerGame({
      asteroids: [],
      lives: 2,
    });
    const shipA = game.ships["ship-a"].ship;
    const shipB = {
      ...game.ships["ship-b"].ship,
      velocity: { x: 2, y: 0 },
      x: 560,
      y: 300,
    };
    const damaged = advanceAsteroidsMultiplayerGameTick(
      withShip(
        {
          ...game,
          asteroids: [
            createAsteroid({
              x: shipA.x,
              y: shipA.y,
            }),
          ],
        },
        "ship-b",
        { ship: shipB },
      ),
    );
    const duringExplosion = advanceAsteroidsMultiplayerGameTick(damaged, {
      "ship-b": { thrust: true },
    });
    const respawned = advanceMultiplayerTicks(
      damaged,
      ASTEROIDS_SHIP_EXPLOSION_TICKS,
    );

    expect(damaged.lives).toBe(1);
    expect(damaged.ships["ship-a"].shipExplosion).toMatchObject({
      x: shipA.x,
      y: shipA.y,
    });
    expect(damaged.ships["ship-b"].shipExplosion).toBeNull();
    expect(damaged.ships["ship-b"].ship.x).toBeGreaterThan(shipB.x);
    expect(duringExplosion.ships["ship-b"].ship.x).toBeGreaterThan(
      damaged.ships["ship-b"].ship.x,
    );
    expect(respawned.ships["ship-a"].shipExplosion).toBeNull();
    expect(respawned.ships["ship-a"].isActive).toBe(true);
    expect(respawned.ships["ship-a"].respawnInvulnerabilityTicks).toBe(
      ASTEROIDS_RESPAWN_INVULNERABILITY_TICKS,
    );
    expect(respawned.ships["ship-a"].ship.x).not.toBe(shipA.x);
    expect(respawned.ships["ship-b"].isActive).toBe(true);
  });

  it("waits for the final explosion to finish before ending the run", () => {
    const game = createRunningMultiplayerGame({
      asteroids: [],
      lives: 0,
      powerUp: createPowerUp({
        x: 760,
        y: 560,
      }),
      saucer: createSaucer({
        shotCooldownTicks: 99,
        x: 40,
        y: 40,
      }),
      saucerBullets: [
        createSaucerShot({
          id: "far-shot",
          x: 40,
          y: 40,
        }),
      ],
    });
    const shipA = game.ships["ship-a"].ship;
    const finalHit = advanceAsteroidsMultiplayerGameTick(
      withShip(
        {
          ...game,
          asteroids: [
            createAsteroid({
              x: shipA.x,
              y: shipA.y,
            }),
          ],
        },
        "ship-b",
        {
          isActive: false,
          respawnOnExplosionEnd: false,
        },
      ),
    );
    const almostLost = advanceMultiplayerTicks(
      finalHit,
      ASTEROIDS_SHIP_EXPLOSION_TICKS - 1,
    );
    const lost = advanceAsteroidsMultiplayerGameTick(almostLost);

    expect(finalHit.status).toBe("running");
    expect(finalHit.ships["ship-a"]).toMatchObject({
      isActive: false,
      respawnOnExplosionEnd: false,
    });
    expect(finalHit.ships["ship-a"].shipExplosion).not.toBeNull();
    expect(almostLost.status).toBe("running");
    expect(almostLost.ships["ship-a"].shipExplosion?.ticksRemaining).toBe(1);
    expect(lost).toMatchObject({
      powerUp: null,
      saucer: null,
      saucerBullets: [],
      status: "lost",
    });
    expect(lost.ships["ship-a"].shipExplosion).toBeNull();
    expect(lost.ships["ship-a"].bullets).toEqual([]);
    expect(lost.ships["ship-b"].bullets).toEqual([]);
  });

  it("projects held thrust and rotation through elapsed render time", () => {
    const game = createRunningMultiplayerGame({
      asteroids: [createSafeAsteroid()],
    });
    const inputs = {
      "ship-a": { fire: true, rotateRight: true, thrust: true },
    };
    const projected = projectAsteroidsMultiplayerGame(
      game,
      inputs,
      getAsteroidsTickDelay() * 2,
    );

    expect(projected).not.toBe(game);
    expect(projected.ships["ship-a"].ship.isThrusting).toBe(true);
    expect(projected.ships["ship-a"].ship.angle).toBe(284);
    expect(projected.ships["ship-a"].ship.x).toBeGreaterThan(
      game.ships["ship-a"].ship.x,
    );
    expect(projected.ships["ship-a"].ship.velocity.x).toBeGreaterThan(0);
    expect(projected.ships["ship-a"].bullets).toEqual([]);
    expect(projected.nextBulletId).toBe(game.nextBulletId);
    expect(game.ships["ship-a"].ship).toMatchObject({
      angle: -90,
      isThrusting: false,
      velocity: { x: 0, y: 0 },
    });
  });

  it("projects existing bullets, asteroids, saucers, and saucer shots", () => {
    const game = withShip(
      createRunningMultiplayerGame({
        asteroids: [
          createSafeAsteroid({
            id: "moving-asteroid",
            velocity: { x: 2, y: 3 },
            x: 100,
            y: 100,
          }),
        ],
        saucer: createSaucer({
          shotCooldownTicks: 3,
          velocity: { x: 1.5, y: -0.5 },
          x: 180,
          y: 160,
        }),
        saucerBullets: [
          createSaucerShot({
            id: "moving-saucer-shot",
            ttl: 40,
            velocity: { x: -3, y: 4 },
            x: 260,
            y: 270,
          }),
        ],
      }),
      "ship-a",
      {
        bullets: [
          createBullet({
            id: "moving-shot",
            ttl: 10,
            velocity: { x: 5, y: -2 },
            x: 200,
            y: 210,
          }),
        ],
      },
    );
    const projected = projectAsteroidsMultiplayerGame(
      game,
      {},
      getAsteroidsTickDelay(),
    );

    expect(projected.asteroids).toMatchObject([
      {
        id: "moving-asteroid",
        x: 102,
        y: 103,
      },
    ]);
    expect(projected.saucer).toMatchObject({
      id: "saucer-test",
      shotCooldownTicks: 2,
      x: 181.5,
      y: 159.5,
    });
    expect(projected.saucerBullets).toMatchObject([
      {
        id: "moving-saucer-shot",
        ttl: 39,
        x: 257,
        y: 274,
      },
    ]);
    expect(projected.ships["ship-a"].bullets).toMatchObject([
      {
        id: "moving-shot",
        ttl: 9,
        x: 205,
        y: 208,
      },
    ]);
    expect(game.asteroids).toMatchObject([
      {
        id: "moving-asteroid",
        x: 100,
        y: 100,
      },
    ]);
    expect(game.saucer).toMatchObject({
      id: "saucer-test",
      shotCooldownTicks: 3,
      x: 180,
      y: 160,
    });
    expect(game.saucerBullets).toMatchObject([
      {
        id: "moving-saucer-shot",
        ttl: 40,
        x: 260,
        y: 270,
      },
    ]);
    expect(game.ships["ship-a"].bullets).toMatchObject([
      {
        id: "moving-shot",
        ttl: 10,
        x: 200,
        y: 210,
      },
    ]);
  });

  it("does not resolve projected collisions, fire, pickups, or spawns", () => {
    const baseGame = createRunningMultiplayerGame({
      asteroids: [createSafeAsteroid()],
    });
    const shipA = baseGame.ships["ship-a"].ship;
    const game = withShip(
      {
        ...baseGame,
        asteroids: [
          createSafeAsteroid({
            id: "target-asteroid",
            velocity: { x: 0, y: 0 },
            x: shipA.x,
            y: shipA.y,
          }),
          createSafeAsteroid({
            id: "remaining-asteroid",
            x: 40,
            y: 40,
          }),
        ],
        nextAsteroidId: 20,
        nextBulletId: 6,
        nextPowerUpId: 4,
        nextSaucerId: 8,
        powerUp: createPowerUp({
          kind: "shield",
          x: shipA.x,
          y: shipA.y,
        }),
        powerUpSpawnCooldownTicks: 0,
        saucer: null,
        saucerBullets: [
          createSaucerShot({
            id: "ship-hit-shot",
            ttl: 40,
            velocity: { x: 0, y: 0 },
            x: shipA.x,
            y: shipA.y,
          }),
        ],
        saucerSpawnCooldownTicks: 0,
        score: 40,
        wave: 2,
      },
      "ship-a",
      {
        bullets: [
          createBullet({
            id: "hit-shot",
            ttl: 10,
            velocity: { x: 0, y: 0 },
            x: shipA.x,
            y: shipA.y,
          }),
        ],
        respawnInvulnerabilityTicks: 0,
        shotCooldownTicks: 0,
      },
    );
    const projected = projectAsteroidsMultiplayerGame(
      game,
      { "ship-a": { fire: true } },
      getAsteroidsTickDelay(),
    );

    expect(projected).toMatchObject({
      lives: game.lives,
      nextAsteroidId: game.nextAsteroidId,
      nextBulletId: game.nextBulletId,
      nextPowerUpId: game.nextPowerUpId,
      nextSaucerId: game.nextSaucerId,
      powerUpSpawnCooldownTicks: game.powerUpSpawnCooldownTicks,
      saucer: null,
      saucerSpawnCooldownTicks: game.saucerSpawnCooldownTicks,
      score: game.score,
      status: "running",
      wave: game.wave,
    });
    expect(projected.powerUp).toEqual(game.powerUp);
    expect(projected.asteroids.map((asteroid) => asteroid.id)).toEqual([
      "target-asteroid",
      "remaining-asteroid",
    ]);
    expect(projected.saucerBullets.map((bullet) => bullet.id)).toEqual([
      "ship-hit-shot",
    ]);
    expect(projected.ships["ship-a"].shipExplosion).toBeNull();
    expect(projected.ships["ship-a"].respawnInvulnerabilityTicks).toBe(0);
    expect(game.ships["ship-a"].bullets.map((bullet) => bullet.id)).toEqual([
      "hit-shot",
    ]);
    expect(projected.ships["ship-a"].bullets.map((bullet) => bullet.id)).toEqual([
      "hit-shot",
    ]);
  });

  it("leaves non-running snapshots authoritative and avoids projected terminal state", () => {
    const pausedGame = pauseAsteroidsMultiplayerGame(
      createRunningMultiplayerGame({
        asteroids: [createSafeAsteroid()],
      }),
    );
    const terminalGame = createRunningMultiplayerGame({
      status: "lost",
    });
    const runningGame = createRunningMultiplayerGame({
      asteroids: [],
      lives: 0,
    });
    const shipA = runningGame.ships["ship-a"].ship;
    const almostLost = withShip(
      withShip(runningGame, "ship-a", {
        isActive: false,
        respawnOnExplosionEnd: false,
        shipExplosion: {
          durationTicks: ASTEROIDS_SHIP_EXPLOSION_TICKS,
          radius: shipA.radius,
          ticksRemaining: 1,
          x: shipA.x,
          y: shipA.y,
        },
      }),
      "ship-b",
      {
        isActive: false,
        respawnOnExplosionEnd: false,
        shipExplosion: null,
      },
    );

    expect(
      projectAsteroidsMultiplayerGame(
        pausedGame,
        { "ship-a": { thrust: true } },
        getAsteroidsTickDelay(),
      ),
    ).toBe(pausedGame);
    expect(
      projectAsteroidsMultiplayerGame(
        terminalGame,
        { "ship-a": { thrust: true } },
        getAsteroidsTickDelay(),
      ),
    ).toBe(terminalGame);
    expect(advanceAsteroidsMultiplayerGameTick(almostLost).status).toBe("lost");
    expect(
      projectAsteroidsMultiplayerGame(almostLost, {}, getAsteroidsTickDelay()),
    ).toMatchObject({
      lives: 0,
      status: "running",
    });
    expect(
      projectAsteroidsMultiplayerGame(almostLost, {}, getAsteroidsTickDelay())
        .ships["ship-a"].shipExplosion,
    ).toMatchObject({
      ticksRemaining: 1,
    });
  });

  it("caps projection ticks to the exported multiplayer window", () => {
    const tickDelayMs = getAsteroidsTickDelay();
    const maxTicks = Math.floor(
      ASTEROIDS_MULTIPLAYER_PROJECTION_MAX_MS / tickDelayMs,
    );
    const game = createRunningMultiplayerGame({
      asteroids: [
        createSafeAsteroid({
          id: "capped-asteroid",
          velocity: { x: 1, y: 0 },
          x: 100,
          y: 100,
        }),
      ],
    });
    const projected = projectAsteroidsMultiplayerGame(
      game,
      {},
      ASTEROIDS_MULTIPLAYER_PROJECTION_MAX_MS + tickDelayMs * 30,
    );

    expect(getAsteroidsMultiplayerProjectionTicks(-1)).toBe(0);
    expect(getAsteroidsMultiplayerProjectionTicks(tickDelayMs - 1)).toBe(0);
    expect(
      getAsteroidsMultiplayerProjectionTicks(
        ASTEROIDS_MULTIPLAYER_PROJECTION_MAX_MS + tickDelayMs * 30,
      ),
    ).toBe(maxTicks);
    expect(projected.asteroids).toMatchObject([
      {
        id: "capped-asteroid",
        x: 100 + maxTicks,
        y: 100,
      },
    ]);
  });
});
