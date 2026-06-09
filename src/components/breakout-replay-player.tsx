"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { BreakoutBoard } from "@/components/breakout-board";
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
import { Button } from "@/components/ui/button";
import {
  getBreakoutBallSpeed,
  getBreakoutTickDelay,
  type BreakoutGameState,
} from "@/lib/breakout-game-engine";
import {
  applyBreakoutReplayEvent,
  createDefaultBreakoutReplayLeaderboardKey,
  createInitialBreakoutReplayGame,
  fetchBreakoutReplay,
  type BreakoutReplayEvent,
  type BreakoutReplayPayload,
} from "@/lib/breakout-replay";

type BreakoutReplayPlayerProps = {
  onBackToProfile: () => void;
};

type PlaybackState = {
  eventIndex: number;
  events: BreakoutReplayEvent[];
  random: () => number;
};

const replayStatusLabels = {
  failed: "Replay unavailable",
  loading: "Loading replay",
  playing: "Replay playing",
  ready: "Replay ready",
} as const;

function BreakoutReplayMessage({
  message,
  onBackToProfile,
  status,
}: {
  message: string;
  onBackToProfile: () => void;
  status: string;
}) {
  return (
    <GameShell className="bg-[var(--breakout-page)] text-[var(--breakout-ink)]">
      <div className="mx-auto flex min-h-[60svh] w-full max-w-md flex-col items-center justify-center gap-4 rounded-md border border-[var(--breakout-border)] bg-[var(--breakout-panel)] p-6 text-center shadow-sm">
        <GameHeader
          status={status}
          statusTestId="breakout-replay-status"
          title="Breakout replay"
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

export function BreakoutReplayPlayer({ onBackToProfile }: BreakoutReplayPlayerProps) {
  const [game, setGame] = useState<BreakoutGameState | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [loadStatus, setLoadStatus] = useState<"failed" | "loading" | "ready">("loading");
  const [replay, setReplay] = useState<BreakoutReplayPayload | null>(null);
  const gameRef = useRef<BreakoutGameState | null>(null);
  const playbackRef = useRef<PlaybackState | null>(null);
  const leaderboardKey = replay?.leaderboardKey ?? createDefaultBreakoutReplayLeaderboardKey();
  const { finalLeaderboardProps } = useGameLeaderboardPresenter({
    leaderboardKey,
    pendingScore: null,
    testIdPrefix: "breakout-replay",
  });
  const { requestBackToMenu } = useGameEscapeToMenu({
    isGameStarted: false,
    onBackToMenu: onBackToProfile,
  });

  useEffect(() => {
    let isCurrent = true;

    fetchBreakoutReplay()
      .then((latestReplay) => {
        if (!isCurrent) {
          return;
        }

        const initialReplay = createInitialBreakoutReplayGame(latestReplay);

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

    let nextGame = currentGame;
    let processedAdvance = false;

    while (playback.eventIndex < playback.events.length && !processedAdvance) {
      const event = playback.events[playback.eventIndex]!;

      playback.eventIndex += 1;
      nextGame = applyBreakoutReplayEvent(nextGame, event, playback.random);
      processedAdvance = event.type === "advance";
    }

    gameRef.current = nextGame;
    setGame(nextGame);

    if (
      playback.eventIndex >= playback.events.length ||
      nextGame.status === "lost" ||
      nextGame.status === "won"
    ) {
      setIsFinished(true);
    }
  }, [isFinished]);

  useEffect(() => {
    if (loadStatus !== "ready" || isFinished) {
      return;
    }

    const timeout = window.setTimeout(advanceReplayFrame, getBreakoutTickDelay());

    return () => window.clearTimeout(timeout);
  }, [advanceReplayFrame, game, isFinished, loadStatus]);

  if (loadStatus === "loading") {
    return (
      <BreakoutReplayMessage
        message="Loading Breakout replay"
        onBackToProfile={requestBackToMenu ?? onBackToProfile}
        status={replayStatusLabels.loading}
      />
    );
  }

  if (loadStatus === "failed" || game === null) {
    return (
      <BreakoutReplayMessage
        message="No Breakout replay is available"
        onBackToProfile={requestBackToMenu ?? onBackToProfile}
        status={replayStatusLabels.failed}
      />
    );
  }

  const activeBrickCount = game.bricks.filter((brick) => brick.isActive).length;
  const ballSpeed =
    game.status === "running" ? getBreakoutBallSpeed(game.ball.velocity) : null;
  const statusLabel = isFinished ? "Replay finished" : replayStatusLabels.playing;

  return (
    <GameShell className="bg-[var(--breakout-page)] text-[var(--breakout-ink)]">
      <GameBoardColumn className="w-[min(92vw,37.25rem,calc(75svh_-_9rem))]">
        <GameSidebar className="border-[var(--breakout-border)] bg-[var(--breakout-panel)]">
          <GameHeader
            status={statusLabel}
            statusTestId="breakout-replay-status"
            title="Breakout replay"
          />

          <GameStatsBar>
            <GameStatCard
              className="border-[var(--breakout-border)]"
              label="Score"
              labelClassName="text-[var(--breakout-muted)]"
              value={game.score}
              valueTestId="breakout-replay-score"
            />
            <GameStatCard
              className="border-[var(--breakout-border)]"
              label="Lives"
              labelClassName="text-[var(--breakout-muted)]"
              value={game.lives}
              valueTestId="breakout-replay-lives"
            />
            <GameStatCard
              className="border-[var(--breakout-border)]"
              label="Bricks"
              labelClassName="text-[var(--breakout-muted)]"
              value={activeBrickCount}
              valueTestId="breakout-replay-bricks-remaining"
            />
            <GameStatCard
              className="border-[var(--breakout-border)]"
              label="Speed"
              labelClassName="text-[var(--breakout-muted)]"
              value={ballSpeed === null ? "0" : ballSpeed.toFixed(2)}
              valueTestId="breakout-replay-speed"
            />
          </GameStatsBar>
        </GameSidebar>

        <GameBoardStage
          actions={
            <GameBoardActions
              onBackToMenu={requestBackToMenu}
              testIdPrefix="breakout-replay"
            />
          }
        >
          <BreakoutBoard game={game} statusLabel={statusLabel}>
            {isFinished ? (
              <GameEndScreen
                className="gap-3 px-3 py-4"
                testId="breakout-replay-finished-screen"
              >
                <div className="flex flex-col items-center gap-1">
                  <p className="text-2xl font-semibold tracking-normal text-balance sm:text-3xl">
                    {game.status === "won" ? "Wall cleared" : "Game over"}
                  </p>
                  <p className="text-xs font-semibold text-[#cbd5e1] sm:text-sm">
                    Final score:
                  </p>
                  <p
                    className="font-mono text-4xl font-semibold leading-none sm:text-5xl"
                    data-testid="breakout-replay-final-score"
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
                  data-testid="breakout-replay-back-button"
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
          </BreakoutBoard>
        </GameBoardStage>
      </GameBoardColumn>
    </GameShell>
  );
}
