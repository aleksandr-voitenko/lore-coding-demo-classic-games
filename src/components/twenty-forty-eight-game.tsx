"use client";

import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  PlayIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  createLiveGameReplayRecording,
  useLiveGameReplayRecording,
  type LiveGameReplayRecording,
} from "@/components/game-replay-recording";
import { GameLeaderboardPanel } from "@/components/game-leaderboard";
import { useGameLeaderboardPresenter } from "@/components/game-leaderboard-presenter";
import { TwentyFortyEightBoard } from "@/components/twenty-forty-eight-board";
import { TwentyFortyEightReplayPlayer } from "@/components/twenty-forty-eight-replay-player";
import { Button } from "@/components/ui/button";
import {
  createInitialTwentyFortyEightGame,
  getTwentyFortyEightTopTile,
  moveTwentyFortyEightGame,
  restartTwentyFortyEightGame,
  type TwentyFortyEightDirection,
  type TwentyFortyEightGameState,
  type TwentyFortyEightStatus,
} from "@/lib/twenty-forty-eight-game-engine";
import { createGameLeaderboardKey } from "@/lib/leaderboard";
import {
  createTwentyFortyEightReplayRandom,
  createTwentyFortyEightReplayRun,
  saveTwentyFortyEightReplay,
  TWENTY_FORTY_EIGHT_REPLAY_GAME_ID,
  TWENTY_FORTY_EIGHT_REPLAY_SCHEMA_VERSION,
  type TwentyFortyEightReplayEvent,
  type TwentyFortyEightReplayEventInput,
  type TwentyFortyEightReplayPayload,
  type TwentyFortyEightReplayRun,
} from "@/lib/twenty-forty-eight-replay";
import { cn } from "@/lib/utils";
import { useGameSession } from "@/hooks/use-game-session";

type TwentyFortyEightGameProps = {
  initialBoardSize?: number;
  initialWinTile?: number;
  onBackToMenu?: () => void;
  onReplayBackToProfile?: () => void;
  replayMode?: "latest";
};

type TwentyFortyEightReplayRecording = LiveGameReplayRecording<TwentyFortyEightReplayEvent, TwentyFortyEightReplayRun> & {
  random: () => number;
};

const statusLabels: Record<Exclude<TwentyFortyEightStatus, "won">, string> = {
  lost: "No moves left",
  ready: "Ready",
  running: "Running",
};

function createTwentyFortyEightHelpSections(winTile: number): GameHelpSection[] {
  return [
    {
      title: "Controls",
      controls: [
        {
          buttons: [{ text: "Enter", label: "Enter key" }],
          label: "Start game",
        },
        {
          buttons: [{ icon: ArrowUpIcon, label: "Up" }, { text: "W", label: "W key" }],
          label: "Slide up",
        },
        {
          buttons: [{ icon: ArrowLeftIcon, label: "Left" }, { text: "A", label: "A key" }],
          label: "Slide left",
        },
        {
          buttons: [{ icon: ArrowDownIcon, label: "Down" }, { text: "S", label: "S key" }],
          label: "Slide down",
        },
        {
          buttons: [{ icon: ArrowRightIcon, label: "Right" }, { text: "D", label: "D key" }],
          label: "Slide right",
        },
        {
          buttons: [{ text: "R", label: "R key" }],
          label: "New board",
        },
      ],
    },
    {
      title: "Rules",
      items: [
        "Tiles slide as far as possible in the chosen direction.",
        "Matching tiles merge once per move and add to your score.",
        `Reach ${winTile} to win; the game ends when no moves remain.`,
      ],
    },
  ];
}

function getTwentyFortyEightStatusLabel(game: TwentyFortyEightGameState) {
  return game.status === "won" ? `${game.winTile} reached` : statusLabels[game.status];
}

function createNewTwentyFortyEightGame({
  bestScore = 0,
  boardSize,
  random = Math.random,
  winTile,
}: {
  bestScore?: number;
  boardSize?: number;
  random?: () => number;
  winTile?: number;
} = {}) {
  return createInitialTwentyFortyEightGame({
    bestScore,
    boardSize,
    random,
    winTile,
  });
}

