"use client";

import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  PlayIcon,
  RotateCcwIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  GameAbandonDialog,
  GameBoardActions,
  GameBoardColumn,
  GameBoardStage,
  GameEndLeaderboardContent,
  GameEndScreen,
  GameHeader,
  GameHelpScreen,
  GameReplaySaveAction,
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
import {
  appendLiveGameReplayEvent,
  createLiveGameReplayRecording,
  useLiveGameReplayRecording,
  type LiveGameReplayRecording,
} from "@/components/game-replay-recording";
import { GameLeaderboardPanel } from "@/components/game-leaderboard";
import {
  isGamePauseKey,
  registerGameKeyDown,
  shouldIgnoreGameKeyDown,
} from "@/components/game-input";
import { useGameLeaderboardPresenter } from "@/components/game-leaderboard-presenter";
import { SnakeBoard, snakeSpriteSources } from "@/components/snake-board";
import { SnakeReplayPlayer } from "@/components/snake-replay-player";
import { Button } from "@/components/ui/button";
import {
  advanceSnakeGame,
  createInitialGame,
  expireTimedFood,
  getGameTickDelay,
  getTimedFoodSpawnDelay,
  isPickupIntroduced,
  queueGameDirection,
  spawnTimedFood,
  type Direction,
  type GameState,
  type GameStatus,
  type TimedFoodKind,
} from "@/lib/snake-game-engine";
import { createFoodFeedback, type FoodFeedback } from "@/lib/snake-food-feedback";
import { createGameLeaderboardKey } from "@/lib/leaderboard";
import {
  createSnakeReplayRandom,
  createSnakeReplayRun,
  saveSnakeReplay,
  SNAKE_REPLAY_GAME_ID,
  SNAKE_REPLAY_SCHEMA_VERSION,
  type SnakeReplayEvent,
  type SnakeReplayEventInput,
  type SnakeReplayPayload,
  type SnakeReplayRun,
} from "@/lib/snake-replay";
import { useGameSession } from "@/hooks/use-game-session";

type TimedFoodLifecycleOptions = {
  expireTimedFoodInGame: (kind: TimedFoodKind, expiresAt: number) => void;
  gameStatus: GameStatus;
  isIntroduced: boolean;
  kind: TimedFoodKind;
  spawnTimedFoodInGame: (kind: TimedFoodKind) => void;
  timedFood: GameState[TimedFoodKind];
};

type SnakeGameProps = {
  onBackToMenu?: () => void;
  onReplayBackToProfile?: () => void;
  replayMode?: "latest";
};

type SnakeReplayRecording = LiveGameReplayRecording<SnakeReplayEvent, SnakeReplayRun> & {
  random: () => number;
};

const START_SCREEN_CELLS: Array<{
  className?: string;
  rotationDeg?: number;
  spriteSrc: string;
}> = [
  {
    rotationDeg: 90,
    spriteSrc: snakeSpriteSources.tail,
  },
  {
    rotationDeg: 90,
    spriteSrc: snakeSpriteSources.bodyStraight,
  },
  {
    rotationDeg: 90,
    spriteSrc: snakeSpriteSources.bodyStraight,
  },
  {
    rotationDeg: 90,
    spriteSrc: snakeSpriteSources.head,
  },
  {
    className: "scale-90",
    spriteSrc: snakeSpriteSources.foodRedApple,
  },
];

const keyDirections: Record<string, Direction> = {
  ArrowUp: "up",
  w: "up",
  W: "up",
  ArrowRight: "right",
  d: "right",
  D: "right",
  ArrowDown: "down",
  s: "down",
  S: "down",
  ArrowLeft: "left",
  a: "left",
  A: "left",
};

const statusLabels: Record<GameStatus, string> = {
  ready: "Ready",
  running: "Running",
  paused: "Paused",
  lost: "Game over",
  won: "You won",
};

