import type {
  SpaceInvadersExplosionKind,
  SpaceInvadersPowerUpKind,
} from "./types";

export const SPACE_INVADERS_BOARD_WIDTH = 420;
export const SPACE_INVADERS_BOARD_HEIGHT = 560;
export const SPACE_INVADERS_COLUMNS = 10;
export const SPACE_INVADERS_ROWS = 5;
export const SPACE_INVADERS_STARTING_LIVES = 3;
export const SPACE_INVADERS_BASE_Y = 492;
export const SPACE_INVADERS_TICK_DELAY_MS = 34;
export const SPACE_INVADERS_BOARD_SIZE_OPTIONS = [
  { height: 560, label: "420 x 560", width: 420 },
  { height: 640, label: "480 x 640", width: 480 },
  { height: 720, label: "540 x 720", width: 540 },
] as const;
export const SPACE_INVADERS_ALIEN_COUNT_OPTIONS = [
  { alienCount: 24, columns: 8, label: "24", rows: 3 },
  { alienCount: 40, columns: 10, label: "40", rows: 4 },
  { alienCount: 50, columns: 10, label: "50", rows: 5 },
] as const;
export const SPACE_INVADERS_EXPLOSION_VARIANTS = [1, 2, 3, 4] as const;
export const SPACE_INVADERS_POWER_UP_KINDS: SpaceInvadersPowerUpKind[] = [
  "bonus-score",
  "burst-shot",
  "extra-life",
  "freeze",
  "piercing-laser",
  "shield",
  "shotgun-shot",
];
export const SPACE_INVADERS_COMMON_POWER_UP_KINDS: Exclude<
  SpaceInvadersPowerUpKind,
  "extra-life"
>[] = [
  "bonus-score",
  "burst-shot",
  "freeze",
  "piercing-laser",
  "shield",
  "shotgun-shot",
];

export const INVADER_DROP_Y = 4;
export const DIVER_INVADER_COUNT = 10;
export const DIVER_DROP_Y = 16;
export const DIVER_STEP_MULTIPLIER = 4.375;
export const FORMATION_SPEEDUP_START_RATIO = 0.5;
export const FORMATION_MAX_SPEED_MULTIPLIER = 1.5;
export const SPACE_INVADERS_SHIELD_BEARER_COUNT = 4;
export const SPACE_INVADERS_REVENGE_ALIEN_COUNT = 3;
export const SPACE_INVADERS_REVENGE_VOLLEY_TARGET_COUNT = 5;
export const SPACE_INVADERS_REVENGE_VOLLEY_WINDUP_TICKS = Math.round(
  2_000 / SPACE_INVADERS_TICK_DELAY_MS,
);
export const SPACE_INVADERS_SPLITTER_ALIEN_COUNT = 3;
export const SPACE_INVADERS_ARMORED_ALIEN_COUNT = 3;
export const SPACE_INVADERS_ARMORED_ALIEN_HIT_POINTS = 3;
export const SPACE_INVADERS_MINE_LAYER_ALIEN_COUNT = 3;
export const EXPLOSION_PADDING_BY_KIND: Record<SpaceInvadersExplosionKind, number> = {
  invader: 16,
  mine: 36,
  player: 12,
  projectile: 0,
  shield: 0,
  ufo: 18,
};
export const EXPLOSION_TTL_TICKS = 12;
export const SPACE_INVADERS_SCORE_POPUP_TICKS = Math.round(
  1_600 / SPACE_INVADERS_TICK_DELAY_MS,
);
export const SPACE_INVADERS_PLAYER_RESPAWN_TICKS = EXPLOSION_TTL_TICKS;
export const SPACE_INVADERS_PLAYER_SHIELD_TICKS = Math.round(
  5_000 / SPACE_INVADERS_TICK_DELAY_MS,
);
export const SPACE_INVADERS_PLAYER_SHIELD_FLASH_TICKS = Math.round(
  2_000 / SPACE_INVADERS_TICK_DELAY_MS,
);
export const SPACE_INVADERS_BONUS_SCORE_POINTS = 50;
export const SPACE_INVADERS_HIT_STREAK_BONUS_STEP = 5;
export const SPACE_INVADERS_HIT_STREAK_BONUS_CAP = 30;
export const SPACE_INVADERS_HIT_STREAK_POPUP_SCALE_STEP = 0.08;
export const SPACE_INVADERS_HIT_STREAK_POPUP_SCALE_CAP = 1.48;
export const SPACE_INVADERS_MULTI_KILL_BONUSES = {
  2: 25,
  3: 60,
  4: 100,
} as const;
export const SPACE_INVADERS_MULTI_KILL_COMBO_TICKS = Math.round(
  700 / SPACE_INVADERS_TICK_DELAY_MS,
);
export const SPACE_INVADERS_UFO_CHAIN_BONUS_STEP = 50;
export const SPACE_INVADERS_UFO_CHAIN_BONUS_CAP = 150;
export const SPACE_INVADERS_EXTRA_LIFE_DROP_CHANCE = 0.05;
export const SPACE_INVADERS_ALIEN_FREEZE_TICKS = Math.round(
  5_000 / SPACE_INVADERS_TICK_DELAY_MS,
);
export const SPACE_INVADERS_POWER_UP_SHIELD_TICKS = Math.round(
  10_000 / SPACE_INVADERS_TICK_DELAY_MS,
);
export const SPACE_INVADERS_PLAYER_BURST_SHOT_COUNT = 5;
export const SPACE_INVADERS_PLAYER_BURST_SHOT_DELAY_TICKS = Math.max(
  0,
  Math.round(300 / SPACE_INVADERS_TICK_DELAY_MS) - 1,
);
export const INVADER_GAP_X = 9;
export const INVADER_GAP_Y = 14;
export const INVADER_HEIGHT = 23;
export const INVADER_STEP_X = 0.8;
export const INVADER_TOP = 64;
export const INVADER_WIDTH = 28;
export const SPACE_INVADERS_PROJECTILE_EXPLOSION_HEIGHT =
  (INVADER_HEIGHT + EXPLOSION_PADDING_BY_KIND.invader * 2) / 3;
