import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";

import { BreakoutBoard } from "./breakout-board";
import { expectMarkup } from "./game-board-test-utils";
import { createInitialBreakoutGame } from "@/lib/breakout-game-engine";

describe("BreakoutBoard", () => {
  it("renders Breakout ball, paddle, and active brick count", () => {
    const game = createInitialBreakoutGame();
    const markup = renderToStaticMarkup(
      <BreakoutBoard
        game={{
          ...game,
          bricks: game.bricks.map((brick, index) => ({
            ...brick,
            isActive: index !== 0,
          })),
          status: "running",
        }}
        statusLabel="Running"
      />,
    );

    expectMarkup(markup, [
      'data-testid="breakout-board"',
      "Breakout board. Field 420 by 560. Score 0. Lives 3. 49 bricks remaining. Running.",
      'data-testid="breakout-brick"',
      'data-testid="breakout-ball"',
      'data-testid="breakout-paddle"',
    ]);
  });
});