const SNAKE_HELP_SECTIONS: GameHelpSection[] = [
  {
    title: "Controls",
    controls: [
      {
        buttons: [{ text: "Space", label: "Space key" }],
        label: "Start game",
      },
      {
        buttons: [{ text: "P", label: "P key" }],
        label: "Pause or resume",
      },
      {
        buttons: [{ icon: ArrowUpIcon, label: "Up" }, { text: "W", label: "W key" }],
        label: "Move up",
      },
      {
        buttons: [{ icon: ArrowLeftIcon, label: "Left" }, { text: "A", label: "A key" }],
        label: "Move left",
      },
      {
        buttons: [{ icon: ArrowDownIcon, label: "Down" }, { text: "S", label: "S key" }],
        label: "Move down",
      },
      {
        buttons: [{ icon: ArrowRightIcon, label: "Right" }, { text: "D", label: "D key" }],
        label: "Move right",
      },
      {
        buttons: [{ text: "Enter", label: "Enter key" }],
        label: "Start a new game after finish",
      },
    ],
  },
  {
    title: "Rules",
    items: [
      "Eat red apples to grow and score.",
      "Collect the key when it appears, then enter the open door for the next level.",
      "Special foods unlock by level and can change score, speed, or length.",
      "Avoid walls, obstacles, and your own body.",
      "Each new level grows the board and resets speed, length, and pickup count.",
    ],
  },
];

function useTimedFoodLifecycle({
  expireTimedFoodInGame,
  gameStatus,
  isIntroduced,
  kind,
  spawnTimedFoodInGame,
  timedFood,
}: TimedFoodLifecycleOptions) {
  useEffect(() => {
    if (gameStatus !== "running" || timedFood !== null || !isIntroduced) {
      return;
    }

    const spawn = window.setTimeout(() => {
      spawnTimedFoodInGame(kind);
    }, getTimedFoodSpawnDelay(kind));

    return () => window.clearTimeout(spawn);
  }, [gameStatus, isIntroduced, kind, spawnTimedFoodInGame, timedFood]);

  const expiresAt = timedFood?.expiresAt ?? null;

  useEffect(() => {
    if (gameStatus !== "running" || expiresAt === null) {
      return;
    }

    const timeout = window.setTimeout(
      () => {
        expireTimedFoodInGame(kind, expiresAt);
      },
      Math.max(0, expiresAt - Date.now()),
    );

    return () => window.clearTimeout(timeout);
  }, [expireTimedFoodInGame, expiresAt, gameStatus, kind]);
}

function appendSnakeReplayEvent(
  recording: SnakeReplayRecording,
  event: SnakeReplayEventInput,
) {
  appendLiveGameReplayEvent(recording, event, {
    advancesTick: event.type === "advance",
  });
}

export function SnakeGame({
  onBackToMenu,
  onReplayBackToProfile,
  replayMode,
}: SnakeGameProps = {}) {
  if (replayMode === "latest") {
    return (
      <SnakeReplayPlayer
        onBackToProfile={onReplayBackToProfile ?? onBackToMenu ?? (() => undefined)}
      />
    );
  }

  return <SnakeLiveGame onBackToMenu={onBackToMenu} />;
}

