import {
  TETRIS_BOARD_HEIGHT,
  TETRIS_BOARD_WIDTH,
  TETRIS_START_LEVEL,
} from "./tetris-parameters";

export {
  TETRIS_BOARD_HEIGHT,
  TETRIS_BOARD_SIZE_OPTIONS,
  TETRIS_BOARD_WIDTH,
  TETRIS_START_LEVEL,
  TETRIS_START_LEVEL_OPTIONS,
} from "./tetris-parameters";

export type TetrisStatus = "ready" | "running" | "paused" | "lost";
export type TetrominoKind = "I" | "J" | "L" | "O" | "S" | "T" | "Z";
export type TetrisCell = TetrominoKind | null;
export type RotationDirection = "clockwise" | "counterclockwise";

export type TetrisPoint = {
  x: number;
  y: number;
};

export type ActiveTetromino = {
  kind: TetrominoKind;
  position: TetrisPoint;
  rotation: number;
};

export type TetrisGameState = {
  board: TetrisCell[][];
  boardHeight: number;
  boardWidth: number;
  currentPiece: ActiveTetromino;
  level: number;
  lines: number;
  nextPieceKind: TetrominoKind;
  score: number;
  startLevel: number;
  status: TetrisStatus;
};

export type CreateTetrisGameOptions = {
  boardHeight?: number;
  boardWidth?: number;
  random?: RandomSource;
  startLevel?: number;
};

type RandomSource = () => number;

type LockPieceOptions = {
  random?: RandomSource;
  scoreBonus?: number;
};

export const TETROMINO_KINDS = ["I", "J", "L", "O", "S", "T", "Z"] as const;

const TETRIS_LINE_SCORES: Record<number, number> = {
  0: 0,
  1: 40,
  2: 100,
  3: 300,
  4: 1200,
};

const TETROMINO_SHAPES: Record<TetrominoKind, TetrisPoint[][]> = {
  I: [
    [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ],
    [
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 2, y: 3 },
    ],
    [
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ],
    [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 1, y: 3 },
    ],
  ],
  J: [
    [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ],
    [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ],
    [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
    ],
  ],
  L: [
    [
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ],
    [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 0, y: 2 },
    ],
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ],
  ],
  O: [
    [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
  ],
  S: [
    [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ],
    [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ],
  ],
  T: [
    [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 2 },
    ],
    [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 2 },
    ],
    [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ],
  ],
  Z: [
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    [
      { x: 2, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 2 },
    ],
  ],
};

const ROTATION_KICKS = [0, -1, 1, -2, 2];

export function createEmptyTetrisBoard(
  boardWidth = TETRIS_BOARD_WIDTH,
  boardHeight = TETRIS_BOARD_HEIGHT,
) {
  return Array.from({ length: boardHeight }, () =>
    Array.from<TetrisCell>({ length: boardWidth }).fill(null),
  );
}

export function createTetrisBoardCells(
  boardWidth = TETRIS_BOARD_WIDTH,
  boardHeight = TETRIS_BOARD_HEIGHT,
) {
  return Array.from({ length: boardWidth * boardHeight }, (_, index) => ({
    x: index % boardWidth,
    y: Math.floor(index / boardWidth),
  }));
}

export function getTetrisTickDelay(level: number) {
  return Math.max(120, 820 - (level - TETRIS_START_LEVEL) * 65);
}

export function getTetrominoCells(piece: ActiveTetromino) {
  const rotations = TETROMINO_SHAPES[piece.kind];
  const shape = rotations[piece.rotation % rotations.length] ?? rotations[0];

  return shape.map((cell) => ({
    x: piece.position.x + cell.x,
    y: piece.position.y + cell.y,
  }));
}

export function createInitialTetrisGame({
  boardHeight = TETRIS_BOARD_HEIGHT,
  boardWidth = TETRIS_BOARD_WIDTH,
  random = Math.random,
  startLevel = TETRIS_START_LEVEL,
}: CreateTetrisGameOptions = {}): TetrisGameState {
  const normalizedBoardWidth = normalizeTetrisBoardDimension(boardWidth, TETRIS_BOARD_WIDTH, 4);
  const normalizedBoardHeight = normalizeTetrisBoardDimension(boardHeight, TETRIS_BOARD_HEIGHT, 8);
  const normalizedStartLevel = normalizeTetrisStartLevel(startLevel);
  const currentPieceKind = getRandomTetrominoKind(random);
  const nextPieceKind = getRandomTetrominoKind(random);
  const board = createEmptyTetrisBoard(normalizedBoardWidth, normalizedBoardHeight);
  const currentPiece = createSpawnedPiece(currentPieceKind, normalizedBoardWidth);

  return {
    board,
    boardHeight: normalizedBoardHeight,
    boardWidth: normalizedBoardWidth,
    currentPiece,
    level: normalizedStartLevel,
    lines: 0,
    nextPieceKind,
    score: 0,
    startLevel: normalizedStartLevel,
    status: canPlacePiece(board, currentPiece) ? "ready" : "lost",
  };
}

