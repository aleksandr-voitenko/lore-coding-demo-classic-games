import type { AsteroidsDifficulty } from "./types";

export const ASTEROIDS_TICK_DELAY_MS = 16;
export const ASTEROIDS_DEFAULT_DIFFICULTY = "medium" satisfies AsteroidsDifficulty;
export const ASTEROIDS_STARTING_ASTEROID_COUNT = 4;
export const ASTEROIDS_STARTING_LIVES = 3;
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

export function normalizeAsteroidsDifficulty(
  value: string | null | undefined,
): AsteroidsDifficulty {
  return (
    ASTEROIDS_DIFFICULTY_OPTIONS.find((option) => option.value === value)?.value ??
    ASTEROIDS_DEFAULT_DIFFICULTY
  );
}

export function getAsteroidsDifficultySettings(difficulty: AsteroidsDifficulty) {
  return (
    ASTEROIDS_DIFFICULTY_OPTIONS.find((option) => option.value === difficulty) ??
    ASTEROIDS_DIFFICULTY_OPTIONS[1]
  );
}

export function getAsteroidsDifficultyLabel(difficulty: AsteroidsDifficulty) {
  return getAsteroidsDifficultySettings(difficulty).label;
}

export type { AsteroidsDifficulty } from "./types";
