import { getGameReplayEventDelayMs, getGameReplayEventElapsedMs } from "@/lib/game-replay";

type ReplayTimedEvent = {
  elapsedMs?: number;
  type: string;
};

export type GameReplayTimedPlayback = {
  lastElapsedMs: number;
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
