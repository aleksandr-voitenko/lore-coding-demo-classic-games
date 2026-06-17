import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GameReplayCursor } from "@/components/game-replay-cursor";

describe("GameReplayCursor", () => {
  it("renders the shared replay cursor at board-local percentages", () => {
    const markup = renderToStaticMarkup(
      <GameReplayCursor
        position={{ x: 0.25, y: 0.75 }}
        testId="simon-replay-cursor"
      />,
    );

    expect(markup).toContain('data-testid="simon-replay-cursor"');
    expect(markup).toContain("left:25%");
    expect(markup).toContain("top:75%");
  });

  it("uses the Simon cursor appearance for all replay cursors", () => {
    const markup = renderToStaticMarkup(
      <GameReplayCursor
        position={{ x: 0.25, y: 0.75 }}
        testId="minesweeper-replay-cursor"
      />,
    );

    expect(markup).toContain("text-white");
    expect(markup).toContain("drop-shadow-[0_2px_5px_rgba(0,0,0,0.72)]");
    expect(markup).toContain("fill-black");
    expect(markup).not.toContain("minesweeper-focus");
  });

  it("does not render before the first cursor replay event", () => {
    const markup = renderToStaticMarkup(<GameReplayCursor position={null} />);

    expect(markup).not.toContain("game-replay-cursor");
  });
});
