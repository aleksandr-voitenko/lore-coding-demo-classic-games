"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  ZapIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { GameBoardColumn, GameHeader, GameShell, GameSidebar } from "@/components/game-layout";
import { isTypingTarget } from "@/components/game-input";
import {
  spaceInvaderClassNames,
  SpaceInvadersBoard,
  spaceInvadersBoardSizeLabel,
} from "@/components/space-invaders-board";
import { Button } from "@/components/ui/button";
import {
  advanceSpaceInvadersGame,
  createInitialSpaceInvadersGame,
  fireSpaceInvadersShot,
  getSpaceInvadersTickDelay,
  moveSpaceInvadersPlayerLeft,
  moveSpaceInvadersPlayerRight,
  pauseSpaceInvadersGame,
  restartSpaceInvadersGame,
  startSpaceInvadersGame,
  type SpaceInvadersGameState,
  type SpaceInvadersStatus,
} from "@/lib/space-invaders-game-engine";
import { cn } from "@/lib/utils";

type SpaceInvadersGameProps = {
  onBackToMenu?: () => void;
};

const statusLabels: Record<SpaceInvadersStatus, string> = {
  lost: "Game over",
  paused: "Paused",
  ready: "Ready",
  running: "Running",
  won: "Earth defended",
};

export function SpaceInvadersGame({ onBackToMenu }: SpaceInvadersGameProps = {}) {
  const [game, setGame] = useState<SpaceInvadersGameState>(() =>
    createInitialSpaceInvadersGame(),
  );
  const tickDelay = game.status === "running" ? getSpaceInvadersTickDelay() : null;
  const activeInvaderCount = game.invaders.filter((invader) => invader.isActive).length;
  const primaryAction =
    game.status === "running" ? "Pause" : game.status === "paused" ? "Resume" : "Start";
  const PrimaryIcon = game.status === "running" ? PauseIcon : PlayIcon;
  const showStartScreen = game.status === "ready";
  const showEndScreen = game.status === "lost" || game.status === "won";
  const showPauseScreen = game.status === "paused";
  const showSideActions = game.status === "running" || game.status === "paused";

  const startGame = useCallback(() => {
    setGame((current) => startSpaceInvadersGame(current));
  }, []);

  const toggleRunState = useCallback(() => {
    setGame((current) => {
      if (current.status === "running") {
        return pauseSpaceInvadersGame(current);
      }

      return startSpaceInvadersGame(current);
    });
  }, []);

  const restartGame = useCallback(() => {
    setGame(restartSpaceInvadersGame());
  }, []);

  const moveLeft = useCallback(() => {
    setGame((current) => moveSpaceInvadersPlayerLeft(current));
  }, []);

  const moveRight = useCallback(() => {
    setGame((current) => moveSpaceInvadersPlayerRight(current));
  }, []);

  const fireShot = useCallback(() => {
    setGame((current) => fireSpaceInvadersShot(current));
  }, []);

  const advanceSpaceInvaders = useCallback(() => {
    setGame((current) => advanceSpaceInvadersGame(current));
  }, []);

  useEffect(() => {
    if (tickDelay === null) {
      return;
    }

    const tick = window.setInterval(advanceSpaceInvaders, tickDelay);

    return () => window.clearInterval(tick);
  }, [advanceSpaceInvaders, tickDelay]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.key === "Enter" && game.status !== "running" && game.status !== "paused") {
        event.preventDefault();
        startGame();
        return;
      }

      if (event.key === "p" || event.key === "P") {
        event.preventDefault();
        toggleRunState();
        return;
      }

      if (game.status !== "running") {
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

      if (event.key === " ") {
        event.preventDefault();
        fireShot();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fireShot, game.status, moveLeft, moveRight, startGame, toggleRunState]);

  return (
    <GameShell className="bg-[var(--invaders-page)] text-[var(--invaders-ink)]">
      <GameSidebar className="border-[var(--invaders-border)] bg-[var(--invaders-panel)]">
        <GameHeader
          accentClassName="bg-[linear-gradient(90deg,var(--invaders-lime),var(--invaders-cyan),var(--invaders-magenta))]"
          backButtonTestId="space-invaders-back-to-menu"
          onBackToMenu={onBackToMenu}
          status={statusLabels[game.status]}
          statusClassName="text-[var(--invaders-muted)]"
          statusTestId="space-invaders-status"
          title="Classic Space Invaders"
        />

        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-[var(--invaders-border)] p-3">
            <dt className="text-xs font-medium text-[var(--invaders-muted)]">
              Score
            </dt>
            <dd
              className="font-mono text-3xl font-semibold leading-none"
              data-testid="space-invaders-score"
            >
              {game.score}
            </dd>
          </div>
          <div className="rounded-md border border-[var(--invaders-border)] p-3">
            <dt className="text-xs font-medium text-[var(--invaders-muted)]">
              Lives
            </dt>
            <dd
              className="font-mono text-3xl font-semibold leading-none"
              data-testid="space-invaders-lives"
            >
              {game.lives}
            </dd>
          </div>
        </dl>

        <div className="rounded-md border border-[var(--invaders-border)] p-3">
          <p className="text-xs font-medium text-[var(--invaders-muted)]">Invaders</p>
          <p
            className="font-mono text-3xl font-semibold leading-none"
            data-testid="space-invaders-remaining"
          >
            {activeInvaderCount}
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

          <div className="grid w-full grid-cols-3 gap-2">
            <Button
              aria-label="Move cannon left"
              onClick={moveLeft}
              size="icon-lg"
              type="button"
              variant="outline"
            >
              <ArrowLeftIcon />
            </Button>
            <Button
              aria-label="Fire"
              data-testid="space-invaders-fire-button"
              onClick={fireShot}
              size="icon-lg"
              type="button"
              variant="outline"
            >
              <ZapIcon />
            </Button>
            <Button
              aria-label="Move cannon right"
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
        <SpaceInvadersBoard game={game} statusLabel={statusLabels[game.status]}>
          {showStartScreen ? (
            <div
              className="absolute inset-2 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-[0.375rem] bg-[var(--invaders-board)] px-4 py-5 text-center text-[var(--invaders-board-text)]"
              data-testid="space-invaders-start-screen"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="grid grid-cols-6 gap-1" aria-hidden="true">
                  {Array.from({ length: 24 }, (_, index) => {
                    const row = Math.floor(index / 6) % spaceInvaderClassNames.length;

                    return (
                      <span
                        className={cn(
                          "h-3 w-5 rounded-[0.18rem]",
                          spaceInvaderClassNames[row],
                        )}
                        key={index}
                        style={{
                          clipPath:
                            "polygon(12% 34%, 24% 8%, 76% 8%, 88% 34%, 100% 34%, 100% 72%, 82% 72%, 82% 100%, 64% 100%, 64% 72%, 36% 72%, 36% 100%, 18% 100%, 18% 72%, 0 72%, 0 34%)",
                        }}
                      />
                    );
                  })}
                </div>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-3xl font-semibold tracking-normal text-balance">
                    Classic Space Invaders
                  </p>
                  <p className="text-sm font-medium text-[color-mix(in_oklch,var(--invaders-board-text)_74%,transparent)]">
                    {statusLabels[game.status]}
                  </p>
                </div>
              </div>
              <Button
                className="min-w-32"
                data-testid="space-invaders-start-button"
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
              className="absolute inset-2 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-[0.375rem] bg-[color-mix(in_oklch,var(--invaders-board)_78%,transparent)] px-4 py-5 text-center text-[var(--invaders-board-text)] backdrop-blur-[2px]"
              data-testid="space-invaders-end-screen"
            >
              <div className="flex flex-col items-center gap-1">
                <p className="text-3xl font-semibold tracking-normal text-balance">
                  {game.status === "won" ? "Earth defended" : "Game over"}
                </p>
                <p className="text-sm font-semibold text-[color-mix(in_oklch,var(--invaders-board-text)_76%,transparent)]">
                  Final score
                </p>
                <p className="font-mono text-5xl font-semibold leading-none">{game.score}</p>
              </div>
              <Button
                className="min-w-36"
                data-testid="space-invaders-new-game-button"
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
              className="absolute inset-2 flex items-center justify-center rounded-[0.375rem] bg-[color-mix(in_oklch,var(--invaders-board)_72%,transparent)] text-center text-[var(--invaders-board-text)] backdrop-blur-[2px]"
              data-testid="space-invaders-board-state"
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
        </SpaceInvadersBoard>

        <div className="flex items-center justify-between rounded-md border border-[var(--invaders-border)] bg-[var(--invaders-panel)] px-3 py-2 text-xs font-medium text-[var(--invaders-muted)]">
          <span>Board {spaceInvadersBoardSizeLabel}</span>
          <span>Speed {tickDelay === null ? "0" : Math.round(1000 / tickDelay)}</span>
        </div>
      </GameBoardColumn>
    </GameShell>
  );
}
