import {
  SPACE_INVADERS_HIT_STREAK_BONUS_CAP,
  SPACE_INVADERS_HIT_STREAK_BONUS_STEP,
  SPACE_INVADERS_HIT_STREAK_POPUP_SCALE_CAP,
  SPACE_INVADERS_HIT_STREAK_POPUP_SCALE_STEP,
  SPACE_INVADERS_MULTI_KILL_BONUSES,
  SPACE_INVADERS_UFO_CHAIN_BONUS_CAP,
  SPACE_INVADERS_UFO_CHAIN_BONUS_STEP,
} from "./constants";
import type {
  SpaceInvadersGameState,
  SpaceInvadersScoreTarget,
} from "./types";

export function advanceSpaceInvadersHitStreak(
  game: SpaceInvadersGameState,
): { bonus: number; game: SpaceInvadersGameState } {
  const hitStreak = game.hitStreak + 1;
  const bonus = getSpaceInvadersHitStreakBonus(hitStreak);
  const gameWithHitStreak = {
    ...game,
    hitStreak,
    score: game.score + bonus,
  };

  return {
    bonus,
    game: gameWithHitStreak,
  };
}

export function resetSpaceInvadersHitStreak(game: SpaceInvadersGameState) {
  if (game.hitStreak === 0) {
    return game;
  }

  return {
    ...game,
    hitStreak: 0,
  };
}

export function advanceSpaceInvadersUfoChain(
  game: SpaceInvadersGameState,
): { bonus: number; game: SpaceInvadersGameState } {
  const ufoHitStreak = game.ufoHitStreak + 1;
  const bonus = getSpaceInvadersUfoChainBonus(ufoHitStreak);
  const gameWithUfoHitStreak = {
    ...game,
    ufoHitStreak,
    score: game.score + bonus,
  };

  return {
    bonus,
    game: gameWithUfoHitStreak,
  };
}

export function getSpaceInvadersHitStreakBonus(hitStreak: number) {
  return Math.min(
    Math.max(0, hitStreak - 1) * SPACE_INVADERS_HIT_STREAK_BONUS_STEP,
    SPACE_INVADERS_HIT_STREAK_BONUS_CAP,
  );
}

export function getSpaceInvadersHitStreakPopupScale(hitStreak: number) {
  const scoreScale = Math.min(
    1 + Math.max(0, hitStreak - 1) * SPACE_INVADERS_HIT_STREAK_POPUP_SCALE_STEP,
    SPACE_INVADERS_HIT_STREAK_POPUP_SCALE_CAP,
  );

  return Number(scoreScale.toFixed(2));
}

export function getSpaceInvadersUfoChainBonus(ufoHitStreak: number) {
  return Math.min(
    Math.max(0, ufoHitStreak - 1) * SPACE_INVADERS_UFO_CHAIN_BONUS_STEP,
    SPACE_INVADERS_UFO_CHAIN_BONUS_CAP,
  );
}

export function getSpaceInvadersMultiKillBonus(destroyedInvaderCount: number) {
  if (destroyedInvaderCount >= 4) {
    return SPACE_INVADERS_MULTI_KILL_BONUSES[4];
  }

  if (destroyedInvaderCount === 3) {
    return SPACE_INVADERS_MULTI_KILL_BONUSES[3];
  }

  if (destroyedInvaderCount === 2) {
    return SPACE_INVADERS_MULTI_KILL_BONUSES[2];
  }

  return 0;
}

export function getSpaceInvadersInvaderScorePopupLabel(
  destroyedInvaderCount: number,
  multiKillBonus: number,
) {
  if (multiKillBonus > 0) {
    if (destroyedInvaderCount === 2) {
      return "DOUBLE";
    }

    if (destroyedInvaderCount === 3) {
      return "TRIPLE";
    }

    return "MULTI";
  }

  return undefined;
}

export function getCombinedSpaceInvadersScoreTarget(
  targets: SpaceInvadersScoreTarget[],
): SpaceInvadersScoreTarget {
  const left = Math.min(...targets.map((target) => target.x));
  const top = Math.min(...targets.map((target) => target.y));
  const right = Math.max(...targets.map((target) => target.x + target.width));
  const bottom = Math.max(...targets.map((target) => target.y + target.height));

  return {
    height: bottom - top,
    width: right - left,
    x: left,
    y: top,
  };
}
