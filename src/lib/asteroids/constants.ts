import type {
  AsteroidSize,
  AsteroidsDifficulty,
  AsteroidsPowerUpKind,
  AsteroidsSaucerKind,
} from "./types";

export const ASTEROIDS_BOARD_WIDTH = 800;
export const ASTEROIDS_BOARD_HEIGHT = 600;
export const ASTEROIDS_DEFAULT_DIFFICULTY = "medium" satisfies AsteroidsDifficulty;
export const ASTEROIDS_STARTING_ASTEROID_COUNT = 4;
export const ASTEROIDS_STARTING_LIVES = 3;
export const ASTEROIDS_BONUS_LIFE_SCORE = 10_000;
export const ASTEROIDS_TICK_DELAY_MS = 16;
export const ASTEROIDS_RESPAWN_INVULNERABILITY_TICKS = Math.ceil(
  3_000 / ASTEROIDS_TICK_DELAY_MS,
);
export const ASTEROIDS_POWER_UP_SHIELD_TICKS = Math.ceil(
  20_000 / ASTEROIDS_TICK_DELAY_MS,
);
export const ASTEROIDS_POWER_UP_MIN_SPAWN_TICKS = Math.ceil(
  15_000 / ASTEROIDS_TICK_DELAY_MS,
);
export const ASTEROIDS_POWER_UP_MAX_SPAWN_TICKS = Math.ceil(
  30_000 / ASTEROIDS_TICK_DELAY_MS,
);
export const ASTEROIDS_BONUS_SCORE_POWER_UP_POINTS = 1_000;
export const ASTEROIDS_SHIP_EXPLOSION_TICKS = Math.ceil(700 / ASTEROIDS_TICK_DELAY_MS);
export const ASTEROIDS_DIFFICULTY_OPTIONS = [
  {
    asteroidCount: 3,
    label: "Easy",
    lives: 4,
    saucerInitialSpawnTicks: Math.ceil(24_000 / ASTEROIDS_TICK_DELAY_MS),
    saucerRespawnCooldownTicks: Math.ceil(32_000 / ASTEROIDS_TICK_DELAY_MS),
    value: "easy",
  },
  {
    asteroidCount: ASTEROIDS_STARTING_ASTEROID_COUNT,
    label: "Medium",
    lives: ASTEROIDS_STARTING_LIVES,
    saucerInitialSpawnTicks: Math.ceil(12_000 / ASTEROIDS_TICK_DELAY_MS),
    saucerRespawnCooldownTicks: Math.ceil(16_000 / ASTEROIDS_TICK_DELAY_MS),
    value: ASTEROIDS_DEFAULT_DIFFICULTY,
  },
  {
    asteroidCount: 5,
    label: "Hard",
    lives: 2,
    saucerInitialSpawnTicks: Math.ceil(6_000 / ASTEROIDS_TICK_DELAY_MS),
    saucerRespawnCooldownTicks: Math.ceil(8_000 / ASTEROIDS_TICK_DELAY_MS),
    value: "hard",
  },
] as const satisfies readonly {
  asteroidCount: number;
  label: string;
  lives: number;
  saucerInitialSpawnTicks: number;
  saucerRespawnCooldownTicks: number;
  value: AsteroidsDifficulty;
}[];
export const ASTEROIDS_SAUCER_INITIAL_SPAWN_TICKS =
  ASTEROIDS_DIFFICULTY_OPTIONS[1].saucerInitialSpawnTicks;

export const ASTEROID_SCORE: Record<AsteroidSize, number> = {
  large: 20,
  medium: 50,
  small: 100,
};
export const ASTEROIDS_SAUCER_SCORE: Record<AsteroidsSaucerKind, number> = {
  large: 200,
  small: 1_000,
};
export const ASTEROID_SPLIT_CHILDREN = 2;
export const BULLET_RADIUS = 2.5;
export const ASTEROIDS_INITIAL_PLAYER_SPEED_MULTIPLIER = 0.5;
export const ASTEROIDS_POWER_UP_SPEED_MULTIPLIER = 1.2;
export const ASTEROIDS_POWER_UP_SHOT_INTERVAL_MULTIPLIER = 0.8;
export const BULLET_SPEED = 8.6 * ASTEROIDS_INITIAL_PLAYER_SPEED_MULTIPLIER;
export const BULLET_TTL_TICKS = 58;
export const MAX_ACTIVE_BULLETS = 4;
export const ASTEROIDS_MOTION_SCALE = 0.8;
export const SAUCER_RADIUS: Record<AsteroidsSaucerKind, number> = {
  large: 18,
  small: 12,
};
export const SAUCER_SHOT_COOLDOWN_TICKS: Record<AsteroidsSaucerKind, number> = {
  large: Math.ceil(1_300 / ASTEROIDS_TICK_DELAY_MS),
  small: Math.ceil(900 / ASTEROIDS_TICK_DELAY_MS),
};
export const SAUCER_SHOT_RADIUS = 2.5;
export const SAUCER_SHOT_SPEED: Record<AsteroidsSaucerKind, number> = {
  large: 3.8,
  small: 4.4,
};
export const SAUCER_SHOT_SPREAD_RADIANS: Record<AsteroidsSaucerKind, number> = {
  large: Math.PI / 4,
  small: Math.PI / 10,
};
export const SAUCER_SHOT_TTL_TICKS = 140;
export const SAUCER_SPEED: Record<AsteroidsSaucerKind, number> = {
  large: 1.4,
  small: 1.8,
};
export const SHIP_FRICTION = 0.992;
export const SHIP_MAX_SPEED =
  6.2 * ASTEROIDS_MOTION_SCALE * ASTEROIDS_INITIAL_PLAYER_SPEED_MULTIPLIER;
export const SHIP_PICKUP_NOSE_RADIUS_MULTIPLIER = 1.42;
export const SHIP_PICKUP_WING_RADIUS_MULTIPLIER = 1.06;
export const SHIP_PICKUP_REAR_RADIUS_MULTIPLIER = 0.42;
export const SHIP_RADIUS = 14;
export const SHIP_THRUST =
  0.23 * ASTEROIDS_MOTION_SCALE * ASTEROIDS_INITIAL_PLAYER_SPEED_MULTIPLIER;
export const SHIP_TURN_DEGREES = 7;
export const SHOT_COOLDOWN_TICKS = Math.ceil(10 * 1.5 * 1.25);
export const POWER_UP_RADIUS = 12;
export const POWER_UP_PICKUP_RING_RADIUS_MULTIPLIER = 1.28;
export const POWER_UP_SPAWN_MARGIN = POWER_UP_RADIUS + 18;
export const POWER_UP_SPAWN_ATTEMPTS = 8;
export const POWER_UP_SHIP_SPAWN_PADDING = 72;
export const POWER_UP_ENTITY_SPAWN_PADDING = 8;
export const ASTEROIDS_POWER_UP_KINDS: AsteroidsPowerUpKind[] = [
  "shield",
  "bullet-speed",
  "shot-interval",
  "bonus-score",
  "engine-speed",
];
