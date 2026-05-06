import {
  BONUS_FOOD_SCORE,
  getGameSpeed,
  isSamePoint,
  SLOW_FOOD_SCORE,
  SLOW_FOOD_SPEED_DECREASE,
  SPEED_FOOD_SCORE,
  SPEED_FOOD_SPEED_INCREASE,
  type GameState,
  type Point,
} from "./snake-game-engine";

export type FoodFeedback = {
  id: number;
  lines: string[];
  position: Point;
};

const POINT_REWARD_ICON = "🟡";
const SPEED_REWARD_ICON = "⚡";

export function createFoodFeedback(
  previousGame: GameState,
  nextGame: GameState,
  id: number,
): FoodFeedback | null {
  if (
    previousGame.status !== "running" ||
    nextGame.status !== "running" ||
    nextGame.score <= previousGame.score
  ) {
    return null;
  }

  const position = nextGame.snake[0];
  const lines: string[] = [];

  if (isSamePoint(position, previousGame.food)) {
    lines.push(`+1 ${POINT_REWARD_ICON}`);
  }

  if (
    previousGame.bonusFood !== null &&
    isSamePoint(position, previousGame.bonusFood.position)
  ) {
    lines.push(`+${BONUS_FOOD_SCORE} ${POINT_REWARD_ICON}`);
  }

  if (
    previousGame.speedFood !== null &&
    isSamePoint(position, previousGame.speedFood.position)
  ) {
    lines.push(
      `+${SPEED_FOOD_SCORE} ${POINT_REWARD_ICON}`,
      `+${SPEED_FOOD_SPEED_INCREASE} ${SPEED_REWARD_ICON}`,
    );
  }

  if (
    previousGame.slowFood !== null &&
    isSamePoint(position, previousGame.slowFood.position)
  ) {
    lines.push(`+${SLOW_FOOD_SCORE} ${POINT_REWARD_ICON}`);

    if ((getGameSpeed(nextGame) ?? 1) < (getGameSpeed(previousGame) ?? 1)) {
      lines.push(`-${SLOW_FOOD_SPEED_DECREASE} ${SPEED_REWARD_ICON}`);
    }
  }

  if (lines.length === 0) {
    return null;
  }

  return {
    id,
    lines,
    position,
  };
}
