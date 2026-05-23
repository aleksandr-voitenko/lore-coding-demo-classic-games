import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GameEndScreen, GameEndSummary } from "./game-end-screen";

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
});
