import { describe, expect, it } from "vitest";

import {
  BATTLE_CITY_ENEMY_SPAWN_INTERVAL_TICKS,
  BATTLE_CITY_FINAL_STAGE_SPAWN_INTERVAL_TICKS,
} from "./constants";
import {
  BATTLE_CITY_DISPLAY_STAGE_COUNT,
  BATTLE_CITY_HARD_LOOP_ENEMY_QUEUE_STAGE,
  BATTLE_CITY_HARD_LOOP_ENEMY_SPAWN_INTERVAL_TICKS,
  BATTLE_CITY_HARD_LOOP_START_STAGE,
  formatBattleCityStageLabel,
  getBattleCityDisplayedStage,
  getBattleCityEnemyQueueStage,
  getBattleCityEnemySpawnIntervalTicks,
  getBattleCityMapStage,
  getNextBattleCityStage,
  isBattleCityHardLoop,
  resolveBattleCityStageProgression,
} from "./stage-progression";

describe("Battle City canonical stage progression", () => {
  it.each([
    [1, 1, 1, 1, false, 1],
    [35, 1, 35, 35, false, 35],
    [1, 2, 36, 1, true, 35],
    [35, 2, 70, 35, true, 35],
    [1, 3, 1, 1, false, 1],
    [1, 4, 36, 1, true, 35],
  ] as const)(
    "maps stage %i cycle %i to displayed stage %i",
    (stage, cycle, displayStage, mapStage, hardLoop, enemyQueueStage) => {
      expect(resolveBattleCityStageProgression(stage, cycle)).toMatchObject({
        cycle: hardLoop ? 2 : 1,
        displayStage,
        enemyQueueStage,
        isHardLoop: hardLoop,
        mapStage,
        stage: mapStage,
      });
      expect(getBattleCityDisplayedStage(stage, cycle)).toBe(displayStage);
      expect(getBattleCityMapStage(stage, cycle)).toBe(mapStage);
      expect(isBattleCityHardLoop(stage, cycle)).toBe(hardLoop);
      expect(getBattleCityEnemyQueueStage(stage, cycle)).toBe(enemyQueueStage);
    },
  );

  it("uses the first-loop interval curve for stages 1 through 35", () => {
    expect(getBattleCityEnemySpawnIntervalTicks(1, 1)).toBe(
      BATTLE_CITY_ENEMY_SPAWN_INTERVAL_TICKS,
    );
    expect(getBattleCityEnemySpawnIntervalTicks(18, 1)).toBe(119);
    expect(getBattleCityEnemySpawnIntervalTicks(35, 1)).toBe(
      BATTLE_CITY_FINAL_STAGE_SPAWN_INTERVAL_TICKS,
    );
  });

  it("uses the Stage 35 enemy mix and 51-frame cadence throughout stages 36 through 70", () => {
    for (const mapStage of [1, 18, 35]) {
      expect(getBattleCityEnemyQueueStage(mapStage, 2)).toBe(
        BATTLE_CITY_HARD_LOOP_ENEMY_QUEUE_STAGE,
      );
      expect(getBattleCityEnemySpawnIntervalTicks(mapStage, 2)).toBe(
        BATTLE_CITY_HARD_LOOP_ENEMY_SPAWN_INTERVAL_TICKS,
      );
    }
  });

  it.each([
    [34, 1, { cycle: 1, stage: 35 }],
    [35, 1, { cycle: 2, stage: 1 }],
    [34, 2, { cycle: 2, stage: 35 }],
    [35, 2, { cycle: 1, stage: 1 }],
    [35, 3, { cycle: 2, stage: 1 }],
  ] as const)(
    "advances stage %i cycle %i to the canonical next cursor",
    (stage, cycle, expected) => {
      expect(getNextBattleCityStage(stage, cycle)).toEqual(expected);
    },
  );

  it("labels the hard loop as displayed stages 36 through 70 and resets after 70", () => {
    expect(BATTLE_CITY_HARD_LOOP_START_STAGE).toBe(36);
    expect(BATTLE_CITY_DISPLAY_STAGE_COUNT).toBe(70);
    expect(formatBattleCityStageLabel(1, 1)).toBe("1");
    expect(formatBattleCityStageLabel(1, 2)).toBe("36");
    expect(formatBattleCityStageLabel(35, 2)).toBe("70");

    const reset = getNextBattleCityStage(35, 2);
    expect(formatBattleCityStageLabel(reset.stage, reset.cycle)).toBe("1");
    expect(getBattleCityEnemyQueueStage(reset.stage, reset.cycle)).toBe(1);
    expect(getBattleCityEnemySpawnIntervalTicks(reset.stage, reset.cycle)).toBe(
      BATTLE_CITY_ENEMY_SPAWN_INTERVAL_TICKS,
    );
  });

  it("normalizes malformed legacy cursor values without leaking stages outside 1 through 70", () => {
    expect(resolveBattleCityStageProgression(Number.NaN, Number.NaN)).toMatchObject(
      {
        cycle: 1,
        displayStage: 1,
        mapStage: 1,
      },
    );
    expect(resolveBattleCityStageProgression(99, 2)).toMatchObject({
      cycle: 2,
      displayStage: 70,
      mapStage: 35,
    });
  });
});
