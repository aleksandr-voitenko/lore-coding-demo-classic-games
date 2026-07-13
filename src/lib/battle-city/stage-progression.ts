import {
  BATTLE_CITY_ENEMY_SPAWN_INTERVAL_TICKS,
  BATTLE_CITY_FINAL_STAGE_SPAWN_INTERVAL_TICKS,
  BATTLE_CITY_REPEAT_SPAWN_INTERVAL_TICKS,
  BATTLE_CITY_STAGE_COUNT,
} from "./constants";

export const BATTLE_CITY_DISPLAY_STAGE_COUNT = BATTLE_CITY_STAGE_COUNT * 2;
export const BATTLE_CITY_HARD_LOOP_START_STAGE = BATTLE_CITY_STAGE_COUNT + 1;
export const BATTLE_CITY_HARD_LOOP_ENEMY_QUEUE_STAGE = BATTLE_CITY_STAGE_COUNT;
export const BATTLE_CITY_HARD_LOOP_ENEMY_SPAWN_INTERVAL_TICKS =
  BATTLE_CITY_REPEAT_SPAWN_INTERVAL_TICKS;

export type BattleCityCanonicalCycle = 1 | 2;

export type BattleCityStageCursor = {
  cycle: BattleCityCanonicalCycle;
  stage: number;
};

export type BattleCityStageProgression = BattleCityStageCursor & {
  displayStage: number;
  enemyQueueStage: number;
  isHardLoop: boolean;
  mapStage: number;
  spawnIntervalTicks: number;
};

export function resolveBattleCityStageProgression(
  stage: number,
  cycle: number,
): BattleCityStageProgression {
  const mapStage = normalizeBattleCityMapStage(stage);
  const canonicalCycle = normalizeBattleCityCycle(cycle);
  const isHardLoop = canonicalCycle === 2;
  const displayStage =
    mapStage + (isHardLoop ? BATTLE_CITY_STAGE_COUNT : 0);

  return {
    cycle: canonicalCycle,
    displayStage,
    enemyQueueStage: isHardLoop
      ? BATTLE_CITY_HARD_LOOP_ENEMY_QUEUE_STAGE
      : mapStage,
    isHardLoop,
    mapStage,
    spawnIntervalTicks: isHardLoop
      ? BATTLE_CITY_HARD_LOOP_ENEMY_SPAWN_INTERVAL_TICKS
      : getFirstLoopEnemySpawnIntervalTicks(mapStage),
    stage: mapStage,
  };
}

export function getBattleCityDisplayedStage(
  stage: number,
  cycle: number,
): number {
  return resolveBattleCityStageProgression(stage, cycle).displayStage;
}

export function getBattleCityMapStage(stage: number, cycle: number): number {
  return resolveBattleCityStageProgression(stage, cycle).mapStage;
}

export function isBattleCityHardLoop(stage: number, cycle: number): boolean {
  return resolveBattleCityStageProgression(stage, cycle).isHardLoop;
}

export function getBattleCityEnemyQueueStage(
  stage: number,
  cycle: number,
): number {
  return resolveBattleCityStageProgression(stage, cycle).enemyQueueStage;
}

export function getBattleCityEnemySpawnIntervalTicks(
  stage: number,
  cycle: number,
): number {
  return resolveBattleCityStageProgression(stage, cycle).spawnIntervalTicks;
}

export function getNextBattleCityStage(
  stage: number,
  cycle: number,
): BattleCityStageCursor {
  const current = resolveBattleCityStageProgression(stage, cycle);
  if (current.mapStage < BATTLE_CITY_STAGE_COUNT) {
    return {
      cycle: current.cycle,
      stage: current.mapStage + 1,
    };
  }

  return current.isHardLoop
    ? { cycle: 1, stage: 1 }
    : { cycle: 2, stage: 1 };
}

export function formatBattleCityStageLabel(
  stage: number,
  cycle: number,
): string {
  return String(getBattleCityDisplayedStage(stage, cycle));
}

function getFirstLoopEnemySpawnIntervalTicks(stage: number): number {
  const progress = (stage - 1) / (BATTLE_CITY_STAGE_COUNT - 1);
  return Math.round(
    BATTLE_CITY_ENEMY_SPAWN_INTERVAL_TICKS -
      progress *
        (BATTLE_CITY_ENEMY_SPAWN_INTERVAL_TICKS -
          BATTLE_CITY_FINAL_STAGE_SPAWN_INTERVAL_TICKS),
  );
}

function normalizeBattleCityMapStage(stage: number): number {
  if (!Number.isFinite(stage)) {
    return 1;
  }
  return Math.min(BATTLE_CITY_STAGE_COUNT, Math.max(1, Math.round(stage)));
}

function normalizeBattleCityCycle(cycle: number): BattleCityCanonicalCycle {
  if (!Number.isFinite(cycle)) {
    return 1;
  }
  // The original resets to the first pass after Stage 70. Reducing legacy
  // cycle values by parity preserves that behavior without expanding state.
  const positiveCycle = Math.max(1, Math.round(cycle));
  return positiveCycle % 2 === 0 ? 2 : 1;
}
