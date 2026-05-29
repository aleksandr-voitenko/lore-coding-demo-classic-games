import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  GameBoardColumn,
  GameBoardStage,
  GameHeader,
  GameShell,
  GameSidebar,
  GameStatsBar,
  GameStatCard,
} from "./game-layout-shell";

describe("game layout shell", () => {
  it("centers the board column with the stats bar above the board stage", () => {
    const markup = renderToStaticMarkup(
      <GameShell className="bg-test">
        <GameBoardColumn className="w-test">
          <GameSidebar className="bg-panel">
            <GameStatsBar>
              <GameStatCard
                className="border-test"
                label="Score"
                labelClassName="text-muted"
                value={42}
              />
            </GameStatsBar>
          </GameSidebar>
          <GameBoardStage actions={<button type="button">Pause</button>}>
            <div>Board</div>
          </GameBoardStage>
        </GameBoardColumn>
      </GameShell>,
    );

    expect(markup).toContain("max-w-[100rem]");
    expect(markup).toContain("justify-center");
    expect(markup).toContain("xl:items-center");
    expect(markup).toContain("w-test");
    expect(markup.indexOf('data-testid="game-sidebar"')).toBeLessThan(
      markup.indexOf('data-testid="game-board-stage"'),
    );
  });

  it("keeps game status available without rendering a visible sidebar title block", () => {
    const markup = renderToStaticMarkup(
      <GameHeader status="Ready" statusTestId="snake-status" title="Classic Snake" />,
    );

    expect(markup).toContain('class="sr-only"');
    expect(markup).toContain("<h1>Classic Snake</h1>");
    expect(markup).toContain('data-testid="snake-status"');
    expect(markup).toContain(">Ready</p>");
  });

  it("renders a single-row shared stats bar with game-specific color hooks", () => {
    const markup = renderToStaticMarkup(
      <GameStatsBar>
        <GameStatCard
          className="border-[var(--snake-border)]"
          label="Score"
          labelClassName="text-[var(--snake-muted)]"
          value={42}
          valueTestId="snake-score"
        />
      </GameStatsBar>,
    );

    expect(markup).toContain("grid-flow-col auto-cols-fr");
    expect(markup).toContain("min-w-0 rounded-md border p-2 sm:p-3");
    expect(markup).toContain("border-[var(--snake-border)]");
    expect(markup).toContain("<dt");
    expect(markup).toContain("text-[var(--snake-muted)]");
    expect(markup).toContain("<dd");
    expect(markup).toContain('data-testid="snake-score"');
    expect(markup).toContain(">42</dd>");
  });
});
