"use client";

import { PlayIcon, RotateCcwIcon, SaveIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

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
import { MinesweeperBoard, MinesweeperStartPreview } from "@/components/minesweeper-board";
import { MinesweeperReplayPlayer } from "@/components/minesweeper-replay-player";
import { Button } from "@/components/ui/button";
import {
  createInitialMinesweeperGame,
  getMinesweeperRemainingMineCount,
  restartMinesweeperGame,
  revealMinesweeperCell,
  toggleMinesweeperFlag,
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
  type MinesweeperReplayEvent,
  type MinesweeperReplayEventInput,
  type MinesweeperReplayPayload,
  type MinesweeperReplayRun,
} from "@/lib/minesweeper-replay";
import { cn } from "@/lib/utils";
import { useGameLeaderboardPresenter } from "@/components/game-leaderboard-presenter";
import { useGameSession } from "@/hooks/use-game-session";

type MinesweeperGameProps = {
  initialBoardHeight?: number;
  initialBoardWidth?: number;
  initialMineCount?: number;
  onBackToMenu?: () => void;
  onReplayBackToProfile?: () => void;
  replayMode?: "latest";
};

type ReplaySaveStatus = "failed" | "idle" | "saved" | "saving";

type MinesweeperReplayRecording = {
  events: MinesweeperReplayEvent[];
  nextSeq: number;
  random: () => number;
  run: MinesweeperReplayRun;
  startedAt: string;
};

type MinesweeperReplayPendingAction =
  | {
      cellId: string;
      type: "reveal";
    }
  | {
      cellId: string;
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
  boardHeight,
  boardWidth,
  mineCount,
}: {
  boardHeight?: number;
  boardWidth?: number;
  mineCount?: number;
} = {}) {
  return createInitialMinesweeperGame({
    height: boardHeight,
    mineCount,
    width: boardWidth,
  });
}

export function MinesweeperGame({
  initialBoardHeight,
  initialBoardWidth,
  initialMineCount,
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
      initialBoardHeight={initialBoardHeight}
      initialBoardWidth={initialBoardWidth}
      initialMineCount={initialMineCount}
      onBackToMenu={onBackToMenu}
    />
  );
}

function appendMinesweeperReplayEvent(
  recording: MinesweeperReplayRecording,
  event: MinesweeperReplayEventInput,
  tick: number,
) {
  recording.events.push({
    ...event,
    seq: recording.nextSeq,
    tick,
  } as MinesweeperReplayEvent);
  recording.nextSeq += 1;
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
  initialBoardHeight,
  initialBoardWidth,
  initialMineCount,
  onBackToMenu,
}: Pick<
  MinesweeperGameProps,
  "initialBoardHeight" | "initialBoardWidth" | "initialMineCount" | "onBackToMenu"
