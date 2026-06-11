"use client";

import { PlayIcon, RotateCcwIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  isGamePauseKey,
  registerGameKeyDown,
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
  type ReplaySaveStatus,
} from "@/components/game-layout";
import {
  createGameReplayRecordingClock,
  getGameReplayRecordingElapsedMs,
  pauseGameReplayRecordingClock,
  resumeGameReplayRecordingClock,
  type GameReplayClockedRecording,
} from "@/components/game-replay-timing";
import { GameLeaderboardPanel } from "@/components/game-leaderboard";
import { useGameLeaderboardPresenter } from "@/components/game-leaderboard-presenter";
import { SimonBoard } from "@/components/simon-board";
import { SimonReplayPlayer } from "@/components/simon-replay-player";
import { Button } from "@/components/ui/button";
import {
  advanceSimonMiss,
  advanceSimonRound,
  advanceSimonPlayback,
  clearSimonActivePad,
  createInitialSimonGame,
  getSimonInputFlashDelay,
  getSimonMissFeedbackDelay,
  getSimonPlaybackDelay,
  getSimonRoundCompleteDelay,
  pauseSimonGame,
  playSimonPad,
  restartSimonGame,
  startSimonGame,
  type SimonGameState,
  type SimonPadId,
  type SimonStatus,
} from "@/lib/simon-game-engine";
import { createGameLeaderboardKey } from "@/lib/leaderboard";
import {
  createSimonReplayRandom,
  createSimonReplayRun,
  saveSimonReplay,
  SIMON_REPLAY_GAME_ID,
  SIMON_REPLAY_SCHEMA_VERSION,
  type SimonReplayEvent,
  type SimonReplayEventInput,
  type SimonReplayPayload,
  type SimonReplayRun,
} from "@/lib/simon-replay";
import { useGameSession } from "@/hooks/use-game-session";

type SimonGameProps = {
  initialWinTarget?: number;
  onBackToMenu?: () => void;
  onReplayBackToProfile?: () => void;
  replayMode?: "latest";
};

type SimonReplayRecording = GameReplayClockedRecording & {
  events: SimonReplayEvent[];
  nextSeq: number;
  random: () => number;
  run: SimonReplayRun;
  startedAt: string;
  tick: number;
};

const statusLabels: Record<SimonStatus, string> = {
  correct: "Correct",
  input: "Repeat",
  lost: "Game over",
  missed: "Miss",
  paused: "Paused",
  ready: "Ready",
  showing: "Watch",
  won: "Sequence cleared",
};