export const SPACE_INVADERS_PROJECTILE_EXPLOSION_WIDTH =
  (INVADER_WIDTH + EXPLOSION_PADDING_BY_KIND.invader * 2) / 3;
export const INVADER_SPRITE_SIZE = 112;
export const SPLITTER_FRAGMENT_GAP_X = 4;
export const SPLITTER_FRAGMENT_HEIGHT = INVADER_HEIGHT * 0.7;
export const SPLITTER_FRAGMENT_WIDTH = INVADER_WIDTH * 0.7;
export const INVADER_FIRE_COOLDOWN_TICKS = 80;
export const INVADER_HIT_RECOVERY_TICKS = 120;
export const MAX_INVADER_SHOTS = 3;
export const PLAYER_BOTTOM_MARGIN = 10;
export const PLAYER_SIZE_SCALE = 0.8;
export const INVADER_X = 38;
export const PLAYER_HEIGHT = 50 * PLAYER_SIZE_SCALE;
export const PLAYER_SPEED = 9.6;
export const PLAYER_WIDTH = 62 * PLAYER_SIZE_SCALE;
export const SHOT_HEIGHT = 22;
export const SHOT_SPEED = -6.4;
export const SHOT_WIDTH = 6;
export const PIERCING_SHOT_HEIGHT = SHOT_HEIGHT * 2;
export const PIERCING_SHOT_SPEED = SHOT_SPEED * 2;
export const SPACE_INVADERS_POWER_UP_SIZE = 36;
export const SPACE_INVADERS_POWER_UP_SPEED = Math.abs(SHOT_SPEED) * 0.75;
export const UFO_COOLDOWN_TICKS = 420;
export const UFO_HEIGHT = 18;
export const UFO_POINT_VALUES = [100, 150, 200, 300] as const;
export const UFO_SPEED = 2.4;
export const UFO_WIDTH = 48;
export const UFO_Y = 34;
export const BURST_SHOT_COUNT = 3;
export const BURST_SHOT_DELAY_TICKS = Math.max(
  0,
  Math.round(1_000 / SPACE_INVADERS_TICK_DELAY_MS) - 1,
);
export const COMMANDER_SHOT_MAX_SPEED_X = 1.1;
export const COMMANDER_SHOT_STEER_X = 0.14;
export const SCATTER_SHOT_VELOCITIES_X = [-1.25, 0, 1.25] as const;
export const SHOTGUN_SHOT_VELOCITIES_X = [-2.4, -1.2, 0, 1.2, 2.4] as const;
