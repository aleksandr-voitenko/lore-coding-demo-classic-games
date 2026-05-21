"use client";

import {
  ArrowLeftIcon,
  CircleQuestionMarkIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  cancelGameMenuExitFlow,
  closeGameHelpFlow,
  confirmGameMenuExitFlow,
  initialGameHelpFlowState,
  initialGameMenuExitFlowState,
  openGameHelpFlow,
  requestGameMenuExitFlow,
  type GameHelpFlowEffect,
  type GameMenuExitFlowEffect,
} from "@/lib/game-ui-flow";
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
  backDisabled?: boolean;
  helpDisabled?: boolean;
  onBackToMenu?: () => void;
  onHelp?: () => void;
  onRestart: () => void;
  pauseAction?: GameBoardPauseAction;
  restartDisabled?: boolean;
  testIdPrefix: string;
};

export type GameHelpSection = {
  controls?: GameHelpControlRow[];
  items?: string[];
  title: string;
};

export type GameHelpControlRow = {
  buttons: GameHelpControlButtonSpec[];
  label: string;
};

export type GameHelpControlButtonSpec = {
  icon?: LucideIcon;
  label: string;
  text?: string;
};

type GameHelpScreenProps = {
  className?: string;
  onClose: () => void;
  sections: GameHelpSection[];
  testId: string;
  title: string;
};

type GameAbandonDialogProps = {
  onCancel: () => void;
  onConfirm: () => void;
};

type UseGameHelpScreenOptions = {
  isGameActive?: boolean;
  onPauseGame?: () => void;
  onResumeGame?: () => void;
};

