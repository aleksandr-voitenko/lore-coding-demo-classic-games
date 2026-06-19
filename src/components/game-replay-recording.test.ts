import { afterEach, describe, expect, it, vi } from "vitest";

import {
  appendLiveGameReplayEvent,
  createLiveGameReplayRecording,
  startLiveGameReplayRecording,
  type LiveGameReplayRecordedEvent,
  type LiveGameReplayRecording,
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

type TestReplayRun = { id: string; seed: number };

type TestReplayRecording = LiveGameReplayRecording<
  TestReplayEvent,
  TestReplayRun
>;

type TestReplayPayload = {
  runId: string;
};

type TestReplayLifecycleControls = Parameters<
  typeof startLiveGameReplayRecording<TestReplayRecording, TestReplayPayload>
>[0];

function createTestReplayRecording(runId: string) {
  return createLiveGameReplayRecording<TestReplayEvent, TestReplayRun>({
    run: { id: runId, seed: 123 },
  });
}

function createTestReplayLifecycleControls({
  isPending = false,
  recording = null,
}: {
  isPending?: boolean;
  recording?: TestReplayRecording | null;
} = {}) {
  const finishedReplays: Array<TestReplayPayload | null> = [];
  const pendingStates: boolean[] = [];
  const saveStatuses: string[] = [];
  const controls: TestReplayLifecycleControls = {
    isReplayRunPendingRef: { current: isPending },
    replayRecordingRef: { current: recording },
    setFinishedReplay: (finishedReplay) => {
      finishedReplays.push(finishedReplay);
    },
    setIsReplayRunPending: (isReplayRunPending) => {
      pendingStates.push(isReplayRunPending);
    },
    setReplaySaveStatus: (replaySaveStatus) => {
      saveStatuses.push(replaySaveStatus);
    },
  };

  return {
    controls,
    finishedReplays,
    pendingStates,
    saveStatuses,
  };
}

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

  it("starts replay recordings and installs the active recording ref", async () => {
    const recording = createTestReplayRecording("run-started");
    const createRecording = vi.fn(async () => recording);
    const { controls, finishedReplays, pendingStates, saveStatuses } =
      createTestReplayLifecycleControls();

    await expect(
      startLiveGameReplayRecording(controls, createRecording),
    ).resolves.toBe(recording);

    expect(createRecording).toHaveBeenCalledTimes(1);
    expect(controls.replayRecordingRef.current).toBe(recording);
    expect(controls.isReplayRunPendingRef.current).toBe(false);
    expect(finishedReplays).toEqual([null]);
    expect(pendingStates).toEqual([true, false]);
    expect(saveStatuses).toEqual(["idle"]);
  });

  it("clears the active recording and marks failed start attempts", async () => {
    const previousRecording = createTestReplayRecording("run-previous");
    const createRecording = vi.fn(async () => {
      throw new Error("run creation failed");
    });
    const { controls, finishedReplays, pendingStates, saveStatuses } =
      createTestReplayLifecycleControls({
        recording: previousRecording,
      });

    await expect(
      startLiveGameReplayRecording(controls, createRecording),
    ).resolves.toBeNull();

    expect(createRecording).toHaveBeenCalledTimes(1);
    expect(controls.replayRecordingRef.current).toBeNull();
    expect(controls.isReplayRunPendingRef.current).toBe(false);
    expect(finishedReplays).toEqual([null]);
    expect(pendingStates).toEqual([true, false]);
    expect(saveStatuses).toEqual(["idle", "failed"]);
  });

  it("does not create or replace recordings while a replay run is pending", async () => {
    const existingRecording = createTestReplayRecording("run-existing");
    const createRecording = vi.fn(async () => createTestReplayRecording("run-next"));
    const { controls, finishedReplays, pendingStates, saveStatuses } =
      createTestReplayLifecycleControls({
        isPending: true,
        recording: existingRecording,
      });

    await expect(
      startLiveGameReplayRecording(controls, createRecording),
    ).resolves.toBeNull();

    expect(createRecording).not.toHaveBeenCalled();
    expect(controls.replayRecordingRef.current).toBe(existingRecording);
    expect(controls.isReplayRunPendingRef.current).toBe(true);
    expect(finishedReplays).toEqual([]);
    expect(pendingStates).toEqual([]);
    expect(saveStatuses).toEqual([]);
  });
});
