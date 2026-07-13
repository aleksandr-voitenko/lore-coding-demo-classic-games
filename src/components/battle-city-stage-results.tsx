"use client";

import { getBattleCityAssetUrl } from "@/lib/battle-city/assets";

type BattleCityStageResultCounts = Readonly<{
  armor: number;
  basic: number;
  fast: number;
  power: number;
}>;

type BattleCityStageResultsProps = {
  killCounts: BattleCityStageResultCounts;
  score: number;
  showTotal: boolean;
  stage: number;
};

const RESULT_ROWS = [
  {
    asset: "tank-enemy-basic.png",
    label: "Basic tanks",
    points: 100,
    type: "basic",
  },
  {
    asset: "tank-enemy-fast.png",
    label: "Fast tanks",
    points: 200,
    type: "fast",
  },
  {
    asset: "tank-enemy-power.png",
    label: "Power tanks",
    points: 300,
    type: "power",
  },
  {
    asset: "tank-enemy-armor.png",
    label: "Armor tanks",
    points: 400,
    type: "armor",
  },
] as const;

function formatNumber(value: number) {
  return value.toLocaleString("en-US");
}

export function BattleCityStageResults({
  killCounts,
  score,
  showTotal,
  stage,
}: BattleCityStageResultsProps) {
  const totalKills = RESULT_ROWS.reduce(
    (total, row) => total + killCounts[row.type],
    0,
  );
  const visibleResultSummary = RESULT_ROWS
    .map((row) => `${row.label} ${killCounts[row.type]}`)
    .join(". ");
  const accessibleSummary = [
    `Stage ${stage} results`,
    `Score ${score}`,
    visibleResultSummary,
    showTotal ? `Total tanks ${totalKills}` : "",
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <section
      aria-label={accessibleSummary}
      className="absolute inset-2 flex items-center justify-center overflow-hidden rounded-[0.375rem] bg-[color-mix(in_oklch,var(--battle-city-board)_94%,black)] px-5 py-6 text-[var(--battle-city-ink)]"
      data-testid="battle-city-stage-results"
      data-show-total={showTotal}
      role="status"
    >
      <div className="w-full max-w-sm rounded-md border border-[var(--battle-city-board-border)] bg-[color-mix(in_oklch,var(--battle-city-panel)_88%,transparent)] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.42)]">
        <div className="mb-4 border-b border-[var(--battle-city-border)] pb-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--battle-city-muted)]">
            Stage {stage}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-wide">
            Battle results
          </h2>
          <p className="mt-1 font-mono text-sm text-[var(--battle-city-results-accent)]">
            Score {formatNumber(score)}
          </p>
        </div>

        <dl className="space-y-2 font-mono text-sm">
          {RESULT_ROWS.map((row) => {
            const count = killCounts[row.type];
            const subtotal = count * row.points;

            return (
              <div
                aria-label={`${row.label}: ${count}, ${subtotal} points`}
                className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-sm border border-[var(--battle-city-border)] bg-black/20 px-3 py-2"
                data-enemy-type={row.type}
                data-testid="battle-city-stage-result-row"
                key={row.type}
              >
                <dt className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-6 shrink-0 bg-contain bg-center bg-no-repeat"
                    style={{
                      backgroundImage: `url(${getBattleCityAssetUrl(row.asset)})`,
                    }}
                  />
                  <span>{row.points} pts</span>
                </dt>
                <dd className="tabular-nums">
                  {count} × {row.points} = {formatNumber(subtotal)}
                </dd>
              </div>
            );
          })}

          {showTotal ? (
            <div
              className="mt-3 flex items-center justify-between border-t border-[var(--battle-city-border)] px-3 pt-3 font-semibold text-[var(--battle-city-results-accent)]"
              data-testid="battle-city-stage-results-total"
            >
              <dt>Total tanks</dt>
              <dd className="tabular-nums">{totalKills}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </section>
  );
}

export type {
  BattleCityStageResultCounts,
  BattleCityStageResultsProps,
};
