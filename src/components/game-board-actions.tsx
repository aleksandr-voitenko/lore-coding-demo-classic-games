"use client";

import {
  ArrowLeftIcon,
  CircleQuestionMarkIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type GameBoardPauseAction = {
  disabled?: boolean;
  isResume?: boolean;
  label: string;
  onClick: () => void;
};

type GameBoardActionsProps = {
  backDisabled?: boolean;
  helpDisabled?: boolean;
  onBackToMenu?: () => void;
  onHelp?: () => void;
  onRestart?: () => void;
  pauseAction?: GameBoardPauseAction;
  restartDisabled?: boolean;
  testIdPrefix: string;
};

type GameBoardActionButtonProps = {
  children: ReactNode;
  disabled?: boolean;
  isHintVisible: boolean;
  label: string;
  onHintActivate: () => void;
  onHintClear: () => void;
  onClick?: () => void;
  testId: string;
};

export function GameBoardActions({
  backDisabled,
  helpDisabled,
  onBackToMenu,
  onHelp,
  onRestart,
  pauseAction,
  restartDisabled,
  testIdPrefix,
}: GameBoardActionsProps) {
  const [activeHint, setActiveHint] = useState<string | null>(null);
  const PauseActionIcon = pauseAction?.isResume ? PlayIcon : PauseIcon;

  return (
    <div
      className="z-30 flex flex-col items-end gap-2"
      data-testid={`${testIdPrefix}-board-actions`}
    >
      {onBackToMenu ? (
        <GameBoardActionButton
          disabled={backDisabled}
          isHintVisible={activeHint === "back"}
          label="Back to game menu"
          onHintActivate={() => setActiveHint("back")}
          onHintClear={() => setActiveHint((current) => (current === "back" ? null : current))}
          onClick={onBackToMenu}
          testId={`${testIdPrefix}-back-to-menu`}
        >
          <ArrowLeftIcon />
        </GameBoardActionButton>
      ) : null}

      {onHelp ? (
        <GameBoardActionButton
          disabled={helpDisabled}
          isHintVisible={activeHint === "help"}
          label="Help"
          onHintActivate={() => setActiveHint("help")}
          onHintClear={() => setActiveHint((current) => (current === "help" ? null : current))}
          onClick={onHelp}
          testId={`${testIdPrefix}-board-help`}
        >
          <CircleQuestionMarkIcon />
        </GameBoardActionButton>
      ) : null}

      {pauseAction ? (
        <GameBoardActionButton
          disabled={pauseAction.disabled}
          isHintVisible={activeHint === "pause"}
          label={pauseAction.label}
          onHintActivate={() => setActiveHint("pause")}
          onHintClear={() => setActiveHint((current) => (current === "pause" ? null : current))}
          onClick={pauseAction.onClick}
          testId={`${testIdPrefix}-board-pause`}
        >
          <PauseActionIcon />
        </GameBoardActionButton>
      ) : null}

      {onRestart ? (
        <GameBoardActionButton
          disabled={restartDisabled}
          isHintVisible={activeHint === "restart"}
          label="Restart"
          onHintActivate={() => setActiveHint("restart")}
          onHintClear={() =>
            setActiveHint((current) => (current === "restart" ? null : current))
          }
          onClick={onRestart}
          testId={`${testIdPrefix}-board-restart`}
        >
          <RotateCcwIcon />
        </GameBoardActionButton>
      ) : null}
    </div>
  );
}

function GameBoardActionButton({
  children,
  disabled,
  isHintVisible,
  label,
  onHintActivate,
  onHintClear,
  onClick,
  testId,
}: GameBoardActionButtonProps) {
  return (
    <div className="relative flex justify-end">
      <span
        className={cn(
          "pointer-events-none absolute right-[calc(100%+0.5rem)] top-1/2 z-40 -translate-y-1/2 rounded-md border border-white/35 bg-black/75 px-2 py-1 text-xs font-semibold text-white opacity-0 shadow-[0_10px_24px_rgba(0,0,0,0.28)] backdrop-blur-md transition-opacity",
          isHintVisible && "opacity-100",
        )}
      >
        {label}
      </span>
      <Button
        aria-label={label}
        className="border-white/45 bg-black/55 text-white shadow-[0_10px_24px_rgba(0,0,0,0.24)] backdrop-blur-md hover:bg-black/70 hover:text-white focus-visible:border-white/70 focus-visible:ring-white/40"
        data-testid={testId}
        disabled={disabled}
        onBlur={onHintClear}
        onFocus={onHintActivate}
        onMouseEnter={onHintActivate}
        onMouseLeave={onHintClear}
        onClick={onClick}
        size="icon-lg"
        type="button"
        variant="outline"
      >
        {children}
      </Button>
    </div>
  );
}
