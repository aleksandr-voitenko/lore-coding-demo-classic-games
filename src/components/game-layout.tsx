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

type GameShellProps = {
  children: ReactNode;
  className: string;
};

type GameSidebarProps = {
  children: ReactNode;
  className: string;
};

type GameBoardColumnProps = {
  children: ReactNode;
  className: string;
};

type GameBoardStageProps = {
  actions: ReactNode;
  children: ReactNode;
};

type GameBoardPauseAction = {
  disabled?: boolean;
  isResume?: boolean;
  label: string;
  onClick: () => void;
};

type GameBoardActionsProps = {
  onHelp?: () => void;
  onRestart: () => void;
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

type GameHeaderProps = {
  accentClassName: string;
  backButtonTestId: string;
  onBackToMenu?: () => void;
  status: string;
  statusClassName: string;
  statusTestId: string;
  title: string;
};

export function GameShell({ children, className }: GameShellProps) {
  return (
    <main className={cn("min-h-svh px-4 py-6 sm:px-6 lg:py-8", className)}>
      <section className="mx-auto grid w-full max-w-6xl gap-5 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[minmax(17rem,20rem)_minmax(0,1fr)] lg:items-center">
        {children}
      </section>
    </main>
  );
}

export function GameSidebar({ children, className }: GameSidebarProps) {
  return (
    <aside className={cn("flex flex-col gap-4 rounded-md border p-4 shadow-sm", className)}>
      {children}
    </aside>
  );
}

export function GameBoardColumn({ children, className }: GameBoardColumnProps) {
  return <div className={cn("mx-auto flex w-full flex-col gap-3", className)}>{children}</div>;
}

export function GameBoardStage({ actions, children }: GameBoardStageProps) {
  return (
    <div className="grid w-full grid-cols-[minmax(0,1fr)_2.25rem] items-start gap-2 sm:gap-3">
      <div className="min-w-0">{children}</div>
      {actions}
    </div>
  );
}

export function GameBoardActions({
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
      <GameBoardActionButton
        isHintVisible={activeHint === "help"}
        label="Help"
        onHintActivate={() => setActiveHint("help")}
        onHintClear={() => setActiveHint((current) => (current === "help" ? null : current))}
        onClick={onHelp}
        testId={`${testIdPrefix}-board-help`}
      >
        <CircleQuestionMarkIcon />
      </GameBoardActionButton>

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

      <GameBoardActionButton
        disabled={restartDisabled}
        isHintVisible={activeHint === "restart"}
        label="Restart"
        onHintActivate={() => setActiveHint("restart")}
        onHintClear={() => setActiveHint((current) => (current === "restart" ? null : current))}
        onClick={onRestart}
        testId={`${testIdPrefix}-board-restart`}
      >
        <RotateCcwIcon />
      </GameBoardActionButton>
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

export function GameHeader({
  accentClassName,
  backButtonTestId,
  onBackToMenu,
  status,
  statusClassName,
  statusTestId,
  title,
}: GameHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-2">
        <div className={cn("h-2 w-14 rounded-full", accentClassName)} aria-hidden="true" />
        <h1 className="text-3xl font-semibold tracking-normal text-balance">{title}</h1>
        <p
          className={cn("text-sm font-medium", statusClassName)}
          aria-live="polite"
          data-testid={statusTestId}
        >
          {status}
        </p>
      </div>
      {onBackToMenu ? (
        <Button
          aria-label="Back to game menu"
          data-testid={backButtonTestId}
          onClick={onBackToMenu}
          size="icon"
          type="button"
          variant="outline"
        >
          <ArrowLeftIcon />
        </Button>
      ) : null}
    </div>
  );
}
