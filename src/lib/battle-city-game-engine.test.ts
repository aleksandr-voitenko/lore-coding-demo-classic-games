import { describe, expect, it } from "vitest";

import {
  advanceBattleCityGame,
  BATTLE_CITY_BOARD_SIZE,
  BATTLE_CITY_BULLET_IMPACT_TICKS,
  BATTLE_CITY_ENEMY_EXPLOSION_TICKS,
  BATTLE_CITY_ENEMY_SPAWN_INTERVAL_TICKS,
  BATTLE_CITY_ENEMY_SPAWN_TICKS,
  BATTLE_CITY_FORTRESS_TICKS,
  BATTLE_CITY_FREEZE_TICKS,
  BATTLE_CITY_GAME_OVER_TRANSITION_TICKS,
  BATTLE_CITY_HEADQUARTERS_EXPLOSION_TICKS,
  BATTLE_CITY_HELMET_TICKS,
  BATTLE_CITY_ICE_SLIDE_STEPS,
  BATTLE_CITY_MAX_ACTIVE_ENEMIES,
  BATTLE_CITY_NEXT_STAGE_INTRO_TICKS,
  BATTLE_CITY_PLAYER_EXPLOSION_TICKS,
  BATTLE_CITY_PLAYER_INVULNERABILITY_TICKS,
  BATTLE_CITY_PLAYER_SPAWN_TICKS,
  BATTLE_CITY_STAGE_COUNT,
  BATTLE_CITY_STAGE_INTRO_TICKS,
  BATTLE_CITY_STAGE_RESULTS_BASE_TICKS,
  BATTLE_CITY_STAGE_RESULTS_PER_KILL_TICKS,
  BATTLE_CITY_STAGE_TRANSITION_TICKS,
  BATTLE_CITY_STAGES,
  BATTLE_CITY_STARTING_LIVES,
  BATTLE_CITY_TICK_MS,
  createInitialBattleCityGame,
  fireBattleCityPlayer,
  formatBattleCityStageLabel,
  getBattleCityStageResultDisplay,
  getBattleCityStage,
  getBattleCityTickDelay,
  moveBattleCityPlayer,
  pauseBattleCityGame,
  restartBattleCityGame,
  resumeBattleCityGame,
  startBattleCityGame,
  type BattleCityBullet,
  type BattleCityEnemy,
  type BattleCityGameState,
  type BattleCityPlayer,
  type BattleCityPowerUpType,
  type BattleCityTerrain,
} from "./battle-city-game-engine";
import {
  BATTLE_CITY_FULL_TERRAIN_FRAGMENT_MASK,
  BATTLE_CITY_TERRAIN_FRAGMENT_BITS,
  createBattleCityTerrainFragmentGrid,
} from "./battle-city/terrain-fragments";

function emptyTerrain(): BattleCityTerrain[][] {
  return Array.from({ length: BATTLE_CITY_BOARD_SIZE }, () =>
    Array<BattleCityTerrain>(BATTLE_CITY_BOARD_SIZE).fill("empty"),
  );
}

function terrainWithHeadquarters(): BattleCityTerrain[][] {
  const terrain = emptyTerrain();
  terrain[24]![12] = "headquarters";
  terrain[24]![13] = "headquarters";
  terrain[25]![12] = "headquarters";
  terrain[25]![13] = "headquarters";
  return terrain;
}

function playerFixture(
  overrides: Partial<BattleCityPlayer> = {},
): BattleCityPlayer {
  return {
    col: 8,
    direction: "up",
    iceSlideDirection: null,
    iceSlideStepsRemaining: 0,
    invulnerabilityTicks: 0,
    phase: "active",
    phaseTicks: 0,
    powerTier: 0,
    row: 20,
    shieldTicks: 0,
    ...overrides,
  };
}

function enemyFixture(
  overrides: Partial<BattleCityEnemy> = {},
): BattleCityEnemy {
  return {
    col: 10,
    destructionPoints: null,
    direction: "down",
    explosionTicks: 0,
    hasDroppedPowerUp: false,
    hitPoints: 1,
    id: "enemy-test",
    isCarrier: false,
    maxHitPoints: 1,
    moveIntervalTicks: 2,
    movementPauseSteps: 0,
    movementTurnPending: false,
    row: 10,
    score: 100,
    slot: 5,
    spawnOrder: 1,
    spawnTicks: 0,
    type: "basic",
    ...overrides,
  };
}

function bulletFixture(
  overrides: Partial<BattleCityBullet> = {},
): BattleCityBullet {
  return {
    canDestroySteel: false,
    col: 9.75,
    direction: "right",
    id: "bullet-test",
    impactTicks: 0,
    isNewborn: false,
    owner: "player",
    row: 10,
    slot: overrides.owner === "enemy" ? 5 : 0,
    speed: 0.25,
    strength: 1,
    ...overrides,
  };
}

function runningGame(
  overrides: Partial<BattleCityGameState> = {},
): BattleCityGameState {
  const terrain = overrides.terrain ?? emptyTerrain();
  return {
    ...startBattleCityGame(createInitialBattleCityGame()),
    enemySpawnCooldownTicks: 1_000,
    player: playerFixture(),
    stageKillCounts: { armor: 0, basic: 0, fast: 0, power: 0 },
    stageBattleTicks: 0,
    stageOutcome: null,
    stageResultTicks: 0,
    stageTransitionTicks: 0,
    status: "running",
    terrain,
    terrainFragments:
      overrides.terrainFragments ?? createBattleCityTerrainFragmentGrid(terrain),
    ...overrides,
  };
}

function powerUpGame(
  type: BattleCityPowerUpType,
  overrides: Partial<BattleCityGameState> = {},
): BattleCityGameState {
  const game = runningGame(overrides);
  return {
    ...game,
    activePowerUp: {
      col: game.player.col,
      id: `power-up-${type}`,
      row: game.player.row,
      type,
    },
  };
}

describe("Battle City stages and lifecycle", () => {
  it("loads all 35 mechanically imported 26x26 stages and ordered queues", () => {
    expect(BATTLE_CITY_STAGES).toHaveLength(BATTLE_CITY_STAGE_COUNT);
    expect(BATTLE_CITY_STAGES.map(({ stage }) => stage)).toEqual(
      Array.from({ length: 35 }, (_, index) => index + 1),
    );
    for (const stage of BATTLE_CITY_STAGES) {
      expect(stage.terrain).toHaveLength(26);
      expect(stage.terrain.every((row) => row.length === 26)).toBe(true);
      expect(stage.enemyQueue).toHaveLength(20);
      expect(stage.spawns.enemies).toHaveLength(3);
    }
    expect(getBattleCityStage(1).enemyQueue.slice(0, 4)).toEqual([
      "basic",
      "basic",
      "basic",
      "basic",
    ]);
    expect(getBattleCityStage(35).enemyQueue.slice(-10)).toEqual(
      Array(10).fill("armor"),
    );
    expect(() => getBattleCityStage(0)).toThrow(RangeError);
    expect(() => getBattleCityStage(36)).toThrow(RangeError);
  });

  it("creates the requested stage with a ready three-life run", () => {
    const game = createInitialBattleCityGame({ stage: 4.6 });

    expect(game).toMatchObject({
      baseAlive: true,
      baseExplosionTicks: 0,
      cycle: 1,
      destroyedEnemyCount: 0,
      lives: BATTLE_CITY_STARTING_LIVES,
      score: 0,
      spawnedEnemyCount: 0,
      stage: 5,
      status: "ready",
      totalEnemyCount: 20,
    });
    expect(game.player).toMatchObject({
      col: 8,
      direction: "up",
      invulnerabilityTicks: 0,
      phase: "spawning",
      phaseTicks: BATTLE_CITY_PLAYER_SPAWN_TICKS,
      row: 24,
    });
    expect(createInitialBattleCityGame({ stage: Number.NaN }).stage).toBe(1);
    expect(createInitialBattleCityGame({ stage: -8 }).stage).toBe(1);
    expect(createInitialBattleCityGame({ stage: 99 }).stage).toBe(35);
    expect(getBattleCityTickDelay()).toBe(BATTLE_CITY_TICK_MS);
    expect(formatBattleCityStageLabel(1, 1)).toBe("1");
    expect(formatBattleCityStageLabel(1, 2)).toBe("36");
    expect(BATTLE_CITY_TICK_MS).toBeCloseTo(1_000 / 60.0988, 8);
    expect(BATTLE_CITY_STAGE_INTRO_TICKS).toBe(97);
    expect(BATTLE_CITY_NEXT_STAGE_INTRO_TICKS).toBe(115);
    expect(BATTLE_CITY_ENEMY_SPAWN_INTERVAL_TICKS).toBe(187);
    expect(BATTLE_CITY_PLAYER_INVULNERABILITY_TICKS).toBeGreaterThanOrEqual(128);
    expect(BATTLE_CITY_PLAYER_INVULNERABILITY_TICKS).toBeLessThanOrEqual(192);
    expect(BATTLE_CITY_HELMET_TICKS).toBe(640);
  });

  it("shows the original stage intro before battle logic starts", () => {
    const ready = createInitialBattleCityGame();
    let intro = startBattleCityGame(ready);

    for (let frame = 1; frame < BATTLE_CITY_STAGE_INTRO_TICKS; frame += 1) {
      intro = advanceBattleCityGame(intro, () => 0.99);
    }

    expect(intro).toMatchObject({
      stageBattleTicks: 0,
      stageTransitionTicks: 1,
      status: "stage-intro",
      tick: BATTLE_CITY_STAGE_INTRO_TICKS - 1,
    });

    const running = advanceBattleCityGame(intro, () => 0.99);
    const paused = pauseBattleCityGame(running);
    const resumed = resumeBattleCityGame(paused);

    expect(running).toMatchObject({
      stageBattleTicks: 1,
      status: "running",
      tick: BATTLE_CITY_STAGE_INTRO_TICKS,
    });
    expect(running.player).toMatchObject({
      phase: "spawning",
      phaseTicks: BATTLE_CITY_PLAYER_SPAWN_TICKS - 1,
    });
    expect(running.enemies).toEqual([
      expect.objectContaining({
        spawnOrder: 1,
        spawnTicks: BATTLE_CITY_ENEMY_SPAWN_TICKS,
      }),
    ]);
    expect(paused.status).toBe("paused");
    expect(resumed.status).toBe("running");
    expect(startBattleCityGame(startBattleCityGame(ready))).toEqual(
      startBattleCityGame(ready),
    );
    expect(pauseBattleCityGame(ready)).toBe(ready);
    expect(resumeBattleCityGame(ready)).toBe(ready);
    expect(advanceBattleCityGame(ready)).toMatchObject({
      stageBattleTicks: 0,
      status: "ready",
      tick: 1,
    });
  });

  it("preserves selector dwell in the first battle's hardware frame phase", () => {
    let ready = createInitialBattleCityGame();
    for (let frame = 0; frame < 11; frame += 1) {
      ready = advanceBattleCityGame(ready);
    }

    const intro = startBattleCityGame(ready);

    expect(intro).toMatchObject({
      stageBattleTicks: 0,
      stageTransitionTicks: BATTLE_CITY_STAGE_INTRO_TICKS,
      status: "stage-intro",
      tick: 11,
    });
  });

  it("advances only the hardware clocks and pickup marker while paused", () => {
    const enemy = enemyFixture({ col: 5, row: 6, spawnTicks: 8 });
    const bullet = bulletFixture({ col: 7, impactTicks: 4, row: 8 });
    const paused = pauseBattleCityGame(
      runningGame({
        bullets: [bullet],
        enemies: [enemy],
        fortressTicks: 40,
        freezeTicks: 30,
        player: playerFixture({ shieldTicks: 20 }),
        powerUpScorePopup: { col: 3, row: 4, ticks: 2 },
        stageBattleTicks: 10,
        tick: 5,
      }),
    );

    const firstPausedFrame = advanceBattleCityGame(paused, () => 0.99);

    expect(firstPausedFrame).toMatchObject({
      fortressTicks: 40,
      freezeTicks: 30,
      powerUpScorePopup: { col: 3, row: 4, ticks: 1 },
      stageBattleTicks: 11,
      status: "paused",
      tick: 6,
    });
    expect(firstPausedFrame.player.shieldTicks).toBe(20);
    expect(firstPausedFrame.enemies).toEqual([enemy]);
    expect(firstPausedFrame.bullets).toEqual([bullet]);

    expect(
      advanceBattleCityGame(firstPausedFrame, () => 0.99),
    ).toMatchObject({
      powerUpScorePopup: null,
      stageBattleTicks: 12,
      status: "paused",
      tick: 7,
    });
  });

  it("restarts a fresh campaign at the Stage 1 intro", () => {
    const restarted = restartBattleCityGame(
      runningGame({ cycle: 3, lives: 8, score: 42_000, stage: 24 }),
    );

    expect(restarted).toMatchObject({
      cycle: 1,
      lives: 3,
      score: 0,
      stage: 1,
      status: "stage-intro",
    });
  });
});

