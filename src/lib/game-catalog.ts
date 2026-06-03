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
  {
    id: "asteroids",
    label: "Classic Asteroids",
  },
] as const;

export type GameCatalogEntry = (typeof GAME_CATALOG)[number];
export type GameId = GameCatalogEntry["id"];
export type GameCatalogArtwork = {
  height: number;
  src: string;
  width: number;
};

const GAME_CATALOG_BY_ID = Object.fromEntries(
  GAME_CATALOG.map((game) => [game.id, game]),
) as Readonly<Record<GameId, GameCatalogEntry>>;

const GAME_CATALOG_ORDER_BY_ID = Object.fromEntries(
  GAME_CATALOG.map((game, index) => [game.id, index]),
) as Readonly<Record<GameId, number>>;

const GAME_CARD_ARTWORK_VERSION = "ai-key-art-v2";

const GAME_CATALOG_ARTWORK_BY_ID = {
  snake: {
    height: 941,
    src: "/images/snake-game-card.png",
    width: 1672,
  },
  tetris: {
    height: 941,
    src: "/images/tetris-game-card.png",
    width: 1672,
  },
  breakout: {
    height: 941,
    src: "/images/breakout-game-card.png",
    width: 1672,
  },
  minesweeper: {
    height: 941,
    src: "/images/minesweeper-game-card.png",
    width: 1672,
  },
  "space-invaders": {
    height: 941,
    src: "/images/space-invaders-game-card.png",
    width: 1672,
  },
  "twenty-forty-eight": {
    height: 941,
    src: "/images/twenty-forty-eight-game-card.png",
    width: 1672,
  },
  pong: {
    height: 941,
    src: "/images/pong-game-card.png",
    width: 1672,
  },
  simon: {
    height: 941,
    src: "/images/simon-game-card.png",
    width: 1672,
  },
  asteroids: {
    height: 941,
    src: "/images/asteroids-game-card.png",
    width: 1672,
  },
} satisfies Readonly<Record<GameId, GameCatalogArtwork>>;

export function isGameId(value: string): value is GameId {
  return Object.hasOwn(GAME_CATALOG_BY_ID, value);
}

export function getGameCatalogEntry(gameId: GameId) {
  return GAME_CATALOG_BY_ID[gameId];
}

export function getGameCatalogArtwork(gameId: GameId): GameCatalogArtwork;
export function getGameCatalogArtwork(gameId: string): GameCatalogArtwork | null;
export function getGameCatalogArtwork(gameId: string) {
  if (isGameId(gameId)) {
    return GAME_CATALOG_ARTWORK_BY_ID[gameId];
  }

  return null;
}

export function getVersionedGameCatalogArtworkSrc(artwork: GameCatalogArtwork) {
  return `${artwork.src}?v=${GAME_CARD_ARTWORK_VERSION}`;
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

export function compareGameCatalogOrder(leftGameId: string, rightGameId: string) {
  const leftIndex = isGameId(leftGameId) ? GAME_CATALOG_ORDER_BY_ID[leftGameId] : Infinity;
  const rightIndex = isGameId(rightGameId) ? GAME_CATALOG_ORDER_BY_ID[rightGameId] : Infinity;

  if (leftIndex !== rightIndex) {
    return leftIndex - rightIndex;
  }

  return leftGameId.localeCompare(rightGameId);
}
