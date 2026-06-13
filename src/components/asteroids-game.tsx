"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  PlayIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { AsteroidsBoard } from "@/components/asteroids-board";
import {
  advanceAsteroidsHitSparks,
  createAsteroidsHitSparks,
  type AsteroidsHitSpark,
} from "@/components/asteroids-hit-sparks";
import {
  advanceAsteroidsPickupFeedbacks,
  createAsteroidsPickupFeedbacks,
  type AsteroidsPickupFeedback,
} from "@/components/asteroids-pickup-feedback";
import {
  createAsteroidsControlState,
  getAsteroidsControlInput,
  getAsteroidsControlKey,
  pressAsteroidsControlKey,
  releaseAsteroidsControlKey,
  resetAsteroidsControlState,
  type AsteroidsControlState,
} from "@/components/asteroids-player-input";
import {
  isGamePauseKey,
  registerGameKeyDown,
  registerGameKeyUp,
  shouldIgnoreGameKeyDown,
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
import { useGameLeaderboardPresenter } from "@/components/game-leaderboard-presenter";
import { AsteroidsReplayPlayer } from "@/components/asteroids-replay-player";
import { Button } from "@/components/ui/button";
import { useGameSession } from "@/hooks/use-game-session";
import {
  advanceAsteroidsGame,
  ASTEROIDS_BONUS_LIFE_SCORE,
  ASTEROIDS_BONUS_SCORE_POWER_UP_POINTS,
  ASTEROIDS_POWER_UP_SHIELD_TICKS,
  ASTEROIDS_TICK_DELAY_MS,
  ASTEROIDS_STARTING_LIVES,
  createInitialAsteroidsGame,
  fireAsteroidsBullet,
  getAsteroidsTickDelay,
  getAsteroidsSaucerScore,
  pauseAsteroidsGame,
  startAsteroidsGame,
  type AsteroidsGameState,
  type AsteroidsStatus,
} from "@/lib/asteroids-game-engine";
import {
  createAsteroidsReplayRandom,
  createAsteroidsReplayRun,
  saveAsteroidsReplay,
  ASTEROIDS_REPLAY_GAME_ID,
  ASTEROIDS_REPLAY_SCHEMA_VERSION,
  type AsteroidsReplayControls,
  type AsteroidsReplayEvent,
  type AsteroidsReplayEventInput,
  type AsteroidsReplayPayload,
  type AsteroidsReplayRun,
} from "@/lib/asteroids-replay";
import { createGameLeaderboardKey } from "@/lib/leaderboard";

type AsteroidsGameProps = {
  initialAsteroidCount?: number;
  initialBoardHeight?: number;
  initialBoardWidth?: number;
  onBackToMenu?: () => void;
  onReplayBackToProfile?: () => void;
  replayMode?: "latest";
};

type AsteroidsReplayRecording = LiveGameReplayRecording<AsteroidsReplayEvent, AsteroidsReplayRun> & {
  random: () => number;
};

const statusLabels: Record<AsteroidsStatus, string> = {
  lost: "Game over",
  paused: "Paused",
  ready: "Ready",
  running: "Running",
};

const ASTEROIDS_HELP_SECTIONS: GameHelpSection[] = [
  {
    title: "Controls",
    controls: [
      {
        buttons: [{ text: "Enter", label: "Enter key" }],
        label: "Start game",
      },
      {
        buttons: [{ icon: ArrowLeftIcon, label: "Left" }, { text: "A", label: "A key" }],
        label: "Hold to rotate counterclockwise",
      },
      {
        buttons: [{ icon: ArrowRightIcon, label: "Right" }, { text: "D", label: "D key" }],
        label: "Hold to rotate clockwise",
      },
      {
        buttons: [{ icon: ArrowUpIcon, label: "Up" }, { text: "W", label: "W key" }],
        label: "Hold to thrust",
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
      "Break large asteroids into medium rocks, then small rocks, then clear them.",
      "Wrap around the edges of the field to stay alive and line up shots.",
      `Shoot large saucers for ${getAsteroidsSaucerScore("large")} points and small saucers for ${getAsteroidsSaucerScore("small").toLocaleString("en-US")} points, but dodge their fire.`,
      `Power-ups appear one at a time and stay until collected: shields last ${Math.round((ASTEROIDS_POWER_UP_SHIELD_TICKS * ASTEROIDS_TICK_DELAY_MS) / 1_000)} seconds, speed bonuses stack by 20%, shot interval bonuses shorten firing cooldown by 20%, and score stars award ${ASTEROIDS_BONUS_SCORE_POWER_UP_POINTS.toLocaleString("en-US")} points.`,
      `Earn a bonus life every ${ASTEROIDS_BONUS_LIFE_SCORE.toLocaleString("en-US")} points.`,
      "Clearing a wave spawns a denser field; the run ends when all lives are lost.",
    ],
  },
];

function getCurrentAsteroidsReplayControls(
  controlState: AsteroidsControlState,
): AsteroidsReplayControls {
  const controls = getAsteroidsControlInput(controlState);

  return {
    rotateLeft: controls.rotateLeft,
    rotateRight: controls.rotateRight,
    thrust: controls.thrust,
  };
}

function areAsteroidsReplayControlsEqual(
  left: AsteroidsReplayControls,
  right: AsteroidsReplayControls,
) {
  return (
    left.rotateLeft === right.rotateLeft &&
    left.rotateRight === right.rotateRight &&
    left.thrust === right.thrust
  );
}

function appendAsteroidsReplayEvent(
  recording: AsteroidsReplayRecording,
  event: AsteroidsReplayEventInput,
) {
  appendLiveGameReplayEvent(recording, event, {
    advancesTick: event.type === "advance",
  });
}

export function AsteroidsGame({
  initialAsteroidCount,
  initialBoardHeight,
  initialBoardWidth,
  onBackToMenu,
  onReplayBackToProfile,
  replayMode,
}: AsteroidsGameProps = {}) {
  if (replayMode === "latest") {
    return (
      <AsteroidsReplayPlayer
        onBackToProfile={onReplayBackToProfile ?? onBackToMenu ?? (() => undefined)}
      />
    );
  }

  return (
    <AsteroidsLiveGame
      initialAsteroidCount={initialAsteroidCount}
      initialBoardHeight={initialBoardHeight}
      initialBoardWidth={initialBoardWidth}
      onBackToMenu={onBackToMenu}
    />
  );
}

function AsteroidsLiveGame({
  initialAsteroidCount,
  initialBoardHeight,
  initialBoardWidth,
  onBackToMenu,
}: Pick<
  AsteroidsGameProps,
  "initialAsteroidCount" | "initialBoardHeight" | "initialBoardWidth" | "onBackToMenu"
> = {}) {
  const [controlState] = useState(() => createAsteroidsControlState());
  const [game, setGame] = useState<AsteroidsGameState>(() =>
    createInitialAsteroidsGame({
      asteroidCount: initialAsteroidCount,
      boardHeight: initialBoardHeight,
      boardWidth: initialBoardWidth,
    }),
  );
  const [hitSparks, setHitSparks] = useState<AsteroidsHitSpark[]>([]);
  const [pickupFeedbacks, setPickupFeedbacks] = useState<AsteroidsPickupFeedback[]>([]);
  const gameRef = useRef(game);
  const nextHitSparkIdRef = useRef(0);
  const nextPickupFeedbackIdRef = useRef(0);
  const {
    beginReplayRecording,
    captureFinishedReplay,
    finishedReplay,
    isReplayRunPending,
    isReplayRunPendingRef,
    pauseRecordingClock,
    replayRecordingRef,
    replaySaveStatus,
    resetReplayRecording,
    resumeRecordingClock,
    saveFinishedReplay,
  } = useLiveGameReplayRecording<AsteroidsReplayRecording, AsteroidsReplayPayload>({
    saveReplay: saveAsteroidsReplay,
  });
  const tickDelay = game.status === "running" ? getAsteroidsTickDelay() : null;
  const canPauseGame = game.status === "running" || game.status === "paused";
  const pauseActionLabel = game.status === "paused" ? "Resume" : "Pause";
  const showStartScreen = game.status === "ready";
  const showEndScreen = game.status === "lost";
  const showPauseScreen = game.status === "paused";
  const leaderboardKey = createGameLeaderboardKey("asteroids", [
    { name: "board", value: `${game.boardWidth}x${game.boardHeight}` },
    { name: "rocks", value: game.startingAsteroidCount },
  ]);
  const isAsteroidsStarted =
    game.status !== "ready" ||
    game.score > 0 ||
    game.wave > 1 ||
    game.lives < ASTEROIDS_STARTING_LIVES;
  const { completedSessionId } = useGameSession({
    active: game.status === "running",
    finalResult: game.status === "lost" ? "lost" : null,
    finalScore: game.score,
    gameId: "asteroids",
    leaderboardKey,
    started: isAsteroidsStarted,
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
    testIdPrefix: "asteroids",
  });

  const commitGame = useCallback((nextGame: AsteroidsGameState) => {
    gameRef.current = nextGame;
    setGame(nextGame);
  }, []);

  const updateCommittedGame = useCallback(
    (updateGame: (current: AsteroidsGameState) => AsteroidsGameState) => {
      const current = gameRef.current;
      const nextGame = updateGame(current);

      if (nextGame !== current) {
        commitGame(nextGame);
      }

      return nextGame;
    },
    [commitGame],
  );

  const clearHitSparks = useCallback(() => {
    nextHitSparkIdRef.current = 0;
    setHitSparks([]);
  }, []);

  const clearPickupFeedbacks = useCallback(() => {
    nextPickupFeedbackIdRef.current = 0;
    setPickupFeedbacks([]);
  }, []);

  const queueHitSparks = useCallback(
    (previousGame: AsteroidsGameState, nextGame: AsteroidsGameState) => {
      const result = createAsteroidsHitSparks({
        nextGame,
        nextId: nextHitSparkIdRef.current,
        previousGame,
      });

      if (result.sparks.length === 0) {
        return;
      }

      nextHitSparkIdRef.current = result.nextId;
      setHitSparks((current) => [...current, ...result.sparks]);
    },
    [],
  );

  const queuePickupFeedbacks = useCallback(
    (previousGame: AsteroidsGameState, nextGame: AsteroidsGameState) => {
      const result = createAsteroidsPickupFeedbacks({
        nextGame,
        nextId: nextPickupFeedbackIdRef.current,
        previousGame,
      });

      if (result.feedbacks.length === 0) {
        return;
      }

      nextPickupFeedbackIdRef.current = result.nextId;
      setPickupFeedbacks((current) => [...current, ...result.feedbacks]);
    },
    [],
  );

  const recordControlChange = useCallback(
    (previousControls: AsteroidsReplayControls) => {
      const recording = replayRecordingRef.current;

      if (recording === null) {
        return;
      }

      const nextControls = getCurrentAsteroidsReplayControls(controlState);

      if (!areAsteroidsReplayControlsEqual(previousControls, nextControls)) {
        appendAsteroidsReplayEvent(recording, {
          controls: nextControls,
          type: "control",
        });
      }
    },
    [controlState, replayRecordingRef],
  );

  const resetControls = useCallback(
    ({ record = false }: { record?: boolean } = {}) => {
      const previousControls = getCurrentAsteroidsReplayControls(controlState);

      resetAsteroidsControlState(controlState);

      if (record) {
        recordControlChange(previousControls);
      }
    },
    [controlState, recordControlChange],
  );

  const startReplayRun = useCallback(async () => {
    if (isReplayRunPendingRef.current) {
      return;
    }

    resetControls();
    clearHitSparks();
    clearPickupFeedbacks();
    resetLeaderboardForm();
    const recording = await beginReplayRecording(async () => {
      const run = await createAsteroidsReplayRun();
      const random = createAsteroidsReplayRandom(run.seed);

      return createLiveGameReplayRecording<
        AsteroidsReplayEvent,
        AsteroidsReplayRun,
        { random: () => number }
      >({
        random,
        run,
      });
    });

    if (recording === null) {
      return;
    }

    const current = gameRef.current;
    const readyGame = createInitialAsteroidsGame({
      asteroidCount: current.startingAsteroidCount,
      boardHeight: current.boardHeight,
      boardWidth: current.boardWidth,
      random: recording.random,
    });

    appendAsteroidsReplayEvent(recording, { type: "start" });
    replayRecordingRef.current = recording;
    commitGame(startAsteroidsGame(readyGame));
  }, [beginReplayRecording, clearHitSparks, clearPickupFeedbacks, commitGame, isReplayRunPendingRef, resetControls, resetLeaderboardForm, replayRecordingRef]);

  const startGame = useCallback(() => {
    void startReplayRun();
  }, [startReplayRun]);

  const toggleRunState = useCallback(() => {
    const current = gameRef.current;

    resetLeaderboardForm();

    if (current.status === "running") {
      resetControls({ record: true });
      pauseRecordingClock();
      updateCommittedGame((gameState) => pauseAsteroidsGame(gameState));
      return;
    }

    if (current.status === "paused") {
      resetControls();
      resumeRecordingClock();
      updateCommittedGame((gameState) => startAsteroidsGame(gameState));
      return;
    }

    startGame();
  }, [pauseRecordingClock, resetControls, resetLeaderboardForm, resumeRecordingClock, startGame, updateCommittedGame]);

  const restartGame = useCallback(() => {
    if (isReplayRunPendingRef.current) {
      return;
    }

    resetControls();
    resetReplayRecording();
    void startReplayRun();
  }, [isReplayRunPendingRef, resetControls, resetReplayRecording, startReplayRun]);

  const fireBullet = useCallback(() => {
    updateCommittedGame((current) => {
      const nextGame = fireAsteroidsBullet(current);
      const recording = replayRecordingRef.current;

      if (recording !== null && nextGame.bullets.length > current.bullets.length) {
        appendAsteroidsReplayEvent(recording, { type: "fire" });
      }

      return nextGame;
    });
  }, [replayRecordingRef, updateCommittedGame]);

  const advanceAsteroids = useCallback(() => {
    updateCommittedGame((current) => {
      const recording = replayRecordingRef.current;
      const controls = getAsteroidsControlInput(controlState);
      let nextGame: AsteroidsGameState;

      if (recording !== null && current.status === "running") {
        appendAsteroidsReplayEvent(recording, { type: "advance" });

        nextGame = advanceAsteroidsGame(current, controls, { random: recording.random });
      } else {
        nextGame = advanceAsteroidsGame(current, controls);
      }

      queueHitSparks(current, nextGame);
      queuePickupFeedbacks(current, nextGame);

      return nextGame;
    });
  }, [controlState, queueHitSparks, queuePickupFeedbacks, replayRecordingRef, updateCommittedGame]);

  const pauseGameForHelp = useCallback(() => {
    resetControls({ record: true });
    pauseRecordingClock();
    updateCommittedGame((current) => pauseAsteroidsGame(current));
  }, [pauseRecordingClock, resetControls, updateCommittedGame]);

  const resumeGameAfterHelp = useCallback(() => {
    resumeRecordingClock();
    updateCommittedGame((current) => startAsteroidsGame(current));
  }, [resumeRecordingClock, updateCommittedGame]);

  useEffect(() => {
    if (game.status !== "lost") {
      return;
    }

    const finalStatus = game.status;

    captureFinishedReplay((recording) => ({
      boardHeight: game.boardHeight,
      boardWidth: game.boardWidth,
      events: [...recording.events],
      finalAsteroidCount: game.asteroids.length,
      finalLives: game.lives,
      finalScore: game.score,
      finalStatus,
      finalTick: recording.tick,
      finalWave: game.wave,
      gameId: ASTEROIDS_REPLAY_GAME_ID,
      leaderboardKey,
      runId: recording.run.id,
      schemaVersion: ASTEROIDS_REPLAY_SCHEMA_VERSION,
      seed: recording.run.seed,
      startedAt: recording.startedAt,
      startingAsteroidCount: game.startingAsteroidCount,
    }));
  }, [
    captureFinishedReplay,
    game.asteroids.length,
    game.boardHeight,
    game.boardWidth,
    game.lives,
    game.score,
    game.startingAsteroidCount,
    game.status,
    game.wave,
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

  useEffect(() => {
    if (tickDelay === null) {
      return;
    }

    const tick = window.setInterval(advanceAsteroids, tickDelay);

    return () => window.clearInterval(tick);
  }, [advanceAsteroids, tickDelay]);

  useEffect(() => {
    if (hitSparks.length === 0) {
      return;
    }

    const tick = window.setInterval(() => {
      setHitSparks((current) => advanceAsteroidsHitSparks(current));
    }, ASTEROIDS_TICK_DELAY_MS);

    return () => window.clearInterval(tick);
  }, [hitSparks.length]);

  useEffect(() => {
    if (pickupFeedbacks.length === 0) {
      return;
    }

    const tick = window.setInterval(() => {
      setPickupFeedbacks((current) => advanceAsteroidsPickupFeedbacks(current));
    }, ASTEROIDS_TICK_DELAY_MS);

    return () => window.clearInterval(tick);
  }, [pickupFeedbacks.length]);

  useEffect(() => {
    if (
      isHelpVisible ||
      isReplayRunPending ||
      pendingLeaderboardEntry !== null ||
      game.status !== "running"
    ) {
      resetControls();
    }
  }, [
    game.status,
    isHelpVisible,
    isReplayRunPendingRef,
    isReplayRunPending,
    pendingLeaderboardEntry,
    resetControls,
  ]);

  useEffect(() => {
    function handleBlur() {
      resetControls({ record: gameRef.current.status === "running" });
    }

    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("blur", handleBlur);
      resetControls();
    };
  }, [resetControls]);

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

      if (
        event.key === "Enter" &&
        game.status !== "running" &&
        game.status !== "paused"
      ) {
        event.preventDefault();
        startGame();
        return;
      }

      if (isGamePauseKey(event.key)) {
        event.preventDefault();

        if (!isReplayRunPendingRef.current) {
          toggleRunState();
        }

        return;
      }

      if (event.key === " ") {
        event.preventDefault();

        if (game.status === "running" && !isReplayRunPendingRef.current) {
          fireBullet();
        }

        return;
      }

      const controlKey = getAsteroidsControlKey(event.key);

      if (controlKey !== null) {
        event.preventDefault();

        if (game.status === "running" && !isReplayRunPendingRef.current) {
          const previousControls = getCurrentAsteroidsReplayControls(controlState);

          pressAsteroidsControlKey(controlState, controlKey);
          recordControlChange(previousControls);
        }
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      const controlKey = getAsteroidsControlKey(event.key);

      if (controlKey === null) {
        return;
      }

      const previousControls = getCurrentAsteroidsReplayControls(controlState);

      if (releaseAsteroidsControlKey(controlState, controlKey)) {
        event.preventDefault();

        if (gameRef.current.status === "running") {
          recordControlChange(previousControls);
        }
      }
    }

    const unregisterKeyDown = registerGameKeyDown(handleKeyDown);
    const unregisterKeyUp = registerGameKeyUp(handleKeyUp);

    return () => {
      unregisterKeyDown();
      unregisterKeyUp();
    };
  }, [
    controlState,
    fireBullet,
    game.status,
    isHelpVisible,
    isReplayRunPendingRef,
    pendingLeaderboardEntry,
    recordControlChange,
    startGame,
    toggleRunState,
  ]);

  return (
    <GameShell className="bg-[var(--asteroids-page)] text-[var(--asteroids-ink)]">
      <GameBoardColumn className="w-[min(94vw,50rem,calc(133.333svh_-_16rem))]">
        <GameSidebar className="border-[var(--asteroids-border)] bg-[var(--asteroids-panel)]">
          <GameHeader
            status={statusLabels[game.status]}
            statusTestId="asteroids-status"
            title="Asteroids"
          />

          <GameStatsBar>
            <GameStatCard
              className="border-[var(--asteroids-border)]"
              label="Score"
              labelClassName="text-[var(--asteroids-muted)]"
              value={game.score}
              valueTestId="asteroids-score"
            />
            <GameStatCard
              className="border-[var(--asteroids-border)]"
              label="Lives"
              labelClassName="text-[var(--asteroids-muted)]"
              value={game.lives}
              valueTestId="asteroids-lives"
            />
            <GameStatCard
              className="border-[var(--asteroids-border)]"
              label="Wave"
              labelClassName="text-[var(--asteroids-muted)]"
              value={game.wave}
              valueTestId="asteroids-wave"
            />
            <GameStatCard
              className="border-[var(--asteroids-border)]"
              label="Rocks"
              labelClassName="text-[var(--asteroids-muted)]"
              value={game.asteroids.length}
              valueTestId="asteroids-rocks"
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
              testIdPrefix="asteroids"
            />
          }
        >
          <AsteroidsBoard
            game={game}
            hitSparks={hitSparks}
            pickupFeedbacks={pickupFeedbacks}
            statusLabel={statusLabels[game.status]}
          >
            {showStartScreen ? (
              <GameStartScreen testId="asteroids-start-screen">
                <GameStartScreenHeader
                  preview={
                    <div
                      className="grid h-16 w-28 place-items-center rounded-md border border-[color-mix(in_oklch,var(--asteroids-ship)_48%,transparent)] bg-[color-mix(in_oklch,var(--asteroids-ship)_8%,transparent)] text-[var(--asteroids-ship)] shadow-[0_0_22px_color-mix(in_oklch,var(--asteroids-ship)_22%,transparent)]"
                      aria-hidden="true"
                    >
                      <svg className="h-11 w-16" viewBox="0 0 64 44">
                        <polygon
                          fill="none"
                          points="32,3 12,40 32,29 52,40"
                          stroke="currentColor"
                          strokeLinejoin="round"
                          strokeWidth="3"
                        />
                      </svg>
                    </div>
                  }
                  status={`${game.startingAsteroidCount} rocks. Endless waves.`}
                  title="Asteroids"
                />
                <Button
                  className="min-w-32"
                  data-testid="asteroids-start-button"
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
            ) : showEndScreen ? (
              <GameEndScreen testId="asteroids-end-screen">
                <GameEndLeaderboardContent
                  action={
                    <div className="flex w-full max-w-xs flex-col items-center gap-2">
                      <Button
                        className="w-full"
                        data-testid="asteroids-new-game-button"
                        disabled={isReplayRunPending}
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
                    metricLabel: "Final score",
                    metricValue: game.score,
                    metricValueTestId: "asteroids-final-score",
                    title: "Game over",
                  }}
                />
                <GameReplaySaveAction
                  onSave={saveFinishedReplay}
                  replayReady={finishedReplay !== null}
                  status={replaySaveStatus}
                  testIdPrefix="asteroids"
                />
              </GameEndScreen>
            ) : showPauseScreen ? (
              <div
                className="absolute inset-2 flex items-center justify-center rounded-[0.375rem] bg-[color-mix(in_oklch,var(--asteroids-board)_74%,transparent)] text-center text-[var(--asteroids-board-text)] backdrop-blur-[2px]"
                data-testid="asteroids-board-state"
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
                sections={ASTEROIDS_HELP_SECTIONS}
                testId="asteroids-help-screen"
                title="Asteroids"
              />
            ) : null}
          </AsteroidsBoard>
        </GameBoardStage>
      </GameBoardColumn>
      {abandonDialogProps ? <GameAbandonDialog {...abandonDialogProps} /> : null}
    </GameShell>
  );
}
