import fixture from "./stages.fixture.json";
import {
  BATTLE_CITY_BOARD_SIZE,
  BATTLE_CITY_STAGE_COUNT,
  BATTLE_CITY_TERRAIN_BY_SYMBOL,
  BATTLE_CITY_TOTAL_ENEMIES,
} from "./constants";
import type {
  BattleCityEnemyType,
  BattleCityStageDefinition,
  BattleCityTerrain,
} from "./types";

const ENEMY_TYPES = new Set<BattleCityEnemyType>([
  "basic",
  "fast",
  "power",
  "armor",
]);

function assertStageFixture(
  value: unknown,
): asserts value is BattleCityStageDefinition[] {
  if (!Array.isArray(value) || value.length !== BATTLE_CITY_STAGE_COUNT) {
    throw new Error("Battle City stage fixture must contain exactly 35 stages.");
  }

  for (const [index, stage] of value.entries()) {
    if (
      typeof stage !== "object" ||
      stage === null ||
      !("stage" in stage) ||
      stage.stage !== index + 1 ||
      !("difficulty" in stage) ||
      !["★", "★★", "★★★", "★★★★"].includes(String(stage.difficulty)) ||
      !("terrain" in stage) ||
      !Array.isArray(stage.terrain) ||
      stage.terrain.length !== BATTLE_CITY_BOARD_SIZE ||
      stage.terrain.some(
        (row: unknown) =>
          typeof row !== "string" ||
          row.length !== BATTLE_CITY_BOARD_SIZE ||
          [...row].some((symbol) => BATTLE_CITY_TERRAIN_BY_SYMBOL[symbol] === undefined),
      ) ||
      !("enemyQueue" in stage) ||
      !Array.isArray(stage.enemyQueue) ||
      stage.enemyQueue.length !== BATTLE_CITY_TOTAL_ENEMIES ||
      stage.enemyQueue.some(
        (type: unknown) => !ENEMY_TYPES.has(type as BattleCityEnemyType),
      ) ||
      !("spawns" in stage) ||
      typeof stage.spawns !== "object" ||
      stage.spawns === null ||
      !("player1" in stage.spawns) ||
      !("player2" in stage.spawns) ||
      !("enemies" in stage.spawns) ||
      !Array.isArray(stage.spawns.enemies) ||
      stage.spawns.enemies.length !== 3
    ) {
      throw new Error(`Battle City stage ${index + 1} is malformed.`);
    }

    const headquartersCount = (stage.terrain as string[]).reduce(
      (count: number, row: string) =>
        count + [...row].filter((symbol) => symbol === "H").length,
      0,
    );
    if (headquartersCount !== 4) {
      throw new Error(`Battle City stage ${index + 1} must contain a 2x2 headquarters.`);
    }
  }
}

assertStageFixture(fixture);

// This runtime fixture is the mechanical gameplay projection of the supplied
// battle_city_maps_26x26.json. Metadata remains outside the runtime shape.
export const BATTLE_CITY_STAGES: readonly BattleCityStageDefinition[] = fixture;

export function getBattleCityStage(stage: number): BattleCityStageDefinition {
  const definition = BATTLE_CITY_STAGES[stage - 1];
  if (definition === undefined) {
    throw new RangeError(`Battle City stage must be between 1 and ${BATTLE_CITY_STAGE_COUNT}.`);
  }
  return definition;
}

export function createBattleCityTerrain(stage: number): BattleCityTerrain[][] {
  return getBattleCityStage(stage).terrain.map((row) =>
    [...row].map((symbol) => BATTLE_CITY_TERRAIN_BY_SYMBOL[symbol]!),
  );
}
