"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { GameLeaderboardPanel } from "@/components/game-leaderboard";
import { GameReplayCursor } from "@/components/game-replay-cursor";
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
import {
  getReplayEventElapsedMs,
  getReplayPlaybackDelayMs,
  isFutureReplayEventFrame,
  type GameReplayTimedPlayback,
  useGameReplayPlayback,
} from "@/components/game-replay-playback";
import { useGameLeaderboardPresenter } from "@/components/game-leaderboard-presenter";
import { MinesweeperBoard } from "@/components/minesweeper-board";
import { Button } from "@/components/ui/button";
import {
  MINESWEEPER_DEFAULT_DIFFICULTY,
  getMinesweeperRemainingMineCount,
  type MinesweeperGameState,
} from "@/lib/minesweeper-game-engine";
import {
  applyMinesweeperReplayEvent,
  createInitialMinesweeperReplayGame,
  createMinesweeperReplayLeaderboardKey,
  fetchMinesweeperReplay,
  type MinesweeperReplayCursorEvent,
  type MinesweeperReplayCursorPosition,
  type MinesweeperReplayEvent,
  type MinesweeperReplayPayload,
} from "@/lib/minesweeper-replay";

type MinesweeperReplayPlayerProps = {
  onBackToProfile: () => void;
};

type PlaybackState = GameReplayTimedPlayback & {
  cursorEventIndex: number;
  cursorEvents: MinesweeperReplayCursorEvent[];
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
  let lastElapsedMs: number | null = null;
  // Timed payloads consume one elapsed boundary; untimed payloads stop after a visible board change.
  const frameElapsedMs = getReplayEventElapsedMs(events[eventIndex]);
  const isTimedFrame = frameElapsedMs !== null;

  while (nextEventIndex < events.length && (isTimedFrame || !processedVisibleAction)) {
    const event = events[nextEventIndex]!;
    const previousGame = nextGame;

    if (isFutureReplayEventFrame(frameElapsedMs, event)) {
      break;
    }

    nextEventIndex += 1;
    nextGame = applyMinesweeperReplayEvent(nextGame, event, random);
    lastElapsedMs = getReplayEventElapsedMs(event) ?? lastElapsedMs;
    processedVisibleAction =
      isTimedFrame ? false : event.type !== "start" && nextGame !== previousGame;
  }

  return {
    eventIndex: nextEventIndex,
    game: nextGame,
    isFinished:
      nextEventIndex >= events.length ||
      nextGame.status === "lost" ||
      nextGame.status === "won",
    lastElapsedMs,
  };
}

export function shouldAdvanceMinesweeperReplayCursorBeforeAction({
  cursorEvent,
  event,
}: {
  cursorEvent: MinesweeperReplayCursorEvent | undefined;
  event: MinesweeperReplayEvent | undefined;
}) {
  // Same-timestamp cursor positions should appear before the board action they point at.
  const cursorElapsedMs = getReplayEventElapsedMs(cursorEvent);
  const eventElapsedMs = getReplayEventElapsedMs(event);

  return (
    cursorElapsedMs !== null &&
    (eventElapsedMs === null || cursorElapsedMs <= eventElapsedMs)
  );
}

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
        <p className="text-lg font-semibold tracking-normal">{message}</p>
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
  const [cursorPosition, setCursorPosition] =
    useState<MinesweeperReplayCursorPosition | null>(null);
  const [cursorStep, setCursorStep] = useState(0);
  const initializeReplay = useCallback(
    (latestReplay: MinesweeperReplayPayload) => {
      const initialReplay = createInitialMinesweeperReplayGame(latestReplay);

      setCursorPosition(null);

      return {
        game: initialReplay.game,
        playback: {
          cursorEventIndex: 0,
          cursorEvents: latestReplay.cursorEvents,
          eventIndex: 0,
          events: latestReplay.events,
          lastElapsedMs: 0,
          random: initialReplay.random,
        } satisfies PlaybackState,
      };
    },
    [],
  );

  const advanceReplayFrame = useCallback(
    ({
      game,
      playback,
    }: {
      game: MinesweeperGameState;
      playback: PlaybackState;
    }) => {
      const nextFrame = advanceMinesweeperReplayFrame({
        eventIndex: playback.eventIndex,
        events: playback.events,
        game,
        random: playback.random,
      });

      playback.eventIndex = nextFrame.eventIndex;
      playback.lastElapsedMs = nextFrame.lastElapsedMs ?? playback.lastElapsedMs;

      return {
        game: nextFrame.game,
        isFinished: nextFrame.isFinished,
      };
    },
    [],
  );
  const canAdvanceReplay = useCallback(
    ({
      playback,
    }: {
      game: MinesweeperGameState;
      playback: PlaybackState;
    }) => {
      const nextEvent = playback.events[playback.eventIndex];
      const nextCursorEvent = playback.cursorEvents[playback.cursorEventIndex];

      return !shouldAdvanceMinesweeperReplayCursorBeforeAction({
        cursorEvent: nextCursorEvent,
        event: nextEvent,
      });
    },
    [],
  );
  const { game, isFinished, loadStatus, playbackRef, replay } = useGameReplayPlayback({
    advanceFrame: advanceReplayFrame,
    canAdvance: canAdvanceReplay,
    initializeReplay,
    loadReplay: fetchMinesweeperReplay,
    scheduleVersion: cursorStep,
  });
  const leaderboardKey =
    replay?.leaderboardKey ??
    createMinesweeperReplayLeaderboardKey({
      difficulty: MINESWEEPER_DEFAULT_DIFFICULTY,
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
    if (loadStatus !== "ready" || isFinished) {
      return;
    }

    const playback = playbackRef.current;
    const nextCursorEvent = playback?.cursorEvents[playback.cursorEventIndex];

    if (playback === null || nextCursorEvent === undefined) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const currentPlayback = playbackRef.current;
      const cursorEvent =
        currentPlayback?.cursorEvents[currentPlayback.cursorEventIndex];

      if (currentPlayback === null || cursorEvent === undefined) {
        return;
      }

      currentPlayback.cursorEventIndex += 1;
      currentPlayback.lastElapsedMs = cursorEvent.elapsedMs;
      setCursorPosition({
        x: cursorEvent.x,
        y: cursorEvent.y,
      });
      setCursorStep((current) => current + 1);
    }, getReplayPlaybackDelayMs({
      event: nextCursorEvent,
      playback,
    }));

    return () => window.clearTimeout(timeout);
  }, [cursorStep, isFinished, loadStatus, playbackRef]);

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
  const statusLabel = isFinished ? "Replay finished" : replayStatusLabels.playing;

  return (
    <GameShell className="bg-[var(--minesweeper-page)] text-[var(--minesweeper-ink)]">
      <GameBoardColumn className={getMinesweeperBoardColumnClassName(game)}>
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
            <GameReplayCursor
              position={cursorPosition}
              testId="minesweeper-replay-cursor"
            />
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

function getMinesweeperBoardColumnClassName(
  game: Pick<MinesweeperGameState, "height" | "width">,
) {
  return game.width > game.height
    ? "w-[min(96vw,56rem)]"
    : "w-[min(92vw,37.25rem,calc(100svh_-_12rem))]";
}
