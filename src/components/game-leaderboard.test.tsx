import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { GameLeaderboardPanel, GameLeaderboardScoreForm } from "./game-leaderboard";

describe("game leaderboard", () => {
  it("renders fixed leaderboard slots with formatted scores", () => {
    const markup = renderToStaticMarkup(
      <GameLeaderboardPanel
        formatScore={(score) => `${score}s`}
        slotTestIdPrefix="test-leaderboard-slot"
        slots={[
          { name: "Ada", score: 12 },
          null,
          { name: "", score: 30 },
        ]}
        statusMessage="Leaderboard unavailable"
        testId="test-leaderboard"
      />,
    );

    expect(markup).toContain('data-testid="test-leaderboard"');
    expect(markup).toContain("Ada");
    expect(markup).toContain("12s");
    expect(markup).toContain("Open");
    expect(markup).toContain("Anonymous");
    expect(markup).toContain("Leaderboard unavailable");
  });

  it("renders the save form with game-specific score labels", () => {
    const markup = renderToStaticMarkup(
      <GameLeaderboardScoreForm
        formatScore={(score) => `0:${score.toString().padStart(2, "0")}`}
        isSaving={false}
        onPlayerNameChange={vi.fn()}
        onSaveScore={vi.fn()}
        pendingEntry={{ rank: 1, score: 12 }}
        playerName=""
        saveFailed
        scoreLabel="time"
        testIdPrefix="minesweeper"
      />,
    );

    expect(markup).toContain('data-testid="minesweeper-leaderboard-form"');
    expect(markup).toContain("Top 2 time");
    expect(markup).toContain("0:12");
    expect(markup).toContain('data-testid="minesweeper-save-score-error"');
  });
});