describe("Battle City movement and firing", () => {
  it.each(["spawning", "exploding"] as const)(
    "blocks movement and firing while the player is %s",
    (phase) => {
      const game = runningGame({
        player: playerFixture({ phase, phaseTicks: 10 }),
      });

      expect(moveBattleCityPlayer(game, "up")).toBe(game);
      expect(fireBattleCityPlayer(game)).toBe(game);
    },
  );

  it("moves the player in one-pixel subcell steps", () => {
    const game = runningGame({
      player: playerFixture({ col: 10, row: 10 }),
    });

    const movedOnce = moveBattleCityPlayer(game, "up");
    const movedEightTimes = Array.from({ length: 8 }).reduce<BattleCityGameState>(
      (current) => moveBattleCityPlayer(current, "up"),
      game,
    );

    expect(movedOnce.player.row).toBe(9.875);
    expect(movedOnce.player.col).toBe(10);
    expect(movedEightTimes.player.row).toBe(9);
  });

  it("applies the original three-of-four-frame player movement cadence", () => {
    const positions: number[] = [];
    let game = runningGame({ player: playerFixture({ col: 10, row: 10 }) });

    for (let frame = 0; frame < 4; frame += 1) {
      game = advanceBattleCityGame(
        game,
        BATTLE_CITY_TICK_MS,
        () => 0.99,
        { direction: "up", fireRequested: false },
      );
      positions.push(game.player.row);
    }

    expect(positions).toEqual([9.875, 9.75, 9.75, 9.625]);
  });

  it("moves before creating a shell requested on the same frame", () => {
    const advanced = advanceBattleCityGame(
      runningGame({
        player: playerFixture({ col: 10, direction: "up", row: 10 }),
      }),
      BATTLE_CITY_TICK_MS,
      () => 0.99,
      { direction: "up", fireRequested: true },
    );

    expect(advanced.player).toMatchObject({ col: 10, row: 9.875 });
    expect(advanced.bullets[0]).toMatchObject({
      col: 11,
      direction: "up",
      row: 9.875,
    });
  });

  it("snaps perpendicular turns to the nearest terrain lane", () => {
    const game = runningGame({
      player: playerFixture({
        col: 10,
        direction: "up",
        row: 10.375,
      }),
    });

    expect(moveBattleCityPlayer(game, "right").player).toMatchObject({
      col: 10.125,
      direction: "right",
      row: 10,
    });
  });

  it("does not leave the current lane when a perpendicular snap is blocked", () => {
    const game = runningGame({
      enemies: [enemyFixture({ col: 10, row: 8.125 })],
      player: playerFixture({
        col: 10,
        direction: "up",
        row: 10.375,
      }),
    });

    const firstAttempt = moveBattleCityPlayer(game, "right");
    const heldAttempt = moveBattleCityPlayer(firstAttempt, "right");

    expect(firstAttempt.player).toMatchObject({
      col: 10,
      direction: "right",
      row: 10.375,
    });
    expect(heldAttempt.player).toMatchObject({
      col: 10,
      direction: "right",
      row: 10.375,
    });
  });

  it("turns downward beside a surviving half-brick wall without lane-locking", () => {
    const terrain = emptyTerrain();
    terrain[10]![12] = "brick";
    terrain[11]![12] = "brick";
    const terrainFragments = createBattleCityTerrainFragmentGrid(terrain);
    const rightHalfMask =
      BATTLE_CITY_TERRAIN_FRAGMENT_BITS["top-right"] |
      BATTLE_CITY_TERRAIN_FRAGMENT_BITS["bottom-right"];
    terrainFragments[10]![12] = rightHalfMask;
    terrainFragments[11]![12] = rightHalfMask;
    let game = runningGame({
      player: playerFixture({ col: 10, direction: "right", row: 10 }),
      terrain,
      terrainFragments,
    });
    for (let step = 0; step < 4; step += 1) {
      game = moveBattleCityPlayer(game, "right");
    }

    expect(moveBattleCityPlayer(game, "down").player).toMatchObject({
      col: 10,
      direction: "down",
      row: 10.125,
    });
  });

  it.each([
    ["left", 9.875],
    ["right", 10.125],
  ] as const)(
    "turns %s above a surviving half-brick wall without lane-locking",
    (direction, expectedCol) => {
      const terrain = emptyTerrain();
      terrain[12]![10] = "brick";
      terrain[12]![11] = "brick";
      const terrainFragments = createBattleCityTerrainFragmentGrid(terrain);
      const bottomHalfMask =
        BATTLE_CITY_TERRAIN_FRAGMENT_BITS["bottom-left"] |
        BATTLE_CITY_TERRAIN_FRAGMENT_BITS["bottom-right"];
      terrainFragments[12]![10] = bottomHalfMask;
      terrainFragments[12]![11] = bottomHalfMask;
      let game = runningGame({
        player: playerFixture({ col: 10, direction: "down", row: 10 }),
        terrain,
        terrainFragments,
      });
      for (let step = 0; step < 4; step += 1) {
        game = moveBattleCityPlayer(game, "down");
      }

      expect(moveBattleCityPlayer(game, direction).player).toMatchObject({
        col: expectedCol,
        direction,
        row: 10,
      });
    },
  );

  it("does not penetrate a terrain cell during a fractional step", () => {
    const terrain = emptyTerrain();
    terrain[9]![10] = "brick";
    const game = runningGame({
      player: playerFixture({ col: 10, direction: "right", row: 10 }),
      terrain,
    });

    expect(moveBattleCityPlayer(game, "up").player).toMatchObject({
      col: 10,
      direction: "up",
      row: 10,
    });
  });

  it("moves a 2x2 player through forest and onto sliding ice", () => {
    const terrain = emptyTerrain();
    terrain[9]![10] = "forest";
    terrain[9]![11] = "ice";
    terrain[10]![10] = "ice";
    terrain[10]![11] = "ice";
    const game = runningGame({
      player: playerFixture({ col: 10, row: 10 }),
      terrain,
    });
    const moved = moveBattleCityPlayer(game, "up");
    const slid = advanceBattleCityGame(moved, () => 0.99);

    expect(moved.player).toMatchObject({
      iceSlideDirection: "up",
      iceSlideStepsRemaining: BATTLE_CITY_ICE_SLIDE_STEPS,
      row: 9.875,
    });
    expect(slid.player.row).toBe(9.75);
    expect(game.player.row).toBe(10);
  });

  it("stops an unsteered ice coast after 28 one-pixel movement steps", () => {
    const terrain = Array.from({ length: BATTLE_CITY_BOARD_SIZE }, () =>
      Array<BattleCityTerrain>(BATTLE_CITY_BOARD_SIZE).fill("ice"),
    );
    let game = runningGame({
      player: playerFixture({
        iceSlideDirection: "up",
        iceSlideStepsRemaining: BATTLE_CITY_ICE_SLIDE_STEPS,
      }),
      terrain,
    });

    for (let frame = 0; frame < 37; frame += 1) {
      game = advanceBattleCityGame(game, () => 0.99);
    }

    expect(game.player).toMatchObject({
      iceSlideDirection: null,
      iceSlideStepsRemaining: 0,
      row: 16.5,
    });

    const stoppedRow = game.player.row;
    for (let frame = 0; frame < 20; frame += 1) {
      game = advanceBattleCityGame(game, () => 0.99);
    }
    expect(game.player.row).toBe(stoppedRow);
  });

  it.each(["brick", "steel", "water", "headquarters"] as const)(
    "blocks player movement through %s",
    (terrainType) => {
      const terrain = emptyTerrain();
      terrain[9]![10] = terrainType;
      const game = runningGame({
        player: playerFixture({ col: 10, direction: "right", row: 10 }),
        terrain,
      });
      const moved = moveBattleCityPlayer(game, "up");

      expect(moved.player).toMatchObject({ col: 10, direction: "up", row: 10 });
    },
  );

  it("blocks board edges and other tank bodies", () => {
    const edge = runningGame({ player: playerFixture({ col: 0, row: 0 }) });
    const occupied = runningGame({
      enemies: [enemyFixture({ col: 10, row: 8 })],
      player: playerFixture({ col: 10, row: 10 }),
    });

    expect(moveBattleCityPlayer(edge, "up")).toBe(edge);
    expect(moveBattleCityPlayer(occupied, "up").player.row).toBe(10);
    expect(moveBattleCityPlayer(pauseBattleCityGame(edge), "down").status).toBe(
      "paused",
    );
  });

  it("limits the default player to one shell and tier two to two shells", () => {
    const game = runningGame();
    const fired = fireBattleCityPlayer(game);
    const blocked = fireBattleCityPlayer(fired);
    const upgraded = fireBattleCityPlayer({
      ...fired,
      player: { ...fired.player, powerTier: 2 },
    });

    expect(fired.bullets).toHaveLength(1);
    expect(fired.bullets[0]).toMatchObject({
      canDestroySteel: false,
      owner: "player",
      slot: 0,
      speed: 0.25,
      strength: 1,
    });
    expect(blocked).toBe(fired);
    expect(upgraded.bullets).toHaveLength(2);
    expect(upgraded.bullets).toMatchObject([
      { id: "bullet-0", slot: 8, speed: 0.25 },
      { id: "bullet-1", slot: 0, speed: 0.5 },
    ]);
    expect(fireBattleCityPlayer(pauseBattleCityGame(game))).toEqual(
      pauseBattleCityGame(game),
    );
  });

  it("reuses the primary slot while a migrated secondary shell remains", () => {
    const game = runningGame({
      bullets: [bulletFixture({ id: "secondary", slot: 8 })],
    });
    const fired = fireBattleCityPlayer(game);

    expect(fired.bullets).toMatchObject([
      { id: "secondary", slot: 8 },
      { id: "bullet-0", slot: 0 },
    ]);
  });

  it.each([
    ["up", 10.375, 11.625],
    ["right", 11.375, 12.625],
    ["down", 12.375, 11.625],
    ["left", 11.375, 10.625],
  ] as const)(
    "fires %s from the center of the tank's leading edge",
    (direction, expectedRow, expectedCol) => {
      const game = runningGame({
        player: playerFixture({
          col: 10.625,
          direction,
          row: 10.375,
        }),
      });

      expect(fireBattleCityPlayer(game).bullets[0]).toMatchObject({
        col: expectedCol,
        row: expectedRow,
      });
    },
  );

  it("collision-checks a newborn shell at its muzzle before moving it", () => {
    const fired = fireBattleCityPlayer(
      runningGame({
        player: playerFixture({ col: 10, direction: "up", row: 10 }),
      }),
    );
    const birthFrame = advanceBattleCityGame(fired, () => 0.99);
    const nextFrame = advanceBattleCityGame(birthFrame, () => 0.99);

    expect(fired.bullets[0]).toMatchObject({
      col: 11,
      isNewborn: true,
      row: 10,
    });
    expect(birthFrame.bullets[0]).toMatchObject({
      col: 11,
      isNewborn: false,
      row: 10,
    });
    expect(nextFrame.bullets[0]?.row).toBe(9.75);
  });

  it.each([
    ["up", 0, 10, 0, 11],
    ["right", 10, 24, 11, 26],
    ["down", 24, 10, 26, 11],
    ["left", 10, 0, 11, 0],
  ] as const)(
    "fires %s outward from a tank touching the board edge",
    (direction, row, col, expectedRow, expectedCol) => {
      const game = runningGame({
        player: playerFixture({ col, direction, row }),
      });

      expect(fireBattleCityPlayer(game).bullets[0]).toMatchObject({
        col: expectedCol,
        direction,
        row: expectedRow,
      });
    },
  );

  it("marks maximum-tier shells as strong and steel-destroying", () => {
    const game = runningGame({
      player: playerFixture({ powerTier: 3 }),
    });
    expect(fireBattleCityPlayer(game).bullets[0]).toMatchObject({
      canDestroySteel: true,
      speed: 0.5,
      strength: 2,
    });
  });
});

