import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { GameLeaderboardPanel, GameLeaderboardScoreForm } from "./game-leaderboard";
import { createGameLeaderboardPresenterProps } from "./game-leaderboard-presenter";

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

  it("builds shared presenter props for start, final, and score form surfaces", () => {
    const formatScore = (score: number) => `${score}s`;
    const onPlayerNameChange = vi.fn();
    const onSaveScore = vi.fn();
    const slots = [{ name: "Grace", score: 9 }, null, null];

    const props = createGameLeaderboardPresenterProps({
      formatScore,
      isSaving: true,
      onPlayerNameChange,
      onSaveScore,
      playerName: "Ada",
      saveFailed: true,
      scoreLabel: "time",
      slots,
      statusMessage: "Leaderboard unavailable",
      testIdPrefix: "minesweeper",
    });

    expect(props.leaderboardPanelProps).toMatchObject({
      formatScore,
      slotTestIdPrefix: "minesweeper-leaderboard-slot",
      slots,
      statusMessage: "Leaderboard unavailable",
      testId: "minesweeper-start-leaderboard",
    });
    expect(props.finalLeaderboardProps).toMatchObject({
      formatScore,
      slotTestIdPrefix: "minesweeper-final-leaderboard-slot",
      slots,
      statusMessage: "Leaderboard unavailable",
      testId: "minesweeper-final-leaderboard",
    });
    expect(props.scoreFormProps).toMatchObject({
      formatScore,
      isSaving: true,
      onPlayerNameChange,
      onSaveScore,
      playerName: "Ada",
      saveFailed: true,
      scoreLabel: "time",
      testIdPrefix: "minesweeper",
    });

    props.scoreFormProps.onSaveScore();

    expect(onSaveScore).toHaveBeenCalledOnce();
  });
});
