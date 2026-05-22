import { describe, expect, it } from "vitest";

import {
  advanceTetrisGame,
  createEmptyTetrisBoard,
  createInitialTetrisGame,
  createTetrisBoardCells,
  getTetrominoCells,
  getTetrominoPreviewCells,
  getTetrisTickDelay,
  hardDropTetrisPiece,
  moveTetrisPiece,
  pauseTetrisGame,
  renderTetrisBoard,
  rotateTetrisPiece,
  softDropTetrisPiece,
  startTetrisGame,
  TETRIS_BOARD_HEIGHT,
  TETRIS_BOARD_WIDTH,
  TETRIS_START_LEVEL,
  type TetrisCell,
  type TetrisGameState,
} from "./tetris-game-engine";

function createRandomSequence(values: number[]) {
  let index = 0;

  return () => values[Math.min(index++, values.length - 1)] ?? 0;
}

function createRunningGame(overrides: Partial<TetrisGameState> = {}): TetrisGameState {
  return {
    ...createInitialTetrisGame({ random: createRandomSequence([0, 3 / 7, 0]) }),
    status: "running",
    ...overrides,
  };
}

function createBottomRowWithGap(gapStart: number, gapLength: number) {
  const board = createEmptyTetrisBoard();
  const bottomRow = board[TETRIS_BOARD_HEIGHT - 1]!;

  bottomRow.forEach((_, index) => {
    bottomRow[index] = index >= gapStart && index < gapStart + gapLength ? null : "Z";
  });

  return board;
}

