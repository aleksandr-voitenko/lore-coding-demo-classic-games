import {
  createGameReplayActiveClock,
  getGameReplayActiveElapsedMs,
  pauseGameReplayActiveClock,
  resumeGameReplayActiveClock,
  type GameReplayActiveClock,
} from "@/lib/game-replay";

export type GameReplayClockedRecording = {
  clock: GameReplayActiveClock;
};

function getReplayNowMs() {
  return globalThis.performance?.now() ?? Date.now();
}

export function createGameReplayRecordingClock() {
  return createGameReplayActiveClock(getReplayNowMs());
}

export function getGameReplayRecordingElapsedMs(
  recording: GameReplayClockedRecording,
) {
  return getGameReplayActiveElapsedMs(recording.clock, getReplayNowMs());
}

export function pauseGameReplayRecordingClock(
  recording: GameReplayClockedRecording | null,
) {
  if (recording === null) {
    return;
  }

  pauseGameReplayActiveClock(recording.clock, getReplayNowMs());
}

export function resumeGameReplayRecordingClock(
  recording: GameReplayClockedRecording | null,
) {
  if (recording === null) {
    return;
  }

  resumeGameReplayActiveClock(recording.clock, getReplayNowMs());
}
