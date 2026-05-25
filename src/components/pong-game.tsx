"use client";

import { ArrowDownIcon, ArrowUpIcon, PlayIcon, RotateCcwIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  registerGameKeyDown,
  registerGameKeyUp,
  shouldIgnoreGameKeyDown,
} from "@/components/game-input";
import {
  GameAbandonDialog,
  GameBoardActions,
  GameBoardColumn,
  GameBoardStage,
  GameEndScreen,
  GameEndSummary,
  GameHeader,
  GameHelpScreen,
  GameShell,
  GameSidebar,
  GameStatCard,
  useGameEscapeToMenu,
  useGameHelpScreen,
  type GameHelpSection,
} from "@/components/game-layout";
import { GameLeaderboardPanel, GameLeaderboardScoreForm } from "@/components/game-leaderboard";
import {
  createPongPaddleMovementState,
  getPongPaddleMovementKey,
  pressPongPaddleMovementKey,
  releasePongPaddleMovementKey,
  resetPongPaddleMovementState,
  type PongPaddleMovementDirection,
  type PongPaddleMovementKey,
} from "@/components/pong-paddle-input";
import { PongBoard } from "@/components/pong-board";
import { Button } from "@/components/ui/button";
import {
  advancePongGame,
  createInitialPongGame,
  decrementPongRemainingScore,
  getPongMaximumScore,
  getPongScoreTickDelay,
  getPongTickDelay,
  isPongBetweenRounds,
  isPongMatchInProgress,
  isPongScoreCountingDown,
  movePongPlayerDown,
  movePongPlayerUp,
  pausePongGame,
  restartPongGame,
  startPongGame,
  type PongGameState,
  type PongStatus,
} from "@/lib/pong-game-engine";
import { createGameLeaderboardKey } from "@/lib/leaderboard";
import { useGameLeaderboard } from "@/hooks/use-game-leaderboard";

type PongGameProps = {
  initialBoardHeight?: number;
  initialBoardWidth?: number;
  initialTargetScore?: number;
  onBackToMenu?: () => void;
};

const statusLabels: Record<PongStatus, string> = {
  lost: "Computer wins",
  paused: "Paused",
  ready: "Ready",
  running: "Running",
  won: "You won",
};

const PONG_PADDLE_MOVE_INTERVAL_MS = getPongTickDelay();