function SnakeLiveGame({ onBackToMenu }: Pick<SnakeGameProps, "onBackToMenu"> = {}) {
  const [game, setGame] = useState<GameState>(() => createInitialGame());
  const [foodFeedbacks, setFoodFeedbacks] = useState<FoodFeedback[]>([]);
  const foodFeedbackIdRef = useRef(0);
  const gameRef = useRef(game);
  const pendingInitialDirectionRef = useRef<Direction | null>(null);
  const previousGameRef = useRef(game);
  const {
    beginReplayRecording,
    captureFinishedReplay,
    finishedReplay,
    isReplayRunPending,
    isReplayRunPendingRef,
    pauseRecordingClock,
    replayRecordingRef,
    replaySaveStatus,
    resumeRecordingClock,
    saveFinishedReplay,
  } = useLiveGameReplayRecording<SnakeReplayRecording, SnakeReplayPayload>({
    saveReplay: saveSnakeReplay,
  });
  const leaderboardKey = createGameLeaderboardKey("snake", [
    { name: "mode", value: "levels" },
  ]);
  const pendingLeaderboardScore =
    game.status === "lost" || game.status === "won" ? game.score : null;
  const { completedSessionId } = useGameSession({
    active: game.status === "running",
    finalResult:
      game.status === "lost" || game.status === "won" ? game.status : null,
    finalScore: game.score,
    gameId: "snake",
    leaderboardKey,
    started: game.status !== "ready",
  });
  const {
    finalLeaderboardProps,
    leaderboardBestScore,
    leaderboardPanelProps,
    pendingLeaderboardEntry,
    resetLeaderboardForm,
    scoreFormProps,
  } = useGameLeaderboardPresenter({
    gameSessionId: completedSessionId,
    leaderboardKey,
    pendingScore: pendingLeaderboardScore,
    testIdPrefix: "snake",
  });
  const bestScore = Math.max(game.bestScore, leaderboardBestScore);
  const speed = getGameTickDelay({
    pickedUpObjects: game.pickedUpObjects,
    speedBoosts: game.speedBoosts,
    status: game.status,
  });
  const removeFoodFeedback = useCallback((id: number) => {
    setFoodFeedbacks((current) => current.filter((feedback) => feedback.id !== id));
  }, []);

  const commitGame = useCallback((nextGame: GameState) => {
    gameRef.current = nextGame;
    setGame(nextGame);
  }, []);

  const updateCommittedGame = useCallback(
    (updateGame: (current: GameState) => GameState) => {
      const current = gameRef.current;
      const nextGame = updateGame(current);

      if (nextGame !== current) {
        commitGame(nextGame);
      }

      return nextGame;
    },
    [commitGame],
  );

  const queueDirection = useCallback((nextDirection: Direction) => {
    updateCommittedGame((current) => {
      const recording = replayRecordingRef.current;
      const nextGame = queueGameDirection(current, nextDirection);

      if (
        recording !== null &&
        current.status === "running" &&
        nextGame !== current &&
        current.queuedDirection !== nextDirection
      ) {
        appendSnakeReplayEvent(recording, {
          direction: nextDirection,
          type: "direction",
        });
      }

      return nextGame;
    });
  }, [replayRecordingRef, updateCommittedGame]);

  const advanceSnake = useCallback(() => {
    updateCommittedGame((current) => {
      const recording = replayRecordingRef.current;

      if (recording !== null && current.status === "running") {
        appendSnakeReplayEvent(recording, { type: "advance" });

        return advanceSnakeGame(current, { random: recording.random });
      }

      return advanceSnakeGame(current);
    });
  }, [replayRecordingRef, updateCommittedGame]);

  const spawnTimedFoodInGame = useCallback((kind: TimedFoodKind) => {
    updateCommittedGame((current) => {
      const recording = replayRecordingRef.current;
      const nowMs = Date.now();
      const nextGame =
        recording === null
          ? spawnTimedFood(current, kind)
          : spawnTimedFood(current, kind, {
              now: () => nowMs,
              random: recording.random,
            });

      if (recording !== null && nextGame !== current) {
        appendSnakeReplayEvent(recording, {
          kind,
          nowMs,
          type: "spawnTimedFood",
        });
      }

      return nextGame;
    });
  }, [replayRecordingRef, updateCommittedGame]);

  const expireTimedFoodInGame = useCallback((kind: TimedFoodKind, expiresAt: number) => {
    updateCommittedGame((current) => {
      const nextGame = expireTimedFood(current, kind, expiresAt);
      const recording = replayRecordingRef.current;

      if (recording !== null && nextGame !== current) {
        appendSnakeReplayEvent(recording, {
          expiresAt,
          kind,
          type: "expireTimedFood",
        });
      }

      return nextGame;
    });
  }, [replayRecordingRef, updateCommittedGame]);

  const startNewGame = useCallback(async (initialDirection?: Direction) => {
    if (isReplayRunPendingRef.current) {
      if (initialDirection !== undefined) {
        pendingInitialDirectionRef.current = initialDirection;
      }

      return;
    }

    pendingInitialDirectionRef.current = initialDirection ?? null;
    resetLeaderboardForm();
    const recording = await beginReplayRecording(async () => {
      const run = await createSnakeReplayRun();
      const random = createSnakeReplayRandom(run.seed);

      return createLiveGameReplayRecording<
        SnakeReplayEvent,
        SnakeReplayRun,
        { random: () => number }
      >({
        random,
        run,
      });
    });

    if (recording === null) {
      pendingInitialDirectionRef.current = null;
      return;
    }

    let nextGame: GameState = {
      ...createInitialGame({
        bestScore,
        random: recording.random,
      }),
      status: "running",
    };

    appendSnakeReplayEvent(recording, { type: "start" });

    const pendingInitialDirection = pendingInitialDirectionRef.current;

    if (pendingInitialDirection !== null) {
      appendSnakeReplayEvent(recording, {
        direction: pendingInitialDirection,
        type: "direction",
      });
      nextGame = queueGameDirection(nextGame, pendingInitialDirection);
    }

    pendingInitialDirectionRef.current = null;
    replayRecordingRef.current = recording;
    setFoodFeedbacks([]);
    commitGame(nextGame);
  }, [beginReplayRecording, bestScore, commitGame, isReplayRunPendingRef, resetLeaderboardForm, replayRecordingRef]);

  const toggleRunState = useCallback(() => {
    const current = gameRef.current;

    if (current.status === "running") {
      pauseRecordingClock();
      commitGame({ ...current, status: "paused" });
      return;
    }

    if (current.status === "paused") {
      resumeRecordingClock();
      commitGame({ ...current, status: "running" });
      return;
    }

    void startNewGame();
  }, [commitGame, pauseRecordingClock, resumeRecordingClock, startNewGame]);

  const restartGame = useCallback(() => {
    void startNewGame();
  }, [startNewGame]);

  useEffect(() => {
    if (game.status !== "lost" && game.status !== "won") {
      return;
    }

    const finalStatus = game.status;

    captureFinishedReplay((recording) => ({
      events: [...recording.events],
      finalLevel: game.level,
      finalScore: game.score,
      finalStatus,
      finalTick: recording.tick,
      gameId: SNAKE_REPLAY_GAME_ID,
      leaderboardKey,
      runId: recording.run.id,
      schemaVersion: SNAKE_REPLAY_SCHEMA_VERSION,
      seed: recording.run.seed,
      startedAt: recording.startedAt,
    }));
  }, [captureFinishedReplay, game.level, game.score, game.status, leaderboardKey]);

  const pauseGameForHelp = useCallback(() => {
    pauseRecordingClock();
    updateCommittedGame((current) =>
      current.status === "running" ? { ...current, status: "paused" } : current,
    );
  }, [pauseRecordingClock, updateCommittedGame]);

  const resumeGameAfterHelp = useCallback(() => {
    resumeRecordingClock();
    updateCommittedGame((current) =>
      current.status === "paused" ? { ...current, status: "running" } : current,
    );
  }, [resumeRecordingClock, updateCommittedGame]);

  const canPauseGame = game.status === "running" || game.status === "paused";
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
    const previousGame = previousGameRef.current;
    previousGameRef.current = game;

    if (previousGame.level !== game.level) {
      setFoodFeedbacks([]);
      return;
    }

    const feedback = createFoodFeedback(previousGame, game, foodFeedbackIdRef.current);

    if (feedback === null) {
      return;
    }

    foodFeedbackIdRef.current += 1;
    setFoodFeedbacks((current) => [...current, feedback].slice(-6));
  }, [game]);

  useTimedFoodLifecycle({
    expireTimedFoodInGame,
    gameStatus: game.status,
    isIntroduced: isPickupIntroduced("bonusFood", game.pickedUpObjects, game.level),
    kind: "bonusFood",
    spawnTimedFoodInGame,
    timedFood: game.bonusFood,
  });
  useTimedFoodLifecycle({
    expireTimedFoodInGame,
    gameStatus: game.status,
    isIntroduced: isPickupIntroduced("speedFood", game.pickedUpObjects, game.level),
    kind: "speedFood",
    spawnTimedFoodInGame,
    timedFood: game.speedFood,
  });
  useTimedFoodLifecycle({
    expireTimedFoodInGame,
    gameStatus: game.status,
    isIntroduced: isPickupIntroduced("slowFood", game.pickedUpObjects, game.level),
    kind: "slowFood",
    spawnTimedFoodInGame,
    timedFood: game.slowFood,
  });
  useTimedFoodLifecycle({
    expireTimedFoodInGame,
    gameStatus: game.status,
    isIntroduced: isPickupIntroduced("shrinkFood", game.pickedUpObjects, game.level),
    kind: "shrinkFood",
    spawnTimedFoodInGame,
    timedFood: game.shrinkFood,
  });

  useEffect(() => {
    if (speed === null) {
      return;
    }

    const tick = window.setInterval(advanceSnake, speed);

    return () => window.clearInterval(tick);
  }, [advanceSnake, speed]);

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

      const nextDirection = keyDirections[event.key];

      if (nextDirection) {
        event.preventDefault();
        if (game.status === "ready") {
          void startNewGame(nextDirection);
          return;
        }

        queueDirection(nextDirection);
        return;
      }

      if (isGamePauseKey(event.key)) {
        event.preventDefault();
        toggleRunState();
        return;
      }

      if (event.key === " " && game.status === "ready") {
        event.preventDefault();
        toggleRunState();
      }

      if (event.key === "Enter" && (game.status === "lost" || game.status === "won")) {
        event.preventDefault();
        restartGame();
      }
    }

    return registerGameKeyDown(handleKeyDown);
  }, [
    game.status,
    isHelpVisible,
    pendingLeaderboardEntry,
    queueDirection,
    restartGame,
    startNewGame,
    toggleRunState,
  ]);

  const pauseActionLabel = game.status === "paused" ? "Resume" : "Pause";
  const showStartScreen = game.status === "ready";
  const showGameOverScreen = game.status === "lost" || game.status === "won";
  const showBoardState = game.status !== "running";

  return (
    <GameShell className="bg-[var(--snake-page)] text-[var(--snake-ink)]">
      <GameBoardColumn className="w-[min(92vw,41.25rem,calc(100svh_-_12rem))]">
        <GameSidebar className="border-[var(--snake-border)] bg-[var(--snake-panel)]">
          <GameHeader
            status={statusLabels[game.status]}
            statusTestId="snake-status"
            title="Snake"
          />

          <GameStatsBar>
            <GameStatCard
              className="border-[var(--snake-border)]"
              label="Score"
              labelClassName="text-[var(--snake-muted)]"
              value={game.score}
              valueTestId="snake-score"
            />
            <GameStatCard
              className="border-[var(--snake-border)]"
              label="Best"
              labelClassName="text-[var(--snake-muted)]"
              value={bestScore}
              valueTestId="snake-best"
            />
            <GameStatCard
              className="border-[var(--snake-border)]"
              label="Level"
              labelClassName="text-[var(--snake-muted)]"
              value={game.level}
              valueTestId="snake-level"
            />
            <GameStatCard
              className="border-[var(--snake-border)]"
              label="Length"
              labelClassName="text-[var(--snake-muted)]"
              value={game.snake.length}
              valueTestId="snake-length"
            />
            <GameStatCard
              className="border-[var(--snake-border)]"
              label="Speed"
              labelClassName="text-[var(--snake-muted)]"
              value={speed === null ? "0" : `${Math.round(1000 / speed)}`}
              valueTestId="snake-speed"
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
              testIdPrefix="snake"
            />
          }
        >
          <SnakeBoard
            foodFeedbacks={foodFeedbacks}
            game={game}
            onFoodFeedbackAnimationEnd={removeFoodFeedback}
            statusLabel={statusLabels[game.status]}
          >
            {showStartScreen ? (
              <GameStartScreen testId="snake-start-screen">
                <GameStartScreenHeader
                  preview={
                    <div className="grid grid-cols-5 gap-1" aria-hidden="true">
                      {START_SCREEN_CELLS.map(({ className, rotationDeg = 0, spriteSrc }, index) => (
                        <span
                          className="relative size-9 overflow-visible rounded-[0.18rem] bg-[var(--snake-board-cell)] bg-cover bg-center bg-no-repeat shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--snake-grid)_60%,transparent)] sm:size-10"
                          key={`${spriteSrc}-${index}`}
                          style={{ backgroundImage: `url("${snakeSpriteSources.floorCell}")` }}
                        >
                          <span
                            className={[
                              "absolute inset-0 bg-contain bg-center bg-no-repeat drop-shadow-[0_3px_5px_color-mix(in_oklch,black_28%,transparent)]",
                              className,
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            style={{
                              backgroundImage: `url("${spriteSrc}")`,
                              transform: rotationDeg === 0 ? undefined : `rotate(${rotationDeg}deg)`,
                            }}
                          />
                        </span>
                      ))}
                    </div>
                  }
                  status={statusLabels[game.status]}
                  statusAriaLive="polite"
                  title="Snake"
                />
                <GameLeaderboardPanel {...leaderboardPanelProps} />
                <Button
                  className="min-w-32"
                  data-testid="snake-start-button"
                  disabled={isReplayRunPending}
                  onClick={toggleRunState}
                  size="lg"
                  type="button"
                  variant="secondary"
                >
                  <PlayIcon data-icon="inline-start" />
                  {isReplayRunPending ? "Starting" : "Start"}
                </Button>
              </GameStartScreen>
            ) : showGameOverScreen ? (
              <GameEndScreen testId="snake-game-over-screen">
                <GameEndLeaderboardContent
                  action={
                    <div className="flex w-full max-w-xs flex-col items-center gap-2">
                      <Button
                        className="w-full"
                        data-testid="snake-new-game-button"
                        onClick={restartGame}
                        size="lg"
                        type="button"
                        variant="secondary"
                      >
                        <RotateCcwIcon data-icon="inline-start" />
                        New game
                      </Button>
                    </div>
                  }
                  leaderboard={finalLeaderboardProps}
                  pendingLeaderboardEntry={pendingLeaderboardEntry}
                  scoreForm={scoreFormProps}
                  summary={{
                    metricLabel: "Your score:",
                    metricValue: game.score,
                    metricValueTestId: "snake-final-score",
                    title: statusLabels[game.status],
                  }}
                />
                <GameReplaySaveAction
                  onSave={saveFinishedReplay}
                  replayReady={finishedReplay !== null}
                  status={replaySaveStatus}
                  testIdPrefix="snake"
                />
              </GameEndScreen>
            ) : showBoardState ? (
              <div
                className="absolute inset-2 flex items-center justify-center rounded-[0.375rem] bg-[color-mix(in_oklch,var(--snake-board)_72%,transparent)] text-center text-[var(--snake-board-text)] backdrop-blur-[2px]"
                data-testid="snake-board-state"
              >
                <p className="text-2xl font-semibold tracking-normal">
                  {statusLabels[game.status]}
                </p>
              </div>
            ) : null}
            {isHelpVisible ? (
              <GameHelpScreen
                onClose={closeHelp}
                sections={SNAKE_HELP_SECTIONS}
                testId="snake-help-screen"
                title="Snake"
              />
            ) : null}
          </SnakeBoard>
        </GameBoardStage>
      </GameBoardColumn>
      {abandonDialogProps ? <GameAbandonDialog {...abandonDialogProps} /> : null}
    </GameShell>
  );
}
