"use client";

import { PlayIcon, RotateCcwIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { registerGameKeyDown, shouldIgnoreGameKeyDown } from "@/components/game-input";
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
  createGameReplayRecordingClock,
  createLiveGameReplayRecording,
  useLiveGameReplayRecording,
  type LiveGameReplayRecording,
} from "@/components/game-replay-recording";
import { getGameReplayRecordingElapsedMs } from "@/components/game-replay-timing";
import { GameLeaderboardPanel } from "@/components/game-leaderboard";
import { MinesweeperBoard, MinesweeperStartPreview } from "@/components/minesweeper-board";
import { MinesweeperReplayPlayer } from "@/components/minesweeper-replay-player";
import { Button } from "@/components/ui/button";
import {
  createInitialMinesweeperGame,
  getMinesweeperRemainingMineCount,
  restartMinesweeperGame,
  revealMinesweeperCell,
  toggleMinesweeperFlag,
  type MinesweeperDifficulty,
  type MinesweeperGameState,
  type MinesweeperStatus,
} from "@/lib/minesweeper-game-engine";
import { createGameLeaderboardKey } from "@/lib/leaderboard";
import {
  createMinesweeperReplayRandom,
  createMinesweeperReplayRun,
  saveMinesweeperReplay,
  MINESWEEPER_REPLAY_GAME_ID,
  MINESWEEPER_REPLAY_SCHEMA_VERSION,
  shouldRecordMinesweeperReplayCursorEvent,
  type MinesweeperReplayCursorEvent,
  type MinesweeperReplayCursorEventInput,
  type MinesweeperReplayCursorPosition,
  type MinesweeperReplayEvent,
  type MinesweeperReplayEventInput,
  type MinesweeperReplayPayload,
  type MinesweeperReplayRun,
} from "@/lib/minesweeper-replay";
import { cn } from "@/lib/utils";
import { useGameLeaderboardPresenter } from "@/components/game-leaderboard-presenter";
import { useGameSession } from "@/hooks/use-game-session";

type MinesweeperGameProps = {
  initialDifficulty?: MinesweeperDifficulty;
  onBackToMenu?: () => void;
  onReplayBackToProfile?: () => void;
  replayMode?: "latest";
};

type MinesweeperReplayRecording = LiveGameReplayRecording<MinesweeperReplayEvent, MinesweeperReplayRun> & {
  cursorEvents: MinesweeperReplayCursorEvent[];
  lastCursorElapsedMs: number | null;
  nextCursorSeq: number;
  random: () => number;
};

type MinesweeperReplayPendingAction =
  | {
      cellId: string;
      cursorPosition?: MinesweeperReplayCursorPosition;
      type: "reveal";
    }
  | {
      cellId: string;
      cursorPosition?: MinesweeperReplayCursorPosition;
      type: "toggleFlag";
    };

const statusLabels: Record<MinesweeperStatus, string> = {
  lost: "Game over",
  ready: "Ready",
  running: "Running",
  won: "Board cleared",
};

const MINESWEEPER_HELP_SECTIONS: GameHelpSection[] = [
  {
    title: "Controls",
    controls: [
      {
        buttons: [{ text: "Enter", label: "Enter key" }],
        label: "Start board",
      },
      {
        buttons: [{ text: "Click", label: "Click" }],
        label: "Reveal square",
      },
      {
        buttons: [{ text: "Right click", label: "Right click" }, { text: "M", label: "M key" }],
        label: "Flag square or toggle flag mode",
      },
      {
        buttons: [{ text: "R", label: "R key" }],
        label: "New minefield",
      },
    ],
  },
  {
    title: "Rules",
    items: [
      "Reveal every safe square without revealing a mine.",
      "Numbers show how many mines touch that square.",
      "Use flags to mark suspected mines and track the remaining mine count.",
    ],
  },
];

function createNewMinesweeperGame({
  difficulty,
}: {
  difficulty?: MinesweeperDifficulty;
} = {}) {
  return createInitialMinesweeperGame({
    difficulty,
  });
}

