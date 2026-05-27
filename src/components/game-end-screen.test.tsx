import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GameEndLeaderboardContent, GameEndScreen, GameEndSummary } from "./game-end-screen";

describe("game end screen", () => {
  it("renders a shared high-contrast terminal overlay and summary", () => {
    const markup = renderToStaticMarkup(
      <GameEndScreen testId="example-end-screen">
        <GameEndSummary
          metricLabel="Final score"
          metricValue={42}
          metricValueTestId="example-final-score"
          title="Game over"
        />
      </GameEndScreen>,
    );

    expect(markup).toContain('data-testid="example-end-screen"');
    expect(markup).toContain("bg-[#0f172a]/92");
    expect(markup).toContain("text-[#f8fafc]");
    expect(markup).toContain("border-white/20");
    expect(markup).toContain("Game over");
    expect(markup).toContain("Final score");
    expect(markup).toContain('data-testid="example-final-score"');
    expect(markup).toContain(">42</p>");
  });

  it("renders the score form and final leaderboard for pending terminal scores", () => {
    const markup = renderToStaticMarkup(
      <GameEndLeaderboardContent
        action={<button type="button">New game</button>}
        leaderboard={{
          slotTestIdPrefix: "example-final-leaderboard-slot",
          slots: [{ name: "Ada", score: 99 }, null, null],
          statusMessage: "Leaderboard loaded",
          testId: "example-final-leaderboard",
        }}
        pendingLeaderboardEntry={{ rank: 0, score: 99 }}
        scoreForm={{
          isSaving: false,
          onPlayerNameChange: () => undefined,
          onSaveScore: () => undefined,
          playerName: "",
          saveFailed: false,
          testIdPrefix: "example",
        }}
        summary={{
          metricLabel: "Final score",
          metricValue: 42,
          metricValueTestId: "example-final-score",
          title: "Game over",
        }}
      />,
    );

    expect(markup).toContain('data-testid="example-leaderboard-form"');
    expect(markup).toContain('data-testid="example-final-leaderboard"');
    expect(markup).toContain('data-testid="example-final-leaderboard-slot-1"');
    expect(markup).toContain(">99</p>");
    expect(markup).not.toContain('data-testid="example-final-score"');
    expect(markup).not.toContain("New game");
  });

  it("renders the final summary, leaderboard, and action after score entry resolves", () => {
    const markup = renderToStaticMarkup(
      <GameEndLeaderboardContent
        action={<button type="button">New game</button>}
        leaderboard={{
          slotTestIdPrefix: "example-final-leaderboard-slot",
          slots: [{ name: "Ada", score: 99 }, null, null],
          statusMessage: "Leaderboard loaded",
          testId: "example-final-leaderboard",
        }}
        pendingLeaderboardEntry={null}
        scoreForm={{
          isSaving: false,
          onPlayerNameChange: () => undefined,
          onSaveScore: () => undefined,
          playerName: "",
          saveFailed: false,
          testIdPrefix: "example",
        }}
        summary={{
          metricLabel: "Final score",
          metricValue: 42,
          metricValueTestId: "example-final-score",
          title: "Game over",
        }}
      />,
    );

    expect(markup).toContain("Game over");
    expect(markup).toContain("Final score");
    expect(markup).toContain('data-testid="example-final-score"');
    expect(markup).toContain('data-testid="example-final-leaderboard"');
    expect(markup).toContain("New game");
    expect(markup).not.toContain('data-testid="example-leaderboard-form"');
  });
});
