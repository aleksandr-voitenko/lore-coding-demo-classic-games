"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PlayIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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
import { isTypingTarget } from "@/components/game-input";
import {
  spaceInvaderClassNames,
  SpaceInvadersBoard,
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
  initialAlienCount?: number;
  initialBoardHeight?: number;
  initialBoardWidth?: number;
  onBackToMenu?: () => void;
};

const statusLabels: Record<SpaceInvadersStatus, string> = {
  lost: "Game over",
  paused: "Paused",
  ready: "Ready",
  running: "Running",
  won: "Earth defended",
};

const SPACE_INVADERS_HELP_SECTIONS: GameHelpSection[] = [
  {
    title: "Controls",
    controls: [
      {
        buttons: [{ text: "Enter", label: "Enter key" }],
        label: "Start game",
      },
      {
        buttons: [{ icon: ArrowLeftIcon, label: "Left" }, { text: "A", label: "A key" }],
        label: "Move cannon left",
      },
      {
        buttons: [{ icon: ArrowRightIcon, label: "Right" }, { text: "D", label: "D key" }],
        label: "Move cannon right",
      },
      {
        buttons: [{ text: "Space", label: "Space key" }],
        label: "Fire",
      },
      {
        buttons: [{ text: "P", label: "P key" }],
        label: "Pause or resume",
      },
    ],
  },
  {
    title: "Rules",
    items: [
      "Shoot every invader before the formation reaches your base.",
      "Only one player shot can be active at a time.",
      "Defend Earth to win; the game ends if the invaders reach the base.",
    ],
  },
];

export function SpaceInvadersGame({
  initialAlienCount,
  initialBoardHeight,
  initialBoardWidth,
  onBackToMenu,
}: SpaceInvadersGameProps = {}) {
  const [game, setGame] = useState<SpaceInvadersGameState>(() =>
    createInitialSpaceInvadersGame({
      alienCount: initialAlienCount,
      boardHeight: initialBoardHeight,
      boardWidth: initialBoardWidth,
    }),
  );
  const tickDelay = game.status === "running" ? getSpaceInvadersTickDelay() : null;
  const activeInvaderCount = game.invaders.filter((invader) => invader.isActive).length;
  const canPauseGame = game.status === "running" || game.status === "paused";
  const pauseActionLabel = game.status === "paused" ? "Resume" : "Pause";
  const showStartScreen = game.status === "ready";
  const showEndScreen = game.status === "lost" || game.status === "won";
  const showPauseScreen = game.status === "paused";

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
    setGame((current) => restartSpaceInvadersGame(current));
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

  const pauseGameForHelp = useCallback(() => {
    setGame((current) => pauseSpaceInvadersGame(current));
  }, []);

  const resumeGameAfterHelp = useCallback(() => {
    setGame((current) => startSpaceInvadersGame(current));
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

    const tick = window.setInterval(advanceSpaceInvaders, tickDelay);

    return () => window.clearInterval(tick);
  }, [advanceSpaceInvaders, tickDelay]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isHelpVisible || isTypingTarget(event.target)) {
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
  }, [fireShot, game.status, isHelpVisible, moveLeft, moveRight, startGame, toggleRunState]);

  return (
    <GameShell className="bg-[var(--invaders-page)] text-[var(--invaders-ink)]">
      <GameSidebar className="border-[var(--invaders-border)] bg-[var(--invaders-panel)]">
        <GameHeader
          accentClassName="bg-[linear-gradient(90deg,var(--invaders-lime),var(--invaders-cyan),var(--invaders-magenta))]"
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

        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-[var(--invaders-border)] p-3">
            <dt className="text-xs font-medium text-[var(--invaders-muted)]">Invaders</dt>
            <dd
              className="font-mono text-3xl font-semibold leading-none"
              data-testid="space-invaders-remaining"
            >
              {activeInvaderCount}
            </dd>
          </div>
          <div className="rounded-md border border-[var(--invaders-border)] p-3">
            <dt className="text-xs font-medium text-[var(--invaders-muted)]">Speed</dt>
            <dd
              className="font-mono text-3xl font-semibold leading-none"
              data-testid="space-invaders-speed"
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
              testIdPrefix="space-invaders"
            />
          }
        >
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
          {isHelpVisible ? (
            <GameHelpScreen
              className="border-[color-mix(in_oklch,var(--invaders-board-text)_24%,transparent)] bg-[color-mix(in_oklch,var(--invaders-board)_94%,black)] text-[var(--invaders-board-text)]"
              onClose={closeHelp}
              sections={SPACE_INVADERS_HELP_SECTIONS}
              testId="space-invaders-help-screen"
              title="Classic Space Invaders"
            />
          ) : null}
          </SpaceInvadersBoard>
        </GameBoardStage>
      </GameBoardColumn>
      {abandonDialogProps ? <GameAbandonDialog {...abandonDialogProps} /> : null}
    </GameShell>
  );
}
