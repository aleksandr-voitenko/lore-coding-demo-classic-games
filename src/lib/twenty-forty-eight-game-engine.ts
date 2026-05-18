export type TwentyFortyEightStatus = "ready" | "running" | "won" | "lost";
export type TwentyFortyEightDirection = "up" | "down" | "left" | "right";

export type TwentyFortyEightTile = {
  id: string;
  value: number;
  x: number;
  y: number;
};

export type TwentyFortyEightGameState = {
  bestScore: number;
  moveCount: number;
  nextTileId: number;
  score: number;
  status: TwentyFortyEightStatus;
  tiles: TwentyFortyEightTile[];
};

export type CreateTwentyFortyEightGameOptions = {
  bestScore?: number;
  random?: RandomSource;
};

export type MoveTwentyFortyEightGameOptions = {
  random?: RandomSource;
};

type RandomSource = () => number;

type BoardCell = {
  x: number;
  y: number;
};

type LineResult = {
  gainedScore: number;
  tiles: TwentyFortyEightTile[];
};

export const TWENTY_FORTY_EIGHT_BOARD_SIZE = 4;
export const TWENTY_FORTY_EIGHT_STARTING_TILE_COUNT = 2;
export const TWENTY_FORTY_EIGHT_WIN_TILE = 2048;

export function createInitialTwentyFortyEightGame({
  bestScore = 0,
  random = Math.random,
}: CreateTwentyFortyEightGameOptions = {}): TwentyFortyEightGameState {
  let game: TwentyFortyEightGameState = {
    bestScore,
    moveCount: 0,
    nextTileId: 1,
    score: 0,
    status: "ready",
    tiles: [],
  };

  for (let tileCount = 0; tileCount < TWENTY_FORTY_EIGHT_STARTING_TILE_COUNT; tileCount += 1) {
    game = addRandomTwentyFortyEightTile(game, random);
  }

  return game;
}

export function startTwentyFortyEightGame(
  game: TwentyFortyEightGameState,
): TwentyFortyEightGameState {
  if (game.status === "ready") {
    return {
      ...game,
      status: "running" as const,
    };
  }

  return game;
}

export function restartTwentyFortyEightGame(
  game: Pick<TwentyFortyEightGameState, "bestScore"> = { bestScore: 0 },
  { random = Math.random }: CreateTwentyFortyEightGameOptions = {},
) {
  return createInitialTwentyFortyEightGame({
    bestScore: game.bestScore,
    random,
  });
}

export function moveTwentyFortyEightGame(
  game: TwentyFortyEightGameState,
  direction: TwentyFortyEightDirection,
  { random = Math.random }: MoveTwentyFortyEightGameOptions = {},
): TwentyFortyEightGameState {
  if (game.status === "lost" || game.status === "won") {
    return game;
  }

  if (!canMoveTwentyFortyEightGame(game)) {
    return {
      ...game,
      status: "lost" as const,
    };
  }

  const { gainedScore, tiles } = slideTiles(game.tiles, direction);

  if (!didBoardChange(game.tiles, tiles)) {
    return game;
  }

  const score = game.score + gainedScore;
  const gameAfterMove: TwentyFortyEightGameState = {
    ...game,
    bestScore: Math.max(game.bestScore, score),
    moveCount: game.moveCount + 1,
    score,
    status: "running",
    tiles,
  };
  const gameAfterSpawn = addRandomTwentyFortyEightTile(gameAfterMove, random);
  const hasWon = gameAfterSpawn.tiles.some((tile) => tile.value >= TWENTY_FORTY_EIGHT_WIN_TILE);

  if (hasWon) {
    return {
      ...gameAfterSpawn,
      status: "won" as const,
    };
  }

  if (!canMoveTwentyFortyEightGame(gameAfterSpawn)) {
    return {
      ...gameAfterSpawn,
      status: "lost" as const,
    };
  }

  return gameAfterSpawn;
}

export function canMoveTwentyFortyEightGame(game: Pick<TwentyFortyEightGameState, "tiles">) {
  if (game.tiles.length < TWENTY_FORTY_EIGHT_BOARD_SIZE * TWENTY_FORTY_EIGHT_BOARD_SIZE) {
    return true;
  }

  return game.tiles.some((tile) => {
    const rightNeighbor = getTwentyFortyEightTileAt(game, tile.x + 1, tile.y);
    const lowerNeighbor = getTwentyFortyEightTileAt(game, tile.x, tile.y + 1);

    return rightNeighbor?.value === tile.value || lowerNeighbor?.value === tile.value;
  });
}

export function createTwentyFortyEightBoardCells() {
  return Array.from({ length: TWENTY_FORTY_EIGHT_BOARD_SIZE }, (_, y) =>
    Array.from({ length: TWENTY_FORTY_EIGHT_BOARD_SIZE }, (_, x): BoardCell => ({ x, y })),
  ).flat();
}

