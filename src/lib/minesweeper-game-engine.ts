export type MinesweeperStatus = "ready" | "running" | "lost" | "won";
export type MinefieldStatus = "pending" | "placed";

export type MinesweeperCell = {
  adjacentMines: number;
  id: string;
  isFlagged: boolean;
  isMine: boolean;
  isRevealed: boolean;
  x: number;
  y: number;
};

export type MinesweeperGameState = {
  cells: MinesweeperCell[];
  flagCount: number;
  height: number;
  mineCount: number;
  minefieldStatus: MinefieldStatus;
  revealedSafeCellCount: number;
  status: MinesweeperStatus;
  width: number;
};

export type CreateMinesweeperGameOptions = {
  height?: number;
  mineCount?: number;
  width?: number;
};

export type RevealMinesweeperCellOptions = {
  random?: RandomSource;
};

type RandomSource = () => number;

export const MINESWEEPER_BOARD_WIDTH = 9;
export const MINESWEEPER_BOARD_HEIGHT = 9;
export const MINESWEEPER_MINE_COUNT = 10;
export const MINESWEEPER_BOARD_SIZE_OPTIONS = [
  { height: 9, label: "9 x 9", width: 9 },
  { height: 12, label: "12 x 12", width: 12 },
  { height: 16, label: "16 x 16", width: 16 },
] as const;
export const MINESWEEPER_MINE_COUNT_OPTIONS = [10, 20, 40] as const;

export function createInitialMinesweeperGame({
  height = MINESWEEPER_BOARD_HEIGHT,
  mineCount = MINESWEEPER_MINE_COUNT,
  width = MINESWEEPER_BOARD_WIDTH,
}: CreateMinesweeperGameOptions = {}): MinesweeperGameState {
  const normalizedWidth = Math.max(1, Math.floor(width));
  const normalizedHeight = Math.max(1, Math.floor(height));
  const cellCount = normalizedWidth * normalizedHeight;
  const normalizedMineCount = Math.max(0, Math.min(Math.floor(mineCount), cellCount - 1));

  return {
    cells: createEmptyCells(normalizedWidth, normalizedHeight),
    flagCount: 0,
    height: normalizedHeight,
    mineCount: normalizedMineCount,
    minefieldStatus: "pending",
    revealedSafeCellCount: 0,
    status: "ready",
    width: normalizedWidth,
  };
}

export function restartMinesweeperGame(
  game: Pick<MinesweeperGameState, "height" | "mineCount" | "width"> = {
    height: MINESWEEPER_BOARD_HEIGHT,
    mineCount: MINESWEEPER_MINE_COUNT,
    width: MINESWEEPER_BOARD_WIDTH,
  },
) {
  return createInitialMinesweeperGame({
    height: game.height,
    mineCount: game.mineCount,
    width: game.width,
  });
}

export function revealMinesweeperCell(
  game: MinesweeperGameState,
  cellId: string,
  { random = Math.random }: RevealMinesweeperCellOptions = {},
): MinesweeperGameState {
  if (game.status === "lost" || game.status === "won") {
    return game;
  }

  const targetCell = game.cells.find((cell) => cell.id === cellId);

  if (!targetCell || targetCell.isFlagged || targetCell.isRevealed) {
    return game;
  }

  const gameWithMines =
    game.minefieldStatus === "pending" ? placeMinesAfterFirstClick(game, targetCell, random) : game;
  const placedTargetCell = gameWithMines.cells.find((cell) => cell.id === cellId);

  if (!placedTargetCell) {
    return gameWithMines;
  }

  if (placedTargetCell.isMine) {
    return {
      ...gameWithMines,
      cells: gameWithMines.cells.map((cell) =>
        cell.isMine ? { ...cell, isRevealed: true } : cell,
      ),
      status: "lost",
    };
  }

  const revealedCells = revealSafeRegion(gameWithMines, placedTargetCell);
  const revealedSafeCellCount = countRevealedSafeCells(revealedCells);
  const safeCellCount = gameWithMines.width * gameWithMines.height - gameWithMines.mineCount;

  return {
    ...gameWithMines,
    cells: revealedCells,
    revealedSafeCellCount,
    status: revealedSafeCellCount >= safeCellCount ? "won" : "running",
  };
}

export function toggleMinesweeperFlag(
  game: MinesweeperGameState,
  cellId: string,
): MinesweeperGameState {
  if (game.status === "lost" || game.status === "won") {
    return game;
  }

  const targetCell = game.cells.find((cell) => cell.id === cellId);

  if (!targetCell || targetCell.isRevealed) {
    return game;
  }

  const shouldFlag = !targetCell.isFlagged;

  if (shouldFlag && game.flagCount >= game.mineCount) {
    return game;
  }

  return {
    ...game,
    cells: game.cells.map((cell) =>
      cell.id === cellId ? { ...cell, isFlagged: shouldFlag } : cell,
    ),
    flagCount: game.flagCount + (shouldFlag ? 1 : -1),
  };
}

