"use client";

import { useEffect, useRef, useState } from "react";

import { getGameReplayEventDelayMs, getGameReplayEventElapsedMs } from "@/lib/game-replay";

type ReplayTimedEvent = {
  elapsedMs?: number;
  type: string;
};

export type GameReplayTimedPlayback = {
  lastElapsedMs: number;
};

type GameReplayPlaybackWithEvents<Event extends ReplayTimedEvent> =
  GameReplayTimedPlayback & {
    eventIndex: number;
    events: Event[];
  };

type GameReplayLoadStatus = "failed" | "loading" | "ready";

type GameReplayPlaybackFrame<Game> = {
  game: Game;
  isFinished: boolean;
};

type GameReplayPlaybackInitialization<Game, Playback> = {
  game: Game;
  playback: Playback;
};

type GameReplayPlaybackContext<Game, Playback> = {
  game: Game;
  playback: Playback;
};

export function getReplayPlaybackDelayMs({
  event,
  playback,
}: {
  event: ReplayTimedEvent;
  playback: GameReplayTimedPlayback;
}) {
  return getGameReplayEventDelayMs({
    event,
    previousElapsedMs: playback.lastElapsedMs,
  });
}

export function getReplayEventElapsedMs(event: ReplayTimedEvent | undefined) {
  return getGameReplayEventElapsedMs(event);
}

export function isFutureReplayEventFrame(
  frameElapsedMs: number | null,
  event: ReplayTimedEvent | undefined,
) {
  const elapsedMs = getReplayEventElapsedMs(event);

  return frameElapsedMs !== null && elapsedMs !== null && elapsedMs > frameElapsedMs;
}

function startGameReplayLoad<Replay>({
  loadReplay,
  onFailed,
  onReady,
}: {
  loadReplay: () => Promise<Replay>;
  onFailed: () => void;
  onReady: (replay: Replay) => void;
}) {
  let isCurrent = true;

  void loadReplay()
    .then((replay) => {
      if (isCurrent) {
        onReady(replay);
      }
    })
    .catch(() => {
      if (isCurrent) {
        onFailed();
      }
    });

  return () => {
    isCurrent = false;
  };
}

function scheduleGameReplayFrame<TimeoutHandle>({
  advanceFrame,
  clearTimeout,
  event,
  playback,
  setTimeout,
}: {
  advanceFrame: () => void;
  clearTimeout: (timeout: TimeoutHandle) => void;
  event: ReplayTimedEvent;
  playback: GameReplayTimedPlayback;
  setTimeout: (callback: () => void, delayMs: number) => TimeoutHandle;
}) {
  const timeout = setTimeout(
    advanceFrame,
    getReplayPlaybackDelayMs({ event, playback }),
  );

  return () => clearTimeout(timeout);
}

/**
 * Ignores stale load settlements and owns one main-frame timeout per mounted replay player.
 * Game-specific frame reduction, cursor timing, and visual effects stay with the caller.
 */
export function useGameReplayPlayback<
  Replay,
  Game,
  Event extends ReplayTimedEvent,
  Playback extends GameReplayPlaybackWithEvents<Event>,
>({
  advanceFrame,
  canAdvance,
  getNextFrameEvent,
  initializeReplay,
  loadReplay,
  scheduleVersion = 0,
}: {
  advanceFrame: (
    context: GameReplayPlaybackContext<Game, Playback>,
  ) => GameReplayPlaybackFrame<Game>;
  canAdvance?: (context: GameReplayPlaybackContext<Game, Playback>) => boolean;
  getNextFrameEvent?: (playback: Playback) => ReplayTimedEvent | undefined;
  initializeReplay: (
    replay: Replay,
  ) => GameReplayPlaybackInitialization<Game, Playback>;
  loadReplay: () => Promise<Replay>;
  scheduleVersion?: number;
}) {
  // Replay adapters may intentionally reuse a Game object, so state identity alone
  // cannot tell the scheduler that replacement playback refs are ready.
  const [acceptedLoadGeneration, setAcceptedLoadGeneration] = useState(0);
  const [game, setGame] = useState<Game | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [loadStatus, setLoadStatus] =
    useState<GameReplayLoadStatus>("loading");
  const [playbackStep, setPlaybackStep] = useState(0);
  const [replay, setReplay] = useState<Replay | null>(null);
  const gameRef = useRef<Game | null>(null);
  const playbackRef = useRef<Playback | null>(null);
  const scheduledFrameCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const cancelLoad = startGameReplayLoad({
      loadReplay,
      onFailed: () => setLoadStatus("failed"),
      onReady: (latestReplay) => {
        const initialReplay = initializeReplay(latestReplay);

        gameRef.current = initialReplay.game;
        playbackRef.current = initialReplay.playback;
        setAcceptedLoadGeneration((current) => current + 1);
        setGame(initialReplay.game);
        setIsFinished(false);
        setLoadStatus("ready");
        setPlaybackStep(0);
        setReplay(latestReplay);
      },
    });

    return () => {
      cancelLoad();
      // A replacement load can settle before the scheduler effect reruns, so its
      // old timeout must be canceled before replacement playback refs are installed.
      const cancelScheduledFrame = scheduledFrameCleanupRef.current;

      scheduledFrameCleanupRef.current = null;
      cancelScheduledFrame?.();
      gameRef.current = null;
      playbackRef.current = null;
    };
  }, [initializeReplay, loadReplay]);

  useEffect(() => {
    if (loadStatus !== "ready" || isFinished || game === null) {
      return;
    }

    const playback = playbackRef.current;

    if (playback === null || canAdvance?.({ game, playback }) === false) {
      return;
    }

    const nextEvent =
      getNextFrameEvent?.(playback) ?? playback.events[playback.eventIndex];

    if (nextEvent === undefined) {
      return;
    }

    const cancelScheduledFrame = scheduleGameReplayFrame({
      advanceFrame: () => {
        const currentGame = gameRef.current;
        const currentPlayback = playbackRef.current;

        if (currentGame === null || currentPlayback === null) {
          return;
        }

        const nextFrame = advanceFrame({
          game: currentGame,
          playback: currentPlayback,
        });

        gameRef.current = nextFrame.game;
        setGame(nextFrame.game);
        setPlaybackStep((current) => current + 1);

        if (nextFrame.isFinished) {
          setIsFinished(true);
        }
      },
      clearTimeout: (timeout: number) => window.clearTimeout(timeout),
      event: nextEvent,
      playback,
      setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
    });
    scheduledFrameCleanupRef.current = cancelScheduledFrame;

    return () => {
      if (scheduledFrameCleanupRef.current !== cancelScheduledFrame) {
        return;
      }

      scheduledFrameCleanupRef.current = null;
      cancelScheduledFrame();
    };
  }, [
    acceptedLoadGeneration,
    advanceFrame,
    canAdvance,
    game,
    getNextFrameEvent,
    isFinished,
    loadStatus,
    playbackStep,
    scheduleVersion,
  ]);

  return {
    game,
    isFinished,
    loadStatus,
    playbackRef,
    replay,
  };
}
