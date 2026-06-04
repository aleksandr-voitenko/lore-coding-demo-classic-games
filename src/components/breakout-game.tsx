"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PlayIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { BreakoutBoard, breakoutBrickClassNames } from "@/components/breakout-board";
import {
  createBreakoutPaddleMovementState,
  getBreakoutPaddleMovementKey,
  type BreakoutPaddleMovementDirection,
} from "@/components/breakout-paddle-input";
import {
  isGamePauseKey,
  registerGameKeyDown,
  registerGameKeyUp,
  shouldIgnoreGameKeyDown,
  useHeldDirectionMovementController,
} from "@/components/game-input";
import {
  GameAbandonDialog,
  GameBoardActions,
  GameBoardColumn,
  GameBoardStage,
  GameEndLeaderboardContent,
  GameEndScreen,
  GameHeader,
  GameHelpScreen,
  GameShell,
  GameSidebar,
  GameStatsBar,
  GameStatCard,
  useGameEscapeToMenu,
  useGameHelpScreen,
  type GameHelpSection,
} from "@/components/game-layout";
import { GameLeaderboardPanel } from "@/components/game-leaderboard";
import { useGameLeaderboardPresenter } from "@/components/game-leaderboard-presenter";
import { Button } from "@/components/ui/button";
import {
  advanceBreakoutGame,
  createInitialBreakoutGame,
  getBreakoutBallSpeed,
  getBreakoutTickDelay,
  moveBreakoutPaddleLeft,
  moveBreakoutPaddleRight,
  pauseBreakoutGame,
  restartBreakoutGame,
  startBreakoutGame,
  type BreakoutGameState,
  type BreakoutStatus,
} from "@/lib/breakout-game-engine";
import { createGameLeaderboardKey } from "@/lib/leaderboard";
import { cn } from "@/lib/utils";
import { useGameSession } from "@/hooks/use-game-session";

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
        label: "Hold to move paddle left",
      },
      {
        buttons: [{ icon: ArrowRightIcon, label: "Right" }, { text: "D", label: "D key" }],
        label: "Hold to move paddle right",
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
      "Keep the ball in play with the paddle.",
      "Break every active brick to clear the wall.",
      "Missing the ball costs a life, and the game ends when no lives remain.",
    ],
  },
];

