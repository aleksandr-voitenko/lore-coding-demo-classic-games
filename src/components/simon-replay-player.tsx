"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

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
  type GameReplayTimedPlayback,
} from "@/components/game-replay-playback";
import { useGameLeaderboardPresenter } from "@/components/game-leaderboard-presenter";
import { SimonBoard } from "@/components/simon-board";
import { Button } from "@/components/ui/button";
import type { SimonGameState, SimonStatus } from "@/lib/simon-game-engine";
import {
  applySimonReplayEvent,
  createDefaultSimonReplayLeaderboardKey,
  createInitialSimonReplayGame,
  fetchSimonReplay,
  type SimonReplayCursorEvent,
  type SimonReplayCursorPosition,
  type SimonReplayEvent,
  type SimonReplayPayload,
} from "@/lib/simon-replay";

type SimonReplayPlayerProps = {
  onBackToProfile: () => void;
};

type PlaybackState = GameReplayTimedPlayback & {
  cursorEventIndex: number;
  cursorEvents: SimonReplayCursorEvent[];
  eventIndex: number;
  events: SimonReplayEvent[];
  random: () => number;
};

export function shouldAdvanceSimonReplayCursorBeforeAction({
  cursorEvent,
  event,
}: {
  cursorEvent: SimonReplayCursorEvent | undefined;
  event: SimonReplayEvent | undefined;
}) {
  // Same-timestamp cursor positions should appear before the pad action they point at.
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

const simonStatusLabels: Record<SimonStatus, string> = {
  correct: "Correct",
  input: "Repeat",
  lost: "Game over",
  missed: "Miss",
  paused: "Paused",
  ready: "Ready",
  showing: "Watch",
  won: "Sequence cleared",
};

function getSimonReplayStatusLabel(game: SimonGameState, isFinished: boolean) {
  if (isFinished) {
    return "Replay finished";
  }

  if ((game.status === "correct" || game.status === "missed") && game.activePad !== null) {
    return simonStatusLabels.input;
  }

  return simonStatusLabels[game.status];
}

export function SimonReplayTurnFeedback({
  game,
}: {
  game: Pick<SimonGameState, "activePad" | "status">;
}) {
  if (game.status === "correct" && game.activePad === null) {
    return (
      <div
        className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-[0.375rem] text-center text-[var(--simon-feedback-ink)]"
        data-testid="simon-replay-correct-feedback"
        role="status"
      >
        <p className="simon-turn-feedback simon-feedback-border rounded-md border bg-[var(--simon-feedback-panel)] px-5 py-3 text-3xl font-black tracking-normal shadow-[0_18px_46px_var(--simon-feedback-shadow)] backdrop-blur-[2px] sm:text-4xl">
          CORRECT!
        </p>
      </div>
    );
  }

  if (game.status === "missed" && game.activePad === null) {
    return (
      <div
        className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-[0.375rem] text-center text-[var(--simon-feedback-ink)]"
        data-testid="simon-replay-miss-feedback"
        role="status"
      >
        <p className="simon-turn-feedback simon-miss-border rounded-md border bg-[var(--simon-miss-panel)] px-5 py-3 text-3xl font-black tracking-normal text-[var(--simon-miss)] shadow-[0_18px_46px_color-mix(in_oklch,var(--simon-miss)_24%,transparent)] backdrop-blur-[2px] sm:text-4xl">
          MISS!
        </p>
      </div>
    );
  }

  return null;
}

function SimonReplayMessage({
  message,
  onBackToProfile,
  status,
}: {
  message: string;
  onBackToProfile: () => void;
  status: string;
}) {
  return (
    <GameShell className="bg-[var(--simon-page)] text-[var(--simon-ink)]">
      <div className="simon-chrome-border mx-auto flex min-h-[60svh] w-full max-w-md flex-col items-center justify-center gap-4 rounded-md border bg-[var(--simon-panel)] p-6 text-center shadow-sm">
        <GameHeader status={status} statusTestId="simon-replay-status" title="Simon replay" />
        <p className="text-lg font-semibold tracking-normal">{message}</p>
        <Button onClick={onBackToProfile} type="button" variant="secondary">
          <ArrowLeftIcon data-icon="inline-start" />
          Back
        </Button>
      </div>
    </GameShell>
  );
}

export function SimonReplayPlayer({ onBackToProfile }: SimonReplayPlayerProps) {
  const [game, setGame] = useState<SimonGameState | null>(null);
  const [cursorPosition, setCursorPosition] =
    useState<SimonReplayCursorPosition | null>(null);
  const [cursorStep, setCursorStep] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [loadStatus, setLoadStatus] = useState<"failed" | "loading" | "ready">("loading");
  const [playbackStep, setPlaybackStep] = useState(0);
  const [replay, setReplay] = useState<SimonReplayPayload | null>(null);
  const gameRef = useRef<SimonGameState | null>(null);
  const playbackRef = useRef<PlaybackState | null>(null);
  const leaderboardKey = replay?.leaderboardKey ?? createDefaultSimonReplayLeaderboardKey();
  const { finalLeaderboardProps } = useGameLeaderboardPresenter({
    leaderboardKey,
    pendingScore: null,
    testIdPrefix: "simon-replay",
  });
  const { requestBackToMenu } = useGameEscapeToMenu({
    isGameStarted: false,
    onBackToMenu: onBackToProfile,
  });

  useEffect(() => {
    let isCurrent = true;

    fetchSimonReplay()
      .then((latestReplay) => {
        if (!isCurrent) {
          return;
        }

        const initialReplay = createInitialSimonReplayGame(latestReplay);

        gameRef.current = initialReplay.game;
        playbackRef.current = {
          cursorEventIndex: 0,
          cursorEvents: latestReplay.cursorEvents,
          eventIndex: 0,
          events: latestReplay.events,
          lastElapsedMs: 0,
          random: initialReplay.random,
        };
        setCursorPosition(null);
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

    const event = playback.events[playback.eventIndex];

    if (event === undefined) {
      setIsFinished(true);
      return;
    }

    const nextGame = applySimonReplayEvent(currentGame, event, playback.random);

    playback.lastElapsedMs = getReplayEventElapsedMs(event) ?? playback.lastElapsedMs;
    playback.eventIndex += 1;
    gameRef.current = nextGame;
    setGame(nextGame);
    setPlaybackStep((current) => current + 1);

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

    const playback = playbackRef.current;
    const nextEvent = playback?.events[playback.eventIndex];
    const nextCursorEvent = playback?.cursorEvents[playback.cursorEventIndex];

    if (playback === null || nextEvent === undefined) {
      return;
    }

    if (
      shouldAdvanceSimonReplayCursorBeforeAction({
        cursorEvent: nextCursorEvent,
        event: nextEvent,
      })
    ) {
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
  }, [advanceReplayFrame, cursorStep, isFinished, loadStatus, playbackStep]);

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
  }, [cursorStep, isFinished, loadStatus]);

  const ignorePadPress = useCallback(() => undefined, []);

  if (loadStatus === "loading") {
    return (
      <SimonReplayMessage
        message="Loading Simon replay"
        onBackToProfile={requestBackToMenu ?? onBackToProfile}
        status={replayStatusLabels.loading}
      />
    );
  }

  if (loadStatus === "failed" || game === null) {
    return (
      <SimonReplayMessage
        message="No Simon replay is available"
        onBackToProfile={requestBackToMenu ?? onBackToProfile}
        status={replayStatusLabels.failed}
      />
    );
  }

  const statusLabel = getSimonReplayStatusLabel(game, isFinished);
  return (
    <GameShell className="bg-[var(--simon-page)] text-[var(--simon-ink)]">
      <GameBoardColumn className="w-[min(92vw,37.25rem,calc(100svh_-_12rem))]">
        <GameSidebar className="simon-chrome-border bg-[var(--simon-panel)]">
          <GameHeader
            status={statusLabel}
            statusTestId="simon-replay-status"
            title="Simon replay"
          />

          <GameStatsBar>
            <GameStatCard
              className="simon-chrome-border"
              label="Score"
              labelClassName="text-[var(--simon-muted)]"
              value={game.score}
              valueTestId="simon-replay-score"
            />
            <GameStatCard
              className="simon-chrome-border"
              label="Round"
              labelClassName="text-[var(--simon-muted)]"
              value={game.round}
              valueTestId="simon-replay-round"
            />
            <GameStatCard
              className="simon-chrome-border"
              label="Target"
              labelClassName="text-[var(--simon-muted)]"
              value={game.winTarget}
              valueTestId="simon-replay-target"
            />
          </GameStatsBar>
        </GameSidebar>

        <GameBoardStage
          actions={
            <GameBoardActions onBackToMenu={requestBackToMenu} testIdPrefix="simon-replay" />
          }
        >
          <SimonBoard
            game={game}
            isInteractive={false}
            onPadPress={ignorePadPress}
            statusLabel={statusLabel}
          >
            <GameReplayCursor
              position={cursorPosition}
              testId="simon-replay-cursor"
            />
            <SimonReplayTurnFeedback game={game} />
            {isFinished ? (
              <GameEndScreen
                className="gap-3 px-3 py-4"
                testId="simon-replay-finished-screen"
              >
                <div className="flex flex-col items-center gap-1">
                  <p className="text-2xl font-semibold tracking-normal text-balance sm:text-3xl">
                    {game.status === "won" ? "Sequence cleared" : "Game over"}
                  </p>
                  <p className="text-xs font-semibold text-[#cbd5e1] sm:text-sm">
                    Final score:
                  </p>
                  <p
                    className="font-mono text-4xl font-semibold leading-none sm:text-5xl"
                    data-testid="simon-replay-final-score"
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
                  data-testid="simon-replay-back-button"
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
          </SimonBoard>
        </GameBoardStage>
      </GameBoardColumn>
    </GameShell>
  );
}
