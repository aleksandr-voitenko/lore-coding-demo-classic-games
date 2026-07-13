import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BattleCityStageResults } from "./battle-city-stage-results";

const KILL_COUNTS = {
  armor: 3,
  basic: 8,
  fast: 5,
  power: 4,
} as const;

describe("BattleCityStageResults", () => {
  it("shows every score row while the per-type counts animate", () => {
    const markup = renderToStaticMarkup(
      <BattleCityStageResults
        killCounts={{ armor: 0, basic: 2, fast: 0, power: 0 }}
        score={12_300}
        showTotal={false}
        stage={7}
      />,
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain('data-testid="battle-city-stage-results"');
    expect(markup).toContain('data-show-total="false"');
    expect(markup).toContain("Stage 7");
    expect(markup).toContain("Score 12,300");
    expect(markup).toContain('data-enemy-type="basic"');
    expect(markup).toContain('data-enemy-type="fast"');
    expect(markup).toContain("2 × 100 = 200");
    expect(markup).toContain("0 × 200 = 0");
    expect(markup).toContain("tank-enemy-basic.png?v=modern-v1");
    expect(markup).toContain("text-[var(--battle-city-ink)]");
    expect(markup).toContain(
      "text-[var(--battle-city-results-accent)]",
    );
    expect(markup).not.toContain("text-[var(--battle-city-board-text)]");
    expect(markup).toContain('data-enemy-type="power"');
    expect(markup).toContain('data-enemy-type="armor"');
    expect(markup).not.toContain("battle-city-stage-results-total");
    expect(markup).toContain(
      'aria-label="Stage 7 results. Score 12300. Basic tanks 2. Fast tanks 0. Power tanks 0. Armor tanks 0"',
    );
  });

  it("clamps animation progress and reveals the final total after all rows", () => {
    const markup = renderToStaticMarkup(
      <BattleCityStageResults
        killCounts={KILL_COUNTS}
        score={12_300}
        showTotal
        stage={7}
      />,
    );

    expect(markup).toContain('data-show-total="true"');
    expect(markup.match(/data-testid="battle-city-stage-result-row"/g)).toHaveLength(
      4,
    );
    expect(markup).toContain('data-testid="battle-city-stage-results-total"');
    expect(markup).toContain("Total tanks");
    expect(markup).toContain(">20</dd>");
    expect(markup).toContain(
      "Armor tanks 3. Total tanks 20",
    );
  });
});
