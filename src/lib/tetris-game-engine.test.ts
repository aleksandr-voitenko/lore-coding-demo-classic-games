import { describe, expect, it } from "vitest";

import {
  advanceTetrisGame,
  createEmptyTetrisBoard,
  createInitialTetrisGame,
  hardDropTetrisPiece,
  moveTetrisPiece,
  renderTetrisBoard,
  rotateTetrisPiece,
  softDropTetrisPiece,
  startTetrisGame,
  TETRIS_BOARD_HEIGHT,
  TETRIS_BOARD_WIDTH,
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

  it("moves a running piece while blocking it at the side wall", () => {
    const game = createRunningGame();
    const movedLeft = moveTetrisPiece(game, -3, 0);
    const blockedLeft = moveTetrisPiece(movedLeft, -1, 0);

    expect(movedLeft.currentPiece.position.x).toBe(0);
    expect(blockedLeft.currentPiece.position.x).toBe(0);
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
