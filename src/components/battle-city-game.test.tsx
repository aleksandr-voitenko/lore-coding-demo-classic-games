import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BattleCityGame } from "./battle-city-game";

describe("BattleCityGame", () => {
  it("launches latest replay mode without live campaign controls", () => {
    const markup = renderToStaticMarkup(
      <BattleCityGame onBackToMenu={() => undefined} replayMode="latest" />,
    );

    expect(markup).toContain('data-testid="battle-city-replay-status"');
    expect(markup).toContain("Loading Tank Patrol replay");
    expect(markup).not.toContain('data-testid="battle-city-status"');
    expect(markup).not.toContain('data-testid="battle-city-start-button"');
    expect(markup).not.toContain('data-testid="battle-city-save-replay-button"');
  });
});
