import { beforeEach, describe, expect, it, vi } from "vitest";

type EffectCleanup = () => void;
type EffectSlot = {
  cleanup?: EffectCleanup;
  dependencies: readonly unknown[] | undefined;
};
type PendingEffect = {
  create: () => EffectCleanup | void;
  dependencies: readonly unknown[] | undefined;
  index: number;
};

class HookLifecycleHarness {
  private effectCursor = 0;
  private readonly effects: EffectSlot[] = [];
  private pendingEffects: PendingEffect[] = [];
  private refCursor = 0;
  private readonly refs: Array<{ current: unknown }> = [];
  private stateCursor = 0;
  private readonly states: unknown[] = [];

  render<Result>(renderHook: () => Result) {
    this.effectCursor = 0;
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

  unmount() {
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

const mocks = vi.hoisted(() => ({
  submitGameSession: vi.fn(),
  user: {
    displayName: "Ada",
    id: "user-1",
  },
}));

vi.mock("react", () => ({
  useEffect: hookRuntime.useEffect,
  useRef: hookRuntime.useRef,
  useState: hookRuntime.useState,
}));

vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => ({ user: mocks.user }),
}));

vi.mock("@/lib/user-profile", () => ({
  submitGameSession: mocks.submitGameSession,
}));

import { useGameSession } from "./use-game-session";

type GameSessionOptions = Parameters<typeof useGameSession>[0];

function createDeferred<Value>() {
  let reject!: (reason?: unknown) => void;
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((promiseResolve, promiseReject) => {
    reject = promiseReject;
    resolve = promiseResolve;
  });

  return { promise, reject, resolve };
}

async function flushPromiseSettlements() {
  await Promise.resolve();
  await Promise.resolve();
}

function createRunningOptions(overrides: Partial<GameSessionOptions> = {}): GameSessionOptions {
  return {
    active: true,
    finalResult: null,
    finalScore: 0,
    gameId: "snake",
    leaderboardKey: "snake|mode=levels",
    started: true,
    ...overrides,
  };
}

describe("useGameSession", () => {
  beforeEach(() => {
    mocks.submitGameSession.mockReset();
  });

  it("keeps the new run's completed session id when an older submission succeeds later", async () => {
    const olderSubmission = createDeferred<{ id: string }>();
    const currentSubmission = createDeferred<{ id: string }>();
    const harness = new HookLifecycleHarness();
    const firstTerminalOptions = createRunningOptions({
      active: false,
      finalResult: "lost",
      finalScore: 10,
    });
    const secondTerminalOptions = createRunningOptions({
      active: false,
      finalResult: "won",
      finalScore: 20,
    });

    mocks.submitGameSession
      .mockReturnValueOnce(olderSubmission.promise)
      .mockReturnValueOnce(currentSubmission.promise);

    harness.render(() => useGameSession(createRunningOptions()));
    harness.render(() => useGameSession(firstTerminalOptions));
    harness.render(() => useGameSession(createRunningOptions()));
    harness.render(() => useGameSession(secondTerminalOptions));

    currentSubmission.resolve({ id: "session-current" });
    await flushPromiseSettlements();

    expect(harness.render(() => useGameSession(secondTerminalOptions))).toEqual({
      completedSessionId: "session-current",
    });

    olderSubmission.resolve({ id: "session-older" });
    await flushPromiseSettlements();

    expect(harness.render(() => useGameSession(secondTerminalOptions))).toEqual({
      completedSessionId: "session-current",
    });
    expect(mocks.submitGameSession).toHaveBeenCalledTimes(2);
  });

  it("ignores an older failure without reopening the current run's submission guard", async () => {
    const olderSubmission = createDeferred<{ id: string }>();
    const currentSubmission = createDeferred<{ id: string }>();
    const retrySubmission = createDeferred<{ id: string }>();
    const harness = new HookLifecycleHarness();
    const firstTerminalOptions = createRunningOptions({
      active: false,
      finalResult: "lost",
      finalScore: 10,
    });
    const secondTerminalOptions = createRunningOptions({
      active: false,
      finalResult: "won",
      finalScore: 20,
    });

    mocks.submitGameSession
      .mockReturnValueOnce(olderSubmission.promise)
      .mockReturnValueOnce(currentSubmission.promise)
      .mockReturnValueOnce(retrySubmission.promise);

    harness.render(() => useGameSession(createRunningOptions()));
    harness.render(() => useGameSession(firstTerminalOptions));
    harness.render(() => useGameSession(createRunningOptions()));
    harness.render(() => useGameSession(secondTerminalOptions));

    olderSubmission.reject(new Error("Older request failed."));
    await flushPromiseSettlements();

    harness.render(() =>
      useGameSession({
        ...secondTerminalOptions,
        finalScore: 21,
      }),
    );

    expect(mocks.submitGameSession).toHaveBeenCalledTimes(2);

    currentSubmission.reject(new Error("Current request failed."));
    await flushPromiseSettlements();

    harness.render(() =>
      useGameSession({
        ...secondTerminalOptions,
        finalScore: 22,
      }),
    );

    expect(mocks.submitGameSession).toHaveBeenCalledTimes(3);
    expect(mocks.submitGameSession).toHaveBeenLastCalledWith({
      activeDurationMs: expect.any(Number),
      finalScore: 22,
      gameId: "snake",
      leaderboardKey: "snake|mode=levels",
      result: "won",
      sortDirection: "desc",
    });

    retrySubmission.resolve({ id: "session-retry" });
    await flushPromiseSettlements();

    expect(
      harness.render(() =>
        useGameSession({
          ...secondTerminalOptions,
          finalScore: 22,
        }),
      ),
    ).toEqual({ completedSessionId: "session-retry" });
  });

  it("submits one keepalive abandonment when an active run unmounts", async () => {
    const now = vi.spyOn(performance, "now");
    const harness = new HookLifecycleHarness();

    now.mockReturnValueOnce(1_000).mockReturnValueOnce(1_300);
    mocks.submitGameSession.mockResolvedValueOnce({ id: "session-abandoned" });

    harness.render(() =>
      useGameSession(
        createRunningOptions({
          finalScore: 7,
        }),
      ),
    );
    harness.unmount();
    await flushPromiseSettlements();

    expect(mocks.submitGameSession).toHaveBeenCalledOnce();
    expect(mocks.submitGameSession).toHaveBeenCalledWith(
      {
        activeDurationMs: 300,
        finalScore: 7,
        gameId: "snake",
        leaderboardKey: "snake|mode=levels",
        result: "abandoned",
        sortDirection: "desc",
      },
      { keepalive: true },
    );

    now.mockRestore();
  });
});
