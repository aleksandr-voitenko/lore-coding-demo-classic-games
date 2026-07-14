import { describe, expect, it } from "vitest";

import {
  advanceBattleCityGame,
  BATTLE_CITY_ENEMY_EXPLOSION_TICKS,
  BATTLE_CITY_FORTRESS_TICKS,
  BATTLE_CITY_FREEZE_TICKS,
  BATTLE_CITY_HELMET_TICKS,
  BATTLE_CITY_NEXT_STAGE_INTRO_TICKS,
  BATTLE_CITY_STAGE_RESULTS_BASE_TICKS,
  BATTLE_CITY_STAGE_RESULTS_PER_KILL_TICKS,
  BATTLE_CITY_STAGE_TRANSITION_TICKS,
  BATTLE_CITY_TICK_MS,
  bulletFixture,
  emptyTerrain,
  enemyFixture,
  formatBattleCityStageLabel,
  getBattleCityStageResultDisplay,
  playerFixture,
  powerUpGame,
  runningGame,
  terrainWithHeadquarters,
} from "./battle-city-game-engine.test-helpers";

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
