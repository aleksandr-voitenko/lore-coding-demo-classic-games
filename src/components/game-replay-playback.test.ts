import { afterEach, describe, expect, it, vi } from "vitest";

type EffectCleanup = () => void;
type EffectSlot = {
  cleanup?: EffectCleanup;
  create: () => EffectCleanup | void;
  dependencies: readonly unknown[] | undefined;
};
type PendingEffect = EffectSlot & {
  index: number;
};

class HookLifecycleHarness {
  private effectCursor = 0;
  private readonly effects: EffectSlot[] = [];
  private isMounted = false;
  private pendingEffects: PendingEffect[] = [];
  private refCursor = 0;
  private readonly refs: Array<{ current: unknown }> = [];
  private stateCursor = 0;
  private readonly states: unknown[] = [];
  stateUpdatesAfterUnmount = 0;

  render<Result>(renderHook: () => Result) {
    this.effectCursor = 0;
    this.isMounted = true;
    this.pendingEffects = [];
    this.refCursor = 0;
    this.stateCursor = 0;

    hookRuntime.setActiveHarness(this);

    try {
      const result = renderHook();

      this.flushEffects();

      return result;
    } finally {
      hookRuntime.setActiveHarness(null);
    }
  }

  replayEffects() {
    const mountedEffects = [...this.effects];

    for (const effect of mountedEffects) {
      effect.cleanup?.();
    }

    for (const [index, effect] of mountedEffects.entries()) {
      const cleanup = effect.create();

      this.effects[index] = {
        ...(typeof cleanup === "function" ? { cleanup } : {}),
        create: effect.create,
        dependencies: effect.dependencies,
      };
    }
  }

  unmount() {
    this.isMounted = false;

    for (const effect of this.effects) {
      effect.cleanup?.();
    }

    this.effects.length = 0;
  }

  useEffect(
    create: () => EffectCleanup | void,
    dependencies: readonly unknown[] | undefined,
  ) {
    const index = this.effectCursor;
    const previous = this.effects[index];

    this.effectCursor += 1;

    if (
      previous !== undefined &&
      dependencies !== undefined &&
      previous.dependencies !== undefined &&
      dependencies.length === previous.dependencies.length &&
      dependencies.every((dependency, dependencyIndex) =>
        Object.is(dependency, previous.dependencies?.[dependencyIndex]),
      )
    ) {
      return;
    }

    this.pendingEffects.push({ create, dependencies, index });
  }

  useRef<Value>(initialValue: Value) {
    const index = this.refCursor;

    this.refCursor += 1;

    if (this.refs[index] === undefined) {
      this.refs[index] = { current: initialValue };
    }

    return this.refs[index] as { current: Value };
  }

  useState<Value>(initialValue: Value | (() => Value)) {
    const index = this.stateCursor;

    this.stateCursor += 1;

    if (!(index in this.states)) {
      this.states[index] =
        typeof initialValue === "function" ? (initialValue as () => Value)() : initialValue;
    }

    const setState = (nextValue: Value | ((currentValue: Value) => Value)) => {
      if (!this.isMounted) {
        this.stateUpdatesAfterUnmount += 1;
        return;
      }

      const currentValue = this.states[index] as Value;

      this.states[index] =
        typeof nextValue === "function"
          ? (nextValue as (value: Value) => Value)(currentValue)
          : nextValue;
    };

    return [this.states[index] as Value, setState] as const;
  }

  private flushEffects() {
    for (const pendingEffect of this.pendingEffects) {
      this.effects[pendingEffect.index]?.cleanup?.();

      const cleanup = pendingEffect.create();

      this.effects[pendingEffect.index] = {
        ...(typeof cleanup === "function" ? { cleanup } : {}),
        create: pendingEffect.create,
        dependencies: pendingEffect.dependencies,
      };
    }

    this.pendingEffects = [];
  }
}