export function MinesweeperGame({
  initialDifficulty,
  onBackToMenu,
  onReplayBackToProfile,
  replayMode,
}: MinesweeperGameProps = {}) {
  if (replayMode === "latest") {
    return (
      <MinesweeperReplayPlayer
        onBackToProfile={onReplayBackToProfile ?? onBackToMenu ?? (() => undefined)}
      />
    );
  }

  return (
    <MinesweeperLiveGame
      initialDifficulty={initialDifficulty}
      onBackToMenu={onBackToMenu}
    />
  );
}

function appendMinesweeperReplayEvent(
  recording: MinesweeperReplayRecording,
  event: MinesweeperReplayEventInput,
  tick: number,
) {
  recording.tick = tick;
  appendLiveGameReplayEvent(recording, event);
}

function appendMinesweeperReplayCursorEvent(
  recording: MinesweeperReplayRecording,
  event: MinesweeperReplayCursorEventInput,
  tick: number,
  { force = false }: { force?: boolean } = {},
) {
  const elapsedMs = getGameReplayRecordingElapsedMs(recording);

  if (
    !shouldRecordMinesweeperReplayCursorEvent({
      elapsedMs,
      force,
      lastElapsedMs: recording.lastCursorElapsedMs,
    })
  ) {
    return null;
  }

  const recordedEvent: MinesweeperReplayCursorEvent = {
    ...event,
    elapsedMs,
    seq: recording.nextCursorSeq,
    tick,
  };

  recording.cursorEvents.push(recordedEvent);
  recording.lastCursorElapsedMs = elapsedMs;
  recording.nextCursorSeq += 1;

  return recordedEvent;
}

function clampMinesweeperReplayCursorCoordinate(value: number) {
  return Math.min(1, Math.max(0, Math.round(value * 10_000) / 10_000));
}

function getMinesweeperReplayCursorPositionFromBoardRect({
  clientX,
  clientY,
  rect,
}: {
  clientX: number;
  clientY: number;
  rect: DOMRect;
}): MinesweeperReplayCursorPosition | null {
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;

  if (x < 0 || x > 1 || y < 0 || y > 1) {
    return null;
  }

  return {
    x: clampMinesweeperReplayCursorCoordinate(x),
    y: clampMinesweeperReplayCursorCoordinate(y),
  };
}

function getMinesweeperReplayCursorPosition(
  event: ReactPointerEvent<HTMLDivElement>,
) {
  return getMinesweeperReplayCursorPositionFromBoardRect({
    clientX: event.clientX,
    clientY: event.clientY,
    rect: event.currentTarget.getBoundingClientRect(),
  });
}

function getMinesweeperReplayActionCursorPosition(
  event: ReactMouseEvent<HTMLButtonElement> | undefined,
) {
  const boardGrid = event?.currentTarget.closest('[data-testid="minesweeper-board"]');
  const boardHost = boardGrid?.parentElement;

  if (event === undefined || !(boardHost instanceof HTMLElement)) {
    return undefined;
  }

  return (
    getMinesweeperReplayCursorPositionFromBoardRect({
      clientX: event.clientX,
      clientY: event.clientY,
      rect: boardHost.getBoundingClientRect(),
    }) ?? undefined
  );
}

function applyMinesweeperReplayPendingAction(
  game: MinesweeperGameState,
  action: MinesweeperReplayPendingAction,
  random: () => number,
) {
  if (action.type === "reveal") {
    return revealMinesweeperCell(game, action.cellId, { random });
  }

  return toggleMinesweeperFlag(game, action.cellId);
}