const SIMON_HELP_SECTIONS: GameHelpSection[] = [
  {
    title: "Controls",
    controls: [
      {
        buttons: [{ text: "Enter", label: "Enter key" }],
        label: "Start game",
      },
      {
        buttons: [{ text: "1", label: "1 key" }, { text: "Q", label: "Q key" }],
        label: "Green pad",
      },
      {
        buttons: [{ text: "2", label: "2 key" }, { text: "W", label: "W key" }],
        label: "Red pad",
      },
      {
        buttons: [{ text: "3", label: "3 key" }, { text: "E", label: "E key" }],
        label: "Yellow pad",
      },
      {
        buttons: [{ text: "4", label: "4 key" }, { text: "R", label: "R key" }],
        label: "Blue pad",
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
      "Watch the highlighted sequence, then repeat it in order.",
      "Each cleared round adds one more pad to the pattern.",
      "One wrong pad ends the game; clear the target sequence to win.",
    ],
  },
];

const keyToSimonPad: Record<string, SimonPadId> = {
  "1": "green",
  "2": "red",
  "3": "yellow",
  "4": "blue",
  e: "yellow",
  E: "yellow",
  q: "green",
  Q: "green",
  r: "blue",
  R: "blue",
  w: "red",
  W: "red",
};

function createReadySimonGame(winTarget?: number) {
  return createInitialSimonGame({ winTarget });
}

function appendSimonReplayEvent(
  recording: SimonReplayRecording,
  event: SimonReplayEventInput,
) {
  recording.events.push({
    ...event,
    elapsedMs: getGameReplayRecordingElapsedMs(recording),
    seq: recording.nextSeq,
    tick: recording.tick,
  } as unknown as SimonReplayEvent);
  recording.nextSeq += 1;
  recording.tick += 1;
}

export function SimonGame({
  initialWinTarget,
  onBackToMenu,
  onReplayBackToProfile,
  replayMode,
}: SimonGameProps = {}) {
  if (replayMode === "latest") {
    return (
      <SimonReplayPlayer
        onBackToProfile={onReplayBackToProfile ?? onBackToMenu ?? (() => undefined)}
      />
    );
  }

  return (
    <SimonLiveGame initialWinTarget={initialWinTarget} onBackToMenu={onBackToMenu} />
  );
}

function SimonLiveGame({
  initialWinTarget,
  onBackToMenu,
}: Pick<SimonGameProps, "initialWinTarget" | "onBackToMenu"> = {}) {
  const [game, setGame] = useState<SimonGameState>(() =>
    createReadySimonGame(initialWinTarget),
  );
  const [finishedReplay, setFinishedReplay] = useState<SimonReplayPayload | null>(null);
  const [isReplayRunPending, setIsReplayRunPending] = useState(false);
  const [replaySaveStatus, setReplaySaveStatus] = useState<ReplaySaveStatus>("idle");
  const gameRef = useRef(game);
  const isReplayRunPendingRef = useRef(false);
  const replayRecordingRef = useRef<SimonReplayRecording | null>(null);
  const playbackDelay = game.status === "showing" ? getSimonPlaybackDelay() : null;
  const roundCompleteDelay =
    game.status === "correct" && game.activePad === null
      ? getSimonRoundCompleteDelay()
      : null;
  const missFeedbackDelay =
    game.status === "missed" && game.activePad === null
      ? getSimonMissFeedbackDelay()
      : null;
  const canPauseGame =
    game.status === "showing" ||
    game.status === "input" ||
    game.status === "correct" ||
    game.status === "missed" ||
    game.status === "paused";
  const pauseActionLabel = game.status === "paused" ? "Resume" : "Pause";
  const progressLabel = useMemo(() => {
    if (game.status === "input") {
      return `${game.inputIndex}/${game.sequence.length}`;
    }

    if (game.status === "showing") {
      return `${Math.min(game.playbackIndex + 1, game.sequence.length)}/${game.sequence.length}`;
    }

    return `${game.score}/${game.winTarget}`;
  }, [game.inputIndex, game.playbackIndex, game.score, game.sequence.length, game.status, game.winTarget]);
  const isTurnFeedbackWaitingForFlash =
    (game.status === "correct" || game.status === "missed") && game.activePad !== null;
  const statusLabel = isTurnFeedbackWaitingForFlash ? statusLabels.input : statusLabels[game.status];
  const showStartScreen = game.status === "ready";
  const showCorrectFeedback = game.status === "correct" && game.activePad === null;
  const showMissFeedback = game.status === "missed" && game.activePad === null;
  const showPauseScreen = game.status === "paused";
  const showEndScreen = game.status === "lost" || game.status === "won";
  const leaderboardKey = createGameLeaderboardKey("simon", [
    { name: "target", value: game.winTarget },
  ]);
  const isSimonActive =
    game.status === "showing" ||
    game.status === "input" ||
    game.status === "correct" ||
    game.status === "missed";
  const { completedSessionId } = useGameSession({
    active: isSimonActive,
    finalResult:
      game.status === "lost" || game.status === "won" ? game.status : null,
    finalScore: game.score,
    gameId: "simon",
    leaderboardKey,
    started: canPauseGame || showEndScreen,
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
    testIdPrefix: "simon",
  });

  const commitGame = useCallback((nextGame: SimonGameState) => {
    gameRef.current = nextGame;
    setGame(nextGame);
  }, []);

  const updateCommittedGame = useCallback(
    (updateGame: (current: SimonGameState) => SimonGameState) => {
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
      const run = await createSimonReplayRun();
      const random = createSimonReplayRandom(run.seed);
      const recording: SimonReplayRecording = {
        clock: createGameReplayRecordingClock(),
        events: [],
        nextSeq: 0,
        random,
        run,
        startedAt: new Date().toISOString(),
        tick: 0,
      };

      appendSimonReplayEvent(recording, { type: "start" });
      replayRecordingRef.current = recording;
      commitGame(
        restart
          ? restartSimonGame(gameRef.current, { random })
          : startSimonGame(gameRef.current, { random }),
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

    const current = gameRef.current;

    if (current.status === "paused") {
      resumeGameReplayRecordingClock(replayRecordingRef.current);
      updateCommittedGame((gameState) => startSimonGame(gameState));
      return;
    }

    void startReplayRun({
      restart: current.status === "lost" || current.status === "won",
    });
  }, [resetLeaderboardForm, startReplayRun, updateCommittedGame]);

  const toggleRunState = useCallback(() => {
    resetLeaderboardForm();
    const current = gameRef.current;

    if (
      current.status === "showing" ||
      current.status === "input" ||
      current.status === "correct" ||
      current.status === "missed"
    ) {
      pauseGameReplayRecordingClock(replayRecordingRef.current);
      updateCommittedGame((gameState) => pauseSimonGame(gameState));
      return;
    }

    if (current.status === "paused") {
      resumeGameReplayRecordingClock(replayRecordingRef.current);
      updateCommittedGame((gameState) => startSimonGame(gameState));
      return;
    }

    startGame();
  }, [resetLeaderboardForm, startGame, updateCommittedGame]);

  const restartGame = useCallback(() => {
    if (isReplayRunPendingRef.current) {
      return;
    }

    replayRecordingRef.current = null;
    resetLeaderboardForm();
    void startReplayRun({ restart: true });
  }, [resetLeaderboardForm, startReplayRun]);

  const pressPad = useCallback((pad: SimonPadId) => {
    updateCommittedGame((current) => {
      const nextGame = playSimonPad(current, pad);
      const recording = replayRecordingRef.current;

      if (nextGame !== current && current.status === "input" && recording !== null) {
        appendSimonReplayEvent(recording, {
          pad,
          type: "pad",
        });
      }

      return nextGame;
    });
  }, [updateCommittedGame]);

  const pauseGameForHelp = useCallback(() => {
    pauseGameReplayRecordingClock(replayRecordingRef.current);
    updateCommittedGame((current) => pauseSimonGame(current));
  }, [updateCommittedGame]);

  const resumeGameAfterHelp = useCallback(() => {
    resumeGameReplayRecordingClock(replayRecordingRef.current);
    updateCommittedGame((current) => startSimonGame(current));
  }, [updateCommittedGame]);

  const saveFinishedReplay = useCallback(async () => {
    if (finishedReplay === null || replaySaveStatus === "saving") {
      return;
    }

    setReplaySaveStatus("saving");

    try {
      await saveSimonReplay(finishedReplay);
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

    const replay: SimonReplayPayload = {
      events: [...recording.events],
      finalInputIndex: game.inputIndex,
      finalRound: game.round,
      finalScore: game.score,
      finalSequenceLength: game.sequence.length,
      finalStatus: game.status,
      finalTick: recording.tick,
      gameId: SIMON_REPLAY_GAME_ID,
      leaderboardKey,
      runId: recording.run.id,
      schemaVersion: SIMON_REPLAY_SCHEMA_VERSION,
      seed: recording.run.seed,
      startedAt: recording.startedAt,
      winTarget: game.winTarget,
    };

    replayRecordingRef.current = null;
    setFinishedReplay(replay);
  }, [
    finishedReplay,
    game.inputIndex,
    game.round,
    game.score,
    game.sequence.length,
    game.status,
    game.winTarget,
    leaderboardKey,
  ]);

  const { closeHelp, isHelpVisible, openHelp } = useGameHelpScreen({
    isGameActive: isSimonActive,
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
    if (playbackDelay === null) {
      return;
    }

    const playbackTimer = window.setTimeout(() => {
      updateCommittedGame((current) => {
        const recording = replayRecordingRef.current;

        if (recording !== null && current.status === "showing") {
          appendSimonReplayEvent(recording, { type: "playback" });
        }

        return advanceSimonPlayback(current);
      });
    }, playbackDelay);

    return () => window.clearTimeout(playbackTimer);
  }, [game.activePad, game.playbackIndex, playbackDelay, updateCommittedGame]);

  useEffect(() => {
    if (
      (game.status !== "input" &&
        game.status !== "correct" &&
        game.status !== "missed") ||
      game.activePad === null
    ) {
      return;
    }

    const flashTimer = window.setTimeout(() => {
      updateCommittedGame((current) => {
        const recording = replayRecordingRef.current;

        if (
          recording !== null &&
          (current.status === "input" ||
            current.status === "correct" ||
            current.status === "missed") &&
          current.activePad !== null
        ) {
          appendSimonReplayEvent(recording, { type: "clear" });
        }

        return clearSimonActivePad(current);
      });
    }, getSimonInputFlashDelay());

    return () => window.clearTimeout(flashTimer);
  }, [game.activePad, game.status, updateCommittedGame]);

  useEffect(() => {
    if (roundCompleteDelay === null) {
      return;
    }

    const roundCompleteTimer = window.setTimeout(() => {
      updateCommittedGame((current) => {
        const recording = replayRecordingRef.current;

        if (recording !== null && current.status === "correct") {
          appendSimonReplayEvent(recording, { type: "advanceRound" });

          return advanceSimonRound(current, { random: recording.random });
        }

        return advanceSimonRound(current, { random: Math.random });
      });
    }, roundCompleteDelay);

    return () => window.clearTimeout(roundCompleteTimer);
  }, [roundCompleteDelay, updateCommittedGame]);

  useEffect(() => {
    if (missFeedbackDelay === null) {
      return;
    }

    const missFeedbackTimer = window.setTimeout(() => {
      updateCommittedGame((current) => {
        const recording = replayRecordingRef.current;

        if (recording !== null && current.status === "missed") {
          appendSimonReplayEvent(recording, { type: "advanceMiss" });
        }

        return advanceSimonMiss(current);
      });
    }, missFeedbackDelay);

    return () => window.clearTimeout(missFeedbackTimer);
  }, [missFeedbackDelay, updateCommittedGame]);

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
        game.status !== "showing" &&
        game.status !== "input" &&
        game.status !== "correct" &&
        game.status !== "missed"
      ) {
        event.preventDefault();
        startGame();
        return;
      }

      if (isGamePauseKey(event.key)) {
        event.preventDefault();
        toggleRunState();
        return;
      }

      const pad = keyToSimonPad[event.key];

      if (pad) {
        event.preventDefault();
        pressPad(pad);
      }
    }

    return registerGameKeyDown(handleKeyDown);
  }, [game.status, isHelpVisible, pendingLeaderboardEntry, pressPad, startGame, toggleRunState]);

  return (
    <GameShell className="bg-[var(--simon-page)] text-[var(--simon-ink)]">
      <GameBoardColumn className="w-[min(92vw,37.25rem,calc(100svh_-_12rem))]">
        <GameSidebar className="simon-chrome-border bg-[var(--simon-panel)]">
          <GameHeader status={statusLabel} statusTestId="simon-status" title="Simon" />

          <GameStatsBar>
            <GameStatCard
              className="simon-chrome-border"
              label="Score"
              labelClassName="text-[var(--simon-muted)]"
              value={game.score}
              valueTestId="simon-score"
            />
            <GameStatCard
              className="simon-chrome-border"
              label="Round"
              labelClassName="text-[var(--simon-muted)]"
              value={game.round}
              valueTestId="simon-round"
            />
            <GameStatCard
              className="simon-chrome-border"
              label="Progress"
              labelClassName="text-[var(--simon-muted)]"
              value={progressLabel}
              valueTestId="simon-progress"
            />
            <GameStatCard
              className="simon-chrome-border"
              label="Target"
              labelClassName="text-[var(--simon-muted)]"
              value={game.winTarget}
              valueTestId="simon-target"
            />
            <GameStatCard
              className="simon-chrome-border"
              label="Speed"
              labelClassName="text-[var(--simon-muted)]"
              value={playbackDelay === null ? "0" : Math.round(1000 / playbackDelay)}
              valueTestId="simon-speed"
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
              testIdPrefix="simon"
            />
          }
        >
          <SimonBoard game={game} onPadPress={pressPad} statusLabel={statusLabel}>
          {showStartScreen ? (
            <GameStartScreen testId="simon-start-screen">
              <GameStartScreenHeader
                preview={
                  <div
                    className="simon-board-ring-border grid size-20 grid-cols-2 gap-1 rounded-full border-8 bg-[var(--simon-board-ring)] p-1"
                    aria-hidden="true"
                  >
                    <span className="rounded-tl-full bg-[#25a75a]" />
                    <span className="rounded-tr-full bg-[#d73548]" />
                    <span className="rounded-bl-full bg-[#f0bd38]" />
                    <span className="rounded-br-full bg-[#1d7ed0]" />
                  </div>
                }
                status={statusLabels[game.status]}
                title="Simon"
              />
              <Button
                className="min-w-32"
                data-testid="simon-start-button"
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
          ) : showCorrectFeedback ? (
            <div
              className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-[0.375rem] text-center text-[var(--simon-feedback-ink)]"
              data-testid="simon-correct-feedback"
              role="status"
            >
              <p className="simon-turn-feedback simon-feedback-border rounded-md border bg-[var(--simon-feedback-panel)] px-5 py-3 text-3xl font-black tracking-normal shadow-[0_18px_46px_var(--simon-feedback-shadow)] backdrop-blur-[2px] sm:text-4xl">
                CORRECT!
              </p>
            </div>
          ) : showMissFeedback ? (
            <div
              className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-[0.375rem] text-center text-[var(--simon-feedback-ink)]"
              data-testid="simon-miss-feedback"
              role="status"
            >
              <p className="simon-turn-feedback simon-miss-border rounded-md border bg-[var(--simon-miss-panel)] px-5 py-3 text-3xl font-black tracking-normal text-[var(--simon-miss)] shadow-[0_18px_46px_color-mix(in_oklch,var(--simon-miss)_24%,transparent)] backdrop-blur-[2px] sm:text-4xl">
                MISS!
              </p>
            </div>
          ) : showEndScreen ? (
            <GameEndScreen testId="simon-end-screen">
              <GameEndLeaderboardContent
                action={
                  <div className="flex w-full max-w-xs flex-col items-center gap-2">
                    <Button
                      className="w-full"
                      data-testid="simon-new-game-button"
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
                  metricValueTestId: "simon-final-score",
                  title: game.status === "won" ? "Sequence cleared" : "Game over",
                }}
              />
              <GameReplaySaveAction
                onSave={saveFinishedReplay}
                replayReady={finishedReplay !== null}
                status={replaySaveStatus}
                testIdPrefix="simon"
              />
            </GameEndScreen>
          ) : showPauseScreen ? (
            <div
              className="absolute inset-3 flex items-center justify-center rounded-[0.375rem] bg-[var(--simon-pause-scrim)] text-center text-[var(--simon-feedback-ink)] backdrop-blur-[2px]"
              data-testid="simon-board-state"
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
              sections={SIMON_HELP_SECTIONS}
              testId="simon-help-screen"
              title="Simon"
            />
          ) : null}
          </SimonBoard>
        </GameBoardStage>
      </GameBoardColumn>
      {abandonDialogProps ? <GameAbandonDialog {...abandonDialogProps} /> : null}
    </GameShell>
  );
}
