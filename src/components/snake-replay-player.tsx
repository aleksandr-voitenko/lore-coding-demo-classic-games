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
import {
  getReplayEventElapsedMs,
  getReplayPlaybackDelayMs,
  isFutureReplayEventFrame,
  type GameReplayTimedPlayback,
} from "@/components/game-replay-playback";
import { useGameLeaderboardPresenter } from "@/components/game-leaderboard-presenter";
import { SnakeBoard } from "@/components/snake-board";
import { Button } from "@/components/ui/button";
import { getGameTickDelay, type GameState } from "@/lib/snake-game-engine";
import { createFoodFeedback, type FoodFeedback } from "@/lib/snake-food-feedback";
import {
  applySnakeReplayEvent,
  createInitialSnakeReplayGame,
  fetchSnakeReplay,
  type SnakeReplayEvent,
} from "@/lib/snake-replay";
import { createGameLeaderboardKey } from "@/lib/leaderboard";

type SnakeReplayPlayerProps = {
  onBackToProfile: () => void;
};

type PlaybackState = GameReplayTimedPlayback & {
  eventIndex: number;
  events: SnakeReplayEvent[];
  random: () => number;
};

const statusLabels = {
  failed: "Replay unavailable",
  loading: "Loading replay",
  playing: "Replay playing",
  ready: "Replay ready",
} as const;

function SnakeReplayMessage({
  message,
  onBackToProfile,
  status,
}: {
  message: string;
  onBackToProfile: () => void;
  status: string;
}) {
  return (
    <GameShell className="bg-[var(--snake-page)] text-[var(--snake-ink)]">
      <div className="mx-auto flex min-h-[60svh] w-full max-w-md flex-col items-center justify-center gap-4 rounded-md border border-[var(--snake-border)] bg-[var(--snake-panel)] p-6 text-center shadow-sm">
        <GameHeader status={status} statusTestId="snake-replay-status" title="Snake replay" />
        <p className="text-lg font-semibold tracking-normal text-black">{message}</p>
        <Button onClick={onBackToProfile} type="button" variant="secondary">
          <ArrowLeftIcon data-icon="inline-start" />
          Back
        </Button>
      </div>
    </GameShell>
  );
}