export function getTwentyFortyEightTileAt(
  game: Pick<TwentyFortyEightGameState, "tiles">,
  x: number,
  y: number,
) {
  return game.tiles.find((tile) => tile.x === x && tile.y === y) ?? null;
}

export function getTwentyFortyEightTopTile(game: Pick<TwentyFortyEightGameState, "tiles">) {
  return game.tiles.reduce((topTile, tile) => Math.max(topTile, tile.value), 0);
}

function addRandomTwentyFortyEightTile(
  game: TwentyFortyEightGameState,
  random: RandomSource,
): TwentyFortyEightGameState {
  const emptyCells = createTwentyFortyEightBoardCells().filter(
    (cell) => getTwentyFortyEightTileAt(game, cell.x, cell.y) === null,
  );

  if (emptyCells.length === 0) {
    return game;
  }

  const cellIndex = Math.min(Math.floor(random() * emptyCells.length), emptyCells.length - 1);
  const cell = emptyCells[cellIndex]!;
  const value = random() < 0.9 ? 2 : 4;

  return {
    ...game,
    nextTileId: game.nextTileId + 1,
    tiles: sortTwentyFortyEightTiles([
      ...game.tiles,
      {
        id: `tile-${game.nextTileId}`,
        value,
        x: cell.x,
        y: cell.y,
      },
    ]),
  };
}

function slideTiles(
  tiles: TwentyFortyEightTile[],
  direction: TwentyFortyEightDirection,
): LineResult {
  return getTraversalLines(direction).reduce<LineResult>(
    (result, line) => {
      const tilesByPosition = new Map(tiles.map((tile) => [`${tile.x}:${tile.y}`, tile]));
      const lineTiles = line
        .map((cell) => tilesByPosition.get(`${cell.x}:${cell.y}`))
        .filter((tile): tile is TwentyFortyEightTile => tile !== undefined);
      const mergedLine = mergeLine(lineTiles, line);

      return {
        gainedScore: result.gainedScore + mergedLine.gainedScore,
        tiles: result.tiles.concat(mergedLine.tiles),
      };
    },
    { gainedScore: 0, tiles: [] },
  );
}

function mergeLine(tiles: TwentyFortyEightTile[], targetCells: BoardCell[]): LineResult {
  const mergedTiles: TwentyFortyEightTile[] = [];
  let gainedScore = 0;
  let targetIndex = 0;

  for (let tileIndex = 0; tileIndex < tiles.length; tileIndex += 1) {
    const tile = tiles[tileIndex]!;
    const nextTile = tiles[tileIndex + 1];
    const targetCell = targetCells[targetIndex]!;

    if (nextTile && nextTile.value === tile.value) {
      const mergedValue = tile.value * 2;

      mergedTiles.push({
        ...tile,
        value: mergedValue,
        x: targetCell.x,
        y: targetCell.y,
      });
      gainedScore += mergedValue;
      tileIndex += 1;
    } else {
      mergedTiles.push({
        ...tile,
        x: targetCell.x,
        y: targetCell.y,
      });
    }

    targetIndex += 1;
  }

  return {
    gainedScore,
    tiles: sortTwentyFortyEightTiles(mergedTiles),
  };
}

function getTraversalLines(direction: TwentyFortyEightDirection): BoardCell[][] {
  return Array.from({ length: TWENTY_FORTY_EIGHT_BOARD_SIZE }, (_, lineIndex) => {
    const cells = Array.from({ length: TWENTY_FORTY_EIGHT_BOARD_SIZE }, (_, cellIndex) => {
      if (direction === "left" || direction === "right") {
        return { x: cellIndex, y: lineIndex };
      }

      return { x: lineIndex, y: cellIndex };
    });

    if (direction === "right" || direction === "down") {
      return cells.reverse();
    }

    return cells;
  });
}

function didBoardChange(
  previousTiles: TwentyFortyEightTile[],
  nextTiles: TwentyFortyEightTile[],
) {
  if (previousTiles.length !== nextTiles.length) {
    return true;
  }

  const nextTilesById = new Map(nextTiles.map((tile) => [tile.id, tile]));

  return previousTiles.some((previousTile) => {
    const nextTile = nextTilesById.get(previousTile.id);

    return (
      nextTile === undefined ||
      nextTile.value !== previousTile.value ||
      nextTile.x !== previousTile.x ||
      nextTile.y !== previousTile.y
    );
  });
}

function sortTwentyFortyEightTiles(tiles: TwentyFortyEightTile[]) {
  return [...tiles].sort((firstTile, secondTile) => {
    if (firstTile.y !== secondTile.y) {
      return firstTile.y - secondTile.y;
    }

    return firstTile.x - secondTile.x;
  });
}
