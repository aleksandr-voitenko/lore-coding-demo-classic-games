import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SimonReplayTurnFeedback } from "./simon-replay-player";
import { createInitialSimonGame, type SimonGameState } from "@/lib/simon-game-engine";

function createReplayFeedbackGame(
  overrides: Partial<SimonGameState>,
): SimonGameState {
  return {
    ...createInitialSimonGame(),
    ...overrides,
  };
}

describe("SimonReplayTurnFeedback", () => {
  it("renders replayed correct feedback after the pad flash clears", () => {
    const markup = renderToStaticMarkup(
      <SimonReplayTurnFeedback
        game={createReplayFeedbackGame({
          activePad: null,
          status: "correct",
        })}
      />,
    );

    expect(markup).toContain('data-testid="simon-replay-correct-feedback"');
    expect(markup).toContain("CORRECT!");
  });

  it("renders replayed miss feedback after the pad flash clears", () => {
    const markup = renderToStaticMarkup(
      <SimonReplayTurnFeedback
        game={createReplayFeedbackGame({
          activePad: null,
          status: "missed",
        })}
      />,
    );

    expect(markup).toContain('data-testid="simon-replay-miss-feedback"');
    expect(markup).toContain("MISS!");
  });

  it("waits for the replayed pad flash before rendering feedback", () => {
    const markup = renderToStaticMarkup(
      <SimonReplayTurnFeedback
        game={createReplayFeedbackGame({
          activePad: "green",
          status: "correct",
        })}
      />,
    );

    expect(markup).not.toContain("simon-replay-correct-feedback");
    expect(markup).not.toContain("CORRECT!");
  });
});