> = {}) {
  const [game, setGame] = useState<MinesweeperGameState>(() =>
    createNewMinesweeperGame({
      boardHeight: initialBoardHeight,
      boardWidth: initialBoardWidth,
      mineCount: initialMineCount,
    }),
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [finishedReplay, setFinishedReplay] =
    useState<MinesweeperReplayPayload | null>(null);
  const [isFlagMode, setIsFlagMode] = useState(false);
  const [isReplayRunPending, setIsReplayRunPending] = useState(false);
  const [isStartScreenVisible, setIsStartScreenVisible] = useState(true);
  const [replaySaveStatus, setReplaySaveStatus] = useState<ReplaySaveStatus>("idle");
  const elapsedSecondsRef = useRef(0);
  const gameRef = useRef(game);
  const isReplayRunPendingRef = useRef(false);
  const pendingInitialActionRef = useRef<MinesweeperReplayPendingAction | null>(null);
  const replayRecordingRef = useRef<MinesweeperReplayRecording | null>(null);
  const safeCellCount = game.width * game.height - game.mineCount;
  const remainingMineCount = getMinesweeperRemainingMineCount(game);
  const showStartScreen = isStartScreenVisible && game.status === "ready";
  const showEndScreen = game.status === "lost" || game.status === "won";
  const leaderboardKey = createGameLeaderboardKey("minesweeper", [
    { name: "board", value: `${game.width}x${game.height}` },
    { name: "mines", value: game.mineCount },
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

  const startReplayRecording = useCallback(async (initialAction: MinesweeperReplayPendingAction) => {
    if (isReplayRunPendingRef.current) {
      pendingInitialActionRef.current ??= initialAction;

      return;
    }

    isReplayRunPendingRef.current = true;
    pendingInitialActionRef.current = initialAction;
    replayRecordingRef.current = null;
    setIsReplayRunPending(true);
    resetLeaderboardForm();
    setFinishedReplay(null);
    setReplaySaveStatus("idle");

    try {
      const run = await createMinesweeperReplayRun();
      const random = createMinesweeperReplayRandom(run.seed);
      const recording: MinesweeperReplayRecording = {
        events: [],
        nextSeq: 0,
        random,
        run,
        startedAt: new Date().toISOString(),
      };
      let nextGame = gameRef.current;

      appendMinesweeperReplayEvent(recording, { type: "start" }, 0);

      const pendingInitialAction = pendingInitialActionRef.current;

      if (pendingInitialAction !== null) {
        appendMinesweeperReplayEvent(
          recording,
          pendingInitialAction,
          elapsedSecondsRef.current,
        );
        nextGame = applyMinesweeperReplayPendingAction(
          nextGame,
          pendingInitialAction,
          random,
        );
      }

      replayRecordingRef.current = recording;
      commitGame(nextGame);
    } catch {
      setReplaySaveStatus("failed");
    } finally {
      pendingInitialActionRef.current = null;
      isReplayRunPendingRef.current = false;
      setIsReplayRunPending(false);
    }
  }, [commitGame, resetLeaderboardForm]);

  const startGame = useCallback(() => {
    resetLeaderboardForm();
    setFinishedReplay(null);
    setIsStartScreenVisible(false);
    setReplaySaveStatus("idle");
  }, [resetLeaderboardForm]);

  const revealCell = useCallback((cellId: string) => {
    updateCommittedGame((current) => {
      if (current.status === "ready" && replayRecordingRef.current === null) {
        void startReplayRecording({
          cellId,
          type: "reveal",
        });

        return current;
      }

      const recording = replayRecordingRef.current;

      if (recording !== null) {
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
  }, [startReplayRecording, updateCommittedGame]);

  const toggleFlag = useCallback((cellId: string) => {
    updateCommittedGame((current) => {
      if (current.status === "ready" && replayRecordingRef.current === null) {
        void startReplayRecording({
          cellId,
          type: "toggleFlag",
        });

        return current;
      }

      const recording = replayRecordingRef.current;

      if (recording !== null) {
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
  }, [startReplayRecording, updateCommittedGame]);

  const startNewGame = useCallback(() => {
    if (isReplayRunPendingRef.current) {
      return;
    }

    replayRecordingRef.current = null;
    pendingInitialActionRef.current = null;
    resetLeaderboardForm();
    setFinishedReplay(null);
    setElapsedSeconds(0);
    elapsedSecondsRef.current = 0;
    setIsFlagMode(false);
    setIsStartScreenVisible(true);
    setReplaySaveStatus("idle");
    updateCommittedGame((current) => restartMinesweeperGame(current));
  }, [resetLeaderboardForm, updateCommittedGame]);

  const saveFinishedReplay = useCallback(async () => {
    if (finishedReplay === null || replaySaveStatus === "saving") {
      return;
    }

    setReplaySaveStatus("saving");

    try {
      await saveMinesweeperReplay(finishedReplay);
      setReplaySaveStatus("saved");
    } catch {
      setReplaySaveStatus("failed");
    }
  }, [finishedReplay, replaySaveStatus]);

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

    const recording = replayRecordingRef.current;

    if (recording === null || finishedReplay !== null) {
      return;
    }

    const finalElapsedSeconds = elapsedSecondsRef.current;
    const replay: MinesweeperReplayPayload = {
      boardHeight: game.height,
      boardWidth: game.width,
      events: [...recording.events],
      finalFlagCount: game.flagCount,
      finalRevealedSafeCellCount: game.revealedSafeCellCount,
      finalScore: finalElapsedSeconds,
      finalStatus: game.status,
      finalTick: finalElapsedSeconds,
      gameId: MINESWEEPER_REPLAY_GAME_ID,
      leaderboardKey,
      mineCount: game.mineCount,
      runId: recording.run.id,
      schemaVersion: MINESWEEPER_REPLAY_SCHEMA_VERSION,
      seed: recording.run.seed,
      startedAt: recording.startedAt,
    };

    replayRecordingRef.current = null;
    setFinishedReplay(replay);
  }, [
    finishedReplay,
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
      <GameBoardColumn className="w-[min(92vw,37.25rem,calc(100svh_-_12rem))]">
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
                        onClick={startNewGame}
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
                <div className="flex w-full max-w-xs flex-col items-center gap-2">
                  <Button
                    className="w-full"
                    data-testid="minesweeper-save-replay-button"
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
                      data-testid="minesweeper-save-replay-error"
                    >
                      Could not save replay. Sign in and try again.
                    </p>
                  ) : null}
                </div>
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
