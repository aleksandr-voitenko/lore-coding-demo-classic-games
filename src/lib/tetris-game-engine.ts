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
  currentPiece: ActiveTetromino;
  level: number;
  lines: number;
  nextPieceKind: TetrominoKind;
  score: number;
  status: TetrisStatus;
};

export type CreateTetrisGameOptions = {
  random?: RandomSource;
};

type RandomSource = () => number;

type LockPieceOptions = {
  random?: RandomSource;
  scoreBonus?: number;
};

export const TETRIS_BOARD_WIDTH = 10;
export const TETRIS_BOARD_HEIGHT = 20;
export const TETRIS_START_LEVEL = 1;

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

export function createEmptyTetrisBoard() {
  return Array.from({ length: TETRIS_BOARD_HEIGHT }, () =>
    Array.from<TetrisCell>({ length: TETRIS_BOARD_WIDTH }).fill(null),
  );
}

export function createTetrisBoardCells() {
  return Array.from({ length: TETRIS_BOARD_WIDTH * TETRIS_BOARD_HEIGHT }, (_, index) => ({
    x: index % TETRIS_BOARD_WIDTH,
    y: Math.floor(index / TETRIS_BOARD_WIDTH),
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
  random = Math.random,
}: CreateTetrisGameOptions = {}): TetrisGameState {
  const currentPieceKind = getRandomTetrominoKind(random);
  const nextPieceKind = getRandomTetrominoKind(random);
  const board = createEmptyTetrisBoard();
  const currentPiece = createSpawnedPiece(currentPieceKind);

  return {
    board,
    currentPiece,
    level: TETRIS_START_LEVEL,
    lines: 0,
    nextPieceKind,
    score: 0,
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
      ...createInitialTetrisGame({ random }),
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
    if (isVisibleBoardCell(cell)) {
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

function createSpawnedPiece(kind: TetrominoKind): ActiveTetromino {
  return {
    kind,
    position: {
      x: Math.floor(TETRIS_BOARD_WIDTH / 2) - 2,
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
    if (isVisibleBoardCell(cell)) {
      lockedBoard[cell.y]![cell.x] = game.currentPiece.kind;
    }
  });

  const { board, clearedLines } = clearCompletedLines(lockedBoard);
  const lines = game.lines + clearedLines;
  const level = Math.floor(lines / 10) + TETRIS_START_LEVEL;
  const nextPiece = createSpawnedPiece(game.nextPieceKind);
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
    currentPiece: nextPiece,
    level,
    lines,
    nextPieceKind,
    score,
    status: "running",
  };
}

function canPlacePiece(board: TetrisCell[][], piece: ActiveTetromino) {
  return getTetrominoCells(piece).every((cell) => {
    if (cell.x < 0 || cell.x >= TETRIS_BOARD_WIDTH || cell.y >= TETRIS_BOARD_HEIGHT) {
      return false;
    }

    if (cell.y < 0) {
      return true;
    }

    return board[cell.y]?.[cell.x] === null;
  });
}

function clearCompletedLines(board: TetrisCell[][]) {
  const remainingRows = board.filter((row) => row.some((cell) => cell === null));
  const clearedLines = TETRIS_BOARD_HEIGHT - remainingRows.length;
  const emptyRows = Array.from({ length: clearedLines }, () =>
    Array.from<TetrisCell>({ length: TETRIS_BOARD_WIDTH }).fill(null),
  );

  return {
    board: [...emptyRows, ...remainingRows],
    clearedLines,
  };
}

function cloneTetrisBoard(board: TetrisCell[][]) {
  return board.map((row) => [...row]);
}

function isVisibleBoardCell(point: TetrisPoint) {
  return (
    point.x >= 0 &&
    point.x < TETRIS_BOARD_WIDTH &&
    point.y >= 0 &&
    point.y < TETRIS_BOARD_HEIGHT
  );
}