describe("tetris game engine", () => {
  it("creates a classic 10 by 20 ready board with current and next pieces", () => {
    const game = createInitialTetrisGame({ random: createRandomSequence([0, 3 / 7]) });
    const renderedBoard = renderTetrisBoard(game);

    expect(game.status).toBe("ready");
    expect(game.board).toHaveLength(TETRIS_BOARD_HEIGHT);
    expect(game.board.every((row) => row.length === TETRIS_BOARD_WIDTH)).toBe(true);
    expect(game.currentPiece.kind).toBe("I");
    expect(game.nextPieceKind).toBe("O");
    expect(renderedBoard[1]?.slice(3, 7)).toEqual(["I", "I", "I", "I"]);
  });

  it("creates configurable board sizes and start levels", () => {
    const game = createInitialTetrisGame({
      boardHeight: 22,
      boardWidth: 12,
      random: createRandomSequence([0, 3 / 7]),
      startLevel: 5,
    });
    const restarted = startTetrisGame(
      {
        ...game,
        status: "lost",
      },
      { random: createRandomSequence([0, 3 / 7]) },
    );

    expect(game.board).toHaveLength(22);
    expect(game.board.every((row) => row.length === 12)).toBe(true);
    expect(game.boardHeight).toBe(22);
    expect(game.boardWidth).toBe(12);
    expect(game.level).toBe(5);
    expect(game.startLevel).toBe(5);
    expect(renderTetrisBoard(game)[1]?.slice(4, 8)).toEqual(["I", "I", "I", "I"]);
    expect(restarted.boardHeight).toBe(22);
    expect(restarted.boardWidth).toBe(12);
    expect(restarted.level).toBe(5);
    expect(restarted.startLevel).toBe(5);
    expect(restarted.status).toBe("running");
  });

  it("exposes stable board coordinates, preview cells, and gravity timing", () => {
    const cells = createTetrisBoardCells();

    expect(cells).toHaveLength(TETRIS_BOARD_WIDTH * TETRIS_BOARD_HEIGHT);
    expect(cells.slice(0, 3)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
    expect(cells[TETRIS_BOARD_WIDTH]).toEqual({ x: 0, y: 1 });
    expect(cells.at(-1)).toEqual({
      x: TETRIS_BOARD_WIDTH - 1,
      y: TETRIS_BOARD_HEIGHT - 1,
    });
    expect(getTetrisTickDelay(TETRIS_START_LEVEL)).toBe(820);
    expect(getTetrisTickDelay(20)).toBe(120);
    expect(getTetrominoPreviewCells("T")).toEqual([
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ]);
    expect(
      getTetrominoCells({
        kind: "T",
        position: { x: 4, y: 2 },
        rotation: -1,
      }),
    ).toEqual([
      { x: 5, y: 2 },
      { x: 4, y: 3 },
      { x: 5, y: 3 },
      { x: 6, y: 3 },
    ]);
  });

  it("starts, pauses, resumes, and ignores duplicate running starts", () => {
    const readyGame = createInitialTetrisGame({ random: createRandomSequence([0, 3 / 7]) });
    const runningGame = startTetrisGame(readyGame);
    const duplicateStart = startTetrisGame(runningGame);
    const pausedGame = pauseTetrisGame(runningGame);
    const duplicatePause = pauseTetrisGame(pausedGame);
    const resumedGame = startTetrisGame(pausedGame);

    expect(runningGame.status).toBe("running");
    expect(duplicateStart).toBe(runningGame);
    expect(pausedGame.status).toBe("paused");
    expect(duplicatePause).toBe(pausedGame);
    expect(resumedGame.status).toBe("running");
    expect(resumedGame.currentPiece).toBe(pausedGame.currentPiece);
  });

  it("moves a running piece while blocking it at the side wall", () => {
    const game = createRunningGame();
    const movedLeft = moveTetrisPiece(game, -3, 0);
    const blockedLeft = moveTetrisPiece(movedLeft, -1, 0);

    expect(movedLeft.currentPiece.position.x).toBe(0);
    expect(blockedLeft.currentPiece.position.x).toBe(0);
  });

  it("ignores movement, rotation, and drops while not running", () => {
    const readyGame = createInitialTetrisGame({ random: createRandomSequence([0, 3 / 7]) });
    const runningOGame = createRunningGame({
      currentPiece: {
        kind: "O",
        position: { x: 4, y: 0 },
        rotation: 0,
      },
    });

    expect(moveTetrisPiece(readyGame, 1, 0)).toBe(readyGame);
    expect(rotateTetrisPiece(readyGame)).toBe(readyGame);
    expect(advanceTetrisGame(readyGame)).toBe(readyGame);
    expect(softDropTetrisPiece(readyGame)).toBe(readyGame);
    expect(hardDropTetrisPiece(readyGame)).toBe(readyGame);
    expect(rotateTetrisPiece(runningOGame)).toBe(runningOGame);
  });

  it("rotates with a small wall kick when the rotated piece would leave the board", () => {
    const game = createRunningGame({
      currentPiece: {
        kind: "I",
        position: { x: 7, y: 0 },
        rotation: 1,
      },
    });
    const rotated = rotateTetrisPiece(game);

    expect(rotated.currentPiece.rotation).toBe(2);
    expect(rotated.currentPiece.position.x).toBe(6);
  });

  it("rotates counterclockwise and leaves a piece unchanged when every kick is blocked", () => {
    const game = createRunningGame({
      currentPiece: {
        kind: "T",
        position: { x: 3, y: 0 },
        rotation: 0,
      },
    });
    const rotatedCounterclockwise = rotateTetrisPiece(game, "counterclockwise");
    const blockedBoard = createEmptyTetrisBoard();

    [3, 4, 5, 6, 7].forEach((x) => {
      blockedBoard[0]![x] = "Z";
    });

    const blockedGame = createRunningGame({
      board: blockedBoard,
      currentPiece: {
        kind: "I",
        position: { x: 3, y: 0 },
        rotation: 0,
      },
    });

    expect(rotatedCounterclockwise.currentPiece.rotation).toBe(3);
    expect(rotatedCounterclockwise.currentPiece.position).toEqual(game.currentPiece.position);
    expect(rotateTetrisPiece(blockedGame)).toBe(blockedGame);
  });

  it("advances a running piece one row when gravity space is open", () => {
    const game = createRunningGame();
    const advanced = advanceTetrisGame(game);

    expect(advanced.status).toBe("running");
    expect(advanced.currentPiece.position.y).toBe(game.currentPiece.position.y + 1);
  });

  it("hard drops, locks the current piece, and spawns the queued next piece", () => {
    const game = createRunningGame();
    const dropped = hardDropTetrisPiece(game, { random: createRandomSequence([4 / 7]) });

    expect(dropped.currentPiece.kind).toBe("O");
    expect(dropped.nextPieceKind).toBe("S");
    expect(dropped.score).toBe(36);
    expect(dropped.board[TETRIS_BOARD_HEIGHT - 1]?.slice(3, 7)).toEqual([
      "I",
      "I",
      "I",
      "I",
    ]);
  });

  it("soft drop locks instead of awarding movement points when the piece is blocked", () => {
    const game = createRunningGame({
      currentPiece: {
        kind: "O",
        position: { x: 4, y: TETRIS_BOARD_HEIGHT - 2 },
        rotation: 0,
      },
      nextPieceKind: "T",
      score: 10,
    });
    const dropped = softDropTetrisPiece(game, { random: createRandomSequence([6 / 7]) });

    expect(dropped.score).toBe(10);
    expect(dropped.currentPiece.kind).toBe("T");
    expect(dropped.nextPieceKind).toBe("Z");
    expect(dropped.board[TETRIS_BOARD_HEIGHT - 2]?.slice(5, 7)).toEqual(["O", "O"]);
    expect(dropped.board[TETRIS_BOARD_HEIGHT - 1]?.slice(5, 7)).toEqual(["O", "O"]);
  });

  it("clears completed lines and scores them at the current level", () => {
    const game = createRunningGame({
      board: createBottomRowWithGap(3, 4),
      currentPiece: {
        kind: "I",
        position: { x: 3, y: TETRIS_BOARD_HEIGHT - 2 },
        rotation: 0,
      },
    });
    const advanced = advanceTetrisGame(game, { random: createRandomSequence([4 / 7]) });

    expect(advanced.lines).toBe(1);
    expect(advanced.score).toBe(40);
    expect(advanced.board[TETRIS_BOARD_HEIGHT - 1]).toEqual(
      Array.from<TetrisCell>({ length: TETRIS_BOARD_WIDTH }).fill(null),
    );
  });

  it("scores a four-line clear and advances the level after ten total lines", () => {
    const board = createEmptyTetrisBoard();

    for (let y = TETRIS_BOARD_HEIGHT - 4; y < TETRIS_BOARD_HEIGHT; y += 1) {
      board[y] = Array.from<TetrisCell>({ length: TETRIS_BOARD_WIDTH }).fill("Z");
      board[y]![5] = null;
    }

    const game = createRunningGame({
      board,
      currentPiece: {
        kind: "I",
        position: { x: 3, y: TETRIS_BOARD_HEIGHT - 4 },
        rotation: 1,
      },
      lines: 9,
      nextPieceKind: "O",
    });
    const advanced = advanceTetrisGame(game);

    expect(advanced.lines).toBe(13);
    expect(advanced.level).toBe(2);
    expect(advanced.score).toBe(1200);
    expect(advanced.board.slice(TETRIS_BOARD_HEIGHT - 4)).toEqual([
      Array.from<TetrisCell>({ length: TETRIS_BOARD_WIDTH }).fill(null),
      Array.from<TetrisCell>({ length: TETRIS_BOARD_WIDTH }).fill(null),
      Array.from<TetrisCell>({ length: TETRIS_BOARD_WIDTH }).fill(null),
      Array.from<TetrisCell>({ length: TETRIS_BOARD_WIDTH }).fill(null),
    ]);
  });

  it("soft drops one row and awards a soft-drop point", () => {
    const game = createRunningGame();
    const dropped = softDropTetrisPiece(game);

    expect(dropped.currentPiece.position.y).toBe(game.currentPiece.position.y + 1);
    expect(dropped.score).toBe(1);
  });

  it("ends the game when the next spawned piece cannot enter the board", () => {
    const board = createEmptyTetrisBoard();
    board[1]![3] = "Z";
    const game = createRunningGame({
      board,
      currentPiece: {
        kind: "O",
        position: { x: 4, y: TETRIS_BOARD_HEIGHT - 2 },
        rotation: 0,
      },
      nextPieceKind: "I",
    });
    const advanced = advanceTetrisGame(game);

    expect(advanced.status).toBe("lost");
    expect(advanced.currentPiece.kind).toBe("O");
  });

  it("restarts from game over with a fresh running game", () => {
    const lostGame = createRunningGame({
      score: 1200,
      status: "lost",
    });
    const restarted = startTetrisGame(lostGame, { random: createRandomSequence([2 / 7, 5 / 7]) });

    expect(restarted.status).toBe("running");
    expect(restarted.score).toBe(0);
    expect(restarted.currentPiece.kind).toBe("L");
    expect(restarted.nextPieceKind).toBe("T");
  });
});
