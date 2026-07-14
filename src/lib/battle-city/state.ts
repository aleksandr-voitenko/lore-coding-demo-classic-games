import type {
  BattleCityEnemy,
  BattleCityGameState,
  BattleCityMultiplayerGameState,
} from "./types";

export function isBattleCityMultiplayerGame(
  game: BattleCityGameState,
): game is BattleCityMultiplayerGameState {
  return game.player2 !== undefined;
}

export function isActiveEnemy(enemy: BattleCityEnemy): boolean {
  return enemy.spawnTicks === 0 && enemy.explosionTicks === 0;
}
