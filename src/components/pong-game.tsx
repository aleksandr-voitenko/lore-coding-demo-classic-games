"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  PlayIcon,
  RotateCcwIcon,
  SaveIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import {
  createPongPaddleMovementState,
  getPongPaddleMovementKey,
  type PongPaddleMovementDirection,
} from "@/components/pong-paddle-input";
import { PongBoard } from "@/components/pong-board";
import { PongReplayPlayer } from "@/components/pong-replay-player";
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
import {
  createPongReplayRun,
  savePongReplay,
  PONG_REPLAY_GAME_ID,
  PONG_REPLAY_SCHEMA_VERSION,
  type PongReplayEvent,
  type PongReplayEventInput,
  type PongReplayPayload,
  type PongReplayRun,
} from "@/lib/pong-replay";
import { createGameLeaderboardKey } from "@/lib/leaderboard";
import { useGameSession } from "@/hooks/use-game-session";

type PongGameProps = {
  initialBoardHeight?: number;
  initialBoardWidth?: number;
  initialTargetScore?: number;
  onBackToMenu?: () => void;
  onReplayBackToProfile?: () => void;
  replayMode?: "latest";
};

type ReplaySaveStatus = "failed" | "idle" | "saved" | "saving";

type PongReplayRecording = {
  events: PongReplayEvent[];
  nextSeq: number;
  run: PongReplayRun;
  startedAt: string;
  tick: number;
};

const statusLabels: Record<PongStatus, string> = {
  lost: "Computer wins",
  paused: "Paused",
  ready: "Ready",
  running: "Running",
  won: "You won",
};

const PONG_PADDLE_MOVE_INTERVAL_MS = getPongTickDelay();

function appendPongReplayEvent(
  recording: PongReplayRecording,
  event: PongReplayEventInput,
) {
  recording.events.push({
    ...event,
    seq: recording.nextSeq,
    tick: recording.tick,
  } as PongReplayEvent);
  recording.nextSeq += 1;

  if (event.type === "advance") {
    recording.tick += 1;
  }
}

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
          buttons: [{ text: "P", label: "P key" }],
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
  onReplayBackToProfile,
  replayMode,
}: PongGameProps = {}) {
  if (replayMode === "latest") {
    return (
      <PongReplayPlayer
        onBackToProfile={onReplayBackToProfile ?? onBackToMenu ?? (() => undefined)}
      />
    );
  }

  return (
    <PongLiveGame
      initialBoardHeight={initialBoardHeight}
      initialBoardWidth={initialBoardWidth}
      initialTargetScore={initialTargetScore}
      onBackToMenu={onBackToMenu}
    />
  );
}

