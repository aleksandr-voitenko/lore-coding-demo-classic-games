import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  shouldAdvanceSimonReplayCursorBeforeAction,
  SimonReplayCursor,
  SimonReplayTurnFeedback,
} from "./simon-replay-player";
import {
  createInitialSimonGame,
  type SimonGameState,
} from "@/lib/simon-game-engine";

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

describe("shouldAdvanceSimonReplayCursorBeforeAction", () => {
  it("prioritizes same-timestamp cursor movement before Simon actions", () => {
    expect(
      shouldAdvanceSimonReplayCursorBeforeAction({
        cursorEvent: {
          elapsedMs: 1_000,
          seq: 0,
          tick: 1,
          type: "cursorMove",
          x: 0.25,
          y: 0.75,
        },
        event: {
          elapsedMs: 1_000,
          pad: "green",
          seq: 1,
          tick: 1,
          type: "pad",
        },
      }),
    ).toBe(true);

    expect(
      shouldAdvanceSimonReplayCursorBeforeAction({
        cursorEvent: {
          elapsedMs: 1_050,
          seq: 0,
          tick: 1,
          type: "cursorMove",
          x: 0.25,
          y: 0.75,
        },
        event: {
          elapsedMs: 1_000,
          pad: "green",
          seq: 1,
          tick: 1,
          type: "pad",
        },
      }),
    ).toBe(false);
  });
});

describe("SimonReplayCursor", () => {
  it("renders the replay cursor at board-local percentages", () => {
    const markup = renderToStaticMarkup(
      <SimonReplayCursor position={{ x: 0.25, y: 0.75 }} />,
    );

    expect(markup).toContain('data-testid="simon-replay-cursor"');
    expect(markup).toContain("left:25%");
    expect(markup).toContain("top:75%");
  });

  it("does not render before the first cursor replay event", () => {
    const markup = renderToStaticMarkup(<SimonReplayCursor position={null} />);

    expect(markup).not.toContain("simon-replay-cursor");
  });
});
