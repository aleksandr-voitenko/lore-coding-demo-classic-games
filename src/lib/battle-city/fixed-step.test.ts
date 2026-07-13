import { describe, expect, it } from "vitest";

import {
  accumulateBattleCityFixedStep,
  BATTLE_CITY_FIXED_STEP_MAX_ELAPSED_MS,
  BATTLE_CITY_FIXED_STEP_MAX_FRAMES,
  BATTLE_CITY_NTSC_FRAME_DURATION_MS,
  BATTLE_CITY_NTSC_FRAME_RATE_HZ,
} from "./fixed-step";

describe("Battle City fixed-step timing", () => {
  it("uses the NTSC NES frame rate", () => {
    expect(BATTLE_CITY_NTSC_FRAME_RATE_HZ).toBe(60.0988);
    expect(BATTLE_CITY_NTSC_FRAME_DURATION_MS).toBeCloseTo(
      16.639267339780496,
      12,
    );
  });

  it("carries sub-frame elapsed time into later calls", () => {
    const first = accumulateBattleCityFixedStep(
      0,
      BATTLE_CITY_NTSC_FRAME_DURATION_MS / 2,
    );
    const second = accumulateBattleCityFixedStep(
      first.remainderMs,
      BATTLE_CITY_NTSC_FRAME_DURATION_MS / 2,
    );

    expect(first).toEqual({
      frames: 0,
      remainderMs: BATTLE_CITY_NTSC_FRAME_DURATION_MS / 2,
    });
    expect(second.frames).toBe(1);
    expect(second.remainderMs).toBeCloseTo(0, 12);
  });

  it("returns multiple whole frames and the remaining fraction", () => {
    const result = accumulateBattleCityFixedStep(
      BATTLE_CITY_NTSC_FRAME_DURATION_MS * 0.75,
      BATTLE_CITY_NTSC_FRAME_DURATION_MS * 2.5,
    );

    expect(result.frames).toBe(3);
    expect(result.remainderMs).toBeCloseTo(
      BATTLE_CITY_NTSC_FRAME_DURATION_MS * 0.25,
      12,
    );
  });

  it("accumulates repeated short deltas without dropping fractional frames", () => {
    let remainderMs = 0;
    let frames = 0;

    for (let index = 0; index < 10; index += 1) {
      const result = accumulateBattleCityFixedStep(remainderMs, 100);
      frames += result.frames;
      remainderMs = result.remainderMs;
    }

    expect(frames).toBe(60);
    expect(remainderMs).toBeCloseTo(
      1_000 - 60 * BATTLE_CITY_NTSC_FRAME_DURATION_MS,
      10,
    );
  });

  it("clamps a long callback delay to the catch-up ceiling", () => {
    const remainderMs = BATTLE_CITY_NTSC_FRAME_DURATION_MS - 0.001;
    const clamped = accumulateBattleCityFixedStep(
      remainderMs,
      BATTLE_CITY_FIXED_STEP_MAX_ELAPSED_MS,
    );
    const stalled = accumulateBattleCityFixedStep(remainderMs, 10_000);

    expect(stalled).toEqual(clamped);
    expect(stalled.frames).toBeLessThanOrEqual(
      BATTLE_CITY_FIXED_STEP_MAX_FRAMES,
    );
    expect(stalled.remainderMs).toBeGreaterThanOrEqual(0);
    expect(stalled.remainderMs).toBeLessThan(
      BATTLE_CITY_NTSC_FRAME_DURATION_MS,
    );
  });

  it("ignores invalid or negative timing input", () => {
    expect(accumulateBattleCityFixedStep(Number.NaN, Number.NaN)).toEqual({
      frames: 0,
      remainderMs: 0,
    });
    expect(accumulateBattleCityFixedStep(-1, -100)).toEqual({
      frames: 0,
      remainderMs: 0,
    });
  });
});