function PongLiveGame({
  initialBoardHeight,
  initialBoardWidth,
  initialTargetScore,
  onBackToMenu,
}: Pick<
  PongGameProps,
  "initialBoardHeight" | "initialBoardWidth" | "initialTargetScore" | "onBackToMenu"
> = {}) {
  const [game, setGame] = useState<PongGameState>(() =>
    createInitialPongGame({
      boardHeight: initialBoardHeight,
      boardWidth: initialBoardWidth,
      targetScore: initialTargetScore,
    }),
  );
  const [finishedReplay, setFinishedReplay] = useState<PongReplayPayload | null>(null);
  const [isReplayRunPending, setIsReplayRunPending] = useState(false);
  const [replaySaveStatus, setReplaySaveStatus] = useState<ReplaySaveStatus>("idle");
  const gameRef = useRef(game);
  const isReplayRunPendingRef = useRef(false);
  const preStartReplayEventsRef = useRef<PongReplayEventInput[]>([]);
  const replayRecordingRef = useRef<PongReplayRecording | null>(null);
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
  const { completedSessionId } = useGameSession({
    active: game.status === "running",
    finalResult:
      game.status === "lost" || game.status === "won" ? game.status : null,
    finalScore: game.remainingScore,
    gameId: "pong",
    leaderboardKey,
    started: isUnfinishedMatch || showEndScreen,
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
    pendingScore: showEndScreen ? game.remainingScore : null,
    testIdPrefix: "pong",
  });

  const commitGame = useCallback((nextGame: PongGameState) => {
    gameRef.current = nextGame;
    setGame(nextGame);
  }, []);

  const updateCommittedGame = useCallback(
    (updateGame: (current: PongGameState) => PongGameState) => {
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
      const run = await createPongReplayRun();
      const recording: PongReplayRecording = {
        events: [],
        nextSeq: 0,
        run,
        startedAt: new Date().toISOString(),
        tick: 0,
      };

      preStartReplayEventsRef.current.forEach((event) => {
        appendPongReplayEvent(recording, event);
      });
      appendPongReplayEvent(recording, { type: "start" });
      preStartReplayEventsRef.current = [];
      replayRecordingRef.current = recording;
      commitGame(
        restart ? restartPongGame(gameRef.current) : startPongGame(gameRef.current),
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
      appendPongReplayEvent(recording, { type: "start" });
      updateCommittedGame((current) => startPongGame(current));

      return;
    }

    void startReplayRun();
  }, [resetLeaderboardForm, startReplayRun, updateCommittedGame]);

  const toggleRunState = useCallback(() => {
    const current = gameRef.current;

    if (current.status === "running") {
      resetLeaderboardForm();
      updateCommittedGame((gameState) => pausePongGame(gameState));
      return;
    }

    if (current.status === "paused") {
      resetLeaderboardForm();
      updateCommittedGame((gameState) => startPongGame(gameState));
      return;
    }

    startGame();
  }, [resetLeaderboardForm, startGame, updateCommittedGame]);

  const movePaddle = useCallback(
    (direction: PongPaddleMovementDirection) => {
      updateCommittedGame((current) => {
        const nextGame =
          direction === "up" ? movePongPlayerUp(current) : movePongPlayerDown(current);
        const event: PongReplayEventInput =
          direction === "up" ? { type: "moveUp" } : { type: "moveDown" };
        const movedPaddle = nextGame.playerPaddle.y !== current.playerPaddle.y;
        const recording = replayRecordingRef.current;

        if (movedPaddle && recording !== null) {
          appendPongReplayEvent(recording, event);
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

  const advancePong = useCallback(() => {
    updateCommittedGame((current) => {
      const recording = replayRecordingRef.current;

      if (recording !== null && current.status === "running") {
        appendPongReplayEvent(recording, { type: "advance" });
      }

      return advancePongGame(current);
    });
  }, [updateCommittedGame]);

  const decrementRemainingScore = useCallback(() => {
    updateCommittedGame((current) => {
      const recording = replayRecordingRef.current;

      if (recording !== null && current.status === "running") {
        appendPongReplayEvent(recording, { type: "scoreTick" });
      }

      return decrementPongRemainingScore(current);
    });
  }, [updateCommittedGame]);

  const pauseGameForHelp = useCallback(() => {
    updateCommittedGame((current) => pausePongGame(current));
  }, [updateCommittedGame]);

  const resumeGameAfterHelp = useCallback(() => {
    updateCommittedGame((current) => startPongGame(current));
  }, [updateCommittedGame]);

  const saveFinishedReplay = useCallback(async () => {
    if (finishedReplay === null || replaySaveStatus === "saving") {
      return;
    }

    setReplaySaveStatus("saving");

    try {
      await savePongReplay(finishedReplay);
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

    const replay: PongReplayPayload = {
      boardHeight: game.boardHeight,
      boardWidth: game.boardWidth,
      events: [...recording.events],
      finalCpuScore: game.score.cpu,
      finalPlayerScore: game.score.player,
      finalScore: game.remainingScore,
      finalStatus: game.status,
      finalTick: recording.tick,
      gameId: PONG_REPLAY_GAME_ID,
      leaderboardKey,
      runId: recording.run.id,
      schemaVersion: PONG_REPLAY_SCHEMA_VERSION,
      seed: recording.run.seed,
      startedAt: recording.startedAt,
      targetScore: game.targetScore,
    };

    replayRecordingRef.current = null;
    preStartReplayEventsRef.current = [];
    setFinishedReplay(replay);
  }, [
    finishedReplay,
    game.boardHeight,
    game.boardWidth,
    game.remainingScore,
    game.score.cpu,
    game.score.player,
    game.status,
    game.targetScore,
    leaderboardKey,
  ]);

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

  const {
    beginMovement: beginPaddleMovement,
    endMovement: endPaddleMovement,
    resetMovement: resetPaddleMovement,
  } = useHeldDirectionMovementController({
    createState: createPongPaddleMovementState,
    intervalMs: PONG_PADDLE_MOVE_INTERVAL_MS,
    isMovementDisabled:
      isHelpVisible ||
      isAbandonDialogVisible ||
      isReplayRunPending ||
      pendingLeaderboardEntry !== null ||
      game.status === "lost" ||
      game.status === "won",
    move: movePaddle,
  });

  const restartGame = useCallback(() => {
    if (isReplayRunPendingRef.current) {
      return;
    }

    resetPaddleMovement();
    preStartReplayEventsRef.current = [];
    replayRecordingRef.current = null;
    void startReplayRun({ restart: true });
  }, [resetPaddleMovement, startReplayRun]);

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

      if (isGamePauseKey(event.key)) {
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
      <GameBoardColumn className="w-[min(92vw,37.25rem,calc(75svh_-_9rem))]">
        <GameSidebar className="border-[var(--pong-border)] bg-[var(--pong-panel)]">
          <GameHeader status={statusLabel} statusTestId="pong-status" title="Pong" />

          <GameStatsBar>
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
                isReplayRunPending || showStartScreen || pendingLeaderboardEntry !== null
              }
              testIdPrefix="pong"
            />
          }
        >
          <PongBoard game={game} statusLabel={statusLabel}>
          {showStartScreen ? (
            <GameStartScreen testId="pong-start-screen">
              <GameStartScreenHeader
                preview={
                  <div
                    className="relative h-24 w-36 rounded-md border border-[#23415e] bg-[#06101f]"
                    aria-hidden="true"
                  >
                    <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 border-l border-dashed border-[#e5f2ff]/60" />
                    <span className="absolute left-4 top-7 h-10 w-1.5 rounded-full bg-[#38bdf8]" />
                    <span className="absolute right-4 top-7 h-10 w-1.5 rounded-full bg-[#f472b6]" />
                    <span className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f8fafc]" />
                  </div>
                }
                status={`First to ${game.targetScore}`}
                title="Pong"
              />
              <Button
                className="min-w-32"
                data-testid="pong-start-button"
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
                  disabled={isReplayRunPending}
                  onClick={startGame}
                  size="lg"
                  type="button"
                  variant="secondary"
                >
                  <PlayIcon data-icon="inline-start" />
                  {isReplayRunPending ? "Starting" : "Serve"}
                </Button>
              </div>
            </div>
          ) : showEndScreen ? (
            <GameEndScreen testId="pong-end-screen">
              <GameEndLeaderboardContent
                action={
                  <Button
                    className="min-w-36"
                    data-testid="pong-new-game-button"
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
                  metricLabel: "Remaining score",
                  metricValue: game.remainingScore,
                  metricValueTestId: "pong-final-score",
                  title: game.status === "won" ? "Match won" : "Match lost",
                }}
              />
              <div className="flex w-full max-w-xs flex-col items-center gap-2">
                <Button
                  className="w-full"
                  data-testid="pong-save-replay-button"
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
                    data-testid="pong-save-replay-error"
                  >
                    Could not save replay. Sign in and try again.
                  </p>
                ) : null}
              </div>
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
              onClose={closeHelp}
              sections={helpSections}
              testId="pong-help-screen"
              title="Pong"
            />
          ) : null}
          </PongBoard>
        </GameBoardStage>
      </GameBoardColumn>
      {abandonDialogProps ? <GameAbandonDialog {...abandonDialogProps} /> : null}
    </GameShell>
  );
}