export function SnakeReplayPlayer({ onBackToProfile }: SnakeReplayPlayerProps) {
  const [foodFeedbacks, setFoodFeedbacks] = useState<FoodFeedback[]>([]);
  const [game, setGame] = useState<GameState | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [loadStatus, setLoadStatus] = useState<"failed" | "loading" | "ready">("loading");
  const [playbackStep, setPlaybackStep] = useState(0);
  const foodFeedbackIdRef = useRef(0);
  const gameRef = useRef<GameState | null>(null);
  const playbackRef = useRef<PlaybackState | null>(null);
  const leaderboardKey = createGameLeaderboardKey("snake", [
    { name: "mode", value: "levels" },
  ]);
  const { finalLeaderboardProps } = useGameLeaderboardPresenter({
    leaderboardKey,
    pendingScore: null,
    testIdPrefix: "snake-replay",
  });
  const { requestBackToMenu } = useGameEscapeToMenu({
    isGameStarted: false,
    onBackToMenu: onBackToProfile,
  });
  const removeFoodFeedback = useCallback((id: number) => {
    setFoodFeedbacks((current) => current.filter((feedback) => feedback.id !== id));
  }, []);

  useEffect(() => {
    let isCurrent = true;

    fetchSnakeReplay()
      .then((replay) => {
        if (!isCurrent) {
          return;
        }

        const initialReplay = createInitialSnakeReplayGame(replay);

        gameRef.current = initialReplay.game;
        foodFeedbackIdRef.current = 0;
        playbackRef.current = {
          eventIndex: 0,
          events: replay.events,
          lastElapsedMs: 0,
          random: initialReplay.random,
        };
        setFoodFeedbacks([]);
        setGame(initialReplay.game);
        setIsFinished(false);
        setLoadStatus("ready");
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
    const nextFoodFeedbacks: FoodFeedback[] = [];
    let didChangeLevel = false;
    let lastElapsedMs: number | null = null;
    let processedAdvance = false;
    const frameElapsedMs = getReplayEventElapsedMs(
      playback.events[playback.eventIndex],
    );
    const isTimedFrame = frameElapsedMs !== null;

    while (playback.eventIndex < playback.events.length && (isTimedFrame || !processedAdvance)) {
      const event = playback.events[playback.eventIndex]!;
      const previousEventGame = nextGame;

      if (isFutureReplayEventFrame(frameElapsedMs, event)) {
        break;
      }

      playback.eventIndex += 1;
      nextGame = applySnakeReplayEvent(nextGame, event, playback.random);
      lastElapsedMs = getReplayEventElapsedMs(event) ?? lastElapsedMs;
      processedAdvance = isTimedFrame ? false : event.type === "advance";

      if (previousEventGame.level !== nextGame.level) {
        didChangeLevel = true;
        nextFoodFeedbacks.length = 0;
        continue;
      }

      const feedback = createFoodFeedback(
        previousEventGame,
        nextGame,
        foodFeedbackIdRef.current,
      );

      if (feedback !== null) {
        foodFeedbackIdRef.current += 1;
        nextFoodFeedbacks.push(feedback);
      }
    }

    playback.lastElapsedMs = lastElapsedMs ?? playback.lastElapsedMs;
    gameRef.current = nextGame;
    setGame(nextGame);
    setPlaybackStep((current) => current + 1);

    if (didChangeLevel || nextFoodFeedbacks.length > 0) {
      setFoodFeedbacks((current) =>
        didChangeLevel ? nextFoodFeedbacks : [...current, ...nextFoodFeedbacks].slice(-6),
      );
    }

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

    const currentGame = gameRef.current;

    if (currentGame === null || currentGame.status !== "running") {
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
  }, [advanceReplayFrame, game, isFinished, loadStatus, playbackStep]);

  if (loadStatus === "loading") {
    return (
      <SnakeReplayMessage
        message="Loading Snake replay"
        onBackToProfile={requestBackToMenu ?? onBackToProfile}
        status={statusLabels.loading}
      />
    );
  }

  if (loadStatus === "failed" || game === null) {
    return (
      <SnakeReplayMessage
        message="No Snake replay is available"
        onBackToProfile={requestBackToMenu ?? onBackToProfile}
        status={statusLabels.failed}
      />
    );
  }

  const speed = getGameTickDelay({
    pickedUpObjects: game.pickedUpObjects,
    speedBoosts: game.speedBoosts,
    status: game.status,
  });

  return (
    <GameShell className="bg-[var(--snake-page)] text-[var(--snake-ink)]">
      <GameBoardColumn className="w-[min(92vw,41.25rem,calc(100svh_-_12rem))]">
        <GameSidebar className="border-[var(--snake-border)] bg-[var(--snake-panel)]">
          <GameHeader
            status={isFinished ? "Replay finished" : statusLabels.playing}
            statusTestId="snake-replay-status"
            title="Snake replay"
          />

          <GameStatsBar>
            <GameStatCard
              className="border-[var(--snake-border)]"
              label="Score"
              labelClassName="text-[var(--snake-muted)]"
              value={game.score}
              valueTestId="snake-replay-score"
            />
            <GameStatCard
              className="border-[var(--snake-border)]"
              label="Level"
              labelClassName="text-[var(--snake-muted)]"
              value={game.level}
              valueTestId="snake-replay-level"
            />
            <GameStatCard
              className="border-[var(--snake-border)]"
              label="Length"
              labelClassName="text-[var(--snake-muted)]"
              value={game.snake.length}
              valueTestId="snake-replay-length"
            />
            <GameStatCard
              className="border-[var(--snake-border)]"
              label="Speed"
              labelClassName="text-[var(--snake-muted)]"
              value={speed === null ? "0" : `${Math.round(1000 / speed)}`}
              valueTestId="snake-replay-speed"
            />
          </GameStatsBar>
        </GameSidebar>

        <GameBoardStage
          actions={
            <GameBoardActions
              onBackToMenu={requestBackToMenu}
              testIdPrefix="snake-replay"
            />
          }
        >
          <SnakeBoard
            foodFeedbacks={foodFeedbacks}
            game={game}
            onFoodFeedbackAnimationEnd={removeFoodFeedback}
            statusLabel={isFinished ? "Replay finished" : "Replay playing"}
          >
            {isFinished ? (
              <GameEndScreen
                className="gap-3 px-3 py-4"
                testId="snake-replay-finished-screen"
              >
                <div className="flex flex-col items-center gap-1">
                  <p className="text-2xl font-semibold tracking-normal text-balance sm:text-3xl">
                    Replay finished
                  </p>
                  <p className="text-xs font-semibold text-[#cbd5e1] sm:text-sm">
                    Final score:
                  </p>
                  <p
                    className="font-mono text-4xl font-semibold leading-none sm:text-5xl"
                    data-testid="snake-replay-final-score"
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
                  data-testid="snake-replay-back-button"
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
          </SnakeBoard>
        </GameBoardStage>
      </GameBoardColumn>
    </GameShell>
  );
}
