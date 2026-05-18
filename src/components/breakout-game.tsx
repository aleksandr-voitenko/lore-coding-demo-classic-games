"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { BreakoutBoard, breakoutBrickClassNames } from "@/components/breakout-board";
import { isTypingTarget } from "@/components/game-input";
import { GameBoardColumn, GameHeader, GameShell, GameSidebar } from "@/components/game-layout";
import { Button } from "@/components/ui/button";
import {
  advanceBreakoutGame,
  BREAKOUT_BOARD_HEIGHT,
  BREAKOUT_BOARD_WIDTH,
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
  onBackToMenu?: () => void;
};

const statusLabels: Record<BreakoutStatus, string> = {
  lost: "Game over",
  paused: "Paused",
  ready: "Ready",
  running: "Running",
  won: "You won",
};

export function BreakoutGame({ onBackToMenu }: BreakoutGameProps = {}) {
  const [game, setGame] = useState<BreakoutGameState>(() => createInitialBreakoutGame());
  const tickDelay = game.status === "running" ? getBreakoutTickDelay() : null;
  const activeBrickCount = game.bricks.filter((brick) => brick.isActive).length;
  const primaryAction =
    game.status === "running" ? "Pause" : game.status === "paused" ? "Resume" : "Start";
  const PrimaryIcon = game.status === "running" ? PauseIcon : PlayIcon;
  const showStartScreen = game.status === "ready";
  const showEndScreen = game.status === "lost" || game.status === "won";
  const showPauseScreen = game.status === "paused";
  const showSideActions = game.status === "running" || game.status === "paused";

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
    setGame(restartBreakoutGame());
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

  useEffect(() => {
    if (tickDelay === null) {
      return;
    }

    const tick = window.setInterval(advanceBreakout, tickDelay);

    return () => window.clearInterval(tick);
  }, [advanceBreakout, tickDelay]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) {
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
  }, [game.status, moveLeft, moveRight, startGame, toggleRunState]);

  return (
    <GameShell className="bg-[var(--breakout-page)] text-[var(--breakout-ink)]">
      <GameSidebar className="border-[var(--breakout-border)] bg-[var(--breakout-panel)]">
        <GameHeader
          accentClassName="bg-[linear-gradient(90deg,var(--breakout-red),var(--breakout-yellow),var(--breakout-blue))]"
          backButtonTestId="breakout-back-to-menu"
          onBackToMenu={onBackToMenu}
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

        <div className="rounded-md border border-[var(--breakout-border)] p-3">
          <p className="text-xs font-medium text-[var(--breakout-muted)]">Bricks</p>
          <p
            className="font-mono text-3xl font-semibold leading-none"
            data-testid="breakout-bricks-remaining"
          >
            {activeBrickCount}
          </p>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-3">
          {showSideActions ? (
            <div className="grid w-full grid-cols-[minmax(0,1fr)_2rem] gap-2">
              <Button onClick={toggleRunState} type="button">
                <PrimaryIcon data-icon="inline-start" />
                {primaryAction}
              </Button>
              <Button
                aria-label="Restart"
                onClick={restartGame}
                size="icon"
                type="button"
                variant="outline"
              >
                <RotateCcwIcon />
              </Button>
            </div>
          ) : null}

          <div className="grid w-full grid-cols-2 gap-2">
            <Button
              aria-label="Move paddle left"
              onClick={moveLeft}
              size="icon-lg"
              type="button"
              variant="outline"
            >
              <ArrowLeftIcon />
            </Button>
            <Button
              aria-label="Move paddle right"
              onClick={moveRight}
              size="icon-lg"
              type="button"
              variant="outline"
            >
              <ArrowRightIcon />
            </Button>
          </div>
        </div>
      </GameSidebar>

      <GameBoardColumn className="max-w-[min(92vw,34rem)]">
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
        </BreakoutBoard>

        <div className="flex items-center justify-between rounded-md border border-[var(--breakout-border)] bg-[var(--breakout-panel)] px-3 py-2 text-xs font-medium text-[var(--breakout-muted)]">
          <span>
            Board {BREAKOUT_BOARD_WIDTH} x {BREAKOUT_BOARD_HEIGHT}
          </span>
          <span>Speed {tickDelay === null ? "0" : Math.round(1000 / tickDelay)}</span>
        </div>
      </GameBoardColumn>
    </GameShell>
  );
}