function createRunningTwentyFortyEightGame(
  game: Pick<TwentyFortyEightGameState, "bestScore" | "boardSize" | "winTile">,
  random: () => number,
) {
  return {
    ...createNewTwentyFortyEightGame({
      bestScore: game.bestScore,
      boardSize: game.boardSize,
      random,
      winTile: game.winTile,
    }),
    status: "running" as const,
  };
}

function appendTwentyFortyEightReplayEvent(
  recording: TwentyFortyEightReplayRecording,
  event: TwentyFortyEightReplayEventInput,
) {
  appendLiveGameReplayEvent(recording, event, {
    advancesTick: event.type === "move",
  });
}

export function TwentyFortyEightGame({
  initialBoardSize,
  initialWinTile,
  onBackToMenu,
  onReplayBackToProfile,
  replayMode,
}: TwentyFortyEightGameProps = {}) {
  if (replayMode === "latest") {
    return (
      <TwentyFortyEightReplayPlayer
        onBackToProfile={onReplayBackToProfile ?? onBackToMenu ?? (() => undefined)}
      />
    );
  }

  return (
    <TwentyFortyEightLiveGame
      initialBoardSize={initialBoardSize}
      initialWinTile={initialWinTile}
      onBackToMenu={onBackToMenu}
    />
  );
}

