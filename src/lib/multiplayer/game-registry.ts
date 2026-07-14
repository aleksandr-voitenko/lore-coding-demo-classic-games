import type { GameId } from "../game-catalog";

type MultiplayerGameRegistryEntry = {
  id: GameId;
  isDefault: boolean;
};

const MULTIPLAYER_GAME_REGISTRY = [
  { id: "space-invaders", isDefault: false },
  { id: "pong", isDefault: true },
  { id: "asteroids", isDefault: false },
  { id: "battle-city", isDefault: false },
] as const satisfies readonly MultiplayerGameRegistryEntry[];

export type MultiplayerGameId =
  (typeof MULTIPLAYER_GAME_REGISTRY)[number]["id"];

export const MULTIPLAYER_GAME_IDS: readonly MultiplayerGameId[] =
  MULTIPLAYER_GAME_REGISTRY.map((game) => game.id);

const multiplayerGameIds = new Set<string>(MULTIPLAYER_GAME_IDS);

export const DEFAULT_MULTIPLAYER_GAME_ID = getDefaultMultiplayerGameId();

export function isMultiplayerGameId(value: string): value is MultiplayerGameId {
  return multiplayerGameIds.has(value);
}

function getDefaultMultiplayerGameId(): MultiplayerGameId {
  const defaultGames = MULTIPLAYER_GAME_REGISTRY.filter(
    (game) => game.isDefault,
  );

  if (defaultGames.length !== 1) {
    throw new Error("The multiplayer game registry requires exactly one default game.");
  }

  return defaultGames[0].id;
}
