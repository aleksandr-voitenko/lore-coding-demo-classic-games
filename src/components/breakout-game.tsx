"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PlayIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { BreakoutBoard, breakoutBrickClassNames } from "@/components/breakout-board";
import { isTypingTarget } from "@/components/game-input";
import {
  GameAbandonDialog,
  GameBoardActions,
  GameBoardColumn,
  GameBoardStage,
  GameHeader,
  GameHelpScreen,
  GameShell,
  GameSidebar,
  useGameEscapeToMenu,
  useGameHelpScreen,
  type GameHelpSection,
} from "@/components/game-layout";
import { Button } from "@/components/ui/button";
import {
  advanceBreakoutGame,
  createInitialBreakoutGame,
  getBreakoutTickDelay,
  moveBreakoutPaddleLeft,
  moveBreakoutPaddleRight,
  pauseBreakoutGame,
  restartBreakoutGame,
  startBreakoutGame,
  type BreakoutGameState,
  type BreakoutStatus,
} from "@/lib/breakout-game-engine";
import { cn } from "@/lib/utils";

type BreakoutGameProps = {
  initialBoardHeight?: number;
  initialBoardWidth?: number;
  initialLives?: number;
  onBackToMenu?: () => void;
};

const statusLabels: Record<BreakoutStatus, string> = {
  lost: "Game over",
  paused: "Paused",
  ready: "Ready",
  running: "Running",
  won: "You won",
};

const BREAKOUT_HELP_SECTIONS: GameHelpSection[] = [
  {
    title: "Controls",
    controls: [
      {
        buttons: [{ text: "Enter", label: "Enter key" }],
        label: "Start game",
      },
      {
        buttons: [{ icon: ArrowLeftIcon, label: "Left" }, { text: "A", label: "A key" }],
        label: "Move paddle left",
      },
      {
        buttons: [{ icon: ArrowRightIcon, label: "Right" }, { text: "D", label: "D key" }],
        label: "Move paddle right",
      },
      {
        buttons: [
          { text: "Space", label: "Space key" },
          { text: "P", label: "P key" },
        ],
        label: "Pause or resume",
      },
    ],
  },
  {
    title: "Rules",
    items: [
      "Keep the ball in play with the paddle.",
      "Break every active brick to clear the wall.",
      "Missing the ball costs a life, and the game ends when no lives remain.",
    ],
  },
];

