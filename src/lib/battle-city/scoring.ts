import { BATTLE_CITY_BONUS_LIFE_SCORE } from "./constants";
import type { BattleCityGameState, BattleCityKillCounts } from "./types";

export const EMPTY_KILL_COUNTS: BattleCityKillCounts = {
  armor: 0,
  basic: 0,
  fast: 0,
  power: 0,
};

export function addScore(
  score: number,
  lives: number,
  bonusLifeAwarded: boolean,
  points: number,
  { canAwardBonusLife }: { canAwardBonusLife: boolean },
): Pick<BattleCityGameState, "bonusLifeAwarded" | "lives" | "score"> {
  const nextScore = score + points;
  const earnedBonus =
    canAwardBonusLife &&
    !bonusLifeAwarded &&
    score < BATTLE_CITY_BONUS_LIFE_SCORE &&
    nextScore >= BATTLE_CITY_BONUS_LIFE_SCORE;
  return {
    bonusLifeAwarded: bonusLifeAwarded || earnedBonus,
    lives: lives + (earnedBonus ? 1 : 0),
    score: nextScore,
  };
}