describe("Battle City spawning and enemy activity", () => {
  it("spawns ordered enemies with carrier orders 4, 11, and 18", () => {
    for (const spawnedEnemyCount of [0, 3, 10, 17]) {
      const advanced = advanceBattleCityGame(
        runningGame({
          enemySpawnCooldownTicks: 0,
          spawnedEnemyCount,
        }),
        () => 0.99,
      );
      const enemy = advanced.enemies[0]!;
      expect(enemy.spawnOrder).toBe(spawnedEnemyCount + 1);
      expect(enemy.isCarrier).toBe([3, 10, 17].includes(spawnedEnemyCount));
      expect(enemy.spawnTicks).toBe(BATTLE_CITY_ENEMY_SPAWN_TICKS);
    }
  });

  it("removes an uncollected power-up when the next carrier spawns", () => {
    const game = runningGame({
      activePowerUp: {
        col: 0,
        id: "old-power-up",
        row: 0,
        type: "helmet",
      },
      enemySpawnCooldownTicks: 0,
      spawnedEnemyCount: 3,
    });
    const advanced = advanceBattleCityGame(game, () => 0.99);

    expect(advanced.enemies[0]?.isCarrier).toBe(true);
    expect(advanced.activePowerUp).toBeNull();
  });

  it("uses the ROM reinforcement cadence and Stage 35 enemy mix on stages 36-70", () => {
    const stageOne = advanceBattleCityGame(
      runningGame({ enemySpawnCooldownTicks: 0, stage: 1 }),
      () => 0.99,
    );
    const stageThirtyFive = advanceBattleCityGame(
      runningGame({ enemySpawnCooldownTicks: 0, stage: 35 }),
      () => 0.99,
    );
    const repeat = advanceBattleCityGame(
      runningGame({ cycle: 2, enemySpawnCooldownTicks: 0, stage: 1 }),
      () => 0.99,
    );

    expect(stageOne.enemySpawnCooldownTicks).toBeGreaterThan(
      stageThirtyFive.enemySpawnCooldownTicks,
    );
    expect(stageOne.enemySpawnCooldownTicks).toBe(187);
    expect(stageThirtyFive.enemySpawnCooldownTicks).toBe(51);
    expect(repeat.enemySpawnCooldownTicks).toBe(51);
    expect(repeat.enemies[0]?.type).toBe("power");
  });

  it("keeps at most four enemy slots and does not reroute the canonical spawn lane", () => {
    const enemies = Array.from({ length: BATTLE_CITY_MAX_ACTIVE_ENEMIES }, (_, index) =>
      enemyFixture({ col: index * 3, id: `enemy-${index}`, row: 4 }),
    );
    const full = advanceBattleCityGame(
      runningGame({ enemySpawnCooldownTicks: 0, enemies }),
      () => 0.99,
    );
    const occupiedSpawn = advanceBattleCityGame(
      runningGame({
        enemySpawnCooldownTicks: 0,
        enemies: [enemyFixture({ col: 12, id: "middle", row: 0 })],
      }),
      () => 0.99,
    );

    expect(full.enemies).toHaveLength(4);
    expect(occupiedSpawn.spawnedEnemyCount).toBe(1);
    expect(occupiedSpawn.enemies[1]).toMatchObject({ col: 12, row: 0 });
  });

  it("spawns enemies center, right, then left", () => {
    const spawnCols: number[] = [];

    for (const spawnedEnemyCount of [0, 1, 2]) {
      const advanced = advanceBattleCityGame(
        runningGame({ enemySpawnCooldownTicks: 0, spawnedEnemyCount }),
        () => 0.99,
      );
      spawnCols.push(advanced.enemies[0]!.col);
    }

    expect(spawnCols).toEqual([12, 24, 0]);
  });

  it.each([
    [0, 37],
    [2, 38],
  ] as const)(
    "runs the 28-update player spawn from tick %i in %i video frames",
    (startingTick, expectedFrames) => {
      let game = runningGame({
        player: playerFixture({
          phase: "spawning",
          phaseTicks: BATTLE_CITY_PLAYER_SPAWN_TICKS,
        }),
        tick: startingTick,
      });
      let frames = 0;

      while (game.player.phase === "spawning" && frames < 50) {
        game = advanceBattleCityGame(game, () => 0.99);
        frames += 1;
      }

      expect(frames).toBe(expectedFrames);
      expect(game.player.phase).toBe("active");
    },
  );

  it.each([
    [5, 55],
    [4, 56],
  ] as const)(
    "runs the 28-update enemy spawn for slot %i in %i video frames",
    (slot, expectedFrames) => {
      let game = runningGame({
        enemies: [
          enemyFixture({
            slot,
            spawnTicks: BATTLE_CITY_ENEMY_SPAWN_TICKS,
          }),
        ],
        spawnedEnemyCount: 20,
      });
      let frames = 0;

      while (game.enemies[0]?.spawnTicks !== 0 && frames < 70) {
        game = advanceBattleCityGame(game, () => 0.99);
        frames += 1;
      }

      expect(frames).toBe(expectedFrames);
      expect(game.enemies[0]?.spawnTicks).toBe(0);
    },
  );

  it("runs enemy tank handlers before player spawn activation", () => {
    const advanced = advanceBattleCityGame(
      runningGame({
        enemies: [
          enemyFixture({
            col: 8,
            direction: "down",
            row: 22,
            slot: 5,
          }),
        ],
        player: playerFixture({
          col: 8,
          phase: "spawning",
          phaseTicks: 1,
          row: 24,
        }),
        spawnedEnemyCount: 20,
        tick: 0,
      }),
      () => 0.99,
    );

    expect(advanced.enemies[0]?.row).toBe(22.125);
    expect(advanced.player.phase).toBe("active");
  });

  it("fills and reuses the original enemy object slots from five down to two", () => {
    let game = runningGame({ enemySpawnCooldownTicks: 0 });
    for (let index = 0; index < BATTLE_CITY_MAX_ACTIVE_ENEMIES; index += 1) {
      game = advanceBattleCityGame(
        { ...game, enemySpawnCooldownTicks: 0 },
        () => 0.99,
      );
    }

    expect(game.enemies.map(({ slot }) => slot)).toEqual([5, 4, 3, 2]);

    game = advanceBattleCityGame(
      {
        ...game,
        enemies: game.enemies.filter(({ slot }) => slot !== 4),
        enemySpawnCooldownTicks: 0,
      },
      () => 0.99,
    );
    expect(game.enemies.map(({ slot }) => slot)).toEqual([5, 4, 3, 2]);
  });

  it("moves an enemy while keeping its newborn shell at the muzzle", () => {
    const enemy = enemyFixture({
      col: 5,
      row: 5,
    });
    const values = [0.99, 0];
    const advanced = advanceBattleCityGame(
      runningGame({ enemies: [enemy], spawnedEnemyCount: 20 }),
      () => values.shift() ?? 0.99,
    );

    expect(advanced.enemies[0]).toMatchObject({ col: 5, row: 5.125 });
    expect(advanced.bullets[0]).toMatchObject({
      col: 6,
      direction: "down",
      isNewborn: false,
      owner: "enemy",
      row: 7.125,
      slot: 5,
    });
  });

  it("keeps an enemy shell attached to its object slot when the tank is replaced", () => {
    const existingShell = bulletFixture({
      id: "old-slot-shell",
      owner: "enemy",
      slot: 5,
    });
    const advanced = advanceBattleCityGame(
      runningGame({
        bullets: [existingShell],
        enemies: [enemyFixture({ id: "replacement", slot: 5 })],
        spawnedEnemyCount: 20,
      }),
      () => 0,
    );

    expect(advanced.bullets).toHaveLength(1);
    expect(advanced.bullets[0]).toMatchObject({ id: "old-slot-shell" });
  });

  it("alternates slow-enemy movement by object slot while fast enemies move every frame", () => {
    const oddSlotBasic = enemyFixture({
      col: 5,
      direction: "down",
      id: "odd-slot-basic",
      row: 5,
      slot: 5,
      type: "basic",
    });
    const evenSlotBasic = enemyFixture({
      col: 8,
      direction: "down",
      id: "even-slot-basic",
      row: 5,
      slot: 4,
      type: "basic",
    });
    const fast = enemyFixture({
      col: 12,
      direction: "down",
      id: "fast",
      moveIntervalTicks: 1,
      row: 5,
      slot: 3,
      type: "fast",
    });
    const firstFrame = advanceBattleCityGame(
      runningGame({
        enemies: [oddSlotBasic, evenSlotBasic, fast],
        spawnedEnemyCount: 20,
      }),
      () => 0.99,
    );
    const secondFrame = advanceBattleCityGame(firstFrame, () => 0.99);

    expect(firstFrame.enemies.map(({ row }) => row)).toEqual([
      5.125,
      5,
      5.125,
    ]);
    expect(secondFrame.enemies.map(({ row }) => row)).toEqual([
      5.125,
      5.125,
      5.25,
    ]);
  });

  it("uses grid-aligned random steering early in a stage", () => {
    const values = [0, 0.3, 0.99];
    const advanced = advanceBattleCityGame(
      runningGame({
        enemies: [enemyFixture({ col: 10, row: 10 })],
        spawnedEnemyCount: 20,
      }),
      () => values.shift() ?? 0.99,
    );

    expect(advanced.enemies[0]).toMatchObject({
      col: 10,
      direction: "left",
      row: 10,
    });
  });

  it("changes AI phases on the ROM's next 64-frame counter boundary", () => {
    const earlyValues = [0, 0.75, 0.99];
    const early = advanceBattleCityGame(
      runningGame({
        enemies: [enemyFixture({ col: 10, row: 10 })],
        player: playerFixture({ col: 5, row: 5 }),
        spawnedEnemyCount: 20,
        stageBattleTicks: 1_535,
      }),
      () => earlyValues.shift() ?? 0.99,
    );
    const middleValues = [0, 0.75, 0.99];
    const middle = advanceBattleCityGame(
      runningGame({
        enemies: [enemyFixture({ col: 10, row: 10 })],
        player: playerFixture({ col: 5, row: 5 }),
        spawnedEnemyCount: 20,
        stageBattleTicks: 1_536,
      }),
      () => middleValues.shift() ?? 0.99,
    );
    const beforeHeadquartersValues = [0, 0.2, 0.99];
    const beforeHeadquarters = advanceBattleCityGame(
      runningGame({
        enemies: [enemyFixture({ col: 10, row: 10 })],
        player: playerFixture({ col: 5, row: 5 }),
        spawnedEnemyCount: 20,
        stageBattleTicks: 3_007,
      }),
      () => beforeHeadquartersValues.shift() ?? 0.99,
    );
    const lateValues = [0, 0.2, 0.99];
    const late = advanceBattleCityGame(
      runningGame({
        enemies: [enemyFixture({ col: 10, row: 10 })],
        player: playerFixture({ col: 5, row: 5 }),
        spawnedEnemyCount: 20,
        stageBattleTicks: 3_008,
      }),
      () => lateValues.shift() ?? 0.99,
    );

    expect(early.enemies[0]).toMatchObject({ direction: "right" });
    expect(middle.enemies[0]).toMatchObject({ direction: "left" });
    expect(beforeHeadquarters.enemies[0]).toMatchObject({ direction: "up" });
    expect(late.enemies[0]).toMatchObject({ direction: "down" });
  });

  it.each(["exploding", "spawning"] as const)(
    "keeps targeting the player while their tank is %s",
    (phase) => {
      const values = [0, 0.75, 0.99];
      const advanced = advanceBattleCityGame(
        runningGame({
          enemies: [enemyFixture({ col: 10, row: 10 })],
          player: playerFixture({
            col: 5,
            phase,
            phaseTicks: 10,
            row: 5,
          }),
          spawnedEnemyCount: 20,
          stageBattleTicks: 1_536,
        }),
        () => values.shift() ?? 0.99,
      );

      expect(advanced.enemies[0]).toMatchObject({ direction: "left" });
    },
  );

  it("uses the original two-opportunity pause on the common blocked path", () => {
    const terrain = emptyTerrain();
    terrain[12]![10] = "brick";
    terrain[12]![11] = "brick";
    const values = [0.99, 0.3, 0.99];
    const advanced = advanceBattleCityGame(
      runningGame({
        enemies: [enemyFixture({ col: 10, row: 10 })],
        spawnedEnemyCount: 20,
        terrain,
      }),
      () => values.shift() ?? 0.99,
    );

    expect(advanced.enemies[0]).toMatchObject({
      col: 10,
      direction: "down",
      movementPauseSteps: 2,
      row: 10,
    });
  });

  it("reverses and queues a turn on the one-in-four aligned blocked path", () => {
    const terrain = emptyTerrain();
    terrain[12]![10] = "brick";
    terrain[12]![11] = "brick";
    const values = [0.99, 0, 0.99];
    const advanced = advanceBattleCityGame(
      runningGame({
        enemies: [enemyFixture({ col: 10, row: 10 })],
        spawnedEnemyCount: 20,
        terrain,
      }),
      () => values.shift() ?? 0.99,
    );

    expect(advanced.enemies[0]).toMatchObject({
      col: 10,
      direction: "up",
      movementTurnPending: true,
      row: 10,
    });
  });

  it.each([
    ["basic", 0.25],
    ["fast", 0.25],
    ["power", 0.5],
    ["armor", 0.25],
  ] as const)("uses the %s tank's projectile speed tier", (type, speed) => {
    const enemy = enemyFixture({
      type,
    });
    const advanced = advanceBattleCityGame(
      runningGame({ enemies: [enemy], spawnedEnemyCount: 20 }),
      () => 0,
    );

    expect(advanced.bullets[0]).toMatchObject({ owner: "enemy", speed });
  });

  it("gives every active enemy the same one-in-32 fire attempt each frame", () => {
    const basic = advanceBattleCityGame(
      runningGame({
        enemies: [
          enemyFixture({
            type: "basic",
          }),
        ],
        spawnedEnemyCount: 20,
      }),
      () => 0.02,
    );
    const power = advanceBattleCityGame(
      runningGame({
        enemies: [
          enemyFixture({
            type: "power",
          }),
        ],
        spawnedEnemyCount: 20,
      }),
      () => 0.02,
    );

    expect(basic.bullets).toHaveLength(1);
    expect(power.bullets).toHaveLength(1);
  });

  it("runs all enemy movement decisions before enemy fire attempts", () => {
    const values = [0.99, 0, 0.75, 0.99, 0.99];
    const advanced = advanceBattleCityGame(
      runningGame({
        enemies: [
          enemyFixture({
            col: 4,
            id: "fast-one",
            moveIntervalTicks: 1,
            slot: 5,
            type: "fast",
          }),
          enemyFixture({
            col: 16,
            id: "fast-two",
            moveIntervalTicks: 1,
            slot: 4,
            type: "fast",
          }),
        ],
        spawnedEnemyCount: 20,
      }),
      () => values.shift() ?? 0.99,
    );

    expect(advanced.enemies[1]?.direction).toBe("right");
    expect(advanced.bullets).toEqual([]);
  });

  it("still consumes an enemy fire roll while that object slot owns a shell", () => {
    let randomCalls = 0;
    const advanced = advanceBattleCityGame(
      runningGame({
        bullets: [
          bulletFixture({
            id: "existing-enemy-shell",
            owner: "enemy",
            slot: 5,
          }),
        ],
        enemies: [
          enemyFixture({
            moveIntervalTicks: 1,
            type: "fast",
          }),
        ],
        spawnedEnemyCount: 20,
      }),
      () => {
        randomCalls += 1;
        return 0.99;
      },
    );

    expect(randomCalls).toBe(2);
    expect(advanced.bullets).toHaveLength(1);
  });

  it("freezes active enemy movement and firing while spawn cadence continues", () => {
    const enemy = enemyFixture();
    const advanced = advanceBattleCityGame(
      runningGame({
        enemies: [enemy],
        enemySpawnCooldownTicks: 0,
        freezeTicks: 2,
      }),
      () => 0,
    );

    expect(advanced.freezeTicks).toBe(1);
    expect(advanced.enemies[0]).toEqual(enemy);
    expect(advanced.bullets).toEqual([]);
    expect(advanced.spawnedEnemyCount).toBe(1);
    expect(advanced.enemies[1]).toMatchObject({ col: 12, spawnOrder: 1 });
  });
});

