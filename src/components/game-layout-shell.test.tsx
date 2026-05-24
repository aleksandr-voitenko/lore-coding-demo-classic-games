import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GameStatCard } from "./game-layout-shell";

describe("game layout shell", () => {
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