const BREAKOUT_PADDLE_MOVE_INTERVAL_MS = getBreakoutTickDelay();

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
  const ballSpeed = game.status === "running" ? getBreakoutBallSpeed(game.ball.velocity) : null;
  const activeBrickCount = game.bricks.filter((brick) => brick.isActive).length;
  const canPauseGame = game.status === "running" || game.status === "paused";
  const pauseActionLabel = game.status === "paused" ? "Resume" : "Pause";
  const showLifeLostScreen = game.status === "ready" && game.lives < game.startingLives;
  const showStartScreen = game.status === "ready" && !showLifeLostScreen;
  const showEndScreen = game.status === "lost" || game.status === "won";
  const showPauseScreen = game.status === "paused";
  const remainingLifeLabel = game.lives === 1 ? "1 life left" : `${game.lives} lives left`;
  const leaderboardKey = createGameLeaderboardKey("breakout", [
    { name: "board", value: `${game.boardWidth}x${game.boardHeight}` },
    { name: "lives", value: game.startingLives },
  ]);
  const isBreakoutStarted =
    game.status !== "ready" || game.lives < game.startingLives || game.score > 0;
  const { completedSessionId } = useGameSession({
    active: game.status === "running",
    finalResult:
      game.status === "lost" || game.status === "won" ? game.status : null,
    finalScore: game.score,
    gameId: "breakout",
    leaderboardKey,
    started: isBreakoutStarted,
  });
  const {
    finalLeaderboardProps,
    leaderboardPanelProps,
    pendingLeaderboardEntry,
    resetLeaderboardForm,
    scoreFormProps,
  } = useGameLeaderboardPresenter({
    gameSessionId: completedSessionId,
    leaderboardKey,
    pendingScore: showEndScreen ? game.score : null,
    testIdPrefix: "breakout",
  });

  const startGame = useCallback(() => {
    resetLeaderboardForm();
    setGame((current) => startBreakoutGame(current));
  }, [resetLeaderboardForm]);

  const toggleRunState = useCallback(() => {
    resetLeaderboardForm();
    setGame((current) => {
      if (current.status === "running") {
        return pauseBreakoutGame(current);
      }

      return startBreakoutGame(current);
    });
  }, [resetLeaderboardForm]);

  const restartGame = useCallback(() => {
    resetLeaderboardForm();
    setGame((current) => restartBreakoutGame(current));
  }, [resetLeaderboardForm]);

  const movePaddle = useCallback((direction: BreakoutPaddleMovementDirection) => {
    setGame((current) =>
      direction === "left" ? moveBreakoutPaddleLeft(current) : moveBreakoutPaddleRight(current),
    );
  }, []);

  const advanceBreakout = useCallback(() => {
    setGame((current) => advanceBreakoutGame(current, { random: Math.random }));
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

  const {
    beginMovement: beginPaddleMovement,
    endMovement: endPaddleMovement,
  } = useHeldDirectionMovementController({
    createState: createBreakoutPaddleMovementState,
    intervalMs: BREAKOUT_PADDLE_MOVE_INTERVAL_MS,
    isMovementDisabled:
      isHelpVisible ||
      pendingLeaderboardEntry !== null ||
      game.status === "lost" ||
      game.status === "won",
    move: movePaddle,
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
      if (
        shouldIgnoreGameKeyDown(event, {
          hasPendingLeaderboardEntry: pendingLeaderboardEntry !== null,
          isHelpVisible,
        })
      ) {
        return;
      }

      const movementKey = getBreakoutPaddleMovementKey(event.key);

      if (movementKey !== null) {
        event.preventDefault();

        if (game.status !== "lost" && game.status !== "won") {
          beginPaddleMovement(movementKey);
        }

        return;
      }

      if (event.key === "Enter" && game.status !== "running" && game.status !== "paused") {
        event.preventDefault();
        startGame();
        return;
      }

      if (isGamePauseKey(event.key)) {
        event.preventDefault();
        toggleRunState();
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      const movementKey = getBreakoutPaddleMovementKey(event.key);

      if (movementKey === null) {
        return;
      }

      if (endPaddleMovement(movementKey)) {
        event.preventDefault();
      }
    }

    const unregisterKeyDown = registerGameKeyDown(handleKeyDown);
    const unregisterKeyUp = registerGameKeyUp(handleKeyUp);

    return () => {
      unregisterKeyDown();
      unregisterKeyUp();
    };
  }, [
    beginPaddleMovement,
    endPaddleMovement,
    game.status,
    isHelpVisible,
    pendingLeaderboardEntry,
    startGame,
    toggleRunState,
  ]);

  return (
    <GameShell className="bg-[var(--breakout-page)] text-[var(--breakout-ink)]">
      <GameBoardColumn className="w-[min(92vw,37.25rem,calc(75svh_-_9rem))]">
        <GameSidebar className="border-[var(--breakout-border)] bg-[var(--breakout-panel)]">
          <GameHeader
            status={statusLabels[game.status]}
            statusTestId="breakout-status"
            title="Breakout"
          />

          <GameStatsBar>
            <GameStatCard
              className="border-[var(--breakout-border)]"
              label="Score"
              labelClassName="text-[var(--breakout-muted)]"
              value={game.score}
              valueTestId="breakout-score"
            />
            <GameStatCard
              className="border-[var(--breakout-border)]"
              label="Lives"
              labelClassName="text-[var(--breakout-muted)]"
              value={game.lives}
              valueTestId="breakout-lives"
            />
            <GameStatCard
              className="border-[var(--breakout-border)]"
              label="Bricks"
              labelClassName="text-[var(--breakout-muted)]"
              value={activeBrickCount}
              valueTestId="breakout-bricks-remaining"
            />
            <GameStatCard
              className="border-[var(--breakout-border)]"
              label="Speed"
              labelClassName="text-[var(--breakout-muted)]"
              value={ballSpeed === null ? "0" : ballSpeed.toFixed(2)}
              valueTestId="breakout-speed"
            />
          </GameStatsBar>
        </GameSidebar>

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
              restartDisabled={game.status === "ready" || pendingLeaderboardEntry !== null}
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
                    Breakout
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
              <GameLeaderboardPanel {...leaderboardPanelProps} />
            </div>
          ) : showLifeLostScreen ? (
            <div
              className="absolute inset-2 flex items-center justify-center rounded-[0.375rem] bg-transparent px-4 py-5 text-center text-[var(--breakout-board-text)]"
              data-testid="breakout-life-lost-screen"
            >
              <div className="flex w-full max-w-[18rem] flex-col items-center gap-3 rounded-md border border-[color-mix(in_oklch,var(--breakout-board-text)_24%,transparent)] bg-[color-mix(in_oklch,var(--breakout-board)_54%,transparent)] p-4 shadow-[0_18px_42px_rgba(0,0,0,0.28)] backdrop-blur-[1px]">
                <div className="flex flex-col items-center gap-1">
                  <p className="text-2xl font-semibold tracking-normal">Life lost</p>
                  <p
                    className="text-sm font-semibold text-[color-mix(in_oklch,var(--breakout-board-text)_80%,transparent)]"
                    data-testid="breakout-lives-remaining"
                  >
                    {remainingLifeLabel}
                  </p>
                </div>
                <Button
                  className="min-w-36"
                  data-testid="breakout-continue-button"
                  onClick={startGame}
                  size="lg"
                  type="button"
                  variant="secondary"
                >
                  <PlayIcon data-icon="inline-start" />
                  Serve next ball
                </Button>
              </div>
            </div>
          ) : showEndScreen ? (
            <GameEndScreen testId="breakout-end-screen">
              <GameEndLeaderboardContent
                action={
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
                }
                leaderboard={finalLeaderboardProps}
                pendingLeaderboardEntry={pendingLeaderboardEntry}
                scoreForm={scoreFormProps}
                summary={{
                  metricLabel: "Final score",
                  metricValue: game.score,
                  metricValueTestId: "breakout-final-score",
                  title: game.status === "won" ? "Wall cleared" : "Game over",
                }}
              />
            </GameEndScreen>
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
              onClose={closeHelp}
              sections={BREAKOUT_HELP_SECTIONS}
              testId="breakout-help-screen"
              title="Breakout"
            />
          ) : null}
          </BreakoutBoard>
        </GameBoardStage>
      </GameBoardColumn>
      {abandonDialogProps ? <GameAbandonDialog {...abandonDialogProps} /> : null}
    </GameShell>
  );
}
