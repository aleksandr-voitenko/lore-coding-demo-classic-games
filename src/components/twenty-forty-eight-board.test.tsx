import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";

import { TwentyFortyEightBoard } from "./twenty-forty-eight-board";
import { expectMarkup } from "./game-board-test-utils";
import type { TwentyFortyEightGameState } from "@/lib/twenty-forty-eight-game-engine";

describe("TwentyFortyEightBoard", () => {
  it("renders 2048 cells with known, large, and fallback tile values", () => {
    const game: TwentyFortyEightGameState = {
      bestScore: 256,
      boardSize: 4,
      moveCount: 3,
      nextTileId: 4,
      score: 128,
      status: "running",
      tiles: [
        { id: "tile-1", value: 2, x: 0, y: 0 },
        { id: "tile-2", value: 128, x: 1, y: 0 },
        { id: "tile-3", value: 4096, x: 2, y: 0 },
      ],
      winTile: 2048,
    };
    const markup = renderToStaticMarkup(
      <TwentyFortyEightBoard game={game} statusLabel="Running" />,
    );

    expectMarkup(markup, [
      'data-testid="twenty-forty-eight-board"',
      "2048 board. Field 4 by 4. Score 128. Best 256. Top tile 4096. Goal 2048. Running.",
      'data-testid="twenty-forty-eight-tile-2"',
      'data-testid="twenty-forty-eight-tile-128"',
      'data-testid="twenty-forty-eight-tile-4096"',
      "Column 4, row 1. Empty.",
    ]);
  });
});
