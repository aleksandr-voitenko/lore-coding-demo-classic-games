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
import { TetrisBoard, tetrominoCellClassNames } from "@/components/tetris-board";
import { TetrisNextPiecePreview } from "@/components/tetris-next-piece-preview";
import { TetrisReplayPlayer } from "@/components/tetris-replay-player";
import { Button } from "@/components/ui/button";
import {
  advanceTetrisGame,
  createInitialTetrisGame,
  getTetrisTickDelay,
  hardDropTetrisPiece,
  moveTetrisPiece,
  pauseTetrisGame,
  rotateTetrisPiece,
  softDropTetrisPiece,
  startTetrisGame,
  type TetrominoKind,
  type TetrisGameState,
  type TetrisStatus,
} from "@/lib/tetris-game-engine";
import { createGameLeaderboardKey } from "@/lib/leaderboard";
import {
  createTetrisReplayRandom,
  createTetrisReplayRun,
  saveTetrisReplay,
  TETRIS_REPLAY_GAME_ID,
  TETRIS_REPLAY_SCHEMA_VERSION,
  type TetrisReplayEvent,
  type TetrisReplayEventInput,
  type TetrisReplayPayload,
  type TetrisReplayRun,
} from "@/lib/tetris-replay";
import { cn } from "@/lib/utils";
import { useGameSession } from "@/hooks/use-game-session";

type TetrisGameProps = {
  initialBoardHeight?: number;
  initialBoardWidth?: number;
  initialStartLevel?: number;
  onBackToMenu?: () => void;
  onReplayBackToProfile?: () => void;
  replayMode?: "latest";
};

type TetrisReplayRecording = LiveGameReplayRecording<
  TetrisReplayEvent,
  TetrisReplayRun
> & {
  random: () => number;
};

const statusLabels: Record<TetrisStatus, string> = {
  lost: "Game over",
  paused: "Paused",
  ready: "Ready",
  running: "Running",
};

