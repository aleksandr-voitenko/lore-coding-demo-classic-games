"use client";

import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  PlayIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { BattleCityBoard } from "@/components/battle-city-board";
import { BattleCityReplayPlayer } from "@/components/battle-city-replay-player";
import { BattleCityStageResults } from "@/components/battle-city-stage-results";
import {
  createBattleCityPlayerMovementState,
  getBattleCityPlayerMovementKey,
  pressBattleCityPlayerMovementKey,
  releaseBattleCityPlayerMovementKey,
  resetBattleCityPlayerMovementState,
  type BattleCityPlayerMovementKey,
} from "@/components/battle-city-player-input";
import {
  isGamePauseKey,
  registerGameKeyDown,
  registerGameKeyUp,
  shouldIgnoreGameKeyDown,
} from "@/components/game-input";
import { GameLeaderboardPanel } from "@/components/game-leaderboard";
import { useGameLeaderboardPresenter } from "@/components/game-leaderboard-presenter";
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
import { getGameReplayRecordingElapsedMs } from "@/components/game-replay-timing";
import { Button } from "@/components/ui/button";
import { useGameSession } from "@/hooks/use-game-session";
import {
  advanceBattleCityGame,
  BATTLE_CITY_STAGE_COUNT,
  BATTLE_CITY_TICK_MS,
  createInitialBattleCityGame,
  formatBattleCityStageLabel,
  getBattleCityStageResultDisplay,
  pauseBattleCityGame,
  resumeBattleCityGame,
  startBattleCityGame,
  type BattleCityFrameInput,
  type BattleCityGameState,
  type BattleCityStatus,
} from "@/lib/battle-city-game-engine";
import { accumulateBattleCityFixedStep } from "@/lib/battle-city/fixed-step";
import {
  BATTLE_CITY_PLAYER_ASSET_BY_POWER_TIER,
  getBattleCityAssetUrl,
} from "@/lib/battle-city/assets";
import {
  createBattleCityReplayRandom,
  createBattleCityReplayRun,
  saveBattleCityReplay,
  BATTLE_CITY_REPLAY_GAME_ID,
  BATTLE_CITY_REPLAY_SCHEMA_VERSION,
  MAX_BATTLE_CITY_REPLAY_EVENTS,
  MAX_BATTLE_CITY_REPLAY_FRAMES,
  type BattleCityReplayAdvanceEvent,
  type BattleCityReplayEvent,
  type BattleCityReplayEventInput,
  type BattleCityReplayPayload,
  type BattleCityReplayRun,
} from "@/lib/battle-city-replay";
import { getGameCatalogEntry } from "@/lib/game-catalog";
import { createGameLeaderboardKey } from "@/lib/leaderboard";

type BattleCityGameProps = {
  onBackToMenu?: () => void;
  onReplayBackToProfile?: () => void;
  replayMode?: "latest";
};

type BattleCityReplayRecording = LiveGameReplayRecording<
  BattleCityReplayEvent,
  BattleCityReplayRun
> & {
  initialTick: number;
  isComplete: boolean;
  random: () => number;
  startingStage: number;
};

const BATTLE_CITY_DISPLAY_NAME = getGameCatalogEntry("battle-city").label;

const BATTLE_CITY_LEADERBOARD_KEY = createGameLeaderboardKey("battle-city", [
  { name: "mode", value: "campaign" },
]);

const BATTLE_CITY_STATUS_LABELS: Record<BattleCityStatus, string> = {
  "game-over": "Game over",
  lost: "Game over",
  paused: "Paused",
  ready: "Ready",
  running: "Running",
  "stage-clear": "Stage clear",
  "stage-intro": "Stage intro",
  "stage-results": "Stage results",
};

function isBattleCitySimulationActive(status: BattleCityStatus) {
  return (
    status === "running" ||
    status === "stage-clear" ||
    status === "game-over" ||
    status === "stage-results" ||
    status === "stage-intro"
  );
}

