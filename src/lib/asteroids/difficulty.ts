import {
  ASTEROIDS_DEFAULT_DIFFICULTY,
  ASTEROIDS_DIFFICULTY_OPTIONS,
} from "./constants";
import type { AsteroidsDifficulty } from "./types";

export function normalizeAsteroidsDifficulty(
  value: string | null | undefined,
): AsteroidsDifficulty {
  return ASTEROIDS_DIFFICULTY_OPTIONS.find((option) => option.value === value)?.value ??
    ASTEROIDS_DEFAULT_DIFFICULTY;
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