const TETRIS_HELP_SECTIONS: GameHelpSection[] = [
  {
    title: "Controls",
    controls: [
      {
        buttons: [{ text: "Enter", label: "Enter key" }],
        label: "Start game",
      },
      {
        buttons: [{ icon: ArrowLeftIcon, label: "Left" }, { text: "A", label: "A key" }],
        label: "Move left",
      },
      {
        buttons: [{ icon: ArrowRightIcon, label: "Right" }, { text: "D", label: "D key" }],
        label: "Move right",
      },
      {
        buttons: [{ icon: ArrowDownIcon, label: "Down" }, { text: "S", label: "S key" }],
        label: "Soft drop",
      },
      {
        buttons: [{ text: "Space", label: "Space key" }],
        label: "Hard drop",
      },
      {
        buttons: [
          { icon: ArrowUpIcon, label: "Up" },
          { text: "W", label: "W key" },
          { text: "X", label: "X key" },
        ],
        label: "Rotate clockwise",
      },
      {
        buttons: [{ text: "Z", label: "Z key" }],
        label: "Rotate counterclockwise",
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
      "Fit falling pieces into complete horizontal lines.",
      "Cleared lines score points and raise the level over time.",
      "The game ends when a new piece cannot enter the board.",
    ],
  },
];

const START_SCREEN_BLOCKS = [
  { kind: "T", x: 1, y: 0 },
  { kind: "T", x: 0, y: 1 },
  { kind: "T", x: 1, y: 1 },
  { kind: "T", x: 2, y: 1 },
  { kind: "O", x: 4, y: 1 },
  { kind: "O", x: 5, y: 1 },
  { kind: "O", x: 4, y: 2 },
  { kind: "O", x: 5, y: 2 },
  { kind: "I", x: 0, y: 4 },
  { kind: "I", x: 1, y: 4 },
  { kind: "I", x: 2, y: 4 },
  { kind: "I", x: 3, y: 4 },
] satisfies Array<{ kind: TetrominoKind; x: number; y: number }>;

function createRunningTetrisGame(
  {
    boardHeight,
    boardWidth,
    startLevel,
  }: Pick<TetrisGameState, "boardHeight" | "boardWidth" | "startLevel">,
  random = Math.random,
) {
  return {
    ...createInitialTetrisGame({
      boardHeight,
      boardWidth,
      random,
      startLevel,
    }),
    status: "running" as const,
  };
}

export function TetrisGame({
  initialBoardHeight,
  initialBoardWidth,
  initialStartLevel,
  onBackToMenu,
  onReplayBackToProfile,
  replayMode,
}: TetrisGameProps = {}) {
  if (replayMode === "latest") {
    return (
      <TetrisReplayPlayer
        onBackToProfile={onReplayBackToProfile ?? onBackToMenu ?? (() => undefined)}
      />
    );
  }

  return (
    <TetrisLiveGame
      initialBoardHeight={initialBoardHeight}
      initialBoardWidth={initialBoardWidth}
      initialStartLevel={initialStartLevel}
      onBackToMenu={onBackToMenu}
    />
  );
}

function TetrisLiveGame({
  initialBoardHeight,
  initialBoardWidth,
  initialStartLevel,
  onBackToMenu,
}: Pick<
  TetrisGameProps,
  "initialBoardHeight" | "initialBoardWidth" | "initialStartLevel" | "onBackToMenu"
> = {}) {
  const [game, setGame] = useState<TetrisGameState>(() =>
    createInitialTetrisGame({
      boardHeight: initialBoardHeight,
      boardWidth: initialBoardWidth,
      startLevel: initialStartLevel,
    }),
  );
  const gameRef = useRef(game);
  const {
    captureFinishedReplay,
    finishedReplay,
    isReplayRunPending,
    isReplayRunPendingRef,
    pauseRecordingClock,
    replayRecordingRef,
    replaySaveStatus,
    resumeRecordingClock,
    saveFinishedReplay,
    startReplayRecording,
  } = useLiveGameReplayRecording<TetrisReplayRecording, TetrisReplayPayload>({
    saveReplay: saveTetrisReplay,
  });
  const tickDelay = game.status === "running" ? getTetrisTickDelay(game.level) : null;
  const canPauseGame = game.status === "running" || game.status === "paused";
  const pauseActionLabel = game.status === "paused" ? "Resume" : "Pause";
  const showStartScreen = game.status === "ready";
  const showGameOverScreen = game.status === "lost";
  const showPauseScreen = game.status === "paused";
  const leaderboardKey = createGameLeaderboardKey("tetris", [
    { name: "board", value: `${game.boardWidth}x${game.boardHeight}` },
    { name: "level", value: game.startLevel },
  ]);
  const { completedSessionId } = useGameSession({
    active: game.status === "running",
    finalResult: game.status === "lost" ? "lost" : null,
    finalScore: game.score,
    gameId: "tetris",
    leaderboardKey,
    started: game.status !== "ready",
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
    pendingScore: showGameOverScreen ? game.score : null,
    testIdPrefix: "tetris",
  });

  const commitGame = useCallback((nextGame: TetrisGameState) => {
    gameRef.current = nextGame;
    setGame(nextGame);
  }, []);

  const updateCommittedGame = useCallback(
    (updateGame: (current: TetrisGameState) => TetrisGameState) => {
      const current = gameRef.current;
      const nextGame = updateGame(current);

      if (nextGame !== current) {
        commitGame(nextGame);
      }

      return nextGame;
    },
    [commitGame],
  );

  const startNewGame = useCallback(async () => {
    if (isReplayRunPendingRef.current) {
      return;
    }

    resetLeaderboardForm();
    const recording = await startReplayRecording(async () => {
      const run = await createTetrisReplayRun();
      const random = createTetrisReplayRandom(run.seed);

      return createLiveGameReplayRecording<
        TetrisReplayEvent,
        TetrisReplayRun,
        { random: () => number }
      >({
        random,
        run,
      });
    });

    if (recording === null) {
      return;
    }

    const nextGame = createRunningTetrisGame(gameRef.current, recording.random);

    appendLiveGameReplayEvent<TetrisReplayEvent, TetrisReplayRecording, TetrisReplayEventInput>(
      recording,
      { type: "start" },
    );
    commitGame(nextGame);
  }, [commitGame, isReplayRunPendingRef, resetLeaderboardForm, startReplayRecording]);

  const startGame = useCallback(() => {
    void startNewGame();
  }, [startNewGame]);

  const toggleRunState = useCallback(() => {
    updateCommittedGame((current) => {
      if (current.status === "running") {
        pauseRecordingClock();
        return pauseTetrisGame(current);
      }

      if (current.status === "paused") {
        resumeRecordingClock();
        return startTetrisGame(current);
      }

      void startNewGame();

      return current;
    });
  }, [pauseRecordingClock, resumeRecordingClock, startNewGame, updateCommittedGame]);

  const restartGame = useCallback(() => {
    void startNewGame();
  }, [startNewGame]);

  const moveLeft = useCallback(() => {
    updateCommittedGame((current) => {
      const nextGame = moveTetrisPiece(current, -1, 0);
      const recording = replayRecordingRef.current;

      if (recording !== null && current.status === "running" && nextGame !== current) {
        appendLiveGameReplayEvent(recording, { type: "moveLeft" });
      }

      return nextGame;
    });
  }, [replayRecordingRef, updateCommittedGame]);

  const moveRight = useCallback(() => {
    updateCommittedGame((current) => {
      const nextGame = moveTetrisPiece(current, 1, 0);
      const recording = replayRecordingRef.current;

      if (recording !== null && current.status === "running" && nextGame !== current) {
        appendLiveGameReplayEvent(recording, { type: "moveRight" });
      }

      return nextGame;
    });
  }, [replayRecordingRef, updateCommittedGame]);

  const softDrop = useCallback(() => {
    updateCommittedGame((current) => {
      const recording = replayRecordingRef.current;

      if (recording !== null && current.status === "running") {
        appendLiveGameReplayEvent(recording, { type: "softDrop" });

        return softDropTetrisPiece(current, { random: recording.random });
      }

      return softDropTetrisPiece(current);
    });
  }, [replayRecordingRef, updateCommittedGame]);

  const hardDrop = useCallback(() => {
    updateCommittedGame((current) => {
      const recording = replayRecordingRef.current;

      if (recording !== null && current.status === "running") {
        appendLiveGameReplayEvent(recording, { type: "hardDrop" });

        return hardDropTetrisPiece(current, { random: recording.random });
      }

      return hardDropTetrisPiece(current);
    });
  }, [replayRecordingRef, updateCommittedGame]);

  const rotateClockwise = useCallback(() => {
    updateCommittedGame((current) => {
      const nextGame = rotateTetrisPiece(current);
      const recording = replayRecordingRef.current;

      if (recording !== null && current.status === "running" && nextGame !== current) {
        appendLiveGameReplayEvent(recording, { type: "rotateClockwise" });
      }

      return nextGame;
    });
  }, [replayRecordingRef, updateCommittedGame]);

  const rotateCounterclockwise = useCallback(() => {
    updateCommittedGame((current) => {
      const nextGame = rotateTetrisPiece(current, "counterclockwise");
      const recording = replayRecordingRef.current;

      if (recording !== null && current.status === "running" && nextGame !== current) {
        appendLiveGameReplayEvent(recording, { type: "rotateCounterclockwise" });
      }

      return nextGame;
    });
  }, [replayRecordingRef, updateCommittedGame]);

  const advanceTetris = useCallback(() => {
    updateCommittedGame((current) => {
      const recording = replayRecordingRef.current;

      if (recording !== null && current.status === "running") {
        appendLiveGameReplayEvent(recording, { type: "advance" }, { advancesTick: true });

        return advanceTetrisGame(current, { random: recording.random });
      }

      return advanceTetrisGame(current);
    });
  }, [replayRecordingRef, updateCommittedGame]);

  const pauseGameForHelp = useCallback(() => {
    pauseRecordingClock();
    updateCommittedGame((current) => pauseTetrisGame(current));
  }, [pauseRecordingClock, updateCommittedGame]);

  const resumeGameAfterHelp = useCallback(() => {
    resumeRecordingClock();
    updateCommittedGame((current) => startTetrisGame(current));
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
      finalLevel: game.level,
      finalLines: game.lines,
      finalScore: game.score,
      finalStatus,
      finalTick: recording.tick,
      gameId: TETRIS_REPLAY_GAME_ID,
      leaderboardKey,
      runId: recording.run.id,
      schemaVersion: TETRIS_REPLAY_SCHEMA_VERSION,
      seed: recording.run.seed,
      startLevel: game.startLevel,
      startedAt: recording.startedAt,
    }));
  }, [
    captureFinishedReplay,
    finishedReplay,
    game.boardHeight,
    game.boardWidth,
    game.level,
    game.lines,
    game.score,
    game.startLevel,
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

  useEffect(() => {
    if (tickDelay === null) {
      return;
    }

    const tick = window.setInterval(advanceTetris, tickDelay);

    return () => window.clearInterval(tick);
  }, [advanceTetris, tickDelay]);

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

      if (event.key === "Enter" && (game.status === "ready" || game.status === "lost")) {
        event.preventDefault();
        startGame();
        return;
      }

      if (isGamePauseKey(event.key)) {
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

      if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") {
        event.preventDefault();
        softDrop();
        return;
      }

      if (
        event.key === "ArrowUp" ||
        event.key === "w" ||
        event.key === "W" ||
        event.key === "x" ||
        event.key === "X"
      ) {
        event.preventDefault();
        rotateClockwise();
        return;
      }

      if (event.key === "z" || event.key === "Z") {
        event.preventDefault();
        rotateCounterclockwise();
        return;
      }

      if (event.key === " ") {
        event.preventDefault();
        hardDrop();
      }
    }

    return registerGameKeyDown(handleKeyDown);
  }, [
    game.status,
    hardDrop,
    moveLeft,
    moveRight,
    pendingLeaderboardEntry,
    rotateClockwise,
    rotateCounterclockwise,
    softDrop,
    isHelpVisible,
    startGame,
    toggleRunState,
  ]);

  return (
    <GameShell className="bg-[var(--tetris-page)] text-[var(--tetris-ink)]">
      <GameBoardColumn className="w-[min(86vw,22.25rem,calc(50svh_-_6rem))]">
        <GameSidebar className="border-[var(--tetris-border)] bg-[var(--tetris-panel)]">
          <GameHeader
            status={statusLabels[game.status]}
            statusTestId="tetris-status"
            title="Tetris"
          />

          <GameStatsBar>
            <GameStatCard
              className="border-[var(--tetris-border)]"
              label="Score"
              labelClassName="text-[var(--tetris-muted)]"
              value={game.score}
              valueTestId="tetris-score"
            />
            <GameStatCard
              className="border-[var(--tetris-border)]"
              label="Lines"
              labelClassName="text-[var(--tetris-muted)]"
              value={game.lines}
              valueTestId="tetris-lines"
            />
            <GameStatCard
              className="border-[var(--tetris-border)]"
              label="Level"
              labelClassName="text-[var(--tetris-muted)]"
              value={game.level}
              valueTestId="tetris-level"
            />
            <div className="flex min-w-0 flex-col gap-2 rounded-md border border-[var(--tetris-border)] p-2 sm:p-3">
              <dt className="text-xs font-medium text-[var(--tetris-muted)]">Next</dt>
              <dd>
                <TetrisNextPiecePreview kind={game.nextPieceKind} />
              </dd>
            </div>
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
              testIdPrefix="tetris"
            />
          }
        >
          <TetrisBoard game={game} statusLabel={statusLabels[game.status]}>
            {showStartScreen ? (
              <GameStartScreen testId="tetris-start-screen">
                <GameStartScreenHeader
                  preview={
                    <div className="grid grid-cols-6 gap-1" aria-hidden="true">
                      {Array.from({ length: 30 }, (_, index) => {
                        const x = index % 6;
                        const y = Math.floor(index / 6);
                        const block = START_SCREEN_BLOCKS.find(
                          (candidate) => candidate.x === x && candidate.y === y,
                        );

                        return (
                          <span
                            className={cn(
                              "size-3 rounded-[0.16rem] bg-[var(--tetris-grid)]",
                              block && tetrominoCellClassNames[block.kind],
                            )}
                            key={`${x}:${y}`}
                          />
                        );
                      })}
                    </div>
                  }
                  status={statusLabels[game.status]}
                  title="Tetris"
                />
                <Button
                  className="min-w-32"
                  data-testid="tetris-start-button"
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
            ) : showGameOverScreen ? (
              <GameEndScreen testId="tetris-game-over-screen">
                <GameEndLeaderboardContent
                  action={
                    <div className="flex w-full max-w-xs flex-col items-center gap-2">
                      <Button
                        className="w-full"
                        data-testid="tetris-new-game-button"
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
                    metricValueTestId: "tetris-final-score",
                    title: "Game over",
                  }}
                />
                <GameReplaySaveAction
                  onSave={saveFinishedReplay}
                  replayReady={finishedReplay !== null}
                  status={replaySaveStatus}
                  testIdPrefix="tetris"
                />
              </GameEndScreen>
            ) : showPauseScreen ? (
              <div
                className="absolute inset-2 flex items-center justify-center rounded-[0.375rem] bg-[color-mix(in_oklch,var(--tetris-board)_72%,transparent)] text-center text-[var(--tetris-board-text)] backdrop-blur-[2px]"
                data-testid="tetris-board-state"
              >
                <div className="flex flex-col items-center gap-3">
                  <p className="text-2xl font-semibold tracking-normal">
                    Paused
                  </p>
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
                sections={TETRIS_HELP_SECTIONS}
                testId="tetris-help-screen"
                title="Tetris"
              />
            ) : null}
          </TetrisBoard>
        </GameBoardStage>
      </GameBoardColumn>
      {abandonDialogProps ? <GameAbandonDialog {...abandonDialogProps} /> : null}
    </GameShell>
  );
}
