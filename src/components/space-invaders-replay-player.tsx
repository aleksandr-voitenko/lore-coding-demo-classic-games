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
  useGameEscapeToMenu,
} from "@/components/game-layout";
import {
  getReplayEventElapsedMs,
  getReplayPlaybackDelayMs,
  isFutureReplayEventFrame,
  type GameReplayTimedPlayback,
} from "@/components/game-replay-playback";
import { useGameLeaderboardPresenter } from "@/components/game-leaderboard-presenter";
import { SpaceInvadersBoard } from "@/components/space-invaders-board";
import { Button } from "@/components/ui/button";
import { type SpaceInvadersGameState } from "@/lib/space-invaders-game-engine";
import {
  applySpaceInvadersReplayEvent,
  createDefaultSpaceInvadersReplayLeaderboardKey,
  createInitialSpaceInvadersReplayGame,
  fetchSpaceInvadersReplay,
  type SpaceInvadersReplayEvent,
  type SpaceInvadersReplayPayload,
  type SpaceInvadersReplayPlaybackState,
} from "@/lib/space-invaders-replay";

type SpaceInvadersReplayPlayerProps = {
  onBackToProfile: () => void;
};

type PlaybackState = GameReplayTimedPlayback & {
  eventIndex: number;
  events: SpaceInvadersReplayEvent[];
  replayState: SpaceInvadersReplayPlaybackState;
};

const replayStatusLabels = {
  failed: "Replay unavailable",
  loading: "Loading replay",
  playing: "Replay playing",
  ready: "Replay ready",
} as const;

function isReplayFrameBoundary(event: SpaceInvadersReplayEvent) {
  return event.type === "advance" || event.type === "fire" || event.type === "start";
}

function SpaceInvadersReplayMessage({
  message,
  onBackToProfile,
  status,
}: {
  message: string;
  onBackToProfile: () => void;
  status: string;
}) {
  return (
    <GameShell className="h-svh overflow-hidden bg-[var(--invaders-page)] px-0 py-0 text-[var(--invaders-ink)] sm:px-0 lg:py-0 [&>section]:h-svh [&>section]:max-w-none [&>section]:items-start xl:[&>section]:min-h-svh xl:[&>section]:items-start">
      <div className="mx-auto flex min-h-[60svh] w-full max-w-md flex-col items-center justify-center gap-4 rounded-md border border-[var(--invaders-board-border)] bg-[var(--invaders-board)] p-6 text-center shadow-sm">
        <GameHeader
          status={status}
          statusTestId="space-invaders-replay-status"
          title="Space Invaders replay"
        />
        <p className="text-lg font-semibold tracking-normal text-[var(--invaders-board-text)]">
          {message}
        </p>
        <Button onClick={onBackToProfile} type="button" variant="secondary">
          <ArrowLeftIcon data-icon="inline-start" />
          Back
        </Button>
      </div>
    </GameShell>
  );
}

