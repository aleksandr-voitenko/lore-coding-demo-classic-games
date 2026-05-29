export const GAME_CATALOG = [
  {
    id: "snake",
    label: "Classic Snake",
  },
  {
    id: "tetris",
    label: "Classic Tetris",
  },
  {
    id: "breakout",
    label: "Classic Breakout",
  },
  {
    id: "minesweeper",
    label: "Classic Minesweeper",
  },
  {
    id: "space-invaders",
    label: "Classic Space Invaders",
  },
  {
    id: "twenty-forty-eight",
    label: "Classic 2048",
  },
  {
    id: "pong",
    label: "Classic Pong",
  },
  {
    id: "simon",
    label: "Classic Simon",
  },
] as const;

export type GameCatalogEntry = (typeof GAME_CATALOG)[number];
export type GameId = GameCatalogEntry["id"];

const GAME_CATALOG_BY_ID = Object.fromEntries(
  GAME_CATALOG.map((game) => [game.id, game]),
) as Readonly<Record<GameId, GameCatalogEntry>>;

export function isGameId(value: string): value is GameId {
  return Object.hasOwn(GAME_CATALOG_BY_ID, value);
}

export function getGameCatalogEntry(gameId: GameId) {
  return GAME_CATALOG_BY_ID[gameId];
}

export function formatGameCatalogLabel(gameId: string) {
  if (isGameId(gameId)) {
    return getGameCatalogEntry(gameId).label;
  }

  return gameId
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
