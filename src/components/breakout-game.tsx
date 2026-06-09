"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PlayIcon,
  RotateCcwIcon,
  SaveIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

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
  GameStartScreen,
  GameStartScreenHeader,
  GameStatsBar,
  GameStatCard,
  useGameEscapeToMenu,
  useGameHelpScreen,
  type GameHelpSection,
} from "@/components/game-layout";
import { GameLeaderboardPanel } from "@/components/game-leaderboard";
import { useGameLeaderboardPresenter } from "@/components/game-leaderboard-presenter";
import { BreakoutReplayPlayer } from "@/components/breakout-replay-player";
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
import {
  createBreakoutReplayRandom,
  createBreakoutReplayRun,
  saveBreakoutReplay,
  BREAKOUT_REPLAY_GAME_ID,
  BREAKOUT_REPLAY_SCHEMA_VERSION,
  type BreakoutReplayEvent,
  type BreakoutReplayEventInput,
  type BreakoutReplayPayload,
  type BreakoutReplayRun,
} from "@/lib/breakout-replay";
import { createGameLeaderboardKey } from "@/lib/leaderboard";
import { cn } from "@/lib/utils";
import { useGameSession } from "@/hooks/use-game-session";

type BreakoutGameProps = {
  initialBoardHeight?: number;
  initialBoardWidth?: number;
  initialLives?: number;
  onBackToMenu?: () => void;
  onReplayBackToProfile?: () => void;
  replayMode?: "latest";
};

type ReplaySaveStatus = "failed" | "idle" | "saved" | "saving";

