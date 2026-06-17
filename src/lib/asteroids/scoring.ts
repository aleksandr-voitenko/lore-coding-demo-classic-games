import {
  ASTEROIDS_BONUS_LIFE_SCORE,
  ASTEROIDS_SAUCER_SCORE,
  ASTEROID_SCORE,
} from "./constants";
import type { AsteroidSize, AsteroidsSaucerKind } from "./types";

export function getAsteroidsAsteroidScore(size: AsteroidSize) {
  return ASTEROID_SCORE[size];
}

export function getAsteroidsSaucerScore(kind: AsteroidsSaucerKind) {
  return ASTEROIDS_SAUCER_SCORE[kind];
}

export function getBonusLivesAwarded(previousScore: number, nextScore: number) {
  if (nextScore <= previousScore) {
    return 0;
  }

  return (
    Math.floor(nextScore / ASTEROIDS_BONUS_LIFE_SCORE) -
    Math.floor(previousScore / ASTEROIDS_BONUS_LIFE_SCORE)
  );
}