const hookRuntime = vi.hoisted(() => {
  let activeHarness: HookLifecycleHarness | null = null;

  function getActiveHarness() {
    if (activeHarness === null) {
      throw new Error("Hook lifecycle calls must run inside the test harness.");
    }

    return activeHarness;
  }

  return {
    setActiveHarness(nextHarness: HookLifecycleHarness | null) {
      activeHarness = nextHarness;
    },
    useEffect(
      create: () => EffectCleanup | void,
      dependencies: readonly unknown[] | undefined,
    ) {
      getActiveHarness().useEffect(create, dependencies);
    },
    useRef<Value>(initialValue: Value) {
      return getActiveHarness().useRef(initialValue);
    },
    useState<Value>(initialValue: Value | (() => Value)) {
      return getActiveHarness().useState(initialValue);
    },
  };
});

vi.mock("react", () => ({
  useEffect: hookRuntime.useEffect,
  useRef: hookRuntime.useRef,
  useState: hookRuntime.useState,
}));

import {
  useGameReplayPlayback,
  type GameReplayTimedPlayback,
} from "@/components/game-replay-playback";

function createDeferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

async function flushPromiseSettlements() {
  await Promise.resolve();
  await Promise.resolve();
}

type TestReplayEvent = {
  elapsedMs: number;
  type: "advance";
};

type TestReplay = {
  events: TestReplayEvent[];
  id: string;
};

type TestGame = {
  frames: number;
  replayId: string;
};

type TestPlayback = GameReplayTimedPlayback & {
  eventIndex: number;
  events: TestReplayEvent[];
};

type TestPlaybackContext = {
  game: TestGame;
  playback: TestPlayback;
};

type TestPlaybackOptions = {
  advanceFrame: (context: TestPlaybackContext) => {
    game: TestGame;
    isFinished: boolean;
  };
  canAdvance?: (context: TestPlaybackContext) => boolean;
  initializeReplay: (replay: TestReplay) => {
    game: TestGame;
    playback: TestPlayback;
  };
  loadReplay: () => Promise<TestReplay>;
  scheduleVersion?: number;
};

function createTestReplay(id: string, elapsedMsValues: number[] = [100]): TestReplay {
  return {
    events: elapsedMsValues.map((elapsedMs) => ({
      elapsedMs,
      type: "advance",
    })),
    id,
  };
}

function initializeTestReplay(replay: TestReplay) {
  return {
    game: {
      frames: 0,
      replayId: replay.id,
    },
    playback: {
      eventIndex: 0,
      events: replay.events,
      lastElapsedMs: 0,
    },
  };
}

function createAdvanceFrame() {
  return vi.fn(({ game, playback }: TestPlaybackContext) => {
    const event = playback.events[playback.eventIndex];

    if (event === undefined) {
      return { game, isFinished: true };
    }

    playback.eventIndex += 1;
    playback.lastElapsedMs = event.elapsedMs;

    return {
      game: {
        ...game,
        frames: game.frames + 1,
      },
      isFinished: playback.eventIndex >= playback.events.length,
    };
  });
}

function renderPlayback(harness: HookLifecycleHarness, options: TestPlaybackOptions) {
  return harness.render(() =>
    useGameReplayPlayback<TestReplay, TestGame, TestReplayEvent, TestPlayback>(options),
  );
}