type BreakoutReplayRecording = {
  events: BreakoutReplayEvent[];
  nextSeq: number;
  random: () => number;
  run: BreakoutReplayRun;
  startedAt: string;
  tick: number;
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

function appendBreakoutReplayEvent(
  recording: BreakoutReplayRecording,
  event: BreakoutReplayEventInput,
) {
  recording.events.push({
    ...event,
    seq: recording.nextSeq,
    tick: recording.tick,
  } as BreakoutReplayEvent);
  recording.nextSeq += 1;

  if (event.type === "advance") {
    recording.tick += 1;
  }
}

export function BreakoutGame({
  initialBoardHeight,
  initialBoardWidth,
  initialLives,
  onBackToMenu,
  onReplayBackToProfile,
  replayMode,
}: BreakoutGameProps = {}) {
  if (replayMode === "latest") {
    return (
      <BreakoutReplayPlayer
        onBackToProfile={onReplayBackToProfile ?? onBackToMenu ?? (() => undefined)}
      />
    );
  }

  return (
    <BreakoutLiveGame
      initialBoardHeight={initialBoardHeight}
      initialBoardWidth={initialBoardWidth}
      initialLives={initialLives}
      onBackToMenu={onBackToMenu}
    />
  );
}

function BreakoutLiveGame({
  initialBoardHeight,
  initialBoardWidth,
  initialLives,
  onBackToMenu,
}: Pick<
  BreakoutGameProps,
  "initialBoardHeight" | "initialBoardWidth" | "initialLives" | "onBackToMenu"
> = {}) {
  const [game, setGame] = useState<BreakoutGameState>(() =>
    createInitialBreakoutGame({
      boardHeight: initialBoardHeight,
      boardWidth: initialBoardWidth,
      lives: initialLives,
    }),
  );
  const [finishedReplay, setFinishedReplay] = useState<BreakoutReplayPayload | null>(null);
  const [isReplayRunPending, setIsReplayRunPending] = useState(false);
  const [replaySaveStatus, setReplaySaveStatus] = useState<ReplaySaveStatus>("idle");
  const gameRef = useRef(game);
  const isReplayRunPendingRef = useRef(false);
  const preStartReplayEventsRef = useRef<BreakoutReplayEventInput[]>([]);
  const replayRecordingRef = useRef<BreakoutReplayRecording | null>(null);
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

  const commitGame = useCallback((nextGame: BreakoutGameState) => {
    gameRef.current = nextGame;
    setGame(nextGame);
  }, []);

  const updateCommittedGame = useCallback(
    (updateGame: (current: BreakoutGameState) => BreakoutGameState) => {
      const current = gameRef.current;
      const nextGame = updateGame(current);

      if (nextGame !== current) {
        commitGame(nextGame);
      }

      return nextGame;
    },
    [commitGame],
  );

  const startReplayRun = useCallback(async ({ restart = false }: { restart?: boolean } = {}) => {
    if (isReplayRunPendingRef.current) {
      return;
    }

    isReplayRunPendingRef.current = true;
    replayRecordingRef.current = null;
    setIsReplayRunPending(true);
    resetLeaderboardForm();
    setFinishedReplay(null);
    setReplaySaveStatus("idle");

    try {
      const run = await createBreakoutReplayRun();
      const random = createBreakoutReplayRandom(run.seed);
      const recording: BreakoutReplayRecording = {
        events: [],
        nextSeq: 0,
        random,
        run,
        startedAt: new Date().toISOString(),
        tick: 0,
      };

      preStartReplayEventsRef.current.forEach((event) => {
        appendBreakoutReplayEvent(recording, event);
      });
      appendBreakoutReplayEvent(recording, { type: "start" });
      preStartReplayEventsRef.current = [];
      replayRecordingRef.current = recording;
      commitGame(
        restart
          ? restartBreakoutGame(gameRef.current)
          : startBreakoutGame(gameRef.current),
      );
    } catch {
      setReplaySaveStatus("failed");
    } finally {
      isReplayRunPendingRef.current = false;
      setIsReplayRunPending(false);
    }
  }, [commitGame, resetLeaderboardForm]);

  const startGame = useCallback(() => {
    resetLeaderboardForm();
    setFinishedReplay(null);
    setReplaySaveStatus("idle");

    const recording = replayRecordingRef.current;

    if (recording !== null) {
      appendBreakoutReplayEvent(recording, { type: "start" });
      updateCommittedGame((current) => startBreakoutGame(current));

      return;
    }

    void startReplayRun();
  }, [resetLeaderboardForm, startReplayRun, updateCommittedGame]);

  const toggleRunState = useCallback(() => {
    const current = gameRef.current;

    if (current.status === "running") {
      resetLeaderboardForm();
      updateCommittedGame((gameState) => pauseBreakoutGame(gameState));
      return;
    }

    if (current.status === "paused") {
      resetLeaderboardForm();
      updateCommittedGame((gameState) => startBreakoutGame(gameState));
      return;
    }

    startGame();
  }, [resetLeaderboardForm, startGame, updateCommittedGame]);

  const restartGame = useCallback(() => {
    if (isReplayRunPendingRef.current) {
      return;
    }

    preStartReplayEventsRef.current = [];
    replayRecordingRef.current = null;
    void startReplayRun({ restart: true });
  }, [startReplayRun]);

  const movePaddle = useCallback(
    (direction: BreakoutPaddleMovementDirection) => {
      updateCommittedGame((current) => {
        const nextGame =
          direction === "left"
            ? moveBreakoutPaddleLeft(current)
            : moveBreakoutPaddleRight(current);
        const event: BreakoutReplayEventInput =
          direction === "left" ? { type: "moveLeft" } : { type: "moveRight" };
        const movedPaddle = nextGame.paddle.x !== current.paddle.x;
        const recording = replayRecordingRef.current;

        if (movedPaddle && recording !== null) {
          appendBreakoutReplayEvent(recording, event);
        } else if (
          movedPaddle &&
          current.status === "ready" &&
          !isReplayRunPendingRef.current
        ) {
          preStartReplayEventsRef.current.push(event);
        }

        return nextGame;
      });
    },
    [updateCommittedGame],
  );

  const advanceBreakout = useCallback(() => {
    updateCommittedGame((current) => {
      const recording = replayRecordingRef.current;

      if (recording !== null && current.status === "running") {
        appendBreakoutReplayEvent(recording, { type: "advance" });

        return advanceBreakoutGame(current, { random: recording.random });
      }

      return advanceBreakoutGame(current, { random: Math.random });
    });
  }, [updateCommittedGame]);

  const pauseGameForHelp = useCallback(() => {
    updateCommittedGame((current) => pauseBreakoutGame(current));
  }, [updateCommittedGame]);

  const resumeGameAfterHelp = useCallback(() => {
    updateCommittedGame((current) => startBreakoutGame(current));
  }, [updateCommittedGame]);

  const saveFinishedReplay = useCallback(async () => {
    if (finishedReplay === null || replaySaveStatus === "saving") {
      return;
    }

    setReplaySaveStatus("saving");

    try {
      await saveBreakoutReplay(finishedReplay);
      setReplaySaveStatus("saved");
    } catch {
      setReplaySaveStatus("failed");
    }
  }, [finishedReplay, replaySaveStatus]);

  useEffect(() => {
    if (game.status !== "lost" && game.status !== "won") {
      return;
    }

    const recording = replayRecordingRef.current;

    if (recording === null || finishedReplay !== null) {
      return;
    }

    const replay: BreakoutReplayPayload = {
      boardHeight: game.boardHeight,
      boardWidth: game.boardWidth,
      events: [...recording.events],
      finalActiveBrickCount: activeBrickCount,
      finalLives: game.lives,
      finalScore: game.score,
      finalStatus: game.status,
      finalTick: recording.tick,
      gameId: BREAKOUT_REPLAY_GAME_ID,
      leaderboardKey,
      runId: recording.run.id,
      schemaVersion: BREAKOUT_REPLAY_SCHEMA_VERSION,
      seed: recording.run.seed,
      startedAt: recording.startedAt,
      startingLives: game.startingLives,
    };

    replayRecordingRef.current = null;
    preStartReplayEventsRef.current = [];
    setFinishedReplay(replay);
  }, [
    activeBrickCount,
    finishedReplay,
    game.boardHeight,
    game.boardWidth,
    game.lives,
    game.score,
    game.startingLives,
    game.status,
    leaderboardKey,
  ]);

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
      isReplayRunPending ||
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
                disabled: isHelpVisible || isReplayRunPending || !canPauseGame,
                isResume: game.status === "paused",
                label: pauseActionLabel,
                onClick: toggleRunState,
              }}
              restartDisabled={
                isReplayRunPending ||
                game.status === "ready" ||
                pendingLeaderboardEntry !== null
              }
              testIdPrefix="breakout"
            />
          }
        >
          <BreakoutBoard game={game} statusLabel={statusLabels[game.status]}>
          {showStartScreen ? (
            <GameStartScreen testId="breakout-start-screen">
              <GameStartScreenHeader
                preview={
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
                }
                status={statusLabels[game.status]}
                title="Breakout"
              />
              <Button
                className="min-w-32"
                data-testid="breakout-start-button"
                disabled={isReplayRunPending}
                onClick={startGame}
                size="lg"
                type="button"
                variant="secondary"
              >
                <PlayIcon data-icon="inline-start" />
                {isReplayRunPending ? "Starting" : "Start"}
              </Button>
              <GameLeaderboardPanel {...leaderboardPanelProps} />
            </GameStartScreen>
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
                  disabled={isReplayRunPending}
                  onClick={startGame}
                  size="lg"
                  type="button"
                  variant="secondary"
                >
                  <PlayIcon data-icon="inline-start" />
                  {isReplayRunPending ? "Starting" : "Serve next ball"}
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
                    disabled={isReplayRunPending}
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
              <div className="flex w-full max-w-xs flex-col items-center gap-2">
                <Button
                  className="w-full"
                  data-testid="breakout-save-replay-button"
                  disabled={
                    finishedReplay === null ||
                    replaySaveStatus === "saving" ||
                    replaySaveStatus === "saved"
                  }
                  onClick={saveFinishedReplay}
                  size="lg"
                  type="button"
                  variant="secondary"
                >
                  <SaveIcon data-icon="inline-start" />
                  {replaySaveStatus === "saving"
                    ? "Saving replay"
                    : replaySaveStatus === "saved"
                      ? "Replay saved"
                      : "Save replay"}
                </Button>
                {replaySaveStatus === "failed" ? (
                  <p
                    className="text-xs font-medium text-[#cbd5e1]"
                    data-testid="breakout-save-replay-error"
                  >
                    Could not save replay. Sign in and try again.
                  </p>
                ) : null}
              </div>
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