function TwentyFortyEightLiveGame({
  initialBoardSize,
  initialWinTile,
  onBackToMenu,
}: Pick<
  TwentyFortyEightGameProps,
  "initialBoardSize" | "initialWinTile" | "onBackToMenu"
> = {}) {
  const [game, setGame] = useState<TwentyFortyEightGameState>(() =>
    createNewTwentyFortyEightGame({
      boardSize: initialBoardSize,
      winTile: initialWinTile,
    }),
  );
  const gameRef = useRef(game);
  const pendingInitialDirectionRef = useRef<TwentyFortyEightDirection | null>(null);
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
    TwentyFortyEightReplayRecording,
    TwentyFortyEightReplayPayload
  >({
    saveReplay: saveTwentyFortyEightReplay,
  });
  const statusLabel = getTwentyFortyEightStatusLabel(game);
  const helpSections = useMemo(
    () => createTwentyFortyEightHelpSections(game.winTile),
    [game.winTile],
  );
  const topTile = getTwentyFortyEightTopTile(game);
  const showStartScreen = game.status === "ready";
  const showEndScreen = game.status === "lost" || game.status === "won";
  const leaderboardKey = createGameLeaderboardKey("twenty-forty-eight", [
    { name: "board", value: game.boardSize },
    { name: "goal", value: game.winTile },
  ]);
  const { closeHelp, isHelpVisible, openHelp } = useGameHelpScreen();
  const { completedSessionId } = useGameSession({
    active: game.status === "running" && !isHelpVisible,
    finalResult:
      game.status === "lost" || game.status === "won" ? game.status : null,
    finalScore: game.score,
    gameId: "twenty-forty-eight",
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
    pendingScore: showEndScreen ? game.score : null,
    testIdPrefix: "twenty-forty-eight",
  });
  const bestScore = Math.max(game.bestScore, leaderboardBestScore);
  const { abandonDialogProps, requestBackToMenu } = useGameEscapeToMenu({
    isDisabled: isHelpVisible,
    isGameStarted: game.status === "running",
    onBackToMenu,
  });

  const commitGame = useCallback((nextGame: TwentyFortyEightGameState) => {
    gameRef.current = nextGame;
    setGame(nextGame);
  }, []);

  const updateCommittedGame = useCallback(
    (updateGame: (current: TwentyFortyEightGameState) => TwentyFortyEightGameState) => {
      const current = gameRef.current;
      const nextGame = updateGame(current);

      if (nextGame !== current) {
        commitGame(nextGame);
      }

      return nextGame;
    },
    [commitGame],
  );

  const startNewGame = useCallback(async (initialDirection?: TwentyFortyEightDirection) => {
    if (isReplayRunPendingRef.current) {
      if (initialDirection !== undefined) {
        pendingInitialDirectionRef.current = initialDirection;
      }

      return;
    }

    pendingInitialDirectionRef.current = initialDirection ?? null;
    resetLeaderboardForm();
    const recording = await beginReplayRecording(async () => {
      const run = await createTwentyFortyEightReplayRun();
      const random = createTwentyFortyEightReplayRandom(run.seed);

      return createLiveGameReplayRecording<
        TwentyFortyEightReplayEvent,
        TwentyFortyEightReplayRun,
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

    let nextGame: TwentyFortyEightGameState = createRunningTwentyFortyEightGame(
      gameRef.current,
      recording.random,
    );

    appendTwentyFortyEightReplayEvent(recording, { type: "start" });

    const pendingInitialDirection = pendingInitialDirectionRef.current;

    if (pendingInitialDirection !== null) {
      appendTwentyFortyEightReplayEvent(recording, {
        direction: pendingInitialDirection,
        type: "move",
      });
      nextGame = moveTwentyFortyEightGame(nextGame, pendingInitialDirection, {
        random: recording.random,
      });
    }

    pendingInitialDirectionRef.current = null;
    replayRecordingRef.current = recording;
    commitGame(nextGame);
  }, [beginReplayRecording, commitGame, isReplayRunPendingRef, resetLeaderboardForm, replayRecordingRef]);

  const startGame = useCallback(() => {
    void startNewGame();
  }, [startNewGame]);

  const restartGame = useCallback(() => {
    if (isReplayRunPendingRef.current) {
      return;
    }

    resetReplayRecording();
    pendingInitialDirectionRef.current = null;
    resetLeaderboardForm();
    updateCommittedGame((current) =>
      restartTwentyFortyEightGame(current, { random: Math.random }),
    );
  }, [isReplayRunPendingRef, resetLeaderboardForm, resetReplayRecording, updateCommittedGame]);

  const moveTiles = useCallback((direction: TwentyFortyEightDirection) => {
    updateCommittedGame((current) => {
      if (current.status === "ready") {
        void startNewGame(direction);

        return current;
      }

      const recording = replayRecordingRef.current;

      if (recording !== null && current.status === "running") {
        appendTwentyFortyEightReplayEvent(recording, {
          direction,
          type: "move",
        });

        return moveTwentyFortyEightGame(current, direction, {
          random: recording.random,
        });
      }

      return moveTwentyFortyEightGame(current, direction, { random: Math.random });
    });
  }, [replayRecordingRef, startNewGame, updateCommittedGame]);

  useEffect(() => {
    if (game.status !== "running") {
      return;
    }

    if (isHelpVisible) {
      pauseRecordingClock();
    } else {
      resumeRecordingClock();
    }
  }, [game.status, isHelpVisible, pauseRecordingClock, resumeRecordingClock]);

  useEffect(() => {
    if (game.status !== "lost" && game.status !== "won") {
      return;
    }

    const finalStatus = game.status;

    captureFinishedReplay((recording) => ({
      boardSize: game.boardSize,
      events: [...recording.events],
      finalMoveCount: game.moveCount,
      finalScore: game.score,
      finalStatus,
      finalTick: recording.tick,
      finalTopTile: topTile,
      gameId: TWENTY_FORTY_EIGHT_REPLAY_GAME_ID,
      leaderboardKey,
      runId: recording.run.id,
      schemaVersion: TWENTY_FORTY_EIGHT_REPLAY_SCHEMA_VERSION,
      seed: recording.run.seed,
      startedAt: recording.startedAt,
      winTile: game.winTile,
    }));
  }, [
    captureFinishedReplay,
    game.boardSize,
    game.moveCount,
    game.score,
    game.status,
    game.winTile,
    leaderboardKey,
    topTile,
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

      if (event.key === "Enter" && game.status === "ready") {
        event.preventDefault();
        startGame();
        return;
      }

      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        restartGame();
        return;
      }

      const direction = getDirectionForKey(event.key);

      if (direction === null) {
        return;
      }

      event.preventDefault();
      moveTiles(direction);
    }

    return registerGameKeyDown(handleKeyDown);
  }, [game.status, isHelpVisible, moveTiles, pendingLeaderboardEntry, restartGame, startGame]);

  return (
    <GameShell className="bg-[var(--twenty-page)] text-[var(--twenty-ink)]">
      <GameBoardColumn className="w-[min(92vw,37.25rem,calc(100svh_-_12rem))]">
        <GameSidebar className="border-[var(--twenty-border)] bg-[var(--twenty-panel)]">
          <GameHeader
            status={statusLabel}
            statusTestId="twenty-forty-eight-status"
            title="2048"
          />

          <GameStatsBar>
            <GameStatCard
              className="border-[var(--twenty-border)]"
              label="Score"
              labelClassName="text-[var(--twenty-muted)]"
              value={game.score}
              valueTestId="twenty-forty-eight-score"
            />
            <GameStatCard
              className="border-[var(--twenty-border)]"
              label="Best"
              labelClassName="text-[var(--twenty-muted)]"
              value={bestScore}
              valueTestId="twenty-forty-eight-best-score"
            />
            <GameStatCard
              className="border-[var(--twenty-border)]"
              label="Top tile"
              labelClassName="text-[var(--twenty-muted)]"
              value={topTile}
              valueTestId="twenty-forty-eight-top-tile"
            />
            <GameStatCard
              className="border-[var(--twenty-border)]"
              label="Moves"
              labelClassName="text-[var(--twenty-muted)]"
              value={game.moveCount}
              valueTestId="twenty-forty-eight-moves"
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
              restartDisabled={isReplayRunPending || pendingLeaderboardEntry !== null}
              testIdPrefix="twenty-forty-eight"
            />
          }
        >
          <TwentyFortyEightBoard game={game} statusLabel={statusLabel}>
          {showStartScreen ? (
            <GameStartScreen testId="twenty-forty-eight-start-screen">
              <GameStartScreenHeader
                preview={<StartPreview />}
                status={statusLabel}
                title="2048"
              />
              <Button
                className="min-w-32"
                data-testid="twenty-forty-eight-overlay-start-button"
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
            <GameEndScreen testId="twenty-forty-eight-end-screen">
              <GameEndLeaderboardContent
                action={
                  <div className="flex w-full max-w-xs flex-col items-center gap-2">
                    <Button
                      className="w-full"
                      data-testid="twenty-forty-eight-overlay-new-game-button"
                      disabled={isReplayRunPending}
                      onClick={startGame}
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
                  metricValueTestId: "twenty-forty-eight-final-score",
                  title: game.status === "won" ? `${game.winTile} reached` : "No moves left",
                }}
              />
              <GameReplaySaveAction
                onSave={saveFinishedReplay}
                replayReady={finishedReplay !== null}
                status={replaySaveStatus}
                testIdPrefix="twenty-forty-eight"
              />
            </GameEndScreen>
          ) : null}
          {isHelpVisible ? (
            <GameHelpScreen
              onClose={closeHelp}
              sections={helpSections}
              testId="twenty-forty-eight-help-screen"
              title="2048"
            />
          ) : null}
          </TwentyFortyEightBoard>
        </GameBoardStage>
      </GameBoardColumn>
      {abandonDialogProps ? <GameAbandonDialog {...abandonDialogProps} /> : null}
    </GameShell>
  );
}

