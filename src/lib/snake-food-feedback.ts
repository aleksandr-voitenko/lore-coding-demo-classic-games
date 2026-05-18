import {
  getActiveTimedFoodEntries,
  getGameSpeed,
  isSamePoint,
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
const TAIL_TRIM_REWARD_ICON = "✂";

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

  if (previousGame.food !== null && isSamePoint(position, previousGame.food)) {
    lines.push(`+1 ${POINT_REWARD_ICON}`);
  }

  getActiveTimedFoodEntries(previousGame).forEach(({ rule, timedFood }) => {
    if (!isSamePoint(position, timedFood.position)) {
      return;
    }

    lines.push(`+${rule.score} ${POINT_REWARD_ICON}`);

    if (rule.speedEffect?.direction === "increase") {
      lines.push(`+${rule.speedEffect.amount} ${SPEED_REWARD_ICON}`);
    }

    if (
      rule.speedEffect?.direction === "decrease" &&
      (getGameSpeed(nextGame) ?? 1) < (getGameSpeed(previousGame) ?? 1)
    ) {
      lines.push(`-${rule.speedEffect.amount} ${SPEED_REWARD_ICON}`);
    }

    if (
      rule.lengthEffect.direction === "shrink" &&
      nextGame.snake.length < previousGame.snake.length
    ) {
      lines.push(`-${previousGame.snake.length - nextGame.snake.length} ${TAIL_TRIM_REWARD_ICON}`);
    }
  });

  if (lines.length === 0) {
    return null;
  }

  return {
    id,
    lines,
    position,
  };
}
