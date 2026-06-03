import type { SpaceInvadersRandomSource } from "./types";

export function getRandomIndex(
  candidateCount: number,
  random: SpaceInvadersRandomSource,
) {
  if (candidateCount <= 1) {
    return 0;
  }

  const randomValue = getRandomValue(random);

  return Math.max(0, Math.min(candidateCount - 1, Math.floor(randomValue * candidateCount)));
}

export function getRandomValue(random: SpaceInvadersRandomSource) {
  const randomValue = random();

  if (!Number.isFinite(randomValue)) {
    return 0;
  }

  return Math.max(0, Math.min(1, randomValue));
}