const BATTLE_CITY_HELP_SECTIONS: GameHelpSection[] = [
  {
    title: "Controls",
    controls: [
      {
        buttons: [
          { icon: ArrowUpIcon, label: "Up" },
          { icon: ArrowRightIcon, label: "Right" },
          { icon: ArrowDownIcon, label: "Down" },
          { icon: ArrowLeftIcon, label: "Left" },
          { text: "WASD", label: "W A S D keys" },
        ],
        label: "Hold to move and turn",
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
      "Destroy all 20 enemy tanks while protecting the phoenix headquarters.",
      "Shells carve up to four brick fragments across their impact face; steel needs a fully upgraded shell.",
      "Water blocks tanks, forest hides them, and ice keeps you sliding briefly.",
      "Flashing enemies reveal one of six power-ups when hit.",
      "An unshielded enemy shell costs a life; any shell that reaches the headquarters ends the run.",
      "Stages 36–70 reuse the 35 maps with the final enemy mix, then reset to Stage 1.",
      "After every battle, the original per-tank score tally appears before the next stage or game over.",
      "Before a new campaign, use Space/Up/Right to advance, B/Down/Left to go back, then press Enter.",
    ],
  },
];

function isBattleCityStartKey(key: string) {
  return key === "Enter";
}

function isBattleCityFireKey(key: string) {
  return key === " ";
}

function getBattleCityStageSelectionDelta(key: string): -1 | 0 | 1 {
  if (key === " " || key === "ArrowUp" || key === "ArrowRight") {
    return 1;
  }
  if (key === "b" || key === "B" || key === "ArrowDown" || key === "ArrowLeft") {
    return -1;
  }
  return 0;
}

function appendBattleCityReplayEvent(
  recording: BattleCityReplayRecording,
  event: BattleCityReplayEventInput,
) {
  if (
    !recording.isComplete ||
    recording.events.length >= MAX_BATTLE_CITY_REPLAY_EVENTS
  ) {
    recording.isComplete = false;
    return null;
  }

  return appendLiveGameReplayEvent(recording, event);
}

function hasSameBattleCityReplayInput(
  left: BattleCityFrameInput,
  right: BattleCityFrameInput,
) {
  return (
    left.direction === right.direction &&
    left.fireRequested === right.fireRequested
  );
}

function appendBattleCityReplayAdvance(
  recording: BattleCityReplayRecording,
  input: BattleCityFrameInput,
) {
  if (
    !recording.isComplete ||
    recording.tick >= MAX_BATTLE_CITY_REPLAY_FRAMES
  ) {
    recording.isComplete = false;
    return;
  }

  if (recording.events.length >= MAX_BATTLE_CITY_REPLAY_EVENTS) {
    recording.isComplete = false;
    return;
  }

  const previousEvent = recording.events.at(-1);

  if (
    previousEvent?.type === "advance" &&
    hasSameBattleCityReplayInput(previousEvent.input, input)
  ) {
    previousEvent.endElapsedMs = getGameReplayRecordingElapsedMs(recording);
    previousEvent.frameCount += 1;
    recording.tick += 1;
    return;
  }

  const event = appendLiveGameReplayEvent<
    BattleCityReplayEvent,
    BattleCityReplayRecording,
    Extract<BattleCityReplayEventInput, { type: "advance" }>
  >(
    recording,
    {
      endElapsedMs: 0,
      frameCount: 1,
      input,
      type: "advance",
    },
    { advancesTick: true },
  ) as BattleCityReplayAdvanceEvent;

  event.endElapsedMs = event.elapsedMs;
}

function appendBattleCityPausedReplayFrame(
  recording: BattleCityReplayRecording,
) {
  if (
    !recording.isComplete ||
    recording.tick >= MAX_BATTLE_CITY_REPLAY_FRAMES
  ) {
    recording.isComplete = false;
    return;
  }

  const pauseEvent = recording.events.at(-1);

  if (pauseEvent?.type !== "pause") {
    recording.isComplete = false;
    return;
  }

  pauseEvent.frameCount += 1;
  recording.tick += 1;
}

export function BattleCityGame({
  onBackToMenu,
  onReplayBackToProfile,
  replayMode,
}: BattleCityGameProps = {}) {
  if (replayMode === "latest") {
    return (
      <BattleCityReplayPlayer
        onBackToProfile={
          onReplayBackToProfile ?? onBackToMenu ?? (() => undefined)
        }
      />
    );
  }

  return <BattleCityLiveGame onBackToMenu={onBackToMenu} />;
}

function BattleCityLiveGame({
  onBackToMenu,
}: Pick<BattleCityGameProps, "onBackToMenu"> = {}) {
  const [game, setGame] = useState<BattleCityGameState>(() =>
    createInitialBattleCityGame(),
  );
  const [hasEnteredGame, setHasEnteredGame] = useState(false);
  const [isReplayTooLong, setIsReplayTooLong] = useState(false);
  const gameRef = useRef(game);
  const fireRequestedRef = useRef(false);
  const movementStateRef = useRef(createBattleCityPlayerMovementState());
  const {
    captureFinishedReplay,
    finishedReplay,
    isReplayRunPending,
    isReplayRunPendingRef,
    pauseRecordingClock,
    replayRecordingRef,
    replaySaveStatus,
    replaceReplayRecording,
    resetReplayRecording,
    resumeRecordingClock,
    saveFinishedReplay,
    setReplaySaveStatus,
    startReplayRecording,
  } = useLiveGameReplayRecording<
    BattleCityReplayRecording,
    BattleCityReplayPayload
  >({
    saveReplay: saveBattleCityReplay,
  });
  const statusLabel = BATTLE_CITY_STATUS_LABELS[game.status];
  const stageLabel = formatBattleCityStageLabel(game.stage, game.cycle);
  const stageResultDisplay = getBattleCityStageResultDisplay(game);
  const enemiesRemaining = Math.max(
    0,
    game.totalEnemyCount - game.spawnedEnemyCount,
  );
  const reserveLives = Math.max(0, game.lives - 1);
  const showStartScreen = !hasEnteredGame && game.status === "ready";
  const showEndScreen = game.status === "lost";
  const canPauseGame = game.status === "running" || game.status === "paused";
  const isRunInProgress = hasEnteredGame && game.status !== "lost";
  const pauseActionLabel = game.status === "paused" ? "Resume" : "Pause";
  const isSimulationActive = isBattleCitySimulationActive(game.status);
  const isFrameClockActive =
    !isReplayRunPending &&
    (isSimulationActive ||
      game.status === "paused" ||
      game.status === "ready");

  const { completedSessionId } = useGameSession({
    active: isSimulationActive && !isReplayRunPending,
    finalResult: game.status === "lost" ? "lost" : null,
    finalScore: game.score,
    gameId: "battle-city",
    leaderboardKey: BATTLE_CITY_LEADERBOARD_KEY,
    started: hasEnteredGame,
  });
  const {
    finalLeaderboardProps,
    leaderboardPanelProps,
    pendingLeaderboardEntry,
    resetLeaderboardForm,
    scoreFormProps,
  } = useGameLeaderboardPresenter({
    gameSessionId: completedSessionId,
    leaderboardKey: BATTLE_CITY_LEADERBOARD_KEY,
    pendingScore: showEndScreen ? game.score : null,
    testIdPrefix: "battle-city",
  });

  const commitGame = useCallback((nextGame: BattleCityGameState) => {
    gameRef.current = nextGame;
    setGame(nextGame);
  }, []);

  const updateCommittedGame = useCallback(
    (updateGame: (current: BattleCityGameState) => BattleCityGameState) => {
      const current = gameRef.current;
      const nextGame = updateGame(current);

      if (nextGame !== current) {
        commitGame(nextGame);
      }

      return nextGame;
    },
    [commitGame],
  );

  const selectReadyStage = useCallback(
    (delta: -1 | 1) => {
      if (isReplayRunPendingRef.current) {
        return;
      }

      updateCommittedGame((current) => {
        if (current.status !== "ready") {
          return current;
        }
        const stage = Math.min(
          BATTLE_CITY_STAGE_COUNT,
          Math.max(1, current.stage + delta),
        );
        if (stage === current.stage) {
          return current;
        }
        return createInitialBattleCityGame({ stage });
      });
    },
    [isReplayRunPendingRef, updateCommittedGame],
  );

  const toggleRunState = useCallback(() => {
    if (isReplayRunPendingRef.current) {
      return;
    }

    resetLeaderboardForm();
    updateCommittedGame((current) => {
      if (current.status === "running") {
        const recording = replayRecordingRef.current;

        if (recording !== null) {
          appendBattleCityReplayEvent(recording, {
            frameCount: 0,
            type: "pause",
          });
        }
        pauseRecordingClock();
        return pauseBattleCityGame(current);
      }

      if (current.status === "paused") {
        const recording = replayRecordingRef.current;

        if (recording !== null) {
          appendBattleCityReplayEvent(recording, { type: "resume" });
        }
        resumeRecordingClock();
        return resumeBattleCityGame(current);
      }

      return current;
    });
  }, [
    isReplayRunPendingRef,
    pauseRecordingClock,
    replayRecordingRef,
    resetLeaderboardForm,
    resumeRecordingClock,
    updateCommittedGame,
  ]);

  const requestPlayerFire = useCallback(() => {
    if (isReplayRunPendingRef.current) {
      return;
    }

    fireRequestedRef.current = true;
  }, [isReplayRunPendingRef]);

  const advanceGameFrames = useCallback(
    (frameCount: number) => {
      updateCommittedGame((current) => {
        let next = current;
        for (let frame = 0; frame < frameCount; frame += 1) {
          const input = {
            direction: movementStateRef.current.direction,
            fireRequested: fireRequestedRef.current,
          };
          const recording = replayRecordingRef.current;

          fireRequestedRef.current = false;

          if (recording !== null && next.status === "paused") {
            appendBattleCityPausedReplayFrame(recording);
            next = advanceBattleCityGame(
              next,
              BATTLE_CITY_TICK_MS,
              recording.random,
              input,
            );
            continue;
          }

          if (
            recording !== null &&
            next.status !== "ready" &&
            next.status !== "lost"
          ) {
            appendBattleCityReplayAdvance(recording, input);
            next = advanceBattleCityGame(
              next,
              BATTLE_CITY_TICK_MS,
              recording.random,
              input,
            );
          } else {
            next = advanceBattleCityGame(
              next,
              BATTLE_CITY_TICK_MS,
              Math.random,
              input,
            );
          }
        }
        return next;
      });
    },
    [replayRecordingRef, updateCommittedGame],
  );

  const pauseGameForOverlay = useCallback(() => {
    updateCommittedGame((current) => {
      if (!isBattleCitySimulationActive(current.status)) {
        return current;
      }

      pauseRecordingClock();

      if (current.status !== "running") {
        return current;
      }

      const recording = replayRecordingRef.current;

      if (recording !== null) {
        appendBattleCityReplayEvent(recording, {
          frameCount: 0,
          type: "pause",
        });
      }
      return pauseBattleCityGame(current);
    });
  }, [pauseRecordingClock, replayRecordingRef, updateCommittedGame]);

  const resumeGameAfterOverlay = useCallback(() => {
    updateCommittedGame((current) => {
      if (current.status !== "paused") {
        if (isBattleCitySimulationActive(current.status)) {
          resumeRecordingClock();
        }
        return current;
      }

      const recording = replayRecordingRef.current;

      if (recording !== null) {
        appendBattleCityReplayEvent(recording, { type: "resume" });
      }
      resumeRecordingClock();
      return resumeBattleCityGame(current);
    });
  }, [replayRecordingRef, resumeRecordingClock, updateCommittedGame]);

  const { closeHelp, isHelpVisible, openHelp } = useGameHelpScreen({
    isGameActive: isSimulationActive,
    onPauseGame: pauseGameForOverlay,
    onResumeGame: resumeGameAfterOverlay,
  });
  const { abandonDialogProps, requestBackToMenu } = useGameEscapeToMenu({
    isDisabled: isHelpVisible || isReplayRunPending,
    isGameStarted: isRunInProgress,
    onBackToMenu,
    onPauseGame: pauseGameForOverlay,
    onResumeGame: resumeGameAfterOverlay,
    shouldPauseBeforeConfirm: isSimulationActive,
  });
  const isAbandonDialogVisible = abandonDialogProps !== null;

  const beginMovement = useCallback(
    (movementKey: BattleCityPlayerMovementKey) => {
      if (isReplayRunPendingRef.current) {
        return;
      }

      pressBattleCityPlayerMovementKey(movementStateRef.current, movementKey);
    },
    [isReplayRunPendingRef],
  );

  const endMovement = useCallback(
    (movementKey: BattleCityPlayerMovementKey) =>
      releaseBattleCityPlayerMovementKey(
        movementStateRef.current,
        movementKey,
      ).handled,
    [],
  );

  const resetMovement = useCallback(() => {
    fireRequestedRef.current = false;
    resetBattleCityPlayerMovementState(movementStateRef.current);
  }, []);

  const startReplayRun = useCallback(
    async (
      readyGame: BattleCityGameState,
      { replaceExisting = false }: { replaceExisting?: boolean } = {},
    ) => {
      if (isReplayRunPendingRef.current || readyGame.status !== "ready") {
        return false;
      }

      resetMovement();
      if (!replaceExisting) {
        resetLeaderboardForm();
      }
      const beginRecording = replaceExisting
        ? replaceReplayRecording
        : startReplayRecording;
      const recording = await beginRecording(async () => {
        const run = await createBattleCityReplayRun();

        return createLiveGameReplayRecording<
          BattleCityReplayEvent,
          BattleCityReplayRun,
          {
            initialTick: number;
            isComplete: boolean;
            random: () => number;
            startingStage: number;
          }
        >({
          initialTick: readyGame.tick,
          isComplete: true,
          random: createBattleCityReplayRandom(run.seed),
          run,
          startingStage: readyGame.stage,
        });
      });

      if (recording === null) {
        return false;
      }

      resetMovement();
      appendBattleCityReplayEvent(recording, { type: "start" });
      resetLeaderboardForm();
      setIsReplayTooLong(false);
      setHasEnteredGame(true);
      commitGame(startBattleCityGame(readyGame));

      return true;
    },
    [
      commitGame,
      isReplayRunPendingRef,
      replaceReplayRecording,
      resetLeaderboardForm,
      resetMovement,
      startReplayRecording,
    ],
  );

  const enterGame = useCallback(() => {
    void startReplayRun(gameRef.current);
  }, [startReplayRun]);

  const isMovementDisabled =
    isHelpVisible ||
    isAbandonDialogVisible ||
    isReplayRunPending ||
    pendingLeaderboardEntry !== null ||
    (game.status !== "running" && game.status !== "stage-clear");

  useEffect(() => {
    if (isMovementDisabled) {
      resetMovement();
    }
  }, [isMovementDisabled, resetMovement]);

  useEffect(() => {
    window.addEventListener("blur", resetMovement);

    return () => {
      window.removeEventListener("blur", resetMovement);
      resetMovement();
    };
  }, [resetMovement]);

  const restartGame = useCallback(() => {
    if (
      isReplayRunPendingRef.current ||
      replaySaveStatus === "saving"
    ) {
      return;
    }

    const previousGame = gameRef.current;
    const readyGame = createInitialBattleCityGame();
    const shouldResumePreviousRecording = previousGame.status !== "paused";

    resetMovement();
    pauseRecordingClock();
    void startReplayRun(readyGame, { replaceExisting: true }).then(
      (didStart) => {
        if (!didStart && shouldResumePreviousRecording) {
          resumeRecordingClock();
        }
      },
    );
  }, [
    isReplayRunPendingRef,
    pauseRecordingClock,
    resetMovement,
    replaySaveStatus,
    resumeRecordingClock,
    startReplayRun,
  ]);

  const showNewCampaignSelector = useCallback(() => {
    resetMovement();
    resetLeaderboardForm();
    resetReplayRecording();
    setIsReplayTooLong(false);
    setHasEnteredGame(false);
    commitGame(createInitialBattleCityGame());
  }, [commitGame, resetLeaderboardForm, resetMovement, resetReplayRecording]);

  useEffect(() => {
    if (game.status !== "lost") {
      return;
    }

    const recording = replayRecordingRef.current;

    if (recording !== null && !recording.isComplete) {
      replayRecordingRef.current = null;
      setIsReplayTooLong(true);
      setReplaySaveStatus("failed");
      return;
    }

    const finalStatus = game.status;

    captureFinishedReplay((recording) => ({
      events: [...recording.events],
      finalBaseAlive: game.baseAlive,
      finalCycle: game.cycle === 2 ? 2 : 1,
      finalLives: game.lives,
      finalScore: game.score,
      finalStage: game.stage,
      finalStatus,
      finalTick: recording.tick,
      gameId: BATTLE_CITY_REPLAY_GAME_ID,
      initialTick: recording.initialTick,
      leaderboardKey: BATTLE_CITY_LEADERBOARD_KEY,
      runId: recording.run.id,
      schemaVersion: BATTLE_CITY_REPLAY_SCHEMA_VERSION,
      seed: recording.run.seed,
      startedAt: recording.startedAt,
      startingStage: recording.startingStage,
    }));
  }, [
    captureFinishedReplay,
    game.baseAlive,
    game.cycle,
    game.lives,
    game.score,
    game.stage,
    game.status,
    replayRecordingRef,
    setReplaySaveStatus,
  ]);

  useEffect(() => {
    if (
      isHelpVisible ||
      isAbandonDialogVisible ||
      !isFrameClockActive
    ) {
      return;
    }

    let animationFrame = 0;
    let previousTimestamp: number | null = null;
    let remainderMs = 0;

    function advanceAtNtscRate(timestamp: number) {
      if (previousTimestamp !== null) {
        const fixedStep = accumulateBattleCityFixedStep(
          remainderMs,
          timestamp - previousTimestamp,
        );
        remainderMs = fixedStep.remainderMs;
        if (fixedStep.frames > 0) {
          advanceGameFrames(fixedStep.frames);
        }
      }
      previousTimestamp = timestamp;
      animationFrame = window.requestAnimationFrame(advanceAtNtscRate);
    }

    animationFrame = window.requestAnimationFrame(advanceAtNtscRate);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [
    advanceGameFrames,
    isAbandonDialogVisible,
    isFrameClockActive,
    isHelpVisible,
  ]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isAbandonDialogVisible || isReplayRunPendingRef.current) {
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

      if (showStartScreen) {
        if (isBattleCityStartKey(event.key)) {
          event.preventDefault();
          if (!event.repeat && !isReplayRunPendingRef.current) {
            enterGame();
          }
          return;
        }

        const stageDelta = getBattleCityStageSelectionDelta(event.key);
        if (stageDelta !== 0) {
          event.preventDefault();
          if (!isReplayRunPendingRef.current) {
            selectReadyStage(stageDelta);
          }
          return;
        }
      }

      const movementKey = getBattleCityPlayerMovementKey(event.key);

      if (movementKey !== null) {
        event.preventDefault();
        if (game.status === "running" || game.status === "stage-clear") {
          beginMovement(movementKey);
        }
        return;
      }

      if (
        isBattleCityFireKey(event.key) &&
        (game.status === "running" || game.status === "stage-clear")
      ) {
        event.preventDefault();
        if (!event.repeat) {
          requestPlayerFire();
        }
        return;
      }

      if (isGamePauseKey(event.key) && canPauseGame) {
        event.preventDefault();
        if (!event.repeat) {
          toggleRunState();
        }
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      const movementKey = getBattleCityPlayerMovementKey(event.key);

      if (movementKey === null) {
        return;
      }

      if (endMovement(movementKey as BattleCityPlayerMovementKey)) {
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
    beginMovement,
    canPauseGame,
    endMovement,
    enterGame,
    game.status,
    isAbandonDialogVisible,
    isHelpVisible,
    isReplayRunPendingRef,
    pendingLeaderboardEntry,
    requestPlayerFire,
    selectReadyStage,
    showStartScreen,
    toggleRunState,
  ]);

  return (
    <GameShell className="bg-[var(--battle-city-page)] text-[var(--battle-city-ink)]">
      <GameBoardColumn className="w-[min(92vw,42rem,calc(100svh_-_12rem))]">
        <GameSidebar className="border-[var(--battle-city-border)] bg-[var(--battle-city-panel)]">
          <GameHeader
            status={statusLabel}
            statusTestId="battle-city-status"
            title={BATTLE_CITY_DISPLAY_NAME}
          />

          <GameStatsBar>
            <GameStatCard
              className="border-[var(--battle-city-border)]"
              label="Score"
              labelClassName="text-[var(--battle-city-muted)]"
              value={game.score.toLocaleString("en-US")}
              valueTestId="battle-city-score"
            />
            <GameStatCard
              className="border-[var(--battle-city-border)]"
              label="Stage"
              labelClassName="text-[var(--battle-city-muted)]"
              value={stageLabel}
              valueTestId="battle-city-stage"
            />
            <GameStatCard
              className="border-[var(--battle-city-border)]"
              label="Lives"
              labelClassName="text-[var(--battle-city-muted)]"
              value={reserveLives}
              valueTestId="battle-city-lives"
            />
            <GameStatCard
              className="border-[var(--battle-city-border)]"
              label="Waiting"
              labelClassName="text-[var(--battle-city-muted)]"
              value={enemiesRemaining}
              valueTestId="battle-city-enemies-remaining"
            />
          </GameStatsBar>
        </GameSidebar>

        <GameBoardStage
          actions={
            <GameBoardActions
              backDisabled={isHelpVisible || isReplayRunPending}
              helpDisabled={isHelpVisible || isReplayRunPending}
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
                showStartScreen ||
                isReplayRunPending ||
                replaySaveStatus === "saving" ||
                pendingLeaderboardEntry !== null
              }
              testIdPrefix="battle-city"
            />
          }
        >
          <BattleCityBoard game={game}>
            {showStartScreen ? (
              <GameStartScreen testId="battle-city-start-screen">
                <GameStartScreenHeader
                  preview={<BattleCityStartPreview />}
                  status="Defend the phoenix through the classic 70-stage cycle"
                  title={BATTLE_CITY_DISPLAY_NAME}
                />
                <div
                  aria-label="Stage select"
                  className="flex items-center gap-2"
                  role="group"
                >
                  <Button
                    aria-label="Previous stage"
                    data-testid="battle-city-previous-stage-button"
                    disabled={isReplayRunPending}
                    onClick={() => selectReadyStage(-1)}
                    size="icon"
                    type="button"
                    variant="outline"
                  >
                    <ArrowLeftIcon aria-hidden="true" />
                  </Button>
                  <span
                    className="min-w-28 text-center text-lg font-semibold tabular-nums"
                    data-testid="battle-city-stage-select-value"
                  >
                    STAGE {game.stage}
                  </span>
                  <Button
                    aria-label="Next stage"
                    data-testid="battle-city-next-stage-button"
                    disabled={isReplayRunPending}
                    onClick={() => selectReadyStage(1)}
                    size="icon"
                    type="button"
                    variant="outline"
                  >
                    <ArrowRightIcon aria-hidden="true" />
                  </Button>
                </div>
                <Button
                  className="min-w-32"
                  data-testid="battle-city-start-button"
                  disabled={isReplayRunPending}
                  onClick={enterGame}
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
              <GameEndScreen testId="battle-city-end-screen">
                <GameEndLeaderboardContent
                  action={
                    <Button
                      className="w-full max-w-xs"
                      data-testid="battle-city-new-game-button"
                      disabled={
                        isReplayRunPending || replaySaveStatus === "saving"
                      }
                      onClick={showNewCampaignSelector}
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
                    metricLabel: `Reached Stage ${stageLabel}`,
                    metricValue: game.score.toLocaleString("en-US"),
                    metricValueTestId: "battle-city-final-score",
                    title: game.baseAlive ? "Out of tanks" : "Headquarters destroyed",
                  }}
                />
                <GameReplaySaveAction
                  errorMessage={
                    isReplayTooLong
                      ? "This replay is too long to save. Start a new game and try again."
                      : undefined
                  }
                  onSave={saveFinishedReplay}
                  replayReady={
                    !isReplayRunPending && finishedReplay !== null
                  }
                  status={replaySaveStatus}
                  testIdPrefix="battle-city"
                />
              </GameEndScreen>
            ) : game.status === "paused" ? (
              <BattleCityStatusOverlay
                actionLabel="Resume"
                onAction={toggleRunState}
                testId="battle-city-board-state"
                title="Paused"
              />
            ) : game.status === "stage-results" ? (
              <BattleCityStageResults
                killCounts={stageResultDisplay.killCounts}
                score={game.score}
                showTotal={stageResultDisplay.showTotal}
                stage={Number(stageLabel)}
              />
            ) : game.status === "stage-intro" ? (
              <BattleCityStatusOverlay
                testId="battle-city-stage-intro"
                title={`STAGE ${stageLabel}`}
              />
            ) : game.status === "game-over" ? (
              <BattleCityStatusOverlay
                testId="battle-city-game-over"
                title="GAME OVER"
              />
            ) : null}
          </BattleCityBoard>
        </GameBoardStage>
      </GameBoardColumn>

      {isHelpVisible ? (
        <GameHelpScreen
          onClose={closeHelp}
          sections={BATTLE_CITY_HELP_SECTIONS}
          testId="battle-city-help-screen"
          title={BATTLE_CITY_DISPLAY_NAME}
        />
      ) : null}
      {abandonDialogProps ? <GameAbandonDialog {...abandonDialogProps} /> : null}
    </GameShell>
  );
}

function BattleCityStartPreview() {
  return (
    <div
      aria-hidden="true"
      className="relative size-24 overflow-hidden rounded-md border border-[var(--battle-city-board-border)] bg-[var(--battle-city-board)] shadow-[0_0_22px_color-mix(in_oklch,var(--battle-city-player)_18%,transparent)]"
    >
      <span
        className="absolute bottom-2 left-2 size-10 bg-contain bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${getBattleCityAssetUrl(
            BATTLE_CITY_PLAYER_ASSET_BY_POWER_TIER[0],
          )})`,
        }}
      />
      <span
        className="absolute right-2 top-2 size-10 rotate-180 bg-contain bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${getBattleCityAssetUrl(
            "tank-enemy-armor.png",
          )})`,
        }}
      />
      <span
        className="absolute bottom-2 right-2 size-8 bg-contain bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${getBattleCityAssetUrl(
            "headquarters-intact.png",
          )})`,
        }}
      />
    </div>
  );
}

function BattleCityStatusOverlay({
  actionLabel,
  onAction,
  testId,
  title,
}: {
  actionLabel?: string;
  onAction?: () => void;
  testId: string;
  title: string;
}) {
  return (
    <div
      className="absolute inset-2 flex items-center justify-center rounded-[0.375rem] bg-[color-mix(in_oklch,var(--battle-city-board)_78%,transparent)] text-center text-[var(--battle-city-board-text)] backdrop-blur-[2px]"
      data-testid={testId}
    >
      <div className="flex flex-col items-center gap-3">
        <p className="text-2xl font-semibold tracking-normal">{title}</p>
        {actionLabel && onAction ? (
          <Button onClick={onAction} size="lg" type="button" variant="secondary">
            <PlayIcon data-icon="inline-start" />
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