function getDirectionForKey(key: string): TwentyFortyEightDirection | null {
  if (key === "ArrowUp" || key === "w" || key === "W") {
    return "up";
  }

  if (key === "ArrowDown" || key === "s" || key === "S") {
    return "down";
  }

  if (key === "ArrowLeft" || key === "a" || key === "A") {
    return "left";
  }

  if (key === "ArrowRight" || key === "d" || key === "D") {
    return "right";
  }

  return null;
}

function StartPreview() {
  const previewTiles = new Map([
    ["0:0", 2],
    ["1:0", 4],
    ["2:1", 8],
    ["3:2", 16],
    ["1:3", 32],
  ]);

  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-4 gap-1.5 rounded-md bg-[var(--twenty-grid)] p-1.5"
    >
      {Array.from({ length: 16 }, (_, index) => {
        const x = index % 4;
        const y = Math.floor(index / 4);
        const value = previewTiles.get(`${x}:${y}`);

        return (
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-[0.2rem] bg-[var(--twenty-empty)] font-mono text-sm font-black",
              value === 2 && "bg-[var(--twenty-tile-2)] text-[var(--twenty-tile-dark)]",
              value === 4 && "bg-[var(--twenty-tile-4)] text-[var(--twenty-tile-dark)]",
              value === 8 && "bg-[var(--twenty-tile-8)] text-[var(--twenty-tile-light)]",
              value === 16 && "bg-[var(--twenty-tile-16)] text-[var(--twenty-tile-light)]",
              value === 32 && "bg-[var(--twenty-tile-32)] text-[var(--twenty-tile-light)]",
            )}
            key={`${x}:${y}`}
          >
            {value}
          </span>
        );
      })}
    </div>
  );
}
