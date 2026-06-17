import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";

import { TetrisBoard } from "./tetris-board";
import { expectMarkup } from "./game-board-test-utils";
import { createInitialTetrisGame } from "@/lib/tetris-game-engine";

describe("TetrisBoard", () => {
  it("renders Tetris board state with its accessible score summary", () => {
    const game = createInitialTetrisGame({ random: () => 0 });
    const markup = renderToStaticMarkup(
      <TetrisBoard game={game} statusLabel="Ready">
        <span data-testid="tetris-overlay">Start</span>
      </TetrisBoard>,
    );

    expectMarkup(markup, [
      'data-testid="tetris-board"',
      "Tetris board. Field 10 by 20. Score 0. Lines 0. Level 1. Ready.",
      'data-testid="tetris-overlay"',
    ]);
  });
});
