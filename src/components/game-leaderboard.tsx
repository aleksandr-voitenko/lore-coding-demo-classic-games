import { SaveIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  MAX_LEADERBOARD_PLAYER_NAME_LENGTH,
  type LeaderboardEntry,
  type PendingLeaderboardEntry,
} from "@/lib/leaderboard";
import { cn } from "@/lib/utils";

export type LeaderboardScoreFormatter = (score: number) => string;

export type GameLeaderboardPanelProps = {
  className?: string;
  formatScore?: LeaderboardScoreFormatter;
  slotTestIdPrefix: string;
  slots: Array<LeaderboardEntry | null>;
  statusMessage?: string;
  testId: string;
};

export type GameLeaderboardScoreFormProps = {
  formatScore?: LeaderboardScoreFormatter;
  isSaving: boolean;
  onPlayerNameChange: (playerName: string) => void;
  onSaveScore: () => void;
  pendingEntry: PendingLeaderboardEntry;
  playerName: string;
  saveFailed: boolean;
  scoreLabel?: string;
  testIdPrefix: string;
};

function formatDefaultScore(score: number) {
  return String(score);
}

export function GameLeaderboardPanel({
  className,
  formatScore = formatDefaultScore,
  slotTestIdPrefix,
  slots,
  statusMessage,
  testId,
}: GameLeaderboardPanelProps) {
  return (
    <div
      className={cn(
        "flex w-full max-w-xs flex-col gap-2 rounded-md border border-[color-mix(in_oklch,currentColor_16%,transparent)] bg-[color-mix(in_oklch,currentColor_8%,transparent)] p-3",
        className,
      )}
      data-testid={testId}
    >
      <p className="text-sm font-semibold">Leaderboard</p>
      <ol className="flex flex-col gap-1">
        {slots.map((entry, index) => (
          <li
            className="grid grid-cols-[1.75rem_minmax(0,1fr)_3.5rem] items-center gap-2 rounded-md bg-[color-mix(in_oklch,currentColor_6%,transparent)] px-2 py-1.5 text-sm"
            data-testid={`${slotTestIdPrefix}-${index + 1}`}
            key={index}
          >
            <span className="font-mono text-xs font-semibold opacity-70">{index + 1}</span>
            <span className="truncate text-left font-medium">
              {entry ? entry.name || "Anonymous" : "Open"}
            </span>
            <span className="text-right font-mono font-semibold">
              {entry ? formatScore(entry.score) : "-"}
            </span>
          </li>
        ))}
      </ol>
      {statusMessage ? (
        <p
          aria-live="polite"
          className="text-xs font-medium opacity-75"
          data-testid={`${testId}-status`}
        >
          {statusMessage}
        </p>
      ) : null}
    </div>
  );
}

export function GameLeaderboardScoreForm({
  formatScore = formatDefaultScore,
  isSaving,
  onPlayerNameChange,
  onSaveScore,
  pendingEntry,
  playerName,
  saveFailed,
  scoreLabel = "score",
  testIdPrefix,
}: GameLeaderboardScoreFormProps) {
  const playerNameInputId = `${testIdPrefix}-player-name`;

  return (
    <form
      autoComplete="off"
      className="flex w-full max-w-xs flex-col items-center gap-3"
      data-testid={`${testIdPrefix}-leaderboard-form`}
      onSubmit={(event) => {
        event.preventDefault();
        onSaveScore();
      }}
    >
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm font-semibold">
          Top {pendingEntry.rank + 1} {scoreLabel}
        </p>
        <p
          className="font-mono text-5xl font-semibold leading-none"
          data-testid={`${testIdPrefix}-qualifying-score`}
        >
          {formatScore(pendingEntry.score)}
        </p>
      </div>
      <div className="flex w-full flex-col gap-1 text-left">
        <label className="text-xs font-medium opacity-75" htmlFor={playerNameInputId}>
          Name
        </label>
        <input
          autoComplete="off"
          autoFocus
          className="h-9 w-full rounded-md border border-[color-mix(in_oklch,currentColor_22%,transparent)] bg-[color-mix(in_oklch,currentColor_10%,transparent)] px-3 text-sm font-medium outline-none transition placeholder:text-[color-mix(in_oklch,currentColor_54%,transparent)] focus-visible:border-current focus-visible:ring-3 focus-visible:ring-[color-mix(in_oklch,currentColor_24%,transparent)]"
          data-testid={`${testIdPrefix}-player-name`}
          disabled={isSaving}
          id={playerNameInputId}
          maxLength={MAX_LEADERBOARD_PLAYER_NAME_LENGTH}
          onChange={(event) => onPlayerNameChange(event.target.value)}
          placeholder="Player name"
          type="text"
          value={playerName}
        />
      </div>
      <div className="w-full">
        <Button
          className="w-full"
          data-testid={`${testIdPrefix}-save-score-button`}
          disabled={isSaving}
          size="lg"
          type="submit"
          variant="secondary"
        >
          <SaveIcon data-icon="inline-start" />
          {isSaving ? "Saving" : "Save"}
        </Button>
      </div>
      {saveFailed ? (
        <p
          aria-live="polite"
          className="text-xs font-medium opacity-75"
          data-testid={`${testIdPrefix}-save-score-error`}
        >
          Could not save score. Try again.
        </p>
      ) : null}
    </form>
  );
}
