import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createLiveGameReplayRecording,
  useLiveGameReplayRecording,
  type LiveGameReplayRecordedEvent,
  type LiveGameReplayRecording,
} from "./game-replay-recording";

// Only state/ref ownership is modeled here; the overlapping save/restart flow
// also has browser coverage in e2e/snake-replay.spec.ts with real React rendering.
const hookRuntime = vi.hoisted(() => {
  const slots: unknown[] = [];
  let cursor = 0;

  return {
    reset: () => {
      slots.length = 0;
      cursor = 0;
    },
    render: <Result>(renderHook: () => Result) => {
      cursor = 0;
      return renderHook();
    },
    useCallback: <Callback>(callback: Callback) => callback,
    useRef: <Value>(initial: Value) => {
      const index = cursor++;
      slots[index] ??= { current: initial };
      return slots[index] as { current: Value };
    },
    useState: <Value>(initial: Value) => {
      const index = cursor++;
      if (!(index in slots)) {
        slots[index] = initial;
      }
      return [
        slots[index] as Value,
        (value: Value | ((previous: Value) => Value)) => {
          slots[index] = typeof value === "function"
            ? (value as (previous: Value) => Value)(slots[index] as Value)
            : value;
        },
      ] as const;
    },
  };
});

vi.mock("react", () => ({
  useCallback: hookRuntime.useCallback,
  useRef: hookRuntime.useRef,
  useState: hookRuntime.useState,
}));

type Recording = LiveGameReplayRecording<LiveGameReplayRecordedEvent>;
type Payload = { runId: string };

function createDeferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function createRecording(id: string) {
  return createLiveGameReplayRecording({ run: { id, seed: 123 } });
}

function createHarness(saveReplay: (payload: Payload) => Promise<void>) {
  const render = () => hookRuntime.render(() =>
    useLiveGameReplayRecording<Recording, Payload>({ saveReplay }),
  );

  return {
    render,
    finish: () => render().captureFinishedReplay(({ run }) => ({ runId: run.id })),
    start: (id: string) => render().startReplayRecording(async () => createRecording(id)),
  };
}

describe("live replay save ownership", () => {
  beforeEach(() => hookRuntime.reset());

  it.each([
    ["reset", "success"],
    ["reset", "failure"],
    ["start", "success"],
    ["start", "failure"],
    ["begin", "success"],
    ["begin", "failure"],
    ["replace", "success"],
    ["replace", "failure"],
  ] as const)("keeps a new run saveable after %s and an old save %s", async (transition, outcome) => {
    const olderSave = createDeferred<void>();
    const saveReplay = vi.fn<(payload: Payload) => Promise<void>>()
      .mockReturnValueOnce(olderSave.promise)
      .mockResolvedValue(undefined);
    const harness = createHarness(saveReplay);

    await harness.start("first");
    harness.finish();
    const saving = harness.render().saveFinishedReplay();

    switch (transition) {
      case "reset":
        harness.render().resetReplayRecording();
        break;
      case "start":
        await harness.start("second");
        break;
      case "begin": {
        const recording = await harness.render().beginReplayRecording(async () => createRecording("second"));
        harness.render().replayRecordingRef.current = recording;
        break;
      }
      case "replace":
        await harness.render().replaceReplayRecording(async () => createRecording("second"));
        break;
    }

    if (outcome === "success") {
      olderSave.resolve();
    } else {
      olderSave.reject(new Error("First replay save failed"));
    }
    await saving;
    if (transition === "reset") {
      expect(harness.render()).toMatchObject({
        finishedReplay: null,
        replaySaveStatus: "idle",
      });
      await harness.start("second");
    }
    harness.finish();

    expect(harness.render()).toMatchObject({
      finishedReplay: { runId: "second" },
      replaySaveStatus: "idle",
    });
    await harness.render().saveFinishedReplay();
    expect(harness.render().replaySaveStatus).toBe("saved");
    expect(saveReplay.mock.calls).toEqual([[{ runId: "first" }], [{ runId: "second" }]]);
  });

  it.each(["success", "failure"] as const)("preserves current save %s when replacement fails", async (outcome) => {
    const currentSave = createDeferred<void>();
    const replacement = createDeferred<Recording>();
    const saveReplay = vi.fn<(payload: Payload) => Promise<void>>()
      .mockReturnValueOnce(currentSave.promise)
      .mockResolvedValue(undefined);
    const harness = createHarness(saveReplay);

    await harness.start("current");
    harness.finish();
    const saving = harness.render().saveFinishedReplay();
    const replacing = harness.render().replaceReplayRecording(() => replacement.promise);

    if (outcome === "success") {
      currentSave.resolve();
    } else {
      currentSave.reject(new Error("Current replay save failed"));
    }
    await saving;
    replacement.reject(new Error("Replacement run could not be created"));
    await expect(replacing).resolves.toBeNull();

    expect(harness.render()).toMatchObject({
      finishedReplay: { runId: "current" },
      isReplayRunPending: false,
      replaySaveStatus: outcome === "success" ? "saved" : "failed",
    });
    if (outcome === "failure") {
      await harness.render().saveFinishedReplay();
      expect(harness.render().replaySaveStatus).toBe("saved");
      expect(saveReplay.mock.calls).toEqual([[{ runId: "current" }], [{ runId: "current" }]]);
    }
  });

  it("does not let an older completion replace a newer pending save", async () => {
    const olderSave = createDeferred<void>();
    const newerSave = createDeferred<void>();
    const saveReplay = vi.fn<(payload: Payload) => Promise<void>>()
      .mockReturnValueOnce(olderSave.promise)
      .mockReturnValueOnce(newerSave.promise);
    const harness = createHarness(saveReplay);

    await harness.start("first");
    harness.finish();
    const savingFirst = harness.render().saveFinishedReplay();
    await harness.start("second");
    harness.finish();
    const savingSecond = harness.render().saveFinishedReplay();

    olderSave.resolve();
    await savingFirst;
    expect(harness.render().replaySaveStatus).toBe("saving");
    await harness.render().saveFinishedReplay();
    expect(saveReplay).toHaveBeenCalledTimes(2);

    newerSave.resolve();
    await savingSecond;
    expect(harness.render()).toMatchObject({
      finishedReplay: { runId: "second" },
      replaySaveStatus: "saved",
    });
  });

  it("keeps a newer successful save when an older save fails afterwards", async () => {
    const olderSave = createDeferred<void>();
    const saveReplay = vi.fn<(payload: Payload) => Promise<void>>()
      .mockReturnValueOnce(olderSave.promise)
      .mockResolvedValue(undefined);
    const harness = createHarness(saveReplay);

    await harness.start("first");
    harness.finish();
    const savingFirst = harness.render().saveFinishedReplay();
    await harness.start("second");
    harness.finish();
    await harness.render().saveFinishedReplay();

    olderSave.reject(new Error("First replay save failed"));
    await savingFirst;
    expect(harness.render()).toMatchObject({
      finishedReplay: { runId: "second" },
      replaySaveStatus: "saved",
    });
  });

  it("keeps a failed new start's status when the previous save succeeds", async () => {
    const olderSave = createDeferred<void>();
    const harness = createHarness(() => olderSave.promise);
    await harness.start("first");
    harness.finish();
    const saving = harness.render().saveFinishedReplay();

    await harness.render().startReplayRecording(async () => {
      throw new Error("New run could not be created");
    });
    olderSave.resolve();
    await saving;

    expect(harness.render()).toMatchObject({
      finishedReplay: null,
      replaySaveStatus: "failed",
    });
  });
});