describe("Battle City projectile collisions", () => {
  it.each([
    ["up", 9, 11, 0b0011],
    ["right", 11, 12, 0b1010],
    ["down", 12, 11, 0b1100],
    ["left", 11, 9, 0b0101],
  ] as const)(
    "carves the centered four-fragment brick strip when firing %s",
    (direction, targetRow, targetCol, expectedMask) => {
      const terrain = emptyTerrain();
      terrain[targetRow]![targetCol] = "brick";
      const fired = fireBattleCityPlayer(
        runningGame({
          player: playerFixture({ col: 10, direction, row: 10 }),
          terrain,
          tick: 1,
        }),
      );

      const advanced = advanceBattleCityGame(fired, () => 0.99);

      expect(advanced.terrain[targetRow]?.[targetCol]).toBe("brick");
      expect(advanced.terrainFragments[targetRow]?.[targetCol]).toBe(expectedMask);
      expect(advanced.bullets).toEqual([
        expect.objectContaining({ impactTicks: BATTLE_CITY_BULLET_IMPACT_TICKS }),
      ]);
    },
  );

  it("carves a four-fragment face while a maximum shell clears both face cells", () => {
    const terrain = emptyTerrain();
    terrain[9]![10] = "brick";
    terrain[10]![10] = "brick";
    terrain[10]![11] = "brick";
    const ordinary = advanceBattleCityGame(
      runningGame({ bullets: [bulletFixture()], terrain, tick: 1 }),
      () => 0.99,
    );
    const strong = advanceBattleCityGame(
      runningGame({
        bullets: [bulletFixture({ canDestroySteel: true, strength: 2 })],
        terrain,
      }),
      () => 0.99,
    );

    expect(ordinary.terrain[9]?.[10]).toBe("brick");
    expect(ordinary.terrain[10]?.slice(10, 12)).toEqual(["brick", "brick"]);
    expect(ordinary.terrainFragments[9]?.[10]).toBe(0b1010);
    expect(ordinary.terrainFragments[10]?.[10]).toBe(
      0b1010,
    );
    expect(strong.terrain[9]?.[10]).toBe("empty");
    expect(strong.terrain[10]?.slice(10, 12)).toEqual(["empty", "brick"]);
    expect(strong.terrainFragments[9]?.[10]).toBe(0);
    expect(strong.terrainFragments[10]?.slice(10, 12)).toEqual([
      0,
      BATTLE_CITY_FULL_TERRAIN_FRAGMENT_MASK,
    ]);
    expect(terrain[9]?.[10]).toBe("brick");
    expect(terrain[10]?.slice(10, 12)).toEqual(["brick", "brick"]);
  });

  it("holds a firing slot through the nine-frame shell impact lifecycle", () => {
    const terrain = emptyTerrain();
    terrain[10]![10] = "brick";
    let game = advanceBattleCityGame(
      runningGame({ bullets: [bulletFixture()], terrain, tick: 1 }),
      () => 0.99,
    );

    expect(game.bullets).toEqual([
      expect.objectContaining({
        id: "bullet-test",
        impactTicks: BATTLE_CITY_BULLET_IMPACT_TICKS,
      }),
    ]);
    expect(fireBattleCityPlayer(game)).toBe(game);

    for (let frame = 0; frame < BATTLE_CITY_BULLET_IMPACT_TICKS - 1; frame += 1) {
      game = advanceBattleCityGame(game, () => 0.99);
    }
    expect(game.bullets[0]).toMatchObject({ impactTicks: 1 });

    game = advanceBattleCityGame(game, () => 0.99);
    expect(game.bullets).toEqual([]);
    expect(fireBattleCityPlayer(game).bullets).toHaveLength(1);
  });

  it("lets tanks pass through cleared wall fragments while intact quadrants still block", () => {
    const terrain = emptyTerrain();
    terrain[9]![10] = "brick";
    const terrainFragments = createBattleCityTerrainFragmentGrid(terrain);
    terrainFragments[9]![10] =
      BATTLE_CITY_TERRAIN_FRAGMENT_BITS["top-left"] |
      BATTLE_CITY_TERRAIN_FRAGMENT_BITS["top-right"];
    const game = runningGame({
      player: playerFixture({ col: 10, row: 10 }),
      terrain,
      terrainFragments,
    });

    expect(moveBattleCityPlayer(game, "up").player.row).toBe(9.875);
  });

  it("only lets maximum-tier player shells destroy steel", () => {
    const terrain = emptyTerrain();
    terrain[10]![10] = "steel";
    const blocked = advanceBattleCityGame(
      runningGame({ bullets: [bulletFixture()], terrain, tick: 1 }),
      () => 0.99,
    );
    const destroyed = advanceBattleCityGame(
      runningGame({
        bullets: [bulletFixture({ canDestroySteel: true, strength: 2 })],
        terrain,
      }),
      () => 0.99,
    );

    expect(blocked.terrain[10]?.[10]).toBe("steel");
    expect(destroyed.terrain[10]?.[10]).toBe("empty");
    expect(destroyed.terrainFragments[10]?.[10]).toBe(0);
  });

  it("keeps play active for the 39-frame headquarters explosion before game over", () => {
    for (const owner of ["player", "enemy"] as const) {
      const terrain = emptyTerrain();
      terrain[10]![10] = "headquarters";
      const slot = owner === "player" ? 0 : 5;
      const tick = owner === "player" ? 1 : 0;
      let advanced = advanceBattleCityGame(
        runningGame({
          bullets: [bulletFixture({ owner, slot })],
          terrain,
          tick,
        }),
        () => 0.99,
      );
      expect(advanced).toMatchObject({
        baseAlive: false,
        baseExplosionTicks: BATTLE_CITY_HEADQUARTERS_EXPLOSION_TICKS,
        stageOutcome: "lost",
        stageTransitionTicks: 0,
        status: "running",
      });

      for (
        let frame = 0;
        frame < BATTLE_CITY_HEADQUARTERS_EXPLOSION_TICKS - 1;
        frame += 1
      ) {
        advanced = advanceBattleCityGame(advanced, () => 0.99);
      }
      expect(advanced).toMatchObject({
        baseExplosionTicks: 1,
        status: "running",
      });

      advanced = advanceBattleCityGame(advanced, () => 0.99);
      expect(advanced).toMatchObject({
        baseExplosionTicks: 0,
        stageTransitionTicks: BATTLE_CITY_GAME_OVER_TRANSITION_TICKS,
        status: "game-over",
      });
    }
  });

  it("resolves a headquarters impact before overlapping shells cancel", () => {
    const terrain = emptyTerrain();
    terrain[10]![10] = "headquarters";
    const advanced = advanceBattleCityGame(
      runningGame({
        bullets: [
          bulletFixture({
            col: 10,
            id: "player",
            isNewborn: true,
            slot: 0,
            speed: 0.5,
          }),
          bulletFixture({
            col: 10.25,
            direction: "left",
            id: "enemy",
            isNewborn: true,
            owner: "enemy",
            slot: 5,
            speed: 0.5,
          }),
        ],
        terrain,
      }),
      () => 0.99,
    );

    expect(advanced.baseAlive).toBe(false);
    expect(advanced.baseExplosionTicks).toBe(
      BATTLE_CITY_HEADQUARTERS_EXPLOSION_TICKS,
    );
    expect(advanced.bullets).toEqual([
      expect.objectContaining({
        id: "enemy",
        impactTicks: BATTLE_CITY_BULLET_IMPACT_TICKS,
      }),
      expect.objectContaining({
        id: "player",
        impactTicks: BATTLE_CITY_BULLET_IMPACT_TICKS,
      }),
    ]);
  });

  it("moves shells their full frame distance before collision passes", () => {
    const terrain = emptyTerrain();
    terrain[10]![10] = "brick";
    const advanced = advanceBattleCityGame(
      runningGame({
        bullets: [
          bulletFixture({ col: 9.5, id: "player", slot: 0, speed: 0.5 }),
          bulletFixture({
            col: 9.5,
            id: "enemy",
            owner: "enemy",
            slot: 5,
            speed: 0.5,
          }),
        ],
        terrain,
      }),
      () => 0.99,
    );

    expect(advanced.terrainFragments[10]?.[10]).toBe(0b1010);
    expect(advanced.bullets).toEqual([
      expect.objectContaining({
        id: "enemy",
        impactTicks: BATTLE_CITY_BULLET_IMPACT_TICKS,
        slot: 5,
      }),
      expect.objectContaining({
        col: 10,
        id: "player",
        impactTicks: 0,
        slot: 0,
      }),
    ]);
  });

  it("resolves simultaneous terrain impacts by slot regardless of array order", () => {
    const player = bulletFixture({
      col: 10,
      id: "player",
      isNewborn: true,
      slot: 0,
      speed: 0.5,
    });
    const enemy = bulletFixture({
      col: 10,
      id: "enemy",
      isNewborn: true,
      owner: "enemy",
      slot: 5,
      speed: 0.5,
    });
    const resolve = (bullets: BattleCityBullet[]) => {
      const terrain = emptyTerrain();
      terrain[10]![10] = "brick";
      return advanceBattleCityGame(
        runningGame({ bullets, terrain }),
        () => 0.99,
      );
    };

    for (const advanced of [resolve([player, enemy]), resolve([enemy, player])]) {
      expect(advanced.terrainFragments[10]?.[10]).toBe(0b1010);
      expect(advanced.bullets).toEqual([
        expect.objectContaining({
          id: "enemy",
          impactTicks: BATTLE_CITY_BULLET_IMPACT_TICKS,
          slot: 5,
        }),
        expect.objectContaining({
          id: "player",
          impactTicks: 0,
          slot: 0,
        }),
      ]);
    }
  });

  it("gates ordinary terrain probes by slot parity while fast shells always probe", () => {
    const resolve = (
      bullet: BattleCityBullet,
      tick: number,
    ): BattleCityGameState => {
      const terrain = emptyTerrain();
      terrain[10]![10] = "brick";
      return advanceBattleCityGame(
        runningGame({ bullets: [bullet], terrain, tick }),
        () => 0.99,
      );
    };
    const playerOrdinary = bulletFixture({ col: 9.75, slot: 0 });
    const enemyOrdinary = bulletFixture({
      col: 9.75,
      owner: "enemy",
      slot: 5,
    });
    const playerFast = bulletFixture({ col: 9.5, slot: 0, speed: 0.5 });

    const skippedPlayer = resolve(playerOrdinary, 0);
    const probingPlayer = resolve(playerOrdinary, 1);
    const probingEnemy = resolve(enemyOrdinary, 0);
    const skippedEnemy = resolve(enemyOrdinary, 1);
    const probingFast = resolve(playerFast, 0);

    expect(skippedPlayer.terrainFragments[10]?.[10]).toBe(0b1111);
    expect(skippedPlayer.bullets[0]).toMatchObject({ col: 10, impactTicks: 0 });
    expect(probingPlayer.terrainFragments[10]?.[10]).toBe(0b1010);
    expect(probingEnemy.terrainFragments[10]?.[10]).toBe(0b1010);
    expect(skippedEnemy.terrainFragments[10]?.[10]).toBe(0b1111);
    expect(probingFast.terrainFragments[10]?.[10]).toBe(0b1010);
  });

  it("checks shell and tank collisions only after each full-frame move", () => {
    const separatingShells = advanceBattleCityGame(
      runningGame({
        bullets: [
          bulletFixture({
            col: 10,
            direction: "left",
            id: "player",
            slot: 0,
            speed: 0.5,
          }),
          bulletFixture({
            col: 10.125,
            direction: "right",
            id: "enemy",
            owner: "enemy",
            slot: 5,
            speed: 0.5,
          }),
        ],
      }),
      () => 0.99,
    );
    const passingTank = advanceBattleCityGame(
      runningGame({
        bullets: [
          bulletFixture({
            col: 12,
            direction: "right",
            row: 11,
            slot: 0,
            speed: 0.5,
          }),
        ],
        enemies: [enemyFixture({ col: 10, row: 10 })],
        freezeTicks: 2,
        spawnedEnemyCount: 20,
      }),
      () => 0.99,
    );

    expect(separatingShells.bullets).toMatchObject([
      { col: 10.625, id: "enemy", slot: 5 },
      { col: 9.5, id: "player", slot: 0 },
    ]);
    expect(passingTank.enemies[0]).toMatchObject({ hitPoints: 1 });
    expect(passingTank.bullets[0]).toMatchObject({ col: 12.5, impactTicks: 0 });
  });

  it("resolves every wall and headquarters probe across one impact face", () => {
    const terrain = emptyTerrain();
    terrain[9]![10] = "brick";
    terrain[10]![10] = "headquarters";
    const advanced = advanceBattleCityGame(
      runningGame({ bullets: [bulletFixture()], terrain, tick: 1 }),
      () => 0.99,
    );

    expect(advanced.terrainFragments[9]?.[10]).toBe(0b1010);
    expect(advanced.baseAlive).toBe(false);
    expect(advanced.bullets[0]).toMatchObject({
      impactTicks: BATTLE_CITY_BULLET_IMPACT_TICKS,
    });
  });

  it("cancels opposing shells in the same cell and when they cross", () => {
    const sameCell = advanceBattleCityGame(
      runningGame({
        bullets: [
          bulletFixture({ col: 9.75, id: "player" }),
          bulletFixture({
            col: 10.25,
            direction: "left",
            id: "enemy",
            owner: "enemy",
          }),
        ],
      }),
      () => 0.99,
    );
    const crossed = advanceBattleCityGame(
      runningGame({
        bullets: [
          bulletFixture({ col: 9.95, id: "player" }),
          bulletFixture({
            col: 10.05,
            direction: "left",
            id: "enemy",
            owner: "enemy",
          }),
        ],
      }),
      () => 0.99,
    );

    expect(sameCell.bullets).toEqual([]);
    expect(crossed.bullets).toEqual([]);
  });

  it("uses player-shell slot precedence for overlapping collision clusters", () => {
    const makeStationary = (
      id: string,
      slot: number,
      owner: "player" | "enemy",
    ) =>
      bulletFixture({
        col: 10,
        id,
        isNewborn: true,
        owner,
        row: 10,
        slot,
      });
    const twoPlayerShells = advanceBattleCityGame(
      runningGame({
        bullets: [
          makeStationary("player-secondary", 8, "player"),
          makeStationary("enemy", 5, "enemy"),
          makeStationary("player-primary", 0, "player"),
        ],
      }),
      () => 0.99,
    );
    const twoEnemyShells = advanceBattleCityGame(
      runningGame({
        bullets: [
          makeStationary("enemy-high", 5, "enemy"),
          makeStationary("enemy-low", 4, "enemy"),
          makeStationary("player", 0, "player"),
        ],
      }),
      () => 0.99,
    );

    expect(twoPlayerShells.bullets).toEqual([
      expect.objectContaining({ id: "player-primary", slot: 0 }),
    ]);
    expect(twoEnemyShells.bullets).toEqual([]);
  });

  it("cancels shells whose centers enter the original six-pixel envelope", () => {
    const near = advanceBattleCityGame(
      runningGame({
        bullets: [
          bulletFixture({ col: 10, id: "player", speed: 0.125 }),
          bulletFixture({
            col: 10.875,
            direction: "left",
            id: "enemy",
            owner: "enemy",
            row: 10.625,
            speed: 0.125,
          }),
        ],
      }),
      () => 0.99,
    );
    const boundary = advanceBattleCityGame(
      runningGame({
        bullets: [
          bulletFixture({ col: 10, id: "player", speed: 0.125 }),
          bulletFixture({
            col: 10.875,
            direction: "left",
            id: "enemy",
            owner: "enemy",
            row: 10.75,
            speed: 0.125,
          }),
        ],
      }),
      () => 0.99,
    );

    expect(near.bullets).toEqual([]);
    expect(boundary.bullets).toHaveLength(2);
  });

  it("does not run shell collision checks between enemy slots", () => {
    const advanced = advanceBattleCityGame(
      runningGame({
        bullets: [
          bulletFixture({
            col: 10,
            id: "slot-five",
            owner: "enemy",
            slot: 5,
            speed: 0.125,
          }),
          bulletFixture({
            col: 10.875,
            direction: "left",
            id: "slot-four",
            owner: "enemy",
            row: 10.625,
            slot: 4,
            speed: 0.125,
          }),
        ],
      }),
      () => 0.99,
    );

    expect(advanced.bullets).toHaveLength(2);
  });

  it("hits tank grazes inside ten pixels and misses at the boundary", () => {
    const enemy = enemyFixture({ col: 10, row: 10 });
    const graze = advanceBattleCityGame(
      runningGame({
        bullets: [
          bulletFixture({
            col: 12.25,
            direction: "left",
            row: 11,
            speed: 0.125,
          }),
        ],
        enemies: [enemy],
        freezeTicks: 2,
        spawnedEnemyCount: 20,
      }),
      () => 0.99,
    );
    const boundary = advanceBattleCityGame(
      runningGame({
        bullets: [
          bulletFixture({
            col: 12.375,
            direction: "left",
            row: 11,
            speed: 0.125,
          }),
        ],
        enemies: [enemy],
        freezeTicks: 2,
        spawnedEnemyCount: 20,
      }),
      () => 0.99,
    );

    expect(graze.enemies[0]).toMatchObject({ hitPoints: 0 });
    expect(boundary.enemies[0]).toMatchObject({ hitPoints: 1 });
  });

  it("damages armor, drops a 2x2-safe carrier power-up on first hit, then scores kills", () => {
    const armor = enemyFixture({
      hitPoints: 4,
      isCarrier: true,
      maxHitPoints: 4,
      score: 400,
      type: "armor",
    });
    const hit = advanceBattleCityGame(
      runningGame({
        bullets: [bulletFixture()],
        enemies: [armor],
        freezeTicks: 2,
        powerUpScorePopup: { col: 3, row: 4, ticks: 12 },
        spawnedEnemyCount: 20,
      }),
      () => 0.999,
    );

    expect(hit.enemies[0]).toMatchObject({
      hasDroppedPowerUp: true,
      hitPoints: 3,
    });
    expect(hit.activePowerUp).toMatchObject({ col: 21, row: 21, type: "star" });
    expect(hit.powerUpScorePopup).toBeNull();
    expect(hit.activePowerUp!.row + 1).toBeLessThan(26);
    expect(hit.activePowerUp!.col + 1).toBeLessThan(26);

    const killed = advanceBattleCityGame(
      runningGame({
        bullets: [bulletFixture()],
        enemies: [enemyFixture()],
        freezeTicks: 2,
        score: 19_900,
        spawnedEnemyCount: 20,
      }),
      () => 0.99,
    );
    expect(killed).toMatchObject({
      bonusLifeAwarded: true,
      destroyedEnemyCount: 0,
      lives: 4,
      score: 20_000,
    });
    expect(killed.enemies[0]).toMatchObject({
      destructionPoints: 100,
      explosionTicks: BATTLE_CITY_ENEMY_EXPLOSION_TICKS,
      hitPoints: 0,
    });
    expect(killed.stageKillCounts.basic).toBe(1);
  });

  it("keeps scoring but suppresses the threshold life after headquarters loss", () => {
    const defeatedByKill = advanceBattleCityGame(
      runningGame({
        baseAlive: false,
        baseExplosionTicks: 10,
        bullets: [bulletFixture()],
        enemies: [enemyFixture()],
        freezeTicks: 2,
        score: 19_900,
        spawnedEnemyCount: 20,
      }),
      () => 0.99,
    );
    const defeatedByPickup = advanceBattleCityGame(
      powerUpGame("star", {
        baseAlive: false,
        baseExplosionTicks: 10,
        score: 19_500,
      }),
      () => 0.99,
    );

    expect(defeatedByKill).toMatchObject({
      bonusLifeAwarded: false,
      lives: 3,
      score: 20_000,
    });
    expect(defeatedByPickup).toMatchObject({
      bonusLifeAwarded: false,
      lives: 3,
      score: 20_000,
    });
  });

  it("holds a destroyed enemy slot through its explosion before completing the stage", () => {
    const hit = advanceBattleCityGame(
      runningGame({
        bullets: [bulletFixture()],
        enemies: [enemyFixture()],
        freezeTicks: 2,
        spawnedEnemyCount: 1,
        totalEnemyCount: 1,
      }),
      () => 0.99,
    );
    const completed = advanceBattleCityGame(
      {
        ...hit,
        enemies: [{ ...hit.enemies[0]!, explosionTicks: 1 }],
        tick: 2,
      },
      () => 0.99,
    );

    expect(hit).toMatchObject({ destroyedEnemyCount: 0, status: "running" });
    expect(hit.enemies[0]?.explosionTicks).toBe(
      BATTLE_CITY_ENEMY_EXPLOSION_TICKS,
    );
    expect(completed).toMatchObject({
      destroyedEnemyCount: 1,
      stageOutcome: "cleared",
      stageTransitionTicks: BATTLE_CITY_STAGE_TRANSITION_TICKS,
      status: "stage-clear",
    });
    expect(completed.enemies).toEqual([]);
  });

  it("starts the result tail when the last enemy expires during the HQ explosion", () => {
    const completed = advanceBattleCityGame(
      runningGame({
        baseAlive: false,
        baseExplosionTicks: 10,
        destroyedEnemyCount: 19,
        enemies: [
          enemyFixture({
            explosionTicks: 1,
            hitPoints: 0,
            moveIntervalTicks: 1,
          }),
        ],
        spawnedEnemyCount: 20,
        totalEnemyCount: 20,
      }),
      () => 0.99,
    );

    expect(completed).toMatchObject({
      baseAlive: false,
      baseExplosionTicks: 9,
      destroyedEnemyCount: 20,
      stageOutcome: "lost",
      stageTransitionTicks: BATTLE_CITY_STAGE_TRANSITION_TICKS,
      status: "stage-clear",
    });
    expect(completed.enemies).toEqual([]);
  });

  it("plays the death explosion before consuming a life and spawning again", () => {
    const enemyShot = bulletFixture({
      col: 7.75,
      direction: "right",
      id: "fatal-shot",
      owner: "enemy",
      row: 20,
      slot: 5,
    });
    const otherShot = bulletFixture({
      col: 2,
      direction: "down",
      id: "other-shot",
      owner: "enemy",
      row: 2,
      slot: 4,
    });
    const hit = advanceBattleCityGame(
      runningGame({
        bullets: [enemyShot, otherShot],
        lives: 2,
        player: playerFixture({ powerTier: 3 }),
      }),
      () => 0.99,
    );
    const spawning = advanceBattleCityGame(
      {
        ...hit,
        player: { ...hit.player, phaseTicks: 1 },
      },
      () => 0.99,
    );
    const skippedSpawnFrame = advanceBattleCityGame(
      {
        ...spawning,
        player: { ...spawning.player, phaseTicks: 1 },
      },
      () => 0.99,
    );
    const active = advanceBattleCityGame(skippedSpawnFrame, () => 0.99);

    expect(hit).toMatchObject({ lives: 2, status: "running" });
    expect(hit.player).toMatchObject({
      phase: "exploding",
      phaseTicks: BATTLE_CITY_PLAYER_EXPLOSION_TICKS,
      powerTier: 0,
    });
    expect(hit.bullets).toEqual([
      expect.objectContaining({
        id: "fatal-shot",
        impactTicks: BATTLE_CITY_BULLET_IMPACT_TICKS,
      }),
      expect.objectContaining({ id: "other-shot", impactTicks: 0 }),
    ]);
    expect(spawning).toMatchObject({ lives: 1, status: "running" });
    expect(spawning.player).toMatchObject({
      col: 8,
      invulnerabilityTicks: 0,
      phase: "spawning",
      phaseTicks: BATTLE_CITY_PLAYER_SPAWN_TICKS,
      powerTier: 0,
      row: 24,
    });
    expect(active.player).toMatchObject({ phase: "active", phaseTicks: 0 });
    expect(active.player.invulnerabilityTicks).toBeGreaterThanOrEqual(128);
    expect(active.player.invulnerabilityTicks).toBeLessThanOrEqual(
      BATTLE_CITY_PLAYER_INVULNERABILITY_TICKS - 1,
    );
  });

  it.each([
    [0, 128],
    [1, 191],
  ] as const)(
    "starts respawn protection on clock phase %i with %i ticks",
    (tick, expectedShieldTicks) => {
      const active = advanceBattleCityGame(
        runningGame({
          player: playerFixture({
            phase: "spawning",
            phaseTicks: 1,
          }),
          tick,
        }),
        () => 0.99,
      );

      expect(active.player).toMatchObject({
        invulnerabilityTicks: expectedShieldTicks,
        phase: "active",
      });
    },
  );

  it.each([
    [1, 32],
    [2, 32],
    [3, 31],
    [4, 32],
  ] as const)(
    "runs the 24-update player explosion for %s-start timing in %s video frames",
    (startingTick, expectedFrames) => {
      let game = runningGame({
        player: playerFixture({
          phase: "exploding",
          phaseTicks: BATTLE_CITY_PLAYER_EXPLOSION_TICKS,
        }),
        tick: startingTick,
      });
      let frames = 0;

      while (game.player.phase === "exploding" && frames < 40) {
        game = advanceBattleCityGame(game, () => 0.99);
        frames += 1;
      }

      expect(frames).toBe(expectedFrames);
      expect(game.player.phase).toBe("spawning");
    },
  );

  it.each([
    ["fast", 1, 5, 24],
    ["slow odd slot", 2, 5, 47],
    ["slow even slot", 2, 4, 48],
  ] as const)(
    "runs a %s explosion on its object-slot cadence",
    (_label, moveIntervalTicks, slot, expectedFrames) => {
      let game = runningGame({
        enemies: [
          enemyFixture({
            explosionTicks: BATTLE_CITY_ENEMY_EXPLOSION_TICKS,
            hitPoints: 0,
            moveIntervalTicks,
            slot,
          }),
        ],
        spawnedEnemyCount: 20,
      });
      let frames = 0;

      while (game.enemies.length > 0 && frames < 60) {
        game = advanceBattleCityGame(game, () => 0.99);
        frames += 1;
      }

      expect(frames).toBe(expectedFrames);
      expect(game.destroyedEnemyCount).toBe(1);
    },
  );

  it("keeps the battlefield alive through a final tank explosion before game over", () => {
    const enemyShot = bulletFixture({
      col: 7.75,
      direction: "right",
      owner: "enemy",
      row: 20,
      slot: 5,
    });
    const hit = advanceBattleCityGame(
      runningGame({ bullets: [enemyShot], lives: 1 }),
      () => 0.99,
    );
    const ended = advanceBattleCityGame(
      { ...hit, player: { ...hit.player, phaseTicks: 1 } },
      () => 0.99,
    );

    expect(hit).toMatchObject({ lives: 1, status: "running" });
    expect(hit.player.phase).toBe("exploding");
    expect(ended).toMatchObject({
      lives: 0,
      stageOutcome: "lost",
      stageTransitionTicks: BATTLE_CITY_GAME_OVER_TRANSITION_TICKS,
      status: "game-over",
    });
  });

  it("absorbs protected hits without disturbing other shells", () => {
    const hit = bulletFixture({
      col: 7.75,
      direction: "right",
      id: "hit",
      owner: "enemy",
      row: 20,
      slot: 5,
    });
    const other = bulletFixture({
      col: 2,
      direction: "down",
      id: "other",
      owner: "enemy",
      row: 2,
      slot: 4,
    });
    const shielded = advanceBattleCityGame(
      runningGame({
        bullets: [hit, other],
        player: playerFixture({ shieldTicks: 2 }),
      }),
      () => 0.99,
    );

    expect(shielded.lives).toBe(3);
    expect(shielded.player.phase).toBe("active");
    expect(shielded.bullets).toEqual([
      expect.objectContaining({ id: "other", impactTicks: 0 }),
    ]);
  });

  it("resolves an incoming shell before a same-frame helmet pickup", () => {
    const enemyShot = bulletFixture({
      col: 7.75,
      direction: "right",
      owner: "enemy",
      row: 20,
      slot: 5,
    });
    const protectedPlayer = advanceBattleCityGame(
      powerUpGame("helmet", {
        bullets: [enemyShot],
        lives: 2,
      }),
      () => 0.99,
    );

    expect(protectedPlayer).toMatchObject({
      activePowerUp: { type: "helmet" },
      bullets: [
        expect.objectContaining({
          impactTicks: BATTLE_CITY_BULLET_IMPACT_TICKS,
        }),
      ],
      lives: 2,
      score: 0,
    });
    expect(protectedPlayer.player).toMatchObject({
      phase: "exploding",
      phaseTicks: BATTLE_CITY_PLAYER_EXPLOSION_TICKS,
      shieldTicks: 0,
    });
  });

  it("never deletes or scores an enemy occupying the player spawn", () => {
    const spawnBlocker = enemyFixture({
      col: 7,
      id: "spawn-blocker",
      row: 24,
    });
    const enemyShot = bulletFixture({
      col: 7.75,
      direction: "right",
      owner: "enemy",
      row: 20,
      slot: 5,
    });
    const hit = advanceBattleCityGame(
      runningGame({
        bullets: [enemyShot],
        destroyedEnemyCount: 5,
        enemies: [spawnBlocker],
        lives: 2,
        player: playerFixture({ powerTier: 3 }),
        score: 1_000,
        spawnedEnemyCount: 20,
      }),
      () => 0.99,
    );

    const respawned = advanceBattleCityGame(
      { ...hit, player: { ...hit.player, phaseTicks: 1 } },
      () => 0.99,
    );

    expect(respawned).toMatchObject({
      destroyedEnemyCount: 5,
      lives: 1,
      score: 1_000,
      status: "running",
    });
    expect(respawned.enemies).toEqual([
      expect.objectContaining({ id: "spawn-blocker" }),
    ]);
    expect(respawned.player).toMatchObject({
      col: 8,
      phase: "spawning",
      powerTier: 0,
      row: 24,
    });
    const active = {
      ...respawned,
      player: { ...respawned.player, phase: "active" as const, phaseTicks: 0 },
    };
    expect(moveBattleCityPlayer(active, "right").player.col).toBe(8.125);
  });
});