function createPongHelpSections(
  maximumScore: number,
  targetScore: number,
): GameHelpSection[] {
  return [
    {
      title: "Controls",
      controls: [
        {
          buttons: [{ text: "Enter", label: "Enter key" }],
          label: "Start or serve",
        },
        {
          buttons: [{ icon: ArrowUpIcon, label: "Up" }, { text: "W", label: "W key" }],
          label: "Hold to move paddle up",
        },
        {
          buttons: [{ icon: ArrowDownIcon, label: "Down" }, { text: "S", label: "S key" }],
          label: "Hold to move paddle down",
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
        "Keep the ball past the computer paddle to score.",
        "Block the ball before it passes your paddle.",
        `First side to ${targetScore} points wins the match.`,
        `You start with ${maximumScore} points; each active second costs 5 and each computer rally costs 100.`,
      ],
    },
  ];
}

export function PongGame({
  initialBoardHeight,
  initialBoardWidth,
  initialTargetScore,
  onBackToMenu,
}: PongGameProps = {}) {
  const [game, setGame] = useState<PongGameState>(() =>
    createInitialPongGame({
      boardHeight: initialBoardHeight,
      boardWidth: initialBoardWidth,
      targetScore: initialTargetScore,
    }),
  );
  const paddleMovementStateRef = useRef(createPongPaddleMovementState());
  const paddleMovementIntervalRef = useRef<number | null>(null);
  const maximumScore = getPongMaximumScore(game.targetScore);
  const helpSections = useMemo(
    () => createPongHelpSections(maximumScore, game.targetScore),
    [game.targetScore, maximumScore],
  );
  const tickDelay = game.status === "running" ? getPongTickDelay() : null;
  const scoreTickDelay = isPongScoreCountingDown(game) ? getPongScoreTickDelay() : null;
  const canPauseGame = game.status === "running" || game.status === "paused";
  const isBetweenRounds = isPongBetweenRounds(game);
  const isUnfinishedMatch = isPongMatchInProgress(game);
  const statusLabel = isBetweenRounds ? "Next rally" : statusLabels[game.status];
  const pauseActionLabel = game.status === "paused" ? "Resume" : "Pause";
  const showStartScreen = game.status === "ready" && !isBetweenRounds;
  const showRoundReadyScreen = isBetweenRounds;
  const showEndScreen = game.status === "lost" || game.status === "won";
  const showPauseScreen = game.status === "paused";
  const leaderboardKey = createGameLeaderboardKey("pong", [
    { name: "board", value: `${game.boardWidth}x${game.boardHeight}` },
    { name: "target", value: game.targetScore },
  ]);
  const {
    isSavingLeaderboardScore,
    leaderboardSlots,
    leaderboardStatusMessage,
    pendingLeaderboardEntry,
    playerName,
    resetLeaderboardForm,
    saveLeaderboardScore: savePendingLeaderboardScore,
    scoreSaveFailed,
    setPlayerName,
  } = useGameLeaderboard({
    leaderboardKey,
    pendingScore: showEndScreen ? game.remainingScore : null,
  });

  const movePaddle = useCallback((direction: PongPaddleMovementDirection) => {
    setGame((current) =>
      direction === "up" ? movePongPlayerUp(current) : movePongPlayerDown(current),
    );
  }, []);

  const stopPaddleMovementLoop = useCallback(() => {
    if (paddleMovementIntervalRef.current === null) {
      return;
    }

    window.clearInterval(paddleMovementIntervalRef.current);
    paddleMovementIntervalRef.current = null;
  }, []);

  const startPaddleMovementLoop = useCallback(
    (direction: PongPaddleMovementDirection) => {
      paddleMovementStateRef.current.direction = direction;

      if (paddleMovementIntervalRef.current !== null) {
        return;
      }

      paddleMovementIntervalRef.current = window.setInterval(() => {
        const currentDirection = paddleMovementStateRef.current.direction;

        if (currentDirection !== null) {
          movePaddle(currentDirection);
        }
      }, PONG_PADDLE_MOVE_INTERVAL_MS);
    },
    [movePaddle],
  );

  const beginPaddleMovement = useCallback(
    (movementKey: PongPaddleMovementKey) => {
      const movement = pressPongPaddleMovementKey(
        paddleMovementStateRef.current,
        movementKey,
      );

      startPaddleMovementLoop(movement.direction);

      if (movement.shouldMoveImmediately) {
        movePaddle(movement.direction);
      }
    },
    [movePaddle, startPaddleMovementLoop],
  );

  const endPaddleMovement = useCallback(
    (movementKey: PongPaddleMovementKey) => {
      const movement = releasePongPaddleMovementKey(
        paddleMovementStateRef.current,
        movementKey,
      );

      if (!movement.handled) {
        return false;
      }

      if (movement.direction === null) {
        stopPaddleMovementLoop();
      } else {
        startPaddleMovementLoop(movement.direction);
      }

      return true;
    },
    [startPaddleMovementLoop, stopPaddleMovementLoop],
  );

  const resetPaddleMovement = useCallback(() => {
    resetPongPaddleMovementState(paddleMovementStateRef.current);
    stopPaddleMovementLoop();
  }, [stopPaddleMovementLoop]);

  const startGame = useCallback(() => {
    resetLeaderboardForm();
    setGame((current) => startPongGame(current));
  }, [resetLeaderboardForm]);

  const toggleRunState = useCallback(() => {
    resetLeaderboardForm();
    setGame((current) => {
      if (current.status === "running") {
        return pausePongGame(current);
      }

      return startPongGame(current);
    });
  }, [resetLeaderboardForm]);

  const restartGame = useCallback(() => {
    resetPaddleMovement();
    resetLeaderboardForm();
    setGame((current) => restartPongGame(current));
  }, [resetLeaderboardForm, resetPaddleMovement]);

  const advancePong = useCallback(() => {
    setGame((current) => advancePongGame(current));
  }, []);

  const decrementRemainingScore = useCallback(() => {
    setGame((current) => decrementPongRemainingScore(current));
  }, []);

  const saveLeaderboardScore = useCallback(() => {
    void savePendingLeaderboardScore();
  }, [savePendingLeaderboardScore]);

  const pauseGameForHelp = useCallback(() => {
    setGame((current) => pausePongGame(current));
  }, []);

  const resumeGameAfterHelp = useCallback(() => {
    setGame((current) => startPongGame(current));
  }, []);

  const { closeHelp, isHelpVisible, openHelp } = useGameHelpScreen({
    isGameActive: game.status === "running",
    onPauseGame: pauseGameForHelp,
    onResumeGame: resumeGameAfterHelp,
  });
  const { abandonDialogProps, requestBackToMenu } = useGameEscapeToMenu({
    isDisabled: isHelpVisible,
    isGameStarted: isUnfinishedMatch,
    onBackToMenu,
    onPauseGame: pauseGameForHelp,
    onResumeGame: resumeGameAfterHelp,
    shouldPauseBeforeConfirm: canPauseGame,
  });
  const isAbandonDialogVisible = abandonDialogProps !== null;

  useEffect(() => {
    if (tickDelay === null) {
      return;
    }

    const tick = window.setInterval(advancePong, tickDelay);

    return () => window.clearInterval(tick);
  }, [advancePong, tickDelay]);

  useEffect(() => {
    if (scoreTickDelay === null) {
      return;
    }

    const scoreTick = window.setInterval(decrementRemainingScore, scoreTickDelay);

    return () => window.clearInterval(scoreTick);
  }, [decrementRemainingScore, scoreTickDelay]);

  useEffect(() => {
    if (
      isHelpVisible ||
      isAbandonDialogVisible ||
      pendingLeaderboardEntry !== null ||
      game.status === "lost" ||
      game.status === "won"
    ) {
      resetPaddleMovement();
    }
  }, [
    game.status,
    isAbandonDialogVisible,
    isHelpVisible,
    pendingLeaderboardEntry,
    resetPaddleMovement,
  ]);

  useEffect(() => {
    window.addEventListener("blur", resetPaddleMovement);

    return () => {
      window.removeEventListener("blur", resetPaddleMovement);
      resetPaddleMovement();
    };
  }, [resetPaddleMovement]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isAbandonDialogVisible) {
        return;
      }

      if (
        shouldIgnoreGameKeyDown(event, {
          hasPendingLeaderboardEntry: pendingLeaderboardEntry !== null,
          isHelpVisible,
        })
      ) {
        return;
      }

      const movementKey = getPongPaddleMovementKey(event.key);

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

      if (event.key === " " || event.key === "p" || event.key === "P") {
        event.preventDefault();
        toggleRunState();
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      const movementKey = getPongPaddleMovementKey(event.key);

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
    isAbandonDialogVisible,
    isHelpVisible,
    pendingLeaderboardEntry,
    startGame,
    toggleRunState,
  ]);

  return (
    <GameShell className="bg-[var(--pong-page)] text-[var(--pong-ink)]">
      <GameSidebar className="border-[var(--pong-border)] bg-[var(--pong-panel)]">
        <GameHeader
          status={statusLabel}
          statusTestId="pong-status"
          title="Classic Pong"
        />

        <dl className="grid grid-cols-2 gap-3">
          <GameStatCard
            className="border-[var(--pong-border)]"
            label="Score"
            labelClassName="text-[var(--pong-muted)]"
            value={game.remainingScore}
            valueTestId="pong-remaining-score"
          />
          <GameStatCard
            className="border-[var(--pong-border)]"
            label="Target"
            labelClassName="text-[var(--pong-muted)]"
            value={game.targetScore}
          />
        </dl>

        <dl className="grid grid-cols-2 gap-3">
          <GameStatCard
            className="border-[var(--pong-border)]"
            label="Player"
            labelClassName="text-[var(--pong-muted)]"
            value={game.score.player}
            valueTestId="pong-player-score"
          />
          <GameStatCard
            className="border-[var(--pong-border)]"
            label="Computer"
            labelClassName="text-[var(--pong-muted)]"
            value={game.score.cpu}
            valueTestId="pong-cpu-score"
          />
        </dl>

      </GameSidebar>

      <GameBoardColumn className="w-[min(92vw,37.25rem)]">
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
              restartDisabled={showStartScreen || pendingLeaderboardEntry !== null}
              testIdPrefix="pong"
            />
          }
        >
          <PongBoard game={game} statusLabel={statusLabel}>
          {showStartScreen ? (
            <div
              className="absolute inset-2 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-[0.375rem] bg-[#081525] px-4 py-5 text-center text-[#e5f2ff]"
              data-testid="pong-start-screen"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="relative h-24 w-36 rounded-md border border-[#23415e] bg-[#06101f]" aria-hidden="true">
                  <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 border-l border-dashed border-[#e5f2ff]/60" />
                  <span className="absolute left-4 top-7 h-10 w-1.5 rounded-full bg-[#38bdf8]" />
                  <span className="absolute right-4 top-7 h-10 w-1.5 rounded-full bg-[#f472b6]" />
                  <span className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f8fafc]" />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-3xl font-semibold tracking-normal text-balance">Classic Pong</p>
                  <p className="text-sm font-medium text-[#9fb6c9]">First to {game.targetScore}</p>
                </div>
              </div>
              <Button
                className="min-w-32"
                data-testid="pong-start-button"
                onClick={startGame}
                size="lg"
                type="button"
                variant="secondary"
              >
                <PlayIcon data-icon="inline-start" />
                Start
              </Button>
              <GameLeaderboardPanel
                slotTestIdPrefix="pong-leaderboard-slot"
                slots={leaderboardSlots}
                statusMessage={leaderboardStatusMessage}
                testId="pong-start-leaderboard"
              />
            </div>
          ) : showRoundReadyScreen ? (
            <div
              className="absolute inset-2 flex items-center justify-center rounded-[0.375rem] bg-[rgba(8,21,37,0.62)] px-4 py-5 text-center text-[#e5f2ff] backdrop-blur-[1px]"
              data-testid="pong-round-ready-screen"
            >
              <div className="flex max-w-72 flex-col items-center gap-3 rounded-md border border-[#e5f2ff]/20 bg-[#081525]/92 p-5 shadow-[0_18px_48px_rgba(0,0,0,0.34)]">
                <div className="flex flex-col items-center gap-1">
                  <p className="text-2xl font-semibold tracking-normal text-balance">
                    Rally complete
                  </p>
                  <p className="text-base font-medium text-[#9fb6c9]">
                    Player {game.score.player} - {game.score.cpu} Computer
                  </p>
                </div>
                <Button
                  className="min-w-32"
                  data-testid="pong-next-rally-button"
                  onClick={startGame}
                  size="lg"
                  type="button"
                  variant="secondary"
                >
                  <PlayIcon data-icon="inline-start" />
                  Serve
                </Button>
              </div>
            </div>
          ) : showEndScreen ? (
            <GameEndScreen testId="pong-end-screen">
              {pendingLeaderboardEntry ? (
                <>
                  <GameLeaderboardScoreForm
                    isSaving={isSavingLeaderboardScore}
                    onPlayerNameChange={setPlayerName}
                    onSaveScore={saveLeaderboardScore}
                    pendingEntry={pendingLeaderboardEntry}
                    playerName={playerName}
                    saveFailed={scoreSaveFailed}
                    testIdPrefix="pong"
                  />
                  <GameLeaderboardPanel
                    slotTestIdPrefix="pong-final-leaderboard-slot"
                    slots={leaderboardSlots}
                    statusMessage={leaderboardStatusMessage}
                    testId="pong-final-leaderboard"
                  />
                </>
              ) : (
                <>
                  <GameEndSummary
                    metricLabel="Remaining score"
                    metricValue={game.remainingScore}
                    metricValueTestId="pong-final-score"
                    title={game.status === "won" ? "Match won" : "Match lost"}
                  />
                  <GameLeaderboardPanel
                    slotTestIdPrefix="pong-final-leaderboard-slot"
                    slots={leaderboardSlots}
                    statusMessage={leaderboardStatusMessage}
                    testId="pong-final-leaderboard"
                  />
                  <Button
                    className="min-w-36"
                    data-testid="pong-new-game-button"
                    onClick={restartGame}
                    size="lg"
                    type="button"
                    variant="secondary"
                  >
                    <RotateCcwIcon data-icon="inline-start" />
                    New game
                  </Button>
                </>
              )}
            </GameEndScreen>
          ) : showPauseScreen ? (
            <div
              className="absolute inset-2 flex items-center justify-center rounded-[0.375rem] bg-[rgba(8,21,37,0.76)] text-center text-[#e5f2ff] backdrop-blur-[2px]"
              data-testid="pong-board-state"
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
              className="border-[#e5f2ff]/25 bg-[#081525] text-[#e5f2ff]"
              onClose={closeHelp}
              sections={helpSections}
              testId="pong-help-screen"
              title="Classic Pong"
            />
          ) : null}
          </PongBoard>
        </GameBoardStage>
      </GameBoardColumn>
      {abandonDialogProps ? <GameAbandonDialog {...abandonDialogProps} /> : null}
    </GameShell>
  );
}
