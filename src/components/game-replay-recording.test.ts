import { afterEach, describe, expect, it, vi } from "vitest";

import {
  appendLiveGameReplayEvent,
  createLiveGameReplayRecording,
  type LiveGameReplayRecordedEvent,
} from "./game-replay-recording";
import { pauseGameReplayActiveClock, resumeGameReplayActiveClock } from "@/lib/game-replay";

type TestReplayEvent = LiveGameReplayRecordedEvent &
  (
    | {
        type: "advance";
      }
    | {
        direction: "left" | "right";
        type: "move";
      }
    | {
        type: "start";
      }
  );

describe("game replay recording", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates typed recordings with game-specific extra fields", () => {
    const random = () => 0.25;

    vi.spyOn(globalThis.performance, "now").mockReturnValue(100);

    const recording = createLiveGameReplayRecording<
      TestReplayEvent,
      { id: string; seed: number },
      { random: () => number }
    >({
      random,
      run: { id: "run-1", seed: 123 },
    });

    expect(recording).toMatchObject({
      events: [],
      nextSeq: 0,
      run: { id: "run-1", seed: 123 },
      tick: 0,
    });
    expect(recording.random()).toBe(0.25);
    expect(Date.parse(recording.startedAt)).not.toBeNaN();
  });

  it("appends replay envelopes with seq, tick, elapsed timing, and tick advancement", () => {
    vi.spyOn(globalThis.performance, "now")
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_125)
      .mockReturnValueOnce(1_250);

    const recording = createLiveGameReplayRecording<
      TestReplayEvent,
      { id: string; seed: number }
    >({
      run: { id: "run-2", seed: 456 },
    });

    appendLiveGameReplayEvent(recording, { type: "start" });
    appendLiveGameReplayEvent(recording, { direction: "left", type: "move" });
    appendLiveGameReplayEvent(recording, { type: "advance" }, { advancesTick: true });

    expect(recording.events).toEqual([
      { elapsedMs: 0, seq: 0, tick: 0, type: "start" },
      { direction: "left", elapsedMs: 125, seq: 1, tick: 0, type: "move" },
      { elapsedMs: 250, seq: 2, tick: 0, type: "advance" },
    ]);
    expect(recording.nextSeq).toBe(3);
    expect(recording.tick).toBe(1);
  });

  it("uses the active clock so appended elapsed time excludes pauses", () => {
    vi.spyOn(globalThis.performance, "now")
      .mockReturnValueOnce(200)
      .mockReturnValueOnce(250)
      .mockReturnValueOnce(900);

    const recording = createLiveGameReplayRecording<
      TestReplayEvent,
      { id: string; seed: number }
    >({
      run: { id: "run-3", seed: 789 },
    });

    pauseGameReplayActiveClock(recording.clock, 250);
    appendLiveGameReplayEvent(recording, { type: "start" });
    resumeGameReplayActiveClock(recording.clock, 875);
    appendLiveGameReplayEvent(recording, { type: "advance" }, { advancesTick: true });

    expect(recording.events).toEqual([
      { elapsedMs: 50, seq: 0, tick: 0, type: "start" },
      { elapsedMs: 75, seq: 1, tick: 0, type: "advance" },
    ]);
  });
});