type UseGameEscapeToMenuOptions = {
  isDisabled?: boolean;
  isGameStarted: boolean;
  onBackToMenu?: () => void;
  onPauseGame?: () => void;
  onResumeGame?: () => void;
  shouldPauseBeforeConfirm?: boolean;
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

export function useGameHelpScreen({
  isGameActive = false,
  onPauseGame,
  onResumeGame,
}: UseGameHelpScreenOptions = {}) {
  const [helpFlow, setHelpFlow] = useState(initialGameHelpFlowState);

  const applyHelpEffect = useCallback(
    (effect: GameHelpFlowEffect) => {
      if (effect === "pause") {
        onPauseGame?.();
      }

      if (effect === "resume") {
        onResumeGame?.();
      }
    },
    [onPauseGame, onResumeGame],
  );

  const openHelp = useCallback(() => {
    const transition = openGameHelpFlow(helpFlow, isGameActive);

    setHelpFlow(transition.state);
    applyHelpEffect(transition.effect);
  }, [applyHelpEffect, helpFlow, isGameActive]);

  const closeHelp = useCallback(() => {
    const transition = closeGameHelpFlow(helpFlow);

    setHelpFlow(transition.state);
    applyHelpEffect(transition.effect);
  }, [applyHelpEffect, helpFlow]);

  return {
    closeHelp,
    isHelpVisible: helpFlow.isHelpVisible,
    openHelp,
  };
}

export function useGameEscapeToMenu({
  isDisabled = false,
  isGameStarted,
  onBackToMenu,
  onPauseGame,
  onResumeGame,
  shouldPauseBeforeConfirm = false,
}: UseGameEscapeToMenuOptions) {
  const [menuExitFlow, setMenuExitFlow] = useState(initialGameMenuExitFlowState);

  const applyMenuExitEffect = useCallback(
    (effect: GameMenuExitFlowEffect) => {
      if (effect === "back") {
        onBackToMenu?.();
      }

      if (effect === "pause") {
        onPauseGame?.();
      }

      if (effect === "resume") {
        onResumeGame?.();
      }
    },
    [onBackToMenu, onPauseGame, onResumeGame],
  );

  const cancelAbandon = useCallback(() => {
    const transition = cancelGameMenuExitFlow(menuExitFlow);

    setMenuExitFlow(transition.state);
    applyMenuExitEffect(transition.effect);
  }, [applyMenuExitEffect, menuExitFlow]);

  const confirmAbandon = useCallback(() => {
    const transition = confirmGameMenuExitFlow();

    setMenuExitFlow(transition.state);
    applyMenuExitEffect(transition.effect);
  }, [applyMenuExitEffect]);

  const requestBackToMenu = useCallback(() => {
    if (!onBackToMenu) {
      return;
    }

    const transition = requestGameMenuExitFlow(menuExitFlow, {
      isDisabled,
      isGameStarted,
      shouldPauseBeforeConfirm,
    });

    setMenuExitFlow(transition.state);
    applyMenuExitEffect(transition.effect);
  }, [
    applyMenuExitEffect,
    isDisabled,
    isGameStarted,
    menuExitFlow,
    onBackToMenu,
    shouldPauseBeforeConfirm,
  ]);

  useEffect(() => {
    if (!onBackToMenu || isDisabled || menuExitFlow.isAbandonDialogVisible) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      requestBackToMenu();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDisabled, menuExitFlow.isAbandonDialogVisible, onBackToMenu, requestBackToMenu]);

  return {
    abandonDialogProps: menuExitFlow.isAbandonDialogVisible
      ? {
          onCancel: cancelAbandon,
          onConfirm: confirmAbandon,
        }
      : null,
    requestBackToMenu: onBackToMenu ? requestBackToMenu : undefined,
  };
}

export function GameAbandonDialog({ onCancel, onConfirm }: GameAbandonDialogProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      onCancel();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div
      aria-describedby="game-abandon-dialog-description"
      aria-labelledby="game-abandon-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      data-testid="game-abandon-dialog"
      role="alertdialog"
    >
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-md border border-white/25 bg-[#10151f] p-4 text-left text-white shadow-[0_24px_80px_rgba(0,0,0,0.42)]">
        <div className="flex flex-col gap-2">
          <h2
            className="text-xl font-semibold tracking-normal text-balance"
            id="game-abandon-dialog-title"
          >
            Abandon game?
          </h2>
          <p className="text-sm leading-6 text-white/78" id="game-abandon-dialog-description">
            Your current game will be lost and you will return to the game menu.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            autoFocus
            className="border-white/35 bg-white/10 text-white hover:bg-white/20 hover:text-white focus-visible:border-white/70 focus-visible:ring-white/40"
            data-testid="game-abandon-cancel"
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            className="bg-white text-[#10151f] hover:bg-white/86"
            data-testid="game-abandon-confirm"
            onClick={onConfirm}
            type="button"
          >
            OK
          </Button>
        </div>
      </div>
    </div>
  );
}

export function GameHelpScreen({
  className,
  onClose,
  sections,
  testId,
  title,
}: GameHelpScreenProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      onClose();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      data-testid={testId}
      role="dialog"
      aria-label={`${title} help`}
    >
      <div
        className={cn(
          "flex max-h-[min(36rem,calc(100svh-2rem))] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-md border border-white/25 p-4 text-left shadow-[0_24px_80px_rgba(0,0,0,0.42)]",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-normal opacity-70">Help</p>
            <h2 className="text-2xl font-semibold tracking-normal text-balance">{title}</h2>
          </div>
          <Button
            aria-label="Close help"
            autoFocus
            className="border-white/35 bg-white/10 text-current hover:bg-white/20 hover:text-current focus-visible:border-white/70 focus-visible:ring-white/40"
            data-testid={`${testId}-close`}
            onClick={onClose}
            size="icon"
            type="button"
            variant="outline"
          >
            <XIcon />
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1.18fr)_minmax(0,0.82fr)]">
          {sections.map((section) => (
            <section className="flex min-w-0 flex-col gap-2" key={section.title}>
              <h3 className="text-sm font-semibold tracking-normal">{section.title}</h3>
              {section.controls ? <GameHelpControls controls={section.controls} /> : null}
              {section.items ? <GameHelpItems items={section.items} /> : null}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function GameHelpControls({ controls }: { controls: GameHelpControlRow[] }) {
  return (
    <div className="inline-grid min-w-[100px] max-w-full self-start grid-cols-[minmax(100px,max-content)] gap-2">
      {controls.map((control) => (
        <div
          className="flex w-full max-w-full items-center gap-3 rounded-md border border-[color-mix(in_oklch,currentColor_16%,transparent)] bg-[color-mix(in_oklch,currentColor_7%,transparent)] p-2 pr-3"
          key={control.label}
        >
          <div className="flex flex-wrap gap-1.5" aria-hidden="true">
            {control.buttons.map((button) => (
              <GameHelpControlButton button={button} key={button.label} />
            ))}
          </div>
          <p className="min-w-0 text-sm font-medium leading-5">{control.label}</p>
        </div>
      ))}
    </div>
  );
}

function GameHelpControlButton({ button }: { button: GameHelpControlButtonSpec }) {
  const Icon = button.icon;

  return (
    <span
      className="flex h-8 min-w-8 items-center justify-center rounded-md border border-[color-mix(in_oklch,currentColor_24%,transparent)] bg-[color-mix(in_oklch,currentColor_12%,transparent)] px-2 text-sm font-semibold leading-none shadow-[inset_0_-1px_0_color-mix(in_oklch,currentColor_18%,transparent)]"
      title={button.label}
    >
      {Icon ? <Icon className="size-4" /> : button.text}
    </span>
  );
}

function GameHelpItems({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2.5 text-[0.9375rem] leading-7 opacity-90 sm:text-base">
      {items.map((item) => (
        <li className="flex gap-2" key={item}>
          <span
            className="mt-[0.75rem] size-1.5 shrink-0 rounded-full bg-current opacity-60"
            aria-hidden="true"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
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
    </div>
  );
}