function useFakeWindowTimers() {
  vi.useFakeTimers();
  vi.stubGlobal("window", {
    clearTimeout: globalThis.clearTimeout,
    setTimeout: globalThis.setTimeout,
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useGameReplayPlayback", () => {
  it("initializes the current replay load", async () => {
    const deferred = createDeferred<TestReplay>();
    const harness = new HookLifecycleHarness();
    const options: TestPlaybackOptions = {
      advanceFrame: createAdvanceFrame(),
      canAdvance: () => false,
      initializeReplay: initializeTestReplay,
      loadReplay: () => deferred.promise,
    };

    expect(renderPlayback(harness, options)).toMatchObject({
      game: null,
      isFinished: false,
      loadStatus: "loading",
      replay: null,
    });

    const replay = createTestReplay("current");

    deferred.resolve(replay);
    await flushPromiseSettlements();

    const readyPlayback = renderPlayback(harness, options);

    expect(readyPlayback).toMatchObject({
      game: {
        frames: 0,
        replayId: "current",
      },
      isFinished: false,
      loadStatus: "ready",
      replay,
    });
    expect(readyPlayback.playbackRef.current).toMatchObject({
      eventIndex: 0,
      lastElapsedMs: 0,
    });

    harness.unmount();
  });

  it("reports the current replay load failure", async () => {
    const deferred = createDeferred<TestReplay>();
    const harness = new HookLifecycleHarness();
    const options: TestPlaybackOptions = {
      advanceFrame: createAdvanceFrame(),
      canAdvance: () => false,
      initializeReplay: initializeTestReplay,
      loadReplay: () => deferred.promise,
    };

    renderPlayback(harness, options);
    deferred.reject(new Error("unavailable"));
    await deferred.promise.catch(() => undefined);
    await flushPromiseSettlements();

    expect(renderPlayback(harness, options)).toMatchObject({
      game: null,
      isFinished: false,
      loadStatus: "failed",
      replay: null,
    });

    harness.unmount();
  });

  it("ignores a replay load settlement after unmount", async () => {
    const deferred = createDeferred<TestReplay>();
    const harness = new HookLifecycleHarness();
    const options: TestPlaybackOptions = {
      advanceFrame: createAdvanceFrame(),
      initializeReplay: initializeTestReplay,
      loadReplay: () => deferred.promise,
    };

    renderPlayback(harness, options);
    harness.unmount();
    deferred.resolve(createTestReplay("stale"));
    await flushPromiseSettlements();

    expect(harness.stateUpdatesAfterUnmount).toBe(0);
  });

  it("keeps exactly one scheduled frame across unchanged rerenders", async () => {
    useFakeWindowTimers();
    const harness = new HookLifecycleHarness();
    const advanceFrame = createAdvanceFrame();
    const options: TestPlaybackOptions = {
      advanceFrame,
      initializeReplay: initializeTestReplay,
      loadReplay: async () => createTestReplay("current", [100, 200]),
    };

    renderPlayback(harness, options);
    await flushPromiseSettlements();
    renderPlayback(harness, options);

    expect(vi.getTimerCount()).toBe(1);

    renderPlayback(harness, options);
    renderPlayback(harness, options);

    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(100);

    expect(advanceFrame).toHaveBeenCalledOnce();

    harness.unmount();
  });

  it("stops scheduling after a terminal frame", async () => {
    useFakeWindowTimers();
    const harness = new HookLifecycleHarness();
    const advanceFrame = createAdvanceFrame();
    const options: TestPlaybackOptions = {
      advanceFrame,
      initializeReplay: initializeTestReplay,
      loadReplay: async () => createTestReplay("terminal"),
    };

    renderPlayback(harness, options);
    await flushPromiseSettlements();
    renderPlayback(harness, options);
    vi.advanceTimersByTime(100);

    const terminalPlayback = renderPlayback(harness, options);

    expect(terminalPlayback.isFinished).toBe(true);
    expect(terminalPlayback.game?.frames).toBe(1);
    expect(advanceFrame).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);

    renderPlayback(harness, options);
    expect(vi.getTimerCount()).toBe(0);

    harness.unmount();
  });

  it("uses scheduleVersion to resume after a scheduling gate opens", async () => {
    useFakeWindowTimers();
    const harness = new HookLifecycleHarness();
    let isBlocked = true;
    const canAdvance = () => !isBlocked;
    const baseOptions: TestPlaybackOptions = {
      advanceFrame: createAdvanceFrame(),
      canAdvance,
      initializeReplay: initializeTestReplay,
      loadReplay: async () => createTestReplay("gated"),
      scheduleVersion: 0,
    };

    renderPlayback(harness, baseOptions);
    await flushPromiseSettlements();
    renderPlayback(harness, baseOptions);

    expect(vi.getTimerCount()).toBe(0);

    isBlocked = false;
    renderPlayback(harness, baseOptions);

    expect(vi.getTimerCount()).toBe(0);

    renderPlayback(harness, {
      ...baseOptions,
      scheduleVersion: 1,
    });

    expect(vi.getTimerCount()).toBe(1);

    harness.unmount();
  });

  it("cleans up its scheduled frame on unmount", async () => {
    useFakeWindowTimers();
    const harness = new HookLifecycleHarness();
    const advanceFrame = createAdvanceFrame();
    const options: TestPlaybackOptions = {
      advanceFrame,
      initializeReplay: initializeTestReplay,
      loadReplay: async () => createTestReplay("unmounted"),
    };

    renderPlayback(harness, options);
    await flushPromiseSettlements();
    renderPlayback(harness, options);

    expect(vi.getTimerCount()).toBe(1);

    harness.unmount();

    expect(vi.getTimerCount()).toBe(0);

    vi.runAllTimers();

    expect(advanceFrame).not.toHaveBeenCalled();
    expect(harness.stateUpdatesAfterUnmount).toBe(0);
  });

  it("keeps the Strict Mode effect replay load current", async () => {
    const firstLoad = createDeferred<TestReplay>();
    const strictModeLoad = createDeferred<TestReplay>();
    const harness = new HookLifecycleHarness();
    const loadReplay = vi
      .fn<() => Promise<TestReplay>>()
      .mockReturnValueOnce(firstLoad.promise)
      .mockReturnValueOnce(strictModeLoad.promise);
    const options: TestPlaybackOptions = {
      advanceFrame: createAdvanceFrame(),
      canAdvance: () => false,
      initializeReplay: initializeTestReplay,
      loadReplay,
    };

    renderPlayback(harness, options);
    harness.replayEffects();

    expect(loadReplay).toHaveBeenCalledTimes(2);

    firstLoad.resolve(createTestReplay("stale-strict-load"));
    await flushPromiseSettlements();

    expect(renderPlayback(harness, options).loadStatus).toBe("loading");

    strictModeLoad.resolve(createTestReplay("strict-load"));
    await flushPromiseSettlements();

    expect(renderPlayback(harness, options)).toMatchObject({
      game: {
        replayId: "strict-load",
      },
      loadStatus: "ready",
    });

    harness.unmount();
  });

  it("replaces the old frame with one timer on the accepted load generation", async () => {
    useFakeWindowTimers();
    const replacementLoad = createDeferred<TestReplay>();
    const harness = new HookLifecycleHarness();
    const advanceFrame = createAdvanceFrame();
    const sharedGame: TestGame = {
      frames: 0,
      replayId: "shared",
    };
    const initializeWithSharedGame = (replay: TestReplay) => ({
      game: sharedGame,
      playback: initializeTestReplay(replay).playback,
    });
    const initialOptions: TestPlaybackOptions = {
      advanceFrame,
      initializeReplay: initializeWithSharedGame,
      loadReplay: async () => createTestReplay("initial"),
    };

    renderPlayback(harness, initialOptions);
    await flushPromiseSettlements();
    renderPlayback(harness, initialOptions);

    expect(vi.getTimerCount()).toBe(1);

    const replacementOptions: TestPlaybackOptions = {
      ...initialOptions,
      initializeReplay: (replay) => initializeWithSharedGame(replay),
      loadReplay: () => replacementLoad.promise,
    };

    renderPlayback(harness, replacementOptions);

    expect(vi.getTimerCount()).toBe(0);
    expect(advanceFrame).not.toHaveBeenCalled();

    replacementLoad.resolve(createTestReplay("replacement", [250]));
    await flushPromiseSettlements();
    renderPlayback(harness, replacementOptions);

    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(249);
    expect(advanceFrame).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(advanceFrame).toHaveBeenCalledOnce();
    expect(advanceFrame.mock.calls[0]?.[0].playback).toMatchObject({
      eventIndex: 1,
      lastElapsedMs: 250,
    });

    harness.unmount();
  });
});