export function startTetrisGame(
  game: TetrisGameState,
  { random = Math.random }: CreateTetrisGameOptions = {},
) {
  if (game.status === "paused") {
    return {
      ...game,
      status: "running" as const,
    };
  }

  if (game.status === "running") {
    return game;
  }

  if (game.status === "lost") {
    return {
      ...createInitialTetrisGame({
        boardHeight: game.boardHeight,
        boardWidth: game.boardWidth,
        random,
        startLevel: game.startLevel,
      }),
      status: "running" as const,
    };
  }

  return {
    ...game,
    status: "running" as const,
  };
}

export function pauseTetrisGame(game: TetrisGameState) {
  if (game.status !== "running") {
    return game;
  }

  return {
    ...game,
    status: "paused" as const,
  };
}

export function moveTetrisPiece(game: TetrisGameState, deltaX: number, deltaY: number) {
  if (game.status !== "running") {
    return game;
  }

  const nextPiece = {
    ...game.currentPiece,
    position: {
      x: game.currentPiece.position.x + deltaX,
      y: game.currentPiece.position.y + deltaY,
    },
  };

  if (!canPlacePiece(game.board, nextPiece)) {
    return game;
  }

  return {
    ...game,
    currentPiece: nextPiece,
  };
}

export function rotateTetrisPiece(
  game: TetrisGameState,
  direction: RotationDirection = "clockwise",
) {
  if (game.status !== "running" || game.currentPiece.kind === "O") {
    return game;
  }

  const rotations = TETROMINO_SHAPES[game.currentPiece.kind];
  const rotationOffset = direction === "clockwise" ? 1 : -1;
  const nextRotation = (game.currentPiece.rotation + rotationOffset + rotations.length) % rotations.length;

  for (const kick of ROTATION_KICKS) {
    const nextPiece = {
      ...game.currentPiece,
      position: {
        x: game.currentPiece.position.x + kick,
        y: game.currentPiece.position.y,
      },
      rotation: nextRotation,
    };

    if (canPlacePiece(game.board, nextPiece)) {
      return {
        ...game,
        currentPiece: nextPiece,
      };
    }
  }

  return game;
}

export function advanceTetrisGame(
  game: TetrisGameState,
  { random = Math.random }: CreateTetrisGameOptions = {},
) {
  if (game.status !== "running") {
    return game;
  }

  const nextPiece = {
    ...game.currentPiece,
    position: {
      x: game.currentPiece.position.x,
      y: game.currentPiece.position.y + 1,
    },
  };

  if (canPlacePiece(game.board, nextPiece)) {
    return {
      ...game,
      currentPiece: nextPiece,
    };
  }

  return lockTetrisPiece(game, { random });
}

export function softDropTetrisPiece(
  game: TetrisGameState,
  { random = Math.random }: CreateTetrisGameOptions = {},
) {
  if (game.status !== "running") {
    return game;
  }

  const movedGame = moveTetrisPiece(game, 0, 1);

  if (movedGame !== game) {
    return {
      ...movedGame,
      score: movedGame.score + 1,
    };
  }

  return lockTetrisPiece(game, { random });
}

export function hardDropTetrisPiece(
  game: TetrisGameState,
  { random = Math.random }: CreateTetrisGameOptions = {},
) {
  if (game.status !== "running") {
    return game;
  }

  let droppedPiece = game.currentPiece;
  let distance = 0;

  while (true) {
    const nextPiece = {
      ...droppedPiece,
      position: {
        x: droppedPiece.position.x,
        y: droppedPiece.position.y + 1,
      },
    };

    if (!canPlacePiece(game.board, nextPiece)) {
      break;
    }

    droppedPiece = nextPiece;
    distance += 1;
  }

  return lockTetrisPiece(
    {
      ...game,
      currentPiece: droppedPiece,
    },
    {
      random,
      scoreBonus: distance * 2,
    },
  );
}

