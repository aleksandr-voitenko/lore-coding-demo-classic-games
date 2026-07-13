export const BATTLE_CITY_NTSC_FRAME_RATE_HZ = 60.0988;
export const BATTLE_CITY_NTSC_FRAME_DURATION_MS =
  1_000 / BATTLE_CITY_NTSC_FRAME_RATE_HZ;

/**
 * Browser callbacks can be delayed for seconds while a tab is suspended.
 * Limiting one catch-up delta prevents a resumed game from monopolizing the
 * main thread with stale simulation work while still allowing about 250 ms of
 * missed play to be recovered.
 */
export const BATTLE_CITY_FIXED_STEP_MAX_ELAPSED_MS = 250;
export const BATTLE_CITY_FIXED_STEP_MAX_FRAMES = Math.ceil(
  BATTLE_CITY_FIXED_STEP_MAX_ELAPSED_MS /
    BATTLE_CITY_NTSC_FRAME_DURATION_MS,
);

export type BattleCityFixedStepResult = Readonly<{
  frames: number;
  remainderMs: number;
}>;

/**
 * Converts elapsed wall time into whole NTSC simulation frames while carrying
 * the fractional frame remainder into the next call.
 */
export function accumulateBattleCityFixedStep(
  previousRemainderMs: number,
  elapsedMs: number,
): BattleCityFixedStepResult {
  const remainderMs =
    Number.isFinite(previousRemainderMs) && previousRemainderMs > 0
      ? previousRemainderMs % BATTLE_CITY_NTSC_FRAME_DURATION_MS
      : 0;
  const boundedElapsedMs = Number.isFinite(elapsedMs)
    ? Math.min(
        BATTLE_CITY_FIXED_STEP_MAX_ELAPSED_MS,
        Math.max(0, elapsedMs),
      )
    : 0;
  const accumulatedMs = remainderMs + boundedElapsedMs;
  const frames = Math.floor(
    accumulatedMs / BATTLE_CITY_NTSC_FRAME_DURATION_MS,
  );

  return {
    frames,
    remainderMs:
      accumulatedMs - frames * BATTLE_CITY_NTSC_FRAME_DURATION_MS,
  };
}
