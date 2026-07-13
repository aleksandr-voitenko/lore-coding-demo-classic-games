import type {
  BattleCityEnemyType,
  BattleCityTerrain,
} from "./types";
import {
  BATTLE_CITY_NTSC_FRAME_DURATION_MS,
  BATTLE_CITY_NTSC_FRAME_RATE_HZ,
} from "./fixed-step";

export const BATTLE_CITY_BOARD_SIZE = 26;
export const BATTLE_CITY_STAGE_COUNT = 35;
export const BATTLE_CITY_TOTAL_ENEMIES = 20;
export const BATTLE_CITY_FRAME_RATE = BATTLE_CITY_NTSC_FRAME_RATE_HZ;
export const BATTLE_CITY_TICK_MS = BATTLE_CITY_NTSC_FRAME_DURATION_MS;
// Each supplied 26x26 map cell is an 8x8 NES-pixel half-tile, so one original
// hardware pixel is one eighth of a map cell.
export const BATTLE_CITY_PIXEL_STEP = 1 / 8;
export const BATTLE_CITY_BULLET_RENDER_SIZE = 1 / 2;
export const BATTLE_CITY_BULLET_IMPACT_TICKS = 9;
export const BATTLE_CITY_BULLET_COLLISION_DISTANCE = 6 / 8;
export const BATTLE_CITY_TANK_BULLET_COLLISION_DISTANCE = 10 / 8;
export const BATTLE_CITY_POWER_UP_COLLISION_DISTANCE = 12 / 8;
export const BATTLE_CITY_ICE_SLIDE_STEPS = 28;
export const BATTLE_CITY_STARTING_LIVES = 3;
export const BATTLE_CITY_MAX_ACTIVE_ENEMIES = 4;
export const BATTLE_CITY_BONUS_LIFE_SCORE = 20_000;
export const BATTLE_CITY_PLAYER_INVULNERABILITY_TICKS = 192;
export const BATTLE_CITY_ENEMY_SPAWN_INTERVAL_TICKS = 187;
export const BATTLE_CITY_FINAL_STAGE_SPAWN_INTERVAL_TICKS = 51;
export const BATTLE_CITY_REPEAT_SPAWN_INTERVAL_TICKS = 51;
// Status $F0 advances through two 14-update animation phases before the tank
// becomes active. Wall-clock duration depends on the player/slot handler phase.
export const BATTLE_CITY_ENEMY_SPAWN_TICKS = 28;
export const BATTLE_CITY_PLAYER_SPAWN_TICKS = 28;
// Status $73 reaches $00 after 24 tank-handler updates. Player and slow-enemy
// handlers do not run every video frame, so their destruction sequence lasts
// longer in wall time even though every tank shares the same update count.
export const BATTLE_CITY_PLAYER_EXPLOSION_TICKS = 24;
export const BATTLE_CITY_ENEMY_EXPLOSION_TICKS = 24;
// Shot-killed enemies replace the explosion with their points sprite for the
// final $16..$11 states. Grenade kills clear the tank type and keep rendering
// explosion art instead of entering the points-popup phase.
export const BATTLE_CITY_ENEMY_SCORE_POPUP_TICKS = 6;
export const BATTLE_CITY_POWER_UP_SCORE_POPUP_TICKS = 50;
export const BATTLE_CITY_HEADQUARTERS_EXPLOSION_TICKS = 39;
export const BATTLE_CITY_HELMET_TICKS = 640;
export const BATTLE_CITY_FREEZE_TICKS = 640;
export const BATTLE_CITY_FORTRESS_TICKS = 1_280;
export const BATTLE_CITY_FORTRESS_WARNING_TICKS = 192;
export const BATTLE_CITY_STAGE_TRANSITION_TICKS = 128;
export const BATTLE_CITY_GAME_OVER_TRANSITION_TICKS = 256;
export const BATTLE_CITY_STAGE_RESULTS_BASE_TICKS = 300;
export const BATTLE_CITY_STAGE_RESULTS_PER_KILL_TICKS = 9;
// From a recognized stage-selection confirmation, the ROM performs 97 NMI
// waits while drawing the map, attributes, curtain reveal, and tank setup. The
// automatic next-stage path first spends another 18 waits closing the curtain
// and redrawing the stage label.
export const BATTLE_CITY_STAGE_INTRO_TICKS = 97;
export const BATTLE_CITY_NEXT_STAGE_INTRO_TICKS = 115;
export const BATTLE_CITY_ENEMY_FIRE_CHANCE = 1 / 32;
export const BATTLE_CITY_ENEMY_TURN_CHANCE = 1 / 16;
export const BATTLE_CITY_CARRIER_FLASH_TICKS = 8;

export const BATTLE_CITY_CARRIER_ORDERS = [4, 11, 18] as const;

export const BATTLE_CITY_ENEMY_STATS: Readonly<
  Record<
    BattleCityEnemyType,
    {
      hitPoints: number;
      moveIntervalTicks: number;
      score: number;
      shotSpeed: number;
    }
  >
> = {
  basic: {
    hitPoints: 1,
    moveIntervalTicks: 2,
    score: 100,
    shotSpeed: BATTLE_CITY_PIXEL_STEP * 2,
  },
  fast: {
    hitPoints: 1,
    moveIntervalTicks: 1,
    score: 200,
    shotSpeed: BATTLE_CITY_PIXEL_STEP * 2,
  },
  power: {
    hitPoints: 1,
    moveIntervalTicks: 2,
    score: 300,
    shotSpeed: BATTLE_CITY_PIXEL_STEP * 4,
  },
  armor: {
    hitPoints: 4,
    moveIntervalTicks: 2,
    score: 400,
    shotSpeed: BATTLE_CITY_PIXEL_STEP * 2,
  },
};

export const BATTLE_CITY_TERRAIN_BY_SYMBOL: Readonly<
  Record<string, BattleCityTerrain>
> = {
  ".": "empty",
  B: "brick",
  H: "headquarters",
  I: "ice",
  S: "steel",
  T: "forest",
  W: "water",
};