export function renderTetrisBoard(game: TetrisGameState) {
  const board = cloneTetrisBoard(game.board);

  getTetrominoCells(game.currentPiece).forEach((cell) => {
    if (isVisibleBoardCell(cell, game.boardWidth, game.boardHeight)) {
      board[cell.y]![cell.x] = game.currentPiece.kind;
    }
  });

  return board;
}

export function getTetrominoPreviewCells(kind: TetrominoKind) {
  return TETROMINO_SHAPES[kind][0];
}

function getRandomTetrominoKind(random: RandomSource) {
  return TETROMINO_KINDS[
    Math.min(TETROMINO_KINDS.length - 1, Math.floor(random() * TETROMINO_KINDS.length))
  ];
}

function createSpawnedPiece(
  kind: TetrominoKind,
  boardWidth = TETRIS_BOARD_WIDTH,
): ActiveTetromino {
  return {
    kind,
    position: {
      x: Math.floor(boardWidth / 2) - 2,
      y: 0,
    },
    rotation: 0,
  };
}

function lockTetrisPiece(
  game: TetrisGameState,
  { random = Math.random, scoreBonus = 0 }: LockPieceOptions = {},
): TetrisGameState {
  const lockedBoard = cloneTetrisBoard(game.board);

  getTetrominoCells(game.currentPiece).forEach((cell) => {
    if (isVisibleBoardCell(cell, game.boardWidth, game.boardHeight)) {
      lockedBoard[cell.y]![cell.x] = game.currentPiece.kind;
    }
  });

  const { board, clearedLines } = clearCompletedLines(lockedBoard);
  const lines = game.lines + clearedLines;
  const level = Math.floor(lines / 10) + game.startLevel;
  const nextPiece = createSpawnedPiece(game.nextPieceKind, game.boardWidth);
  const nextPieceKind = getRandomTetrominoKind(random);
  const score =
    game.score + scoreBonus + (TETRIS_LINE_SCORES[clearedLines] ?? 0) * game.level;

  if (!canPlacePiece(board, nextPiece)) {
    return {
      ...game,
      board,
      level,
      lines,
      score,
      status: "lost",
    };
  }

  return {
    board,
    boardHeight: game.boardHeight,
    boardWidth: game.boardWidth,
    currentPiece: nextPiece,
    level,
    lines,
    nextPieceKind,
    score,
    startLevel: game.startLevel,
    status: "running",
  };
}

function canPlacePiece(board: TetrisCell[][], piece: ActiveTetromino) {
  const boardHeight = board.length;
  const boardWidth = board[0]?.length ?? 0;

  return getTetrominoCells(piece).every((cell) => {
    if (cell.x < 0 || cell.x >= boardWidth || cell.y >= boardHeight) {
      return false;
    }

    if (cell.y < 0) {
      return true;
    }

    return board[cell.y]?.[cell.x] === null;
  });
}

function clearCompletedLines(board: TetrisCell[][]) {
  const boardHeight = board.length;
  const boardWidth = board[0]?.length ?? TETRIS_BOARD_WIDTH;
  const remainingRows = board.filter((row) => row.some((cell) => cell === null));
  const clearedLines = boardHeight - remainingRows.length;
  const emptyRows = Array.from({ length: clearedLines }, () =>
    Array.from<TetrisCell>({ length: boardWidth }).fill(null),
  );

  return {
    board: [...emptyRows, ...remainingRows],
    clearedLines,
  };
}

function cloneTetrisBoard(board: TetrisCell[][]) {
  return board.map((row) => [...row]);
}

function isVisibleBoardCell(
  point: TetrisPoint,
  boardWidth = TETRIS_BOARD_WIDTH,
  boardHeight = TETRIS_BOARD_HEIGHT,
) {
  return (
    point.x >= 0 &&
    point.x < boardWidth &&
    point.y >= 0 &&
    point.y < boardHeight
  );
}

function normalizeTetrisBoardDimension(value: number, fallback: number, minimum: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(minimum, Math.floor(value));
}

function normalizeTetrisStartLevel(startLevel: number) {
  if (!Number.isFinite(startLevel)) {
    return TETRIS_START_LEVEL;
  }

  return Math.max(TETRIS_START_LEVEL, Math.floor(startLevel));
}
