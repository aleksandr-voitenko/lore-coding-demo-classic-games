"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { AsteroidsBoard } from "@/components/asteroids-board";
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
import {
  getReplayEventElapsedMs,
  getReplayPlaybackDelayMs,
  isFutureReplayEventFrame,
  type GameReplayTimedPlayback,
} from "@/components/game-replay-playback";
import { useGameLeaderboardPresenter } from "@/components/game-leaderboard-presenter";
import { Button } from "@/components/ui/button";
import { type AsteroidsGameState } from "@/lib/asteroids-game-engine";
import {
  applyAsteroidsReplayEvent,
  createDefaultAsteroidsReplayLeaderboardKey,
  createInitialAsteroidsReplayGame,
  fetchAsteroidsReplay,
  type AsteroidsReplayEvent,
  type AsteroidsReplayPayload,
  type AsteroidsReplayPlaybackState,
} from "@/lib/asteroids-replay";

type AsteroidsReplayPlayerProps = {
  onBackToProfile: () => void;
};

type PlaybackState = GameReplayTimedPlayback & {
  eventIndex: number;
  events: AsteroidsReplayEvent[];
  replayState: AsteroidsReplayPlaybackState;
};

const replayStatusLabels = {
  failed: "Replay unavailable",
  loading: "Loading replay",
  playing: "Replay playing",
  ready: "Replay ready",
} as const;

function isReplayFrameBoundary(event: AsteroidsReplayEvent) {
  return event.type === "advance" || event.type === "fire" || event.type === "start";
}

function AsteroidsReplayMessage({
  message,
  onBackToProfile,
  status,
}: {
  message: string;
  onBackToProfile: () => void;
  status: string;
}) {
  return (
    <GameShell className="bg-[var(--asteroids-page)] text-[var(--asteroids-ink)]">
      <div className="mx-auto flex min-h-[60svh] w-full max-w-md flex-col items-center justify-center gap-4 rounded-md border border-[var(--asteroids-border)] bg-[var(--asteroids-panel)] p-6 text-center shadow-sm">
        <GameHeader
          status={status}
          statusTestId="asteroids-replay-status"
          title="Asteroids replay"
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

export function AsteroidsReplayPlayer({ onBackToProfile }: AsteroidsReplayPlayerProps) {
  const [game, setGame] = useState<AsteroidsGameState | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [loadStatus, setLoadStatus] = useState<"failed" | "loading" | "ready">("loading");
  const [playbackStep, setPlaybackStep] = useState(0);
  const [replay, setReplay] = useState<AsteroidsReplayPayload | null>(null);
  const playbackRef = useRef<PlaybackState | null>(null);
  const leaderboardKey =
    replay?.leaderboardKey ?? createDefaultAsteroidsReplayLeaderboardKey();
  const { finalLeaderboardProps } = useGameLeaderboardPresenter({
    leaderboardKey,
    pendingScore: null,
    testIdPrefix: "asteroids-replay",
  });
  const { requestBackToMenu } = useGameEscapeToMenu({
    isGameStarted: false,
    onBackToMenu: onBackToProfile,
  });

  useEffect(() => {
    let isCurrent = true;

    fetchAsteroidsReplay()
      .then((latestReplay) => {
        if (!isCurrent) {
          return;
        }

        const initialReplay = createInitialAsteroidsReplayGame(latestReplay);

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
      nextReplayState = applyAsteroidsReplayEvent(nextReplayState, event);
      lastElapsedMs = getReplayEventElapsedMs(event) ?? lastElapsedMs;
      processedFrame = isTimedFrame ? false : isReplayFrameBoundary(event);
    }

    playback.lastElapsedMs = lastElapsedMs ?? playback.lastElapsedMs;
    playback.replayState = nextReplayState;
    setGame(nextReplayState.game);
    setPlaybackStep((current) => current + 1);

    if (
      playback.eventIndex >= playback.events.length ||
      nextReplayState.game.status === "lost"
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
      <AsteroidsReplayMessage
        message="Loading Asteroids replay"
        onBackToProfile={requestBackToMenu ?? onBackToProfile}
        status={replayStatusLabels.loading}
      />
    );
  }

  if (loadStatus === "failed" || game === null) {
    return (
      <AsteroidsReplayMessage
        message="No Asteroids replay is available"
        onBackToProfile={requestBackToMenu ?? onBackToProfile}
        status={replayStatusLabels.failed}
      />
    );
  }

  const statusLabel = isFinished ? "Replay finished" : replayStatusLabels.playing;

  return (
    <GameShell className="bg-[var(--asteroids-page)] text-[var(--asteroids-ink)]">
      <GameBoardColumn className="w-[min(94vw,50rem,calc(133.333svh_-_16rem))]">
        <GameSidebar className="border-[var(--asteroids-border)] bg-[var(--asteroids-panel)]">
          <GameHeader
            status={statusLabel}
            statusTestId="asteroids-replay-status"
            title="Asteroids replay"
          />

          <GameStatsBar>
            <GameStatCard
              className="border-[var(--asteroids-border)]"
              label="Score"
              labelClassName="text-[var(--asteroids-muted)]"
              value={game.score}
              valueTestId="asteroids-replay-score"
            />
            <GameStatCard
              className="border-[var(--asteroids-border)]"
              label="Lives"
              labelClassName="text-[var(--asteroids-muted)]"
              value={game.lives}
              valueTestId="asteroids-replay-lives"
            />
            <GameStatCard
              className="border-[var(--asteroids-border)]"
              label="Wave"
              labelClassName="text-[var(--asteroids-muted)]"
              value={game.wave}
              valueTestId="asteroids-replay-wave"
            />
            <GameStatCard
              className="border-[var(--asteroids-border)]"
              label="Rocks"
              labelClassName="text-[var(--asteroids-muted)]"
              value={game.asteroids.length}
              valueTestId="asteroids-replay-rocks"
            />
          </GameStatsBar>
        </GameSidebar>

        <GameBoardStage
          actions={
            <GameBoardActions
              onBackToMenu={requestBackToMenu}
              testIdPrefix="asteroids-replay"
            />
          }
        >
          <AsteroidsBoard game={game} statusLabel={statusLabel}>
            {isFinished ? (
              <GameEndScreen
                className="gap-3 px-3 py-4"
                testId="asteroids-replay-finished-screen"
              >
                <div className="flex flex-col items-center gap-1">
                  <p className="text-2xl font-semibold tracking-normal text-balance sm:text-3xl">
                    Game over
                  </p>
                  <p className="text-xs font-semibold text-[#cbd5e1] sm:text-sm">
                    Final score:
                  </p>
                  <p
                    className="font-mono text-4xl font-semibold leading-none sm:text-5xl"
                    data-testid="asteroids-replay-final-score"
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
                  data-testid="asteroids-replay-back-button"
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
          </AsteroidsBoard>
        </GameBoardStage>
      </GameBoardColumn>
    </GameShell>
  );
}