export function BreakoutGame({
  initialBoardHeight,
  initialBoardWidth,
  initialLives,
  onBackToMenu,
}: BreakoutGameProps = {}) {
  const [game, setGame] = useState<BreakoutGameState>(() =>
    createInitialBreakoutGame({
      boardHeight: initialBoardHeight,
      boardWidth: initialBoardWidth,
      lives: initialLives,
    }),
  );
  const tickDelay = game.status === "running" ? getBreakoutTickDelay() : null;
  const activeBrickCount = game.bricks.filter((brick) => brick.isActive).length;
  const canPauseGame = game.status === "running" || game.status === "paused";
  const pauseActionLabel = game.status === "paused" ? "Resume" : "Pause";
  const showStartScreen = game.status === "ready";
  const showEndScreen = game.status === "lost" || game.status === "won";
  const showPauseScreen = game.status === "paused";

  const startGame = useCallback(() => {
    setGame((current) => startBreakoutGame(current));
  }, []);

  const toggleRunState = useCallback(() => {
    setGame((current) => {
      if (current.status === "running") {
        return pauseBreakoutGame(current);
      }

      return startBreakoutGame(current);
    });
  }, []);

  const restartGame = useCallback(() => {
    setGame((current) => restartBreakoutGame(current));
  }, []);

  const moveLeft = useCallback(() => {
    setGame((current) => moveBreakoutPaddleLeft(current));
  }, []);

  const moveRight = useCallback(() => {
    setGame((current) => moveBreakoutPaddleRight(current));
  }, []);

  const advanceBreakout = useCallback(() => {
    setGame((current) => advanceBreakoutGame(current));
  }, []);

  const pauseGameForHelp = useCallback(() => {
    setGame((current) => pauseBreakoutGame(current));
  }, []);

  const resumeGameAfterHelp = useCallback(() => {
    setGame((current) => startBreakoutGame(current));
  }, []);

  const { closeHelp, isHelpVisible, openHelp } = useGameHelpScreen({
    isGameActive: game.status === "running",
    onPauseGame: pauseGameForHelp,
    onResumeGame: resumeGameAfterHelp,
  });
  const { abandonDialogProps, requestBackToMenu } = useGameEscapeToMenu({
    isDisabled: isHelpVisible,
    isGameStarted: canPauseGame,
    onBackToMenu,
    onPauseGame: pauseGameForHelp,
    onResumeGame: resumeGameAfterHelp,
    shouldPauseBeforeConfirm: canPauseGame,
  });

  useEffect(() => {
    if (tickDelay === null) {
      return;
    }

    const tick = window.setInterval(advanceBreakout, tickDelay);

    return () => window.clearInterval(tick);
  }, [advanceBreakout, tickDelay]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isHelpVisible || isTypingTarget(event.target)) {
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
        event.preventDefault();
        moveLeft();
        return;
      }

      if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
        event.preventDefault();
        moveRight();
        return;
      }

      if (event.key === "Enter" && game.status !== "running" && game.status !== "paused") {
        event.preventDefault();
        startGame();
        return;
      }

      if (event.key === " " || event.key === "p" || event.key === "P") {
        event.preventDefault();
        toggleRunState();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [game.status, isHelpVisible, moveLeft, moveRight, startGame, toggleRunState]);

  return (
    <GameShell className="bg-[var(--breakout-page)] text-[var(--breakout-ink)]">
      <GameSidebar className="border-[var(--breakout-border)] bg-[var(--breakout-panel)]">
        <GameHeader
          accentClassName="bg-[linear-gradient(90deg,var(--breakout-red),var(--breakout-yellow),var(--breakout-blue))]"
          status={statusLabels[game.status]}
          statusClassName="text-[var(--breakout-muted)]"
          statusTestId="breakout-status"
          title="Classic Breakout"
        />

        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-[var(--breakout-border)] p-3">
            <dt className="text-xs font-medium text-[var(--breakout-muted)]">Score</dt>
            <dd
              className="font-mono text-3xl font-semibold leading-none"
              data-testid="breakout-score"
            >
              {game.score}
            </dd>
          </div>
          <div className="rounded-md border border-[var(--breakout-border)] p-3">
            <dt className="text-xs font-medium text-[var(--breakout-muted)]">Lives</dt>
            <dd
              className="font-mono text-3xl font-semibold leading-none"
              data-testid="breakout-lives"
            >
              {game.lives}
            </dd>
          </div>
        </dl>

        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-[var(--breakout-border)] p-3">
            <dt className="text-xs font-medium text-[var(--breakout-muted)]">Bricks</dt>
            <dd
              className="font-mono text-3xl font-semibold leading-none"
              data-testid="breakout-bricks-remaining"
            >
              {activeBrickCount}
            </dd>
          </div>
          <div className="rounded-md border border-[var(--breakout-border)] p-3">
            <dt className="text-xs font-medium text-[var(--breakout-muted)]">Speed</dt>
            <dd
              className="font-mono text-3xl font-semibold leading-none"
              data-testid="breakout-speed"
            >
              {tickDelay === null ? "0" : Math.round(1000 / tickDelay)}
            </dd>
          </div>
        </dl>

      </GameSidebar>

      <GameBoardColumn className="max-w-[min(92vw,37.25rem)]">
        <GameBoardStage
          actions={
            <GameBoardActions
              backDisabled={isHelpVisible}
              helpDisabled={isHelpVisible}
              onBackToMenu={requestBackToMenu}
              onHelp={openHelp}
              onRestart={restartGame}
              pauseAction={{
                disabled: isHelpVisible || !canPauseGame,
                isResume: game.status === "paused",
                label: pauseActionLabel,
                onClick: toggleRunState,
              }}
              restartDisabled={game.status === "ready"}
              testIdPrefix="breakout"
            />
          }
        >
          <BreakoutBoard game={game} statusLabel={statusLabels[game.status]}>
          {showStartScreen ? (
            <div
              className="absolute inset-2 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-[0.375rem] bg-[var(--breakout-board)] px-4 py-5 text-center text-[var(--breakout-board-text)]"
              data-testid="breakout-start-screen"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="grid grid-cols-10 gap-1" aria-hidden="true">
                  {Array.from({ length: 30 }, (_, index) => {
                    const row = Math.floor(index / 10);

                    return (
                      <span
                        className={cn(
                          "h-2.5 w-4 rounded-[0.16rem]",
                          breakoutBrickClassNames[row],
                        )}
                        key={index}
                      />
                    );
                  })}
                </div>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-3xl font-semibold tracking-normal text-balance">
                    Classic Breakout
                  </p>
                  <p className="text-sm font-medium text-[color-mix(in_oklch,var(--breakout-board-text)_74%,transparent)]">
                    {statusLabels[game.status]}
                  </p>
                </div>
              </div>
              <Button
                className="min-w-32"
                data-testid="breakout-start-button"
                onClick={startGame}
                size="lg"
                type="button"
                variant="secondary"
              >
                <PlayIcon data-icon="inline-start" />
                Start
              </Button>
            </div>
          ) : showEndScreen ? (
            <div
              className="absolute inset-2 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-[0.375rem] bg-[color-mix(in_oklch,var(--breakout-board)_78%,transparent)] px-4 py-5 text-center text-[var(--breakout-board-text)] backdrop-blur-[2px]"
              data-testid="breakout-end-screen"
            >
              <div className="flex flex-col items-center gap-1">
                <p className="text-3xl font-semibold tracking-normal text-balance">
                  {game.status === "won" ? "Wall cleared" : "Game over"}
                </p>
                <p className="text-sm font-semibold text-[color-mix(in_oklch,var(--breakout-board-text)_76%,transparent)]">
                  Final score
                </p>
                <p className="font-mono text-5xl font-semibold leading-none">{game.score}</p>
              </div>
              <Button
                className="min-w-36"
                data-testid="breakout-new-game-button"
                onClick={restartGame}
                size="lg"
                type="button"
                variant="secondary"
              >
                <RotateCcwIcon data-icon="inline-start" />
                New game
              </Button>
            </div>
          ) : showPauseScreen ? (
            <div
              className="absolute inset-2 flex items-center justify-center rounded-[0.375rem] bg-[color-mix(in_oklch,var(--breakout-board)_72%,transparent)] text-center text-[var(--breakout-board-text)] backdrop-blur-[2px]"
              data-testid="breakout-board-state"
            >
              <div className="flex flex-col items-center gap-3">
                <p className="text-2xl font-semibold tracking-normal">Paused</p>
                <Button
                  className="min-w-32"
                  onClick={toggleRunState}
                  size="lg"
                  type="button"
                  variant="secondary"
                >
                  <PlayIcon data-icon="inline-start" />
                  Resume
                </Button>
              </div>
            </div>
          ) : null}
          {isHelpVisible ? (
            <GameHelpScreen
              className="border-[color-mix(in_oklch,var(--breakout-board-text)_24%,transparent)] bg-[color-mix(in_oklch,var(--breakout-board)_94%,black)] text-[var(--breakout-board-text)]"
              onClose={closeHelp}
              sections={BREAKOUT_HELP_SECTIONS}
              testId="breakout-help-screen"
              title="Classic Breakout"
            />
          ) : null}
          </BreakoutBoard>
        </GameBoardStage>
      </GameBoardColumn>
      {abandonDialogProps ? <GameAbandonDialog {...abandonDialogProps} /> : null}
    </GameShell>
  );
}
