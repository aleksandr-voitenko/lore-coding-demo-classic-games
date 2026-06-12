import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SnakeLevelIntermissionScreen } from "./snake-level-intermission-screen";

describe("SnakeLevelIntermissionScreen", () => {
  it("renders the next level number", () => {
    const markup = renderToStaticMarkup(<SnakeLevelIntermissionScreen level={2} />);

    expect(markup).toContain('data-testid="snake-level-intermission"');
    expect(markup).not.toContain("Next level");
    expect(markup).toContain("Level 2");
  });
});
