import { describe, expect, it } from "vitest";

import {
  advanceBattleCityGame,
  BATTLE_CITY_ENEMY_SPAWN_INTERVAL_TICKS,
  BATTLE_CITY_ENEMY_SPAWN_TICKS,
  BATTLE_CITY_HELMET_TICKS,
  BATTLE_CITY_NEXT_STAGE_INTRO_TICKS,
  BATTLE_CITY_PLAYER_INVULNERABILITY_TICKS,
  BATTLE_CITY_PLAYER_SPAWN_TICKS,
  BATTLE_CITY_STAGE_COUNT,
  BATTLE_CITY_STAGE_INTRO_TICKS,
  BATTLE_CITY_STAGES,
  BATTLE_CITY_STARTING_LIVES,
  BATTLE_CITY_TICK_MS,
  bulletFixture,
  createInitialBattleCityGame,
  enemyFixture,
  formatBattleCityStageLabel,
  getBattleCityStage,
  getBattleCityTickDelay,
  pauseBattleCityGame,
  playerFixture,
  restartBattleCityGame,
  resumeBattleCityGame,
  runningGame,
  startBattleCityGame,
} from "./battle-city-game-engine.test-helpers";

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