function MinesweeperLiveGame({
  initialDifficulty,
  onBackToMenu,
}: Pick<
  MinesweeperGameProps,
  "initialDifficulty" | "onBackToMenu"
> = {}) {
  const [game, setGame] = useState<MinesweeperGameState>(() =>
    createNewMinesweeperGame({
      difficulty: initialDifficulty,
    }),
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isFlagMode, setIsFlagMode] = useState(false);
  const [isStartScreenVisible, setIsStartScreenVisible] = useState(true);
  const elapsedSecondsRef = useRef(0);
  const gameRef = useRef(game);
  const pendingInitialActionRef = useRef<MinesweeperReplayPendingAction | null>(null);
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
  } = useLiveGameReplayRecording<
    MinesweeperReplayRecording,
    MinesweeperReplayPayload
  >({
    saveReplay: saveMinesweeperReplay,
  });
  const safeCellCount = game.width * game.height - game.mineCount;
  const remainingMineCount = getMinesweeperRemainingMineCount(game);
  const showStartScreen = isStartScreenVisible && game.status === "ready";
  const showEndScreen = game.status === "lost" || game.status === "won";
  const leaderboardKey = createGameLeaderboardKey("minesweeper", [
    { name: "difficulty", value: game.difficulty },
  ]);
  const { closeHelp, isHelpVisible, openHelp } = useGameHelpScreen();
  const { completedSessionId } = useGameSession({
    active: game.status === "running" && !isHelpVisible,
    finalResult:
      game.status === "lost" || game.status === "won" ? game.status : null,
    finalScore: elapsedSeconds,
    gameId: "minesweeper",
    leaderboardKey,
    sortDirection: "asc",
    started: game.status !== "ready",
  });
  const {
    finalLeaderboardProps,
    leaderboardPanelProps,
    pendingLeaderboardEntry,
    resetLeaderboardForm,
    scoreFormProps,
  } = useGameLeaderboardPresenter({
    formatScore: formatElapsedTime,
    gameSessionId: completedSessionId,
    leaderboardKey,
    pendingScore: game.status === "won" ? elapsedSeconds : null,
    scoreLabel: "time",
    sortDirection: "asc",
    testIdPrefix: "minesweeper",
  });
  const { abandonDialogProps, requestBackToMenu } = useGameEscapeToMenu({
    isDisabled: isHelpVisible,
    isGameStarted: game.status === "running",
    onBackToMenu,
  });

  const commitGame = useCallback((nextGame: MinesweeperGameState) => {
    gameRef.current = nextGame;
    setGame(nextGame);
  }, []);

  const updateCommittedGame = useCallback(
    (updateGame: (current: MinesweeperGameState) => MinesweeperGameState) => {
      const current = gameRef.current;
      const nextGame = updateGame(current);

      if (nextGame !== current) {
        commitGame(nextGame);
      }

      return nextGame;
    },
    [commitGame],
  );

  const startReplayRecording = useCallback(async (initialAction?: MinesweeperReplayPendingAction) => {
    if (isReplayRunPendingRef.current) {
      if (initialAction !== undefined) {
        pendingInitialActionRef.current ??= initialAction;
      }

      return;
    }

    pendingInitialActionRef.current = initialAction ?? null;
    resetLeaderboardForm();
    const clock = createGameReplayRecordingClock();
    const recording = await beginReplayRecording(async () => {
      const run = await createMinesweeperReplayRun();
      const random = createMinesweeperReplayRandom(run.seed);

      return createLiveGameReplayRecording<
        MinesweeperReplayEvent,
        MinesweeperReplayRun,
        {
          cursorEvents: MinesweeperReplayCursorEvent[];
          lastCursorElapsedMs: number | null;
          nextCursorSeq: number;
          random: () => number;
        }
      >({
        clock,
        cursorEvents: [],
        lastCursorElapsedMs: null,
        nextCursorSeq: 0,
        random,
        run,
      });
    });

    if (recording === null) {
      pendingInitialActionRef.current = null;
      return;
    }

    let nextGame = gameRef.current;

    appendMinesweeperReplayEvent(recording, { type: "start" }, 0);

    const pendingInitialAction = pendingInitialActionRef.current;

    if (pendingInitialAction !== null) {
      const { cursorPosition, ...pendingReplayEvent } = pendingInitialAction;

      if (cursorPosition !== undefined) {
        appendMinesweeperReplayCursorEvent(
          recording,
          {
            ...cursorPosition,
            type: "cursorMove",
          },
          elapsedSecondsRef.current,
          { force: true },
        );
      }

      appendMinesweeperReplayEvent(
        recording,
        pendingReplayEvent,
        elapsedSecondsRef.current,
      );
      nextGame = applyMinesweeperReplayPendingAction(
        nextGame,
        pendingInitialAction,
        recording.random,
      );
    }

    pendingInitialActionRef.current = null;
    replayRecordingRef.current = recording;
    commitGame(nextGame);
  }, [beginReplayRecording, commitGame, isReplayRunPendingRef, resetLeaderboardForm, replayRecordingRef]);

  const startGame = useCallback(() => {
    resetLeaderboardForm();
    resetReplayRecording();
    setIsStartScreenVisible(false);
    void startReplayRecording();
  }, [resetLeaderboardForm, resetReplayRecording, startReplayRecording]);

  const revealCell = useCallback((
    cellId: string,
    event?: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    const cursorPosition = getMinesweeperReplayActionCursorPosition(event);

    updateCommittedGame((current) => {
      if (current.status === "ready" && replayRecordingRef.current === null) {
        void startReplayRecording({
          cellId,
          cursorPosition,
          type: "reveal",
        });

        return current;
      }

      const recording = replayRecordingRef.current;

      if (recording !== null) {
        if (cursorPosition !== undefined) {
          appendMinesweeperReplayCursorEvent(
            recording,
            {
              ...cursorPosition,
              type: "cursorMove",
            },
            elapsedSecondsRef.current,
            { force: true },
          );
        }

        appendMinesweeperReplayEvent(
          recording,
          {
            cellId,
            type: "reveal",
          },
          elapsedSecondsRef.current,
        );

        return revealMinesweeperCell(current, cellId, { random: recording.random });
      }

      return revealMinesweeperCell(current, cellId, { random: Math.random });
    });
  }, [replayRecordingRef, startReplayRecording, updateCommittedGame]);

  const toggleFlag = useCallback((
    cellId: string,
    event?: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    const cursorPosition = getMinesweeperReplayActionCursorPosition(event);

    updateCommittedGame((current) => {
      if (current.status === "ready" && replayRecordingRef.current === null) {
        void startReplayRecording({
          cellId,
          cursorPosition,
          type: "toggleFlag",
        });

        return current;
      }

      const recording = replayRecordingRef.current;

      if (recording !== null) {
        if (cursorPosition !== undefined) {
          appendMinesweeperReplayCursorEvent(
            recording,
            {
              ...cursorPosition,
              type: "cursorMove",
            },
            elapsedSecondsRef.current,
            { force: true },
          );
        }

        appendMinesweeperReplayEvent(
          recording,
          {
            cellId,
            type: "toggleFlag",
          },
          elapsedSecondsRef.current,
        );
      }

      return toggleMinesweeperFlag(current, cellId);
    });
  }, [replayRecordingRef, startReplayRecording, updateCommittedGame]);

  const trackReplayPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || isHelpVisible || showStartScreen) {
      return;
    }

    const recording = replayRecordingRef.current;
    const currentStatus = gameRef.current.status;

    if (recording === null || currentStatus === "lost" || currentStatus === "won") {
      return;
    }

    const cursorPosition = getMinesweeperReplayCursorPosition(event);

    if (cursorPosition === null) {
      return;
    }

    appendMinesweeperReplayCursorEvent(
      recording,
      {
        ...cursorPosition,
        type: "cursorMove",
      },
      elapsedSecondsRef.current,
    );
  }, [isHelpVisible, replayRecordingRef, showStartScreen]);

  const startNewGame = useCallback(() => {
    if (isReplayRunPendingRef.current) {
      return;
    }

    resetReplayRecording();
    pendingInitialActionRef.current = null;
    resetLeaderboardForm();
    setElapsedSeconds(0);
    elapsedSecondsRef.current = 0;
    setIsFlagMode(false);
    setIsStartScreenVisible(true);
    updateCommittedGame((current) => restartMinesweeperGame(current));
  }, [isReplayRunPendingRef, resetLeaderboardForm, resetReplayRecording, updateCommittedGame]);

  const startNewPlayableGame = useCallback(() => {
    if (isReplayRunPendingRef.current) {
      return;
    }

    resetReplayRecording();
    pendingInitialActionRef.current = null;
    resetLeaderboardForm();
    setElapsedSeconds(0);
    elapsedSecondsRef.current = 0;
    setIsFlagMode(false);
    setIsStartScreenVisible(false);
    updateCommittedGame((current) => restartMinesweeperGame(current));
    void startReplayRecording();
  }, [
    isReplayRunPendingRef,
    resetLeaderboardForm,
    resetReplayRecording,
    startReplayRecording,
    updateCommittedGame,
  ]);

  useEffect(() => {
    if (game.status === "lost" || game.status === "won") {
      return;
    }

    if (isHelpVisible) {
      pauseRecordingClock();
    } else {
      resumeRecordingClock();
    }
  }, [game.status, isHelpVisible, pauseRecordingClock, resumeRecordingClock]);

  useEffect(() => {
    if (game.status !== "running" || isHelpVisible) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => {
        const nextElapsedSeconds = current + 1;

        elapsedSecondsRef.current = nextElapsedSeconds;

        return nextElapsedSeconds;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [game.status, isHelpVisible]);

  useEffect(() => {
    if (game.status !== "lost" && game.status !== "won") {
      return;
    }

    const finalElapsedSeconds = elapsedSecondsRef.current;
    const finalStatus = game.status;

    captureFinishedReplay((recording) => ({
      boardHeight: game.height,
      boardWidth: game.width,
      cursorEvents: [...recording.cursorEvents],
      difficulty: game.difficulty,
      events: [...recording.events],
      finalFlagCount: game.flagCount,
      finalRevealedSafeCellCount: game.revealedSafeCellCount,
      finalScore: finalElapsedSeconds,
      finalStatus,
      finalTick: finalElapsedSeconds,
      gameId: MINESWEEPER_REPLAY_GAME_ID,
      leaderboardKey,
      mineCount: game.mineCount,
      runId: recording.run.id,
      schemaVersion: MINESWEEPER_REPLAY_SCHEMA_VERSION,
      seed: recording.run.seed,
      startedAt: recording.startedAt,
    }));
  }, [
    captureFinishedReplay,
    game.difficulty,
    game.flagCount,
    game.height,
    game.mineCount,
    game.revealedSafeCellCount,
    game.status,
    game.width,
    leaderboardKey,
  ]);

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

      if (event.key === "Enter" && showStartScreen) {
        event.preventDefault();
        startGame();
        return;
      }

      if (showStartScreen) {
        return;
      }

      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        startNewGame();
        return;
      }

      if (event.key === "m" || event.key === "M") {
        event.preventDefault();
        setIsFlagMode((current) => !current);
      }
    }

    return registerGameKeyDown(handleKeyDown);
  }, [isHelpVisible, pendingLeaderboardEntry, showStartScreen, startGame, startNewGame]);

  return (
    <GameShell className="bg-[var(--minesweeper-page)] text-[var(--minesweeper-ink)]">
      <GameBoardColumn className={getMinesweeperBoardColumnClassName(game)}>
        <GameSidebar className="border-[var(--minesweeper-border)] bg-[var(--minesweeper-panel)]">
          <GameHeader
            status={statusLabels[game.status]}
            statusTestId="minesweeper-status"
            title="Minesweeper"
          />

          <GameStatsBar>
            <GameStatCard
              className="border-[var(--minesweeper-border)]"
              label="Mines"
              labelClassName="text-[var(--minesweeper-muted)]"
              value={remainingMineCount}
              valueTestId="minesweeper-mines-remaining"
            />
            <GameStatCard
              className="border-[var(--minesweeper-border)]"
              label="Time"
              labelClassName="text-[var(--minesweeper-muted)]"
              value={formatElapsedTime(elapsedSeconds)}
              valueTestId="minesweeper-time"
            />
            <GameStatCard
              className="border-[var(--minesweeper-border)]"
              label="Safe cells"
              labelClassName="text-[var(--minesweeper-muted)]"
              value={`${game.revealedSafeCellCount}/${safeCellCount}`}
              valueTestId="minesweeper-safe-cells"
            />
            <div className="min-w-0 rounded-md border border-[var(--minesweeper-border)] p-2 sm:p-3">
              <dt className="text-xs font-medium text-[var(--minesweeper-muted)]">
                Mode
              </dt>
              <dd
                className={cn(
                  "mt-1 inline-flex rounded-[0.2rem] px-2 py-1 text-sm font-semibold",
                  isFlagMode
                    ? "bg-[color-mix(in_oklch,var(--minesweeper-flag)_14%,white)] text-[var(--minesweeper-flag)]"
                    : "bg-[color-mix(in_oklch,var(--minesweeper-one)_14%,white)] text-[var(--minesweeper-one)]",
                )}
                data-testid="minesweeper-active-mode"
              >
                {isFlagMode ? "Flag" : "Reveal"}
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
              onRestart={startNewGame}
              restartDisabled={isReplayRunPending || pendingLeaderboardEntry !== null}
              testIdPrefix="minesweeper"
            />
          }
        >
          <MinesweeperBoard
            game={game}
            isInputDisabled={showStartScreen || isReplayRunPending}
            isFlagMode={isFlagMode}
            onRevealCell={revealCell}
            onTrackPointerMove={trackReplayPointerMove}
            onToggleFlag={toggleFlag}
            statusLabel={statusLabels[game.status]}
          >
            {showStartScreen ? (
              <GameStartScreen testId="minesweeper-start-screen">
                <GameStartScreenHeader
                  preview={<MinesweeperStartPreview />}
                  status={statusLabels[game.status]}
                  title="Minesweeper"
                />
                <Button
                  className="min-w-32"
                  data-testid="minesweeper-start-button"
                  onClick={startGame}
                  size="lg"
                  type="button"
                  variant="secondary"
                >
                  <PlayIcon data-icon="inline-start" />
                  Start
                </Button>
                <GameLeaderboardPanel {...leaderboardPanelProps} />
              </GameStartScreen>
            ) : showEndScreen ? (
              <GameEndScreen testId="minesweeper-end-screen">
                <GameEndLeaderboardContent
                  action={
                    <div className="flex w-full max-w-xs flex-col items-center gap-2">
                      <Button
                        className="w-full"
                        data-testid="minesweeper-new-game-button"
                        disabled={isReplayRunPending}
                        onClick={startNewPlayableGame}
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
                    metricLabel: "Time",
                    metricValue: formatElapsedTime(elapsedSeconds),
                    metricValueTestId: "minesweeper-final-time",
                    title: game.status === "won" ? "Board cleared" : "Game over",
                  }}
                />
                <GameReplaySaveAction
                  onSave={saveFinishedReplay}
                  replayReady={finishedReplay !== null}
                  status={replaySaveStatus}
                  testIdPrefix="minesweeper"
                />
              </GameEndScreen>
            ) : null}
            {isHelpVisible ? (
              <GameHelpScreen
                onClose={closeHelp}
                sections={MINESWEEPER_HELP_SECTIONS}
                testId="minesweeper-help-screen"
                title="Minesweeper"
              />
            ) : null}
          </MinesweeperBoard>
        </GameBoardStage>
      </GameBoardColumn>
      {abandonDialogProps ? <GameAbandonDialog {...abandonDialogProps} /> : null}
    </GameShell>
  );
}

function formatElapsedTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getMinesweeperBoardColumnClassName(
  game: Pick<MinesweeperGameState, "height" | "width">,
) {
  return game.width > game.height
    ? "w-[min(96vw,56rem)]"
    : "w-[min(92vw,37.25rem,calc(100svh_-_12rem))]";
}
