import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

import { SimonBoard } from "./simon-board";
import { expectMarkup } from "./game-board-test-utils";
import { createInitialSimonGame } from "@/lib/simon-game-engine";

describe("SimonBoard", () => {
  it("renders Simon pads with active input state and labels", () => {
    const game = {
      ...createInitialSimonGame({ difficulty: "easy" }),
      activePad: "red" as const,
      round: 2,
      score: 1,
      sequence: ["red" as const],
      status: "input" as const,
      winTarget: 4,
    };
    const markup = renderToStaticMarkup(
      <SimonBoard game={game} onPadPress={vi.fn()} statusLabel="Repeat" />,
    );

    expectMarkup(markup, [
      'data-testid="simon-board"',
      "Simon board. Round 2. Score 1. Difficulty Easy. Target 4. Repeat.",
      'data-testid="simon-pad-green"',
      'data-testid="simon-pad-red"',
      "border-white/95",
      "brightness-125",
      "inset_0_0_0_4px_rgba(255,255,255,0.94)",
      "Red pad. Key 2 or W.",
      ">2</div>",
    ]);
  });
});