export function getMinesweeperRemainingMineCount(game: MinesweeperGameState) {
  return game.mineCount - game.flagCount;
}

export function getMinesweeperCellId(x: number, y: number) {
  return `${x}:${y}`;
}

export function getMinesweeperCell(
  game: MinesweeperGameState,
  x: number,
  y: number,
) {
  return game.cells.find((cell) => cell.x === x && cell.y === y) ?? null;
}

function createEmptyCells(width: number, height: number) {
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x): MinesweeperCell => ({
      adjacentMines: 0,
      id: getMinesweeperCellId(x, y),
      isFlagged: false,
      isMine: false,
      isRevealed: false,
      x,
      y,
    })),
  ).flat();
}

function placeMinesAfterFirstClick(
  game: MinesweeperGameState,
  firstClickCell: MinesweeperCell,
  random: RandomSource,
): MinesweeperGameState {
  if (game.mineCount === 0) {
    return {
      ...game,
      minefieldStatus: "placed",
      status: "running",
    };
  }

  const preferredExcludedIds = new Set(
    getNeighboringCells(game, firstClickCell)
      .map((cell) => cell.id)
      .concat(firstClickCell.id),
  );
  const fallbackExcludedIds = new Set([firstClickCell.id]);
  const preferredCandidates = getMineCandidates(game, preferredExcludedIds);
  const candidates =
    preferredCandidates.length >= game.mineCount
      ? preferredCandidates
      : getMineCandidates(game, fallbackExcludedIds);
  const mineIds = new Set(selectMineIds(candidates, game.mineCount, random));
  const minedCells = game.cells.map((cell) => ({
    ...cell,
    isMine: mineIds.has(cell.id),
  }));

  return {
    ...game,
    cells: addAdjacentMineCounts({
      ...game,
      cells: minedCells,
    }),
    minefieldStatus: "placed",
    status: "running",
  };
}

function getMineCandidates(game: MinesweeperGameState, excludedIds: Set<string>) {
  return game.cells.filter((cell) => !excludedIds.has(cell.id));
}

function selectMineIds(
  candidates: MinesweeperCell[],
  mineCount: number,
  random: RandomSource,
) {
  const shuffledCandidates = [...candidates];

  for (let mineIndex = 0; mineIndex < mineCount; mineIndex += 1) {
    const availableCount = shuffledCandidates.length - mineIndex;
    const selectedIndex = mineIndex + Math.floor(random() * availableCount);
    const selectedCell = shuffledCandidates[selectedIndex];

    if (!selectedCell) {
      break;
    }

    shuffledCandidates[selectedIndex] = shuffledCandidates[mineIndex]!;
    shuffledCandidates[mineIndex] = selectedCell;
  }

  return shuffledCandidates.slice(0, mineCount).map((cell) => cell.id);
}

function addAdjacentMineCounts(game: MinesweeperGameState) {
  return game.cells.map((cell) => ({
    ...cell,
    adjacentMines: getNeighboringCells(game, cell).filter((neighbor) => neighbor.isMine).length,
  }));
}

function revealSafeRegion(game: MinesweeperGameState, targetCell: MinesweeperCell) {
  const revealedIds = new Set<string>();
  const visitedIds = new Set<string>();
  const cellsById = new Map(game.cells.map((cell) => [cell.id, cell]));
  const cellsToVisit = [targetCell];

  while (cellsToVisit.length > 0) {
    const currentCell = cellsToVisit.shift();

    if (
      !currentCell ||
      visitedIds.has(currentCell.id) ||
      currentCell.isFlagged ||
      currentCell.isMine
    ) {
      continue;
    }

    visitedIds.add(currentCell.id);
    revealedIds.add(currentCell.id);

    if (currentCell.adjacentMines !== 0) {
      continue;
    }

    for (const neighbor of getNeighboringCells(game, currentCell)) {
      const currentNeighbor = cellsById.get(neighbor.id);

      if (currentNeighbor && !visitedIds.has(currentNeighbor.id)) {
        cellsToVisit.push(currentNeighbor);
      }
    }
  }

  return game.cells.map((cell) =>
    revealedIds.has(cell.id) ? { ...cell, isRevealed: true } : cell,
  );
}

function countRevealedSafeCells(cells: MinesweeperCell[]) {
  return cells.filter((cell) => cell.isRevealed && !cell.isMine).length;
}

function getNeighboringCells(game: MinesweeperGameState, cell: MinesweeperCell) {
  const neighbors: MinesweeperCell[] = [];

  for (let deltaY = -1; deltaY <= 1; deltaY += 1) {
    for (let deltaX = -1; deltaX <= 1; deltaX += 1) {
      if (deltaX === 0 && deltaY === 0) {
        continue;
      }

      const x = cell.x + deltaX;
      const y = cell.y + deltaY;

      if (x < 0 || x >= game.width || y < 0 || y >= game.height) {
        continue;
      }

      const neighbor = getMinesweeperCell(game, x, y);

      if (neighbor) {
        neighbors.push(neighbor);
      }
    }
  }

  return neighbors;
}
