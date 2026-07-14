export {
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
} from "./battle-city-game-engine";
export type {
  BattleCityBullet,
  BattleCityGameState,
  BattleCityTerrain,
} from "./battle-city-game-engine";

import {
  BATTLE_CITY_BOARD_SIZE,
  createInitialBattleCityGame,
  startBattleCityGame,
  type BattleCityBullet,
  type BattleCityEnemy,
  type BattleCityGameState,
  type BattleCityPlayer,
  type BattleCityPowerUpType,
  type BattleCityTerrain,
} from "./battle-city-game-engine";

// These test-owned values construct explicit terrain-fragment state without
// coupling the facade suites to the engine's private module layout.
export const BATTLE_CITY_FULL_TERRAIN_FRAGMENT_MASK = 0b1111;
export const BATTLE_CITY_TERRAIN_FRAGMENT_BITS = {
  "top-left": 0b0001,
  "top-right": 0b0010,
  "bottom-left": 0b0100,
  "bottom-right": 0b1000,
} as const;

export function createBattleCityTerrainFragmentGrid(
  terrain: readonly (readonly BattleCityTerrain[])[],
): number[][] {
  return terrain.map((row) =>
    row.map((cell) =>
      cell === "brick" || cell === "steel"
        ? BATTLE_CITY_FULL_TERRAIN_FRAGMENT_MASK
        : 0,
    ),
  );
}

export function emptyTerrain(): BattleCityTerrain[][] {
  return Array.from({ length: BATTLE_CITY_BOARD_SIZE }, () =>
    Array<BattleCityTerrain>(BATTLE_CITY_BOARD_SIZE).fill("empty"),
  );
}

export function terrainWithHeadquarters(): BattleCityTerrain[][] {
  const terrain = emptyTerrain();
  terrain[24]![12] = "headquarters";
  terrain[24]![13] = "headquarters";
  terrain[25]![12] = "headquarters";
  terrain[25]![13] = "headquarters";
  return terrain;
}

export function playerFixture(
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

export function enemyFixture(
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

export function bulletFixture(
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

export function runningGame(
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

export function powerUpGame(
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
