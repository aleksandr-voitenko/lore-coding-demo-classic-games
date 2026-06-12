type SnakeLevelIntermissionScreenProps = {
  level: number;
  testId?: string;
};

export function SnakeLevelIntermissionScreen({
  level,
  testId = "snake-level-intermission",
}: SnakeLevelIntermissionScreenProps) {
  return (
    <div
      className="absolute inset-2 flex items-center justify-center rounded-[0.375rem] bg-[color-mix(in_oklch,var(--snake-board)_80%,transparent)] px-4 text-center text-[var(--snake-board-text)] shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--snake-accent)_34%,transparent)] backdrop-blur-[2px]"
      data-testid={testId}
    >
      <p className="font-mono text-4xl font-semibold leading-none tracking-normal sm:text-5xl">
        Level {level}
      </p>
    </div>
  );
}
