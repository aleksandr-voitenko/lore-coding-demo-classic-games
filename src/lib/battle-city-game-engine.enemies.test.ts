import { describe, expect, it } from "vitest";

import {
  advanceBattleCityGame,
  BATTLE_CITY_ENEMY_SPAWN_TICKS,
  BATTLE_CITY_MAX_ACTIVE_ENEMIES,
  BATTLE_CITY_PLAYER_SPAWN_TICKS,
  bulletFixture,
  emptyTerrain,
  enemyFixture,
  playerFixture,
  runningGame,
} from "./battle-city-game-engine.test-helpers";

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
