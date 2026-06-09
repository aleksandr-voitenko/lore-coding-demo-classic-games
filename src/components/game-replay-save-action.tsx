"use client";

import { SaveIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ReplaySaveStatus = "failed" | "idle" | "saved" | "saving";

type GameReplaySaveActionProps = {
  errorClassName?: string;
  onSave: () => void;
  replayReady: boolean;
  status: ReplaySaveStatus;
  testIdPrefix: string;
};

export function GameReplaySaveAction({
  errorClassName,
  onSave,
  replayReady,
  status,
  testIdPrefix,
}: GameReplaySaveActionProps) {
  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-2">
      <Button
        className="w-full"
        data-testid={`${testIdPrefix}-save-replay-button`}
        disabled={!replayReady || status === "saving" || status === "saved"}
        onClick={onSave}
        size="lg"
        type="button"
        variant="secondary"
      >
        <SaveIcon data-icon="inline-start" />
        {getReplaySaveLabel(status)}
      </Button>
      {status === "failed" ? (
        <p
          className={cn("text-xs font-medium text-[#cbd5e1]", errorClassName)}
          data-testid={`${testIdPrefix}-save-replay-error`}
        >
          Could not save replay. Sign in and try again.
        </p>
      ) : null}
    </div>
  );
}

function getReplaySaveLabel(status: ReplaySaveStatus) {
  if (status === "saving") {
    return "Saving replay";
  }

  if (status === "saved") {
    return "Replay saved";
  }

  return "Save replay";
}
