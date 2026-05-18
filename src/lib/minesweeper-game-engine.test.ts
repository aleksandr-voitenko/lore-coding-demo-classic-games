import { describe, expect, it } from "vitest";

import {
  createInitialMinesweeperGame,
  getMinesweeperCell,
  getMinesweeperCellId,
  getMinesweeperRemainingMineCount,
  MINESWEEPER_BOARD_HEIGHT,
  MINESWEEPER_BOARD_WIDTH,
  MINESWEEPER_MINE_COUNT,
  restartMinesweeperGame,
  revealMinesweeperCell,
  toggleMinesweeperFlag,
  type MinesweeperGameState,
} from "./minesweeper-game-engine";

function constantRandom(value: number) {
  return () => value;
}

function revealCell(
  game: MinesweeperGameState,
  x: number,
  y: number,
  random = constantRandom(0),
) {
  return revealMinesweeperCell(game, getMinesweeperCellId(x, y), { random });
}

function expectCell(game: MinesweeperGameState, x: number, y: number) {
  const cell = getMinesweeperCell(game, x, y);

  expect(cell).not.toBeNull();

  return cell!;
}

describe("minesweeper game engine", () => {
  it("creates an initial ready board without placing mines", () => {
    const game = createInitialMinesweeperGame();

    expect(game.status).toBe("ready");
    expect(game.minefieldStatus).toBe("pending");
    expect(game.width).toBe(MINESWEEPER_BOARD_WIDTH);
    expect(game.height).toBe(MINESWEEPER_BOARD_HEIGHT);
    expect(game.mineCount).toBe(MINESWEEPER_MINE_COUNT);
    expect(game.cells).toHaveLength(MINESWEEPER_BOARD_WIDTH * MINESWEEPER_BOARD_HEIGHT);
    expect(game.cells.some((cell) => cell.isMine)).toBe(false);
    expect(game.cells.some((cell) => cell.isRevealed)).toBe(false);
    expect(game.flagCount).toBe(0);
  });

  it("places mines deterministically after the first reveal", () => {
    const game = createInitialMinesweeperGame({ height: 4, mineCount: 2, width: 4 });
    const revealed = revealCell(game, 0, 0, constantRandom(0));
    const mines = revealed.cells.filter((cell) => cell.isMine);

    expect(revealed.minefieldStatus).toBe("placed");
    expect(mines.map((cell) => cell.id)).toEqual(["2:0", "3:0"]);
    expect(expectCell(revealed, 0, 0)).toMatchObject({
      isMine: false,
      isRevealed: true,
    });
  });

  it("keeps the first revealed cell safe even when deterministic placement starts at the first candidate", () => {
    const game = createInitialMinesweeperGame({ height: 3, mineCount: 1, width: 3 });
    const revealed = revealCell(game, 1, 1, constantRandom(0));
    const firstClickCell = expectCell(revealed, 1, 1);

    expect(firstClickCell.isMine).toBe(false);
    expect(firstClickCell.isRevealed).toBe(true);
    expect(revealed.cells.filter((cell) => cell.isMine)).toHaveLength(1);
  });

  it("counts adjacent mines after mine placement", () => {
    const game = createInitialMinesweeperGame({ height: 4, mineCount: 2, width: 4 });
    const revealed = revealCell(game, 0, 0, constantRandom(0));

    expect(expectCell(revealed, 1, 0)).toMatchObject({ adjacentMines: 1 });
    expect(expectCell(revealed, 2, 1)).toMatchObject({ adjacentMines: 2 });
    expect(expectCell(revealed, 0, 3)).toMatchObject({ adjacentMines: 0 });
  });

  it("flood reveals empty regions and their numbered boundary cells", () => {
    const game = createInitialMinesweeperGame({ height: 5, mineCount: 1, width: 5 });
    const revealed = revealCell(game, 0, 0, constantRandom(0.999));

    expect(expectCell(revealed, 4, 4)).toMatchObject({ isMine: true, isRevealed: false });
    expect(expectCell(revealed, 3, 3)).toMatchObject({
      adjacentMines: 1,
      isRevealed: true,
    });
    expect(revealed.revealedSafeCellCount).toBe(24);
    expect(revealed.status).toBe("won");
  });

  it("toggles flags and updates the remaining mine counter", () => {
    const game = createInitialMinesweeperGame({ mineCount: 2 });
    const firstFlag = toggleMinesweeperFlag(game, getMinesweeperCellId(0, 0));
    const secondFlag = toggleMinesweeperFlag(firstFlag, getMinesweeperCellId(1, 0));
    const unflagged = toggleMinesweeperFlag(secondFlag, getMinesweeperCellId(0, 0));

    expect(firstFlag.flagCount).toBe(1);
    expect(getMinesweeperRemainingMineCount(firstFlag)).toBe(1);
    expect(secondFlag.flagCount).toBe(2);
    expect(getMinesweeperRemainingMineCount(secondFlag)).toBe(0);
    expect(unflagged.flagCount).toBe(1);
    expect(expectCell(unflagged, 0, 0).isFlagged).toBe(false);
  });

  it("does not reveal flagged cells", () => {
    const game = createInitialMinesweeperGame();
    const flagged = toggleMinesweeperFlag(game, getMinesweeperCellId(0, 0));
    const revealed = revealCell(flagged, 0, 0, constantRandom(0));

    expect(revealed).toBe(flagged);
    expect(revealed.status).toBe("ready");
    expect(revealed.minefieldStatus).toBe("pending");
    expect(expectCell(revealed, 0, 0).isRevealed).toBe(false);
  });

  it("loses and reveals mines when a mine cell is revealed", () => {
    const game = createInitialMinesweeperGame({ height: 4, mineCount: 1, width: 4 });
    const running = revealCell(game, 0, 0, constantRandom(0));
    const lost = revealCell(running, 2, 0, constantRandom(0));

    expect(lost.status).toBe("lost");
    expect(expectCell(lost, 2, 0)).toMatchObject({
      isMine: true,
      isRevealed: true,
    });
  });

  it("wins when all safe cells are revealed", () => {
    const game = createInitialMinesweeperGame({ height: 2, mineCount: 1, width: 2 });
    const running = revealCell(game, 0, 0, constantRandom(0));
    const secondSafeReveal = revealCell(running, 0, 1, constantRandom(0));
    const won = revealCell(secondSafeReveal, 1, 1, constantRandom(0));

    expect(won.status).toBe("won");
    expect(won.revealedSafeCellCount).toBe(3);
    expect(expectCell(won, 1, 0)).toMatchObject({
      isMine: true,
      isRevealed: false,
    });
  });

  it("restarts to a new ready board with the same dimensions and mine count", () => {
    const game = createInitialMinesweeperGame({ height: 4, mineCount: 1, width: 4 });
    const running = revealCell(game, 0, 0, constantRandom(0));
    const flagged = toggleMinesweeperFlag(running, getMinesweeperCellId(1, 1));
    const restarted = restartMinesweeperGame(flagged);

    expect(restarted).toMatchObject({
      flagCount: 0,
      height: 4,
      mineCount: 1,
      minefieldStatus: "pending",
      revealedSafeCellCount: 0,
      status: "ready",
      width: 4,
    });
    expect(restarted.cells.some((cell) => cell.isMine || cell.isRevealed || cell.isFlagged)).toBe(
      false,
    );
  });
});