describe("Battle City power-ups and progression", () => {
  it("shows the 500-point pickup marker for exactly 50 frames", () => {
    let game = advanceBattleCityGame(
      runningGame({
        activePowerUp: {
          col: 11,
          id: "popup-star",
          row: 12,
          type: "star",
        },
        player: playerFixture({ col: 10, row: 11 }),
      }),
      () => 0.99,
    );

    expect(game).toMatchObject({
      activePowerUp: null,
      powerUpScorePopup: { col: 11, row: 12, ticks: 50 },
      score: 500,
    });

    for (let frame = 0; frame < 49; frame += 1) {
      game = advanceBattleCityGame(game, () => 0.99);
    }
    expect(game.powerUpScorePopup).toMatchObject({ ticks: 1 });

    game = advanceBattleCityGame(game, () => 0.99);
    expect(game.powerUpScorePopup).toBeNull();
  });

  it("keeps ice coasting and collects a reached bonus during game over", () => {
    const terrain = emptyTerrain();
    for (const row of [10, 11]) {
      for (const col of [10, 11, 12]) {
        terrain[row]![col] = "ice";
      }
    }
    const game = runningGame({
      activePowerUp: {
        col: 11.5,
        id: "tail-star",
        row: 10,
        type: "star",
      },
      baseAlive: true,
      player: playerFixture({
        col: 10,
        iceSlideDirection: "right",
        iceSlideStepsRemaining: 3,
        row: 10,
      }),
      score: 19_500,
      stageOutcome: "lost",
      stageTransitionTicks: 200,
      status: "game-over",
      terrain,
      tick: 0,
    });

    const advanced = advanceBattleCityGame(game, () => 0.99);

    expect(advanced).toMatchObject({
      activePowerUp: null,
      bonusLifeAwarded: false,
      lives: 3,
      powerUpScorePopup: { col: 11.5, row: 10, ticks: 50 },
      score: 20_000,
      stageTransitionTicks: 199,
      status: "game-over",
    });
    expect(advanced.player).toMatchObject({
      col: 10.125,
      iceSlideDirection: "right",
      iceSlideStepsRemaining: 2,
      powerTier: 1,
    });
  });

  it.each([
    ["right edge", 9, 10],
    ["bottom edge", 10, 9],
    ["corner", 9, 9],
  ] as const)(
    "collects a power-up overlapping the player's %s",
    (_edge, col, row) => {
      const game = runningGame({
        activePowerUp: {
          col,
          id: "overlapping-star",
          row,
          type: "star",
        },
        player: playerFixture({ col: 10, row: 10 }),
      });

      const collected = advanceBattleCityGame(game, () => 0.99);

      expect(collected).toMatchObject({ activePowerUp: null, score: 500 });
      expect(collected.player.powerTier).toBe(1);
    },
  );

  it("does not collect a nearby non-overlapping power-up", () => {
    const game = runningGame({
      activePowerUp: {
        col: 8,
        id: "nearby-star",
        row: 8,
        type: "star",
      },
      player: playerFixture({ col: 10, row: 10 }),
    });

    const advanced = advanceBattleCityGame(game, () => 0.99);

    expect(advanced.activePowerUp).toMatchObject({ id: "nearby-star" });
    expect(advanced.score).toBe(0);
  });

  it("uses the original strict 12-pixel power-up pickup range", () => {
    const inside = advanceBattleCityGame(
      runningGame({
        activePowerUp: {
          col: 11.375,
          id: "inside-star",
          row: 11.375,
          type: "star",
        },
        player: playerFixture({ col: 10, row: 10 }),
      }),
      () => 0.99,
    );
    const boundary = advanceBattleCityGame(
      runningGame({
        activePowerUp: {
          col: 11.5,
          id: "boundary-star",
          row: 11.5,
          type: "star",
        },
        player: playerFixture({ col: 10, row: 10 }),
      }),
      () => 0.99,
    );

    expect(inside.activePowerUp).toBeNull();
    expect(inside.score).toBe(500);
    expect(boundary.activePowerUp).toMatchObject({ id: "boundary-star" });
    expect(boundary.score).toBe(0);
  });

  it("applies star, helmet, tank, and clock pickups with 500 points", () => {
    const star = advanceBattleCityGame(powerUpGame("star"), () => 0.99);
    const helmet = advanceBattleCityGame(powerUpGame("helmet"), () => 0.99);
    const tank = advanceBattleCityGame(powerUpGame("tank"), () => 0.99);
    const clock = advanceBattleCityGame(powerUpGame("clock"), () => 0.99);

    expect(star).toMatchObject({ activePowerUp: null, score: 500 });
    expect(star.player.powerTier).toBe(1);
    expect(helmet.player.shieldTicks).toBe(BATTLE_CITY_HELMET_TICKS);
    expect(tank.lives).toBe(4);
    expect(clock.freezeTicks).toBe(BATTLE_CITY_FREEZE_TICKS);
  });

  it("quantizes helmet, clock, and shovel expiry to the original 64-frame clock", () => {
    const helmet = advanceBattleCityGame(
      powerUpGame("helmet", { tick: 63 }),
      () => 0.99,
    );
    const clock = advanceBattleCityGame(
      powerUpGame("clock", { tick: 63 }),
      () => 0.99,
    );
    const shovel = advanceBattleCityGame(
      powerUpGame("shovel", {
        terrain: terrainWithHeadquarters(),
        tick: 63,
      }),
      () => 0.99,
    );

    expect(helmet.player.shieldTicks).toBe(577);
    expect(clock.freezeTicks).toBe(577);
    expect(shovel.fortressTicks).toBe(1_217);
  });

  it("uses grenade on active enemies only and keeps spawning enemies alive", () => {
    const advanced = advanceBattleCityGame(
      powerUpGame("grenade", {
        destroyedEnemyCount: 2,
        enemies: [
          enemyFixture(),
          enemyFixture({ id: "enemy-2", spawnTicks: 20 }),
        ],
        freezeTicks: 2,
        score: 1_000,
        spawnedEnemyCount: 8,
      }),
      () => 0.99,
    );

    expect(advanced.enemies).toEqual([
      expect.objectContaining({
        destructionPoints: null,
        explosionTicks: BATTLE_CITY_ENEMY_EXPLOSION_TICKS,
        id: "enemy-test",
      }),
      expect.objectContaining({ id: "enemy-2", spawnTicks: 19 }),
    ]);
    expect(advanced.destroyedEnemyCount).toBe(2);
    expect(advanced.stageKillCounts).toEqual({
      armor: 0,
      basic: 0,
      fast: 0,
      power: 0,
    });
    expect(advanced.score).toBe(1_500);
    expect(advanced.status).toBe("running");
  });

  it("moves grenade-killed fast tanks onto the slow object-slot explosion cadence", () => {
    let game = advanceBattleCityGame(
      powerUpGame("grenade", {
        enemies: [
          enemyFixture({
            moveIntervalTicks: 1,
            slot: 5,
            type: "fast",
          }),
        ],
        spawnedEnemyCount: 20,
      }),
      () => 0.99,
    );
    let frames = 0;

    expect(game.enemies[0]).toMatchObject({
      explosionTicks: BATTLE_CITY_ENEMY_EXPLOSION_TICKS,
      moveIntervalTicks: 2,
    });
    while (game.enemies.length > 0 && frames < 60) {
      game = advanceBattleCityGame(game, () => 0.99);
      frames += 1;
    }

    expect(frames).toBe(48);
    expect(game.destroyedEnemyCount).toBe(1);
  });

  it("repairs and fortifies the headquarters enclosure, then restores brick", () => {
    const fortified = advanceBattleCityGame(
      powerUpGame("shovel", { terrain: terrainWithHeadquarters() }),
      () => 0.99,
    );

    expect(fortified.fortressTicks).toBe(BATTLE_CITY_FORTRESS_TICKS);
    expect(fortified.terrain[23]?.slice(11, 15)).toEqual(
      Array(4).fill("steel"),
    );
    expect(fortified.terrain[24]?.[11]).toBe("steel");
    expect(fortified.terrain[25]?.[14]).toBe("steel");

    const restored = advanceBattleCityGame(
      { ...fortified, fortressTicks: 1 },
      () => 0.99,
    );
    expect(restored.fortressTicks).toBe(0);
    expect(restored.terrain[23]?.slice(11, 15)).toEqual(
      Array(4).fill("brick"),
    );
    expect(restored.terrain[24]?.[12]).toBe("headquarters");
  });

  it("awards a shovel after HQ destruction without rebuilding the fortress", () => {
    const collected = advanceBattleCityGame(
      powerUpGame("shovel", {
        baseAlive: false,
        baseExplosionTicks: 20,
        stageOutcome: "lost",
        terrain: terrainWithHeadquarters(),
      }),
      () => 0.99,
    );

    expect(collected).toMatchObject({
      activePowerUp: null,
      baseAlive: false,
      fortressTicks: 0,
      score: 500,
    });
    expect(collected.terrain[23]?.[11]).toBe("empty");

    const lastLifeGameOver = advanceBattleCityGame(
      powerUpGame("shovel", {
        baseAlive: true,
        stageOutcome: "lost",
        stageTransitionTicks: 200,
        status: "game-over",
        terrain: terrainWithHeadquarters(),
      }),
      () => 0.99,
    );

    expect(lastLifeGameOver).toMatchObject({
      activePowerUp: null,
      baseAlive: true,
      fortressTicks: 0,
      score: 500,
      status: "game-over",
    });
    expect(lastLifeGameOver.terrain[23]?.[11]).toBe("empty");
  });

  it("flashes the fortified enclosure during its final three timer counts", () => {
    const terrain = terrainWithHeadquarters();
    const steel = advanceBattleCityGame(powerUpGame("shovel", { terrain }));
    const brickFlash = advanceBattleCityGame(
      { ...steel, fortressTicks: 193 },
      () => 0.99,
    );
    const steelFlash = advanceBattleCityGame(
      { ...brickFlash, fortressTicks: 177 },
      () => 0.99,
    );

    expect(brickFlash.terrain[23]?.[11]).toBe("brick");
    expect(steelFlash.terrain[23]?.[11]).toBe("steel");
  });

  it("keeps an uncollected power-up until collection or the next carrier", () => {
    const game = runningGame({
      activePowerUp: {
        col: 0,
        id: "expiring",
        row: 0,
        type: "star",
      },
    });
    expect(advanceBattleCityGame(game, () => 0.99).activePowerUp).toMatchObject({
      id: "expiring",
    });
  });

  it("collects a touched power-up on its final visible tick", () => {
    const game = powerUpGame("star");
    const collected = advanceBattleCityGame(
      {
        ...game,
        activePowerUp: { ...game.activePowerUp! },
      },
      () => 0.99,
    );

    expect(collected).toMatchObject({ activePowerUp: null, score: 500 });
    expect(collected.player.powerTier).toBe(1);
  });

  it("keeps battle logic live for 128 frames before the timed result tally", () => {
    const cleared = advanceBattleCityGame(
      runningGame({
        destroyedEnemyCount: 20,
        lives: 5,
        player: playerFixture({ powerTier: 2 }),
        score: 12_300,
        spawnedEnemyCount: 20,
        stage: 1,
        stageKillCounts: { armor: 3, basic: 8, fast: 5, power: 4 },
      }),
      () => 0.99,
    );
    expect(cleared).toMatchObject({
      stageOutcome: "cleared",
      stageTransitionTicks: BATTLE_CITY_STAGE_TRANSITION_TICKS,
      status: "stage-clear",
    });
    const tailFrame = advanceBattleCityGame(
      {
        ...cleared,
        bullets: [bulletFixture({ col: 2, row: 2 })],
      },
      BATTLE_CITY_TICK_MS,
      () => 0.99,
      { direction: "up", fireRequested: false },
    );
    expect(tailFrame).toMatchObject({
      stageTransitionTicks: BATTLE_CITY_STAGE_TRANSITION_TICKS - 1,
      status: "stage-clear",
    });
    expect(tailFrame.player.row).toBeLessThan(cleared.player.row);
    expect(tailFrame.bullets[0]?.col).toBeGreaterThan(2);

    const results = advanceBattleCityGame({
      ...cleared,
      stageTransitionTicks: 1,
    });
    expect(results).toMatchObject({
      stageResultTicks: 0,
      stageTransitionTicks:
        BATTLE_CITY_STAGE_RESULTS_BASE_TICKS +
        BATTLE_CITY_STAGE_RESULTS_PER_KILL_TICKS * 20,
      status: "stage-results",
    });
  });

  it("preserves an existing stage-clear tail when the last life expires", () => {
    const cleared = runningGame({
      destroyedEnemyCount: 20,
      lives: 1,
      player: playerFixture({ phase: "exploding", phaseTicks: 1 }),
      spawnedEnemyCount: 20,
      stageOutcome: "cleared",
      stageTransitionTicks: 64,
      status: "stage-clear",
      tick: 0,
    });
    const exhausted = advanceBattleCityGame(cleared, () => 0.99);

    expect(exhausted).toMatchObject({
      lives: 0,
      stageOutcome: "lost",
      stageTransitionTicks: 63,
      status: "stage-clear",
      tick: 1,
    });

    const results = advanceBattleCityGame(
      { ...exhausted, stageTransitionTicks: 1 },
      () => 0.99,
    );
    expect(results).toMatchObject({
      stageOutcome: "lost",
      status: "stage-results",
    });

    const lost = advanceBattleCityGame(
      { ...results, stageTransitionTicks: 1 },
      () => 0.99,
    );
    expect(lost.status).toBe("lost");
  });

  it("rebases the hardware frame clock when the ending tail begins", () => {
    const cleared = advanceBattleCityGame(
      runningGame({
        destroyedEnemyCount: 20,
        spawnedEnemyCount: 20,
        tick: 63,
      }),
      () => 0.99,
    );
    const tailFrame = advanceBattleCityGame(
      {
        ...cleared,
        enemies: [enemyFixture({ col: 5, row: 5, slot: 5 })],
      },
      () => 0.99,
    );

    expect(cleared).toMatchObject({ status: "stage-clear", tick: 0 });
    expect(tailFrame).toMatchObject({ status: "stage-clear", tick: 1 });
    expect(tailFrame.enemies[0]?.row).toBe(5);
  });

  it("advances after results through stages 1-70 and resets after Stage 70", () => {
    const resultGame = runningGame({
      lives: 5,
      player: playerFixture({ powerTier: 2 }),
      score: 12_300,
      stageKillCounts: { armor: 0, basic: 20, fast: 0, power: 0 },
      stageOutcome: "cleared",
      stageTransitionTicks: 1,
      status: "stage-results",
    });
    const stageTwo = advanceBattleCityGame(resultGame);
    expect(stageTwo).toMatchObject({
      cycle: 1,
      lives: 5,
      score: 12_300,
      stage: 2,
      stageTransitionTicks: BATTLE_CITY_NEXT_STAGE_INTRO_TICKS,
      status: "stage-intro",
    });
    expect(stageTwo.player.powerTier).toBe(2);

    let stageTwoIntro = stageTwo;
    for (
      let frame = 1;
      frame < BATTLE_CITY_NEXT_STAGE_INTRO_TICKS;
      frame += 1
    ) {
      stageTwoIntro = advanceBattleCityGame(stageTwoIntro, () => 0.99);
    }
    expect(stageTwoIntro).toMatchObject({
      stageBattleTicks: 0,
      stageTransitionTicks: 1,
      status: "stage-intro",
    });
    expect(
      advanceBattleCityGame(stageTwoIntro, () => 0.99),
    ).toMatchObject({
      stageBattleTicks: 1,
      status: "running",
    });

    const stage36 = advanceBattleCityGame({
      ...resultGame,
      cycle: 1,
      stage: 35,
    });
    expect(stage36).toMatchObject({ cycle: 2, stage: 1 });
    expect(formatBattleCityStageLabel(stage36.stage, stage36.cycle)).toBe("36");

    const reset = advanceBattleCityGame({
      ...resultGame,
      cycle: 2,
      stage: 35,
    });
    expect(reset).toMatchObject({ cycle: 1, stage: 1 });
    expect(formatBattleCityStageLabel(reset.stage, reset.cycle)).toBe("1");
  });

  it("starts the next battle after the complete tally and automatic setup path", () => {
    const creditedKills = 2;
    const expectedFrames =
      BATTLE_CITY_STAGE_RESULTS_BASE_TICKS +
      BATTLE_CITY_STAGE_RESULTS_PER_KILL_TICKS * creditedKills +
      BATTLE_CITY_NEXT_STAGE_INTRO_TICKS;
    let game = runningGame({
      stageKillCounts: {
        armor: 0,
        basic: creditedKills,
        fast: 0,
        power: 0,
      },
      stageOutcome: "cleared",
      stageTransitionTicks:
        BATTLE_CITY_STAGE_RESULTS_BASE_TICKS +
        BATTLE_CITY_STAGE_RESULTS_PER_KILL_TICKS * creditedKills,
      status: "stage-results",
    });

    for (let frame = 1; frame < expectedFrames; frame += 1) {
      game = advanceBattleCityGame(game, () => 0.99);
    }
    expect(game).toMatchObject({
      stage: 2,
      stageBattleTicks: 0,
      stageTransitionTicks: 1,
      status: "stage-intro",
    });

    game = advanceBattleCityGame(game, () => 0.99);
    expect(game).toMatchObject({
      stage: 2,
      stageBattleTicks: 1,
      status: "running",
    });
  });

  it("shows the same result tally before the final game-over screen", () => {
    const results = advanceBattleCityGame(
      runningGame({
        stageOutcome: "lost",
        stageTransitionTicks: 1,
        status: "game-over",
      }),
    );
    const lost = advanceBattleCityGame({
      ...results,
      stageTransitionTicks: 1,
    });

    expect(results.status).toBe("stage-results");
    expect(lost.status).toBe("lost");
  });

  it("counts each result-row tank on the ROM's nine-frame cadence", () => {
    const results = runningGame({
      stageKillCounts: { armor: 4, basic: 2, fast: 1, power: 3 },
      stageResultTicks: 0,
      status: "stage-results",
    });

    expect(getBattleCityStageResultDisplay(results)).toEqual({
      killCounts: { armor: 0, basic: 0, fast: 0, power: 0 },
      showTotal: false,
    });
    expect(
      getBattleCityStageResultDisplay({ ...results, stageResultTicks: 38 })
        .killCounts.basic,
    ).toBe(0);
    expect(
      getBattleCityStageResultDisplay({ ...results, stageResultTicks: 39 })
        .killCounts.basic,
    ).toBe(1);
    expect(
      getBattleCityStageResultDisplay({ ...results, stageResultTicks: 48 })
        .killCounts.basic,
    ).toBe(2);
    expect(
      getBattleCityStageResultDisplay({ ...results, stageResultTicks: 87 })
        .killCounts.fast,
    ).toBe(1);
    expect(
      getBattleCityStageResultDisplay({ ...results, stageResultTicks: 144 })
        .killCounts.power,
    ).toBe(3);
    const counted = getBattleCityStageResultDisplay({
      ...results,
      stageResultTicks: 210,
    });
    expect(counted).toEqual({
      killCounts: { armor: 4, basic: 2, fast: 1, power: 3 },
      showTotal: false,
    });
    expect(
      getBattleCityStageResultDisplay({ ...results, stageResultTicks: 256 })
        .showTotal,
    ).toBe(false);
    expect(
      getBattleCityStageResultDisplay({ ...results, stageResultTicks: 257 })
        .showTotal,
    ).toBe(true);
  });
});
