import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";

import { PongBoard } from "./pong-board";
import { expectMarkup } from "./game-board-test-utils";
import { createInitialPongGame } from "@/lib/pong-game-engine";

describe("PongBoard", () => {
  it("renders Pong ball, paddles, and score target", () => {
    const game = createInitialPongGame();
    const markup = renderToStaticMarkup(<PongBoard game={game} statusLabel="Ready" />);

    expectMarkup(markup, [
      'data-testid="pong-board"',
      "Pong board. Field 420 by 560. Score 1000. Player 0. Computer 0. First to 5. Ready.",
      'data-testid="pong-ball"',
      'data-testid="pong-player-paddle"',
      'data-testid="pong-cpu-paddle"',
    ]);
  });
});
