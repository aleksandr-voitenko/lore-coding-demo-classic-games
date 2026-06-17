import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { MinesweeperBoard, MinesweeperStartPreview } from "./minesweeper-board";
import { expectMarkup } from "./game-board-test-utils";
import { createInitialMinesweeperGame } from "@/lib/minesweeper-game-engine";

describe("MinesweeperBoard", () => {
  it("renders Minesweeper covered, flagged, numbered, empty, and mine cells", () => {
    const initialGame = createInitialMinesweeperGame({ height: 3, mineCount: 1, width: 3 });
    const game = {
      ...initialGame,
      cells: initialGame.cells.map((cell) => {
        if (cell.id === "0:0") {
          return { ...cell, isFlagged: true };
        }

        if (cell.id === "1:0") {
          return { ...cell, adjacentMines: 2, isRevealed: true };
        }

        if (cell.id === "2:0") {
          return { ...cell, isMine: true, isRevealed: true };
        }

        if (cell.id === "0:1") {
          return { ...cell, isRevealed: true };
        }

        return cell;
      }),
      flagCount: 1,
      minefieldStatus: "placed" as const,
      revealedSafeCellCount: 2,
      status: "running" as const,
    };
    const markup = renderToStaticMarkup(
      <MinesweeperBoard
        game={game}
        isFlagMode={false}
        onRevealCell={vi.fn()}
        onToggleFlag={vi.fn()}
        statusLabel="Running"
      />,
    );
    const previewMarkup = renderToStaticMarkup(<MinesweeperStartPreview />);

    expectMarkup(markup, [
      'data-testid="minesweeper-board"',
      "Minesweeper board. Field 3 by 3. 1 mines. 1 flags. 2 safe cells revealed. Running.",
      "Column 1, row 1. Flagged.",
      "Column 2, row 1. 2 adjacent mines.",
      "Column 3, row 1. Mine revealed.",
      "Column 1, row 2. Empty.",
    ]);
    expect(previewMarkup).toContain("grid-cols-5");
  });
});