export function SpaceInvadersReplayPlayer({
  onBackToProfile,
}: SpaceInvadersReplayPlayerProps) {
  const [game, setGame] = useState<SpaceInvadersGameState | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [loadStatus, setLoadStatus] = useState<"failed" | "loading" | "ready">(
    "loading",
  );
  const [playbackStep, setPlaybackStep] = useState(0);
  const [replay, setReplay] = useState<SpaceInvadersReplayPayload | null>(null);
  const playbackRef = useRef<PlaybackState | null>(null);
  const leaderboardKey =
    replay?.leaderboardKey ?? createDefaultSpaceInvadersReplayLeaderboardKey();
  const { finalLeaderboardProps } = useGameLeaderboardPresenter({
    leaderboardKey,
    pendingScore: null,
    testIdPrefix: "space-invaders-replay",
  });
  const { requestBackToMenu } = useGameEscapeToMenu({
    isGameStarted: false,
    onBackToMenu: onBackToProfile,
  });

  useEffect(() => {
    let isCurrent = true;

    fetchSpaceInvadersReplay()
      .then((latestReplay) => {
        if (!isCurrent) {
          return;
        }

        const initialReplay = createInitialSpaceInvadersReplayGame(latestReplay);

        playbackRef.current = {
          eventIndex: 0,
          events: latestReplay.events,
          lastElapsedMs: 0,
          replayState: initialReplay,
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

    if (playback === null || isFinished) {
      return;
    }

    let nextReplayState = playback.replayState;
    let lastElapsedMs: number | null = null;
    let processedFrame = false;
    const frameElapsedMs = getReplayEventElapsedMs(
      playback.events[playback.eventIndex],
    );
    const isTimedFrame = frameElapsedMs !== null;

    while (playback.eventIndex < playback.events.length && (isTimedFrame || !processedFrame)) {
      const event = playback.events[playback.eventIndex]!;

      if (isFutureReplayEventFrame(frameElapsedMs, event)) {
        break;
      }

      playback.eventIndex += 1;
      nextReplayState = applySpaceInvadersReplayEvent(nextReplayState, event);
      lastElapsedMs = getReplayEventElapsedMs(event) ?? lastElapsedMs;
      processedFrame = isTimedFrame ? false : isReplayFrameBoundary(event);
    }

    playback.lastElapsedMs = lastElapsedMs ?? playback.lastElapsedMs;
    playback.replayState = nextReplayState;
    setGame(nextReplayState.game);
    setPlaybackStep((current) => current + 1);

    if (
      playback.eventIndex >= playback.events.length ||
      nextReplayState.game.status === "lost" ||
      nextReplayState.game.status === "won"
    ) {
      setIsFinished(true);
    }
  }, [isFinished]);

  useEffect(() => {
    if (loadStatus !== "ready" || isFinished) {
      return;
    }

    const playback = playbackRef.current;
    const nextEvent = playback?.events[playback.eventIndex];

    if (playback === null || nextEvent === undefined) {
      return;
    }

    const timeout = window.setTimeout(
      advanceReplayFrame,
      getReplayPlaybackDelayMs({
        event: nextEvent,
        playback,
      }),
    );

    return () => window.clearTimeout(timeout);
  }, [advanceReplayFrame, isFinished, loadStatus, playbackStep]);

  if (loadStatus === "loading") {
    return (
      <SpaceInvadersReplayMessage
        message="Loading Space Invaders replay"
        onBackToProfile={requestBackToMenu ?? onBackToProfile}
        status={replayStatusLabels.loading}
      />
    );
  }

  if (loadStatus === "failed" || game === null) {
    return (
      <SpaceInvadersReplayMessage
        message="No Space Invaders replay is available"
        onBackToProfile={requestBackToMenu ?? onBackToProfile}
        status={replayStatusLabels.failed}
      />
    );
  }

  const statusLabel = isFinished ? "Replay finished" : replayStatusLabels.playing;

  return (
    <GameShell className="h-svh overflow-hidden bg-[var(--invaders-page)] px-0 py-0 text-[var(--invaders-ink)] sm:px-0 lg:py-0 [&>section]:h-svh [&>section]:max-w-none [&>section]:items-start xl:[&>section]:min-h-svh xl:[&>section]:items-start">
      <GameBoardColumn className="w-[min(100vw,75svh)] gap-0">
        <GameHeader
          status={statusLabel}
          statusTestId="space-invaders-replay-status"
          title="Space Invaders replay"
        />

        <GameBoardStage
          actions={
            <GameBoardActions
              onBackToMenu={requestBackToMenu}
              testIdPrefix="space-invaders-replay"
            />
          }
        >
          <SpaceInvadersBoard game={game} statusLabel={statusLabel}>
            {isFinished ? (
              <GameEndScreen
                className="gap-3 px-3 py-4"
                testId="space-invaders-replay-finished-screen"
              >
                <div className="flex flex-col items-center gap-1">
                  <p className="text-2xl font-semibold tracking-normal text-balance sm:text-3xl">
                    {game.status === "won" ? "Earth defended" : "Game over"}
                  </p>
                  <p className="text-xs font-semibold text-[#cbd5e1] sm:text-sm">
                    Final score:
                  </p>
                  <p
                    className="font-mono text-4xl font-semibold leading-none sm:text-5xl"
                    data-testid="space-invaders-replay-final-score"
                  >
                    {game.score}
                  </p>
                </div>
                <GameLeaderboardPanel
                  {...finalLeaderboardProps}
                  className="max-w-[17rem] p-2 sm:max-w-xs sm:p-3"
                />
                <Button
                  className="min-w-28"
                  data-testid="space-invaders-replay-back-button"
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
          </SpaceInvadersBoard>
        </GameBoardStage>
      </GameBoardColumn>
    </GameShell>
  );
}
