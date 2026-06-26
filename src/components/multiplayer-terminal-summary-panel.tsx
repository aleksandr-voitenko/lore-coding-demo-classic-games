import type { ReactNode } from "react";

export type MultiplayerTerminalSummaryRow = {
  label: string;
  testId: string;
  value: ReactNode;
};

export function MultiplayerTerminalSummaryPanel({
  rows,
  testId,
}: {
  rows: readonly MultiplayerTerminalSummaryRow[];
  testId: string;
}) {
  return (
    <section
      className="mt-4 rounded-md border border-[var(--chrome-border)] p-3"
      data-testid={testId}
    >
      <h3 className="text-sm font-semibold tracking-normal">Match summary</h3>
      <dl className="mt-3 grid gap-2 text-sm">
        {rows.map((row) => (
          <MultiplayerTerminalSummaryPanelRow key={row.testId} row={row} />
        ))}
      </dl>
    </section>
  );
}

function MultiplayerTerminalSummaryPanelRow({
  row,
}: {
  row: MultiplayerTerminalSummaryRow;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--chrome-muted)]">
        {row.label}
      </dt>
      <dd
        className="mt-1 break-all font-semibold tracking-normal"
        data-testid={row.testId}
      >
        {row.value}
      </dd>
    </div>
  );
}
