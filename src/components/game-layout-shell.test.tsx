import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GameHeader, GameShell, GameStatCard } from "./game-layout-shell";

describe("game layout shell", () => {
  it("centers the board rail and keeps the sidebar adjacent on desktop", () => {
    const markup = renderToStaticMarkup(
      <GameShell className="bg-test">
        <aside>Stats</aside>
        <div>Board</div>
      </GameShell>,
    );

    expect(markup).toContain("max-w-[100rem]");
    expect(markup).toContain("xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]");
    expect(markup).toContain("xl:content-center xl:items-start");
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

  it("renders a shared sidebar stat card with game-specific color hooks", () => {
    const markup = renderToStaticMarkup(
      <dl>
        <GameStatCard
          className="border-[var(--snake-border)]"
          label="Score"
          labelClassName="text-[var(--snake-muted)]"
          value={42}
          valueTestId="snake-score"
        />
      </dl>,
    );

    expect(markup).toContain("rounded-md border p-3");
    expect(markup).toContain("border-[var(--snake-border)]");
    expect(markup).toContain("<dt");
    expect(markup).toContain("text-[var(--snake-muted)]");
    expect(markup).toContain("<dd");
    expect(markup).toContain('data-testid="snake-score"');
    expect(markup).toContain(">42</dd>");
  });
});
