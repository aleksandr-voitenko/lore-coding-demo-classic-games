"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { GameLeaderboardPanel } from "@/components/game-leaderboard";
import {
  GameBoardActions,
  GameBoardColumn,
  GameBoardStage,
  GameEndScreen,
  GameHeader,
  GameShell,
  GameSidebar,
  GameStatsBar,
  GameStatCard,
  useGameEscapeToMenu,
} from "@/components/game-layout";
import { useGameLeaderboardPresenter } from "@/components/game-leaderboard-presenter";
import { MinesweeperBoard } from "@/components/minesweeper-board";
import { Button } from "@/components/ui/button";
import {
  getMinesweeperRemainingMineCount,
  type MinesweeperGameState,
} from "@/lib/minesweeper-game-engine";
import {
  applyMinesweeperReplayEvent,
  createInitialMinesweeperReplayGame,
  createMinesweeperReplayLeaderboardKey,
  fetchMinesweeperReplay,
  type MinesweeperReplayEvent,
  type MinesweeperReplayPayload,
} from "@/lib/minesweeper-replay";

type MinesweeperReplayPlayerProps = {
  onBackToProfile: () => void;
};

type PlaybackState = {
  eventIndex: number;
  events: MinesweeperReplayEvent[];
  random: () => number;
};

type MinesweeperReplayFrame = {
  eventIndex: number;
  events: MinesweeperReplayEvent[];
  game: MinesweeperGameState;
  random: () => number;
};

export function advanceMinesweeperReplayFrame({
  eventIndex,
  events,
  game,
  random,
}: MinesweeperReplayFrame) {
  let nextEventIndex = eventIndex;
  let nextGame = game;
  let processedVisibleAction = false;

  while (nextEventIndex < events.length && !processedVisibleAction) {
    const event = events[nextEventIndex]!;
    const previousGame = nextGame;

    nextEventIndex += 1;
    nextGame = applyMinesweeperReplayEvent(nextGame, event, random);
    processedVisibleAction = event.type !== "start" && nextGame !== previousGame;
  }

  return {
    eventIndex: nextEventIndex,
    game: nextGame,
    isFinished:
      nextEventIndex >= events.length ||
      nextGame.status === "lost" ||
      nextGame.status === "won",
  };
}

const MINESWEEPER_REPLAY_STEP_MS = 420;

const replayStatusLabels = {
  failed: "Replay unavailable",
  loading: "Loading replay",
  playing: "Replay playing",
  ready: "Replay ready",
} as const;

function MinesweeperReplayMessage({
  message,
  onBackToProfile,
  status,
}: {
  message: string;
  onBackToProfile: () => void;
  status: string;
}) {
  return (
    <GameShell className="bg-[var(--minesweeper-page)] text-[var(--minesweeper-ink)]">
      <div className="mx-auto flex min-h-[60svh] w-full max-w-md flex-col items-center justify-center gap-4 rounded-md border border-[var(--minesweeper-border)] bg-[var(--minesweeper-panel)] p-6 text-center shadow-sm">
        <GameHeader
          status={status}
          statusTestId="minesweeper-replay-status"
          title="Minesweeper replay"
        />
        <p className="text-lg font-semibold tracking-normal text-black">{message}</p>
        <Button onClick={onBackToProfile} type="button" variant="secondary">
          <ArrowLeftIcon data-icon="inline-start" />
          Back
        </Button>
      </div>
    </GameShell>
  );
}

