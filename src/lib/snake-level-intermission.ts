import type { GameState } from "@/lib/snake-game-engine";

export const SNAKE_LEVEL_INTERMISSION_MS = 1_400;

export function getSnakeLevelIntermissionLevel(
  previousGame: Pick<GameState, "level" | "status">,
  nextGame: Pick<GameState, "level" | "status">,
) {
  if (
    previousGame.status !== "running" ||
    nextGame.status !== "running" ||
    nextGame.level !== previousGame.level + 1
  ) {
    return null;
  }

  return nextGame.level;
}