export function MinesweeperReplayPlayer({
  onBackToProfile,
}: MinesweeperReplayPlayerProps) {
  const [game, setGame] = useState<MinesweeperGameState | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [loadStatus, setLoadStatus] = useState<"failed" | "loading" | "ready">("loading");
  const [replay, setReplay] = useState<MinesweeperReplayPayload | null>(null);
  const gameRef = useRef<MinesweeperGameState | null>(null);
  const playbackRef = useRef<PlaybackState | null>(null);
  const leaderboardKey =
    replay?.leaderboardKey ??
    createMinesweeperReplayLeaderboardKey({
      boardHeight: 9,
      boardWidth: 9,
      mineCount: 10,
    });
  const { finalLeaderboardProps } = useGameLeaderboardPresenter({
    formatScore: formatElapsedTime,
    leaderboardKey,
    pendingScore: null,
    scoreLabel: "time",
    sortDirection: "asc",
    testIdPrefix: "minesweeper-replay",
  });
  const { requestBackToMenu } = useGameEscapeToMenu({
    isGameStarted: false,
    onBackToMenu: onBackToProfile,
  });

  useEffect(() => {
    let isCurrent = true;

    fetchMinesweeperReplay()
      .then((latestReplay) => {
        if (!isCurrent) {
          return;
        }

        const initialReplay = createInitialMinesweeperReplayGame(latestReplay);

        gameRef.current = initialReplay.game;
        playbackRef.current = {
          eventIndex: 0,
          events: latestReplay.events,
          random: initialReplay.random,
        };
        setGame(initialReplay.game);
        setIsFinished(false);
        setLoadStatus("ready");
        setReplay(latestReplay);
      })
      .catch(() => {
        if (isCurrent) {
          setLoadStatus("failed");
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const advanceReplayFrame = useCallback(() => {
    const playback = playbackRef.current;
    const currentGame = gameRef.current;

    if (playback === null || currentGame === null || isFinished) {
      return;
    }

    const nextFrame = advanceMinesweeperReplayFrame({
      eventIndex: playback.eventIndex,
      events: playback.events,
      game: currentGame,
      random: playback.random,
    });
    const nextGame = nextFrame.game;

    playback.eventIndex = nextFrame.eventIndex;
    gameRef.current = nextGame;
    setGame(nextGame);

    if (nextFrame.isFinished) {
      setIsFinished(true);
    }
  }, [isFinished]);

  useEffect(() => {
    if (loadStatus !== "ready" || isFinished) {
      return;
    }

    const timeout = window.setTimeout(advanceReplayFrame, MINESWEEPER_REPLAY_STEP_MS);

    return () => window.clearTimeout(timeout);
  }, [advanceReplayFrame, game, isFinished, loadStatus]);

  if (loadStatus === "loading") {
    return (
      <MinesweeperReplayMessage
        message="Loading Minesweeper replay"
        onBackToProfile={requestBackToMenu ?? onBackToProfile}
        status={replayStatusLabels.loading}
      />
    );
  }

  if (loadStatus === "failed" || game === null) {
    return (
      <MinesweeperReplayMessage
        message="No Minesweeper replay is available"
        onBackToProfile={requestBackToMenu ?? onBackToProfile}
        status={replayStatusLabels.failed}
      />
    );
  }

  const remainingMineCount = getMinesweeperRemainingMineCount(game);
  const safeCellCount = game.width * game.height - game.mineCount;
  const statusLabel = isFinished ? "Replay finished" : replayStatusLabels.playing;

  return (
    <GameShell className="bg-[var(--minesweeper-page)] text-[var(--minesweeper-ink)]">
      <GameBoardColumn className="w-[min(92vw,37.25rem,calc(100svh_-_12rem))]">
        <GameSidebar className="border-[var(--minesweeper-border)] bg-[var(--minesweeper-panel)]">
          <GameHeader
            status={statusLabel}
            statusTestId="minesweeper-replay-status"
            title="Minesweeper replay"
          />

          <GameStatsBar>
            <GameStatCard
              className="border-[var(--minesweeper-border)]"
              label="Mines"
              labelClassName="text-[var(--minesweeper-muted)]"
              value={remainingMineCount}
              valueTestId="minesweeper-replay-mines-remaining"
            />
            <GameStatCard
              className="border-[var(--minesweeper-border)]"
              label="Time"
              labelClassName="text-[var(--minesweeper-muted)]"
              value={formatElapsedTime(replay?.finalScore ?? 0)}
              valueTestId="minesweeper-replay-time"
            />
            <GameStatCard
              className="border-[var(--minesweeper-border)]"
              label="Safe cells"
              labelClassName="text-[var(--minesweeper-muted)]"
              value={`${game.revealedSafeCellCount}/${safeCellCount}`}
              valueTestId="minesweeper-replay-safe-cells"
            />
            <GameStatCard
              className="border-[var(--minesweeper-border)]"
              label="Board"
              labelClassName="text-[var(--minesweeper-muted)]"
              value={`${game.width}x${game.height}`}
              valueTestId="minesweeper-replay-board-size"
            />
          </GameStatsBar>
        </GameSidebar>

        <GameBoardStage
          actions={
            <GameBoardActions
              onBackToMenu={requestBackToMenu}
              testIdPrefix="minesweeper-replay"
            />
          }
        >
          <MinesweeperBoard
            game={game}
            isFlagMode={false}
            isInputDisabled
            onRevealCell={() => undefined}
            onToggleFlag={() => undefined}
            statusLabel={statusLabel}
          >
            {isFinished ? (
              <GameEndScreen
                className="gap-3 px-3 py-4"
                testId="minesweeper-replay-finished-screen"
              >
                <div className="flex flex-col items-center gap-1">
                  <p className="text-2xl font-semibold tracking-normal text-balance sm:text-3xl">
                    {game.status === "won" ? "Board cleared" : "Game over"}
                  </p>
                  <p className="text-xs font-semibold text-[#cbd5e1] sm:text-sm">
                    Final time:
                  </p>
                  <p
                    className="font-mono text-4xl font-semibold leading-none sm:text-5xl"
                    data-testid="minesweeper-replay-final-time"
                  >
                    {formatElapsedTime(replay?.finalScore ?? 0)}
                  </p>
                </div>
                <GameLeaderboardPanel
                  {...finalLeaderboardProps}
                  className="max-w-[17rem] p-2 sm:max-w-xs sm:p-3"
                />
                <Button
                  className="min-w-28"
                  data-testid="minesweeper-replay-back-button"
                  onClick={requestBackToMenu ?? onBackToProfile}
                  size="lg"
                  type="button"
                  variant="secondary"
                >
                  <ArrowLeftIcon data-icon="inline-start" />
                  Back
                </Button>
              </GameEndScreen>
            ) : null}
          </MinesweeperBoard>
        </GameBoardStage>
      </GameBoardColumn>
    </GameShell>
  );
}

function formatElapsedTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
