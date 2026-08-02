import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SocialOverview } from "@/lib/social";

type EffectCleanup = () => void;
type EffectSlot = {
  cleanup?: EffectCleanup;
  dependencies: readonly unknown[] | undefined;
};
type MemoizedCallback = {
  callback: (...args: never[]) => unknown;
  dependencies: readonly unknown[];
};
type PendingEffect = {
  create: () => EffectCleanup | void;
  dependencies: readonly unknown[] | undefined;
  index: number;
};

function dependenciesMatch(
  current: readonly unknown[],
  previous: readonly unknown[],
) {
  return (
    current.length === previous.length &&
    current.every((dependency, index) => Object.is(dependency, previous[index]))
  );
}

class HookLifecycleHarness {
  private callbackCursor = 0;
  private readonly callbacks: MemoizedCallback[] = [];
  private effectCursor = 0;
  private readonly effects: EffectSlot[] = [];
  private pendingEffects: PendingEffect[] = [];
  private refCursor = 0;
  private readonly refs: Array<{ current: unknown }> = [];
  private stateCursor = 0;
  private readonly states: unknown[] = [];

  render<Result>(renderHook: () => Result) {
    this.callbackCursor = 0;
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

  useCallback<Callback extends (...args: never[]) => unknown>(
    callback: Callback,
    dependencies: readonly unknown[],
  ) {
    const index = this.callbackCursor;
    const previous = this.callbacks[index];

    this.callbackCursor += 1;

    if (
      previous !== undefined &&
      dependenciesMatch(dependencies, previous.dependencies)
    ) {
      return previous.callback as Callback;
    }

    this.callbacks[index] = { callback, dependencies };

    return callback;
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
      dependenciesMatch(dependencies, previous.dependencies)
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
        typeof initialValue === "function"
          ? (initialValue as () => Value)()
          : initialValue;
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
    useCallback<Callback extends (...args: never[]) => unknown>(
      callback: Callback,
      dependencies: readonly unknown[],
    ) {
      return getActiveHarness().useCallback(callback, dependencies);
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
  useCallback: hookRuntime.useCallback,
  useEffect: hookRuntime.useEffect,
  useRef: hookRuntime.useRef,
  useState: hookRuntime.useState,
}));

import {
  getSocialPendingCount,
  useSocialOverview,
} from "./use-social-overview";

type EventListener = () => void;

class FakeBrowserEventTarget {
  readonly listeners = new Map<string, Set<EventListener>>();

  addEventListener(type: string, listener: EventListener) {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();

    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type: string) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener();
    }
  }

  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener);
  }
}

class FakeDocument extends FakeBrowserEventTarget {
  visibilityState: "hidden" | "visible" = "visible";
}

const EMPTY_OVERVIEW: SocialOverview = {
  blockedUsers: [],
  friends: [],
  incomingFriendRequests: [],
  incomingPartyInvitations: [],
  outgoingFriendRequests: [],
  outgoingPartyInvitations: [],
};

const FIRST_OVERVIEW: SocialOverview = {
  ...EMPTY_OVERVIEW,
  friends: [
    {
      availability: "available",
      friendsSince: "2026-08-03T00:00:00.000Z",
      user: { displayName: "Grace", id: "user-2" },
    },
  ],
};

const SECOND_OVERVIEW: SocialOverview = {
  ...EMPTY_OVERVIEW,
  friends: [
    {
      availability: "busy",
      friendsSince: "2026-08-03T00:00:00.000Z",
      user: { displayName: "Lin", id: "user-3" },
    },
  ],
};

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
  await Promise.resolve();
}

describe("useSocialOverview", () => {
  let fakeDocument: FakeDocument;
  let fakeWindow: FakeBrowserEventTarget;

  beforeEach(() => {
    vi.useFakeTimers();
    fakeDocument = new FakeDocument();
    fakeWindow = new FakeBrowserEventTarget();
    vi.stubGlobal("document", fakeDocument);
    vi.stubGlobal("window", fakeWindow);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("loads an overview immediately for a signed-in account", async () => {
    const fetchOverview = vi.fn(async () => FIRST_OVERVIEW);
    const harness = new HookLifecycleHarness();
    const useRenderedSocialOverview = () =>
      useSocialOverview("user-1", { fetchOverview, pollIntervalMs: 1_000 });

    expect(harness.render(useRenderedSocialOverview)).toMatchObject({
      error: null,
      isLoading: true,
      isRefreshing: false,
      overview: null,
    });
    expect(fetchOverview).toHaveBeenCalledOnce();

    await flushPromiseSettlements();

    expect(harness.render(useRenderedSocialOverview)).toMatchObject({
      error: null,
      isLoading: false,
      isRefreshing: false,
      overview: FIRST_OVERVIEW,
    });
    harness.unmount();
  });

  it("does not fetch, poll, or install browser listeners while signed out", () => {
    const fetchOverview = vi.fn(async () => FIRST_OVERVIEW);
    const harness = new HookLifecycleHarness();

    expect(
      harness.render(() =>
        useSocialOverview(null, { fetchOverview, pollIntervalMs: 1_000 }),
      ),
    ).toMatchObject({
      error: null,
      isLoading: false,
      isRefreshing: false,
      overview: null,
    });
    expect(fetchOverview).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(fakeDocument.listeners.size).toBe(0);
    expect(fakeWindow.listeners.size).toBe(0);
  });

  it("retains the last good overview while a refresh is pending or fails", async () => {
    const failedRefresh = createDeferred<SocialOverview>();
    const fetchOverview = vi
      .fn<() => Promise<SocialOverview>>()
      .mockResolvedValueOnce(FIRST_OVERVIEW)
      .mockReturnValueOnce(failedRefresh.promise);
    const harness = new HookLifecycleHarness();
    const useRenderedSocialOverview = () =>
      useSocialOverview("user-1", { fetchOverview, pollIntervalMs: 1_000 });

    harness.render(useRenderedSocialOverview);
    await flushPromiseSettlements();

    const loaded = harness.render(useRenderedSocialOverview);
    const refreshPromise = loaded.refreshWithGeneration();

    expect(harness.render(useRenderedSocialOverview)).toMatchObject({
      error: null,
      isLoading: false,
      isRefreshing: true,
      overview: FIRST_OVERVIEW,
    });

    const refreshError = new Error("Overview failed.");
    failedRefresh.reject(refreshError);
    await expect(refreshPromise).resolves.toEqual({
      overview: null,
      requestGeneration: 3,
    });

    expect(harness.render(useRenderedSocialOverview)).toMatchObject({
      error: refreshError,
      isLoading: false,
      isRefreshing: false,
      overview: FIRST_OVERVIEW,
      overviewRequestGeneration: 2,
    });
    harness.unmount();
  });

  it("does not let an older request replace a newer response", async () => {
    const olderRequest = createDeferred<SocialOverview>();
    const newerRequest = createDeferred<SocialOverview>();
    const fetchOverview = vi
      .fn<() => Promise<SocialOverview>>()
      .mockReturnValueOnce(olderRequest.promise)
      .mockReturnValueOnce(newerRequest.promise);
    const harness = new HookLifecycleHarness();
    const useRenderedSocialOverview = () =>
      useSocialOverview("user-1", { fetchOverview, pollIntervalMs: 1_000 });

    const initial = harness.render(useRenderedSocialOverview);
    const newerRefresh = initial.refreshWithGeneration();

    newerRequest.resolve(SECOND_OVERVIEW);
    await expect(newerRefresh).resolves.toEqual({
      overview: SECOND_OVERVIEW,
      requestGeneration: 3,
    });
    expect(harness.render(useRenderedSocialOverview)).toMatchObject({
      overview: SECOND_OVERVIEW,
      overviewRequestGeneration: 3,
    });

    olderRequest.resolve(FIRST_OVERVIEW);
    await flushPromiseSettlements();
    expect(harness.render(useRenderedSocialOverview).overview).toBe(SECOND_OVERVIEW);
    harness.unmount();
  });

  it("suppresses an old account response after the active account changes", async () => {
    const firstAccountRequest = createDeferred<SocialOverview>();
    const secondAccountRequest = createDeferred<SocialOverview>();
    const fetchOverview = vi
      .fn<() => Promise<SocialOverview>>()
      .mockReturnValueOnce(firstAccountRequest.promise)
      .mockReturnValueOnce(secondAccountRequest.promise);
    const harness = new HookLifecycleHarness();

    harness.render(() =>
      useSocialOverview("user-1", { fetchOverview, pollIntervalMs: 1_000 }),
    );
    harness.render(() =>
      useSocialOverview("user-2", { fetchOverview, pollIntervalMs: 1_000 }),
    );

    secondAccountRequest.resolve(SECOND_OVERVIEW);
    await flushPromiseSettlements();

    expect(
      harness.render(() =>
        useSocialOverview("user-2", { fetchOverview, pollIntervalMs: 1_000 }),
      ).overview,
    ).toBe(SECOND_OVERVIEW);

    firstAccountRequest.resolve(FIRST_OVERVIEW);
    await flushPromiseSettlements();

    expect(
      harness.render(() =>
        useSocialOverview("user-2", { fetchOverview, pollIntervalMs: 1_000 }),
      ).overview,
    ).toBe(SECOND_OVERVIEW);
    harness.unmount();
  });

  it("does not expose account A data when account B's initial overview fails", async () => {
    const secondAccountRequest = createDeferred<SocialOverview>();
    const fetchOverview = vi
      .fn<() => Promise<SocialOverview>>()
      .mockResolvedValueOnce(FIRST_OVERVIEW)
      .mockReturnValueOnce(secondAccountRequest.promise);
    const harness = new HookLifecycleHarness();

    harness.render(() =>
      useSocialOverview("user-1", { fetchOverview, pollIntervalMs: 1_000 }),
    );
    await flushPromiseSettlements();
    expect(
      harness.render(() =>
        useSocialOverview("user-1", { fetchOverview, pollIntervalMs: 1_000 }),
      ).overview,
    ).toBe(FIRST_OVERVIEW);

    const accountChangeRender = harness.render(() =>
      useSocialOverview("user-2", { fetchOverview, pollIntervalMs: 1_000 }),
    );

    expect(accountChangeRender).toMatchObject({
      error: null,
      isLoading: true,
      isRefreshing: false,
      overview: null,
    });

    const secondAccountError = new Error("Account B overview failed.");
    secondAccountRequest.reject(secondAccountError);
    await flushPromiseSettlements();

    expect(
      harness.render(() =>
        useSocialOverview("user-2", { fetchOverview, pollIntervalMs: 1_000 }),
      ),
    ).toMatchObject({
      error: secondAccountError,
      isLoading: false,
      isRefreshing: false,
      overview: null,
    });
    harness.unmount();
  });

  it("never returns the previous account overview during an account change or sign-out render", async () => {
    const secondAccountRequest = createDeferred<SocialOverview>();
    const fetchOverview = vi
      .fn<() => Promise<SocialOverview>>()
      .mockResolvedValueOnce(FIRST_OVERVIEW)
      .mockReturnValueOnce(secondAccountRequest.promise);
    const harness = new HookLifecycleHarness();

    harness.render(() =>
      useSocialOverview("user-1", { fetchOverview, pollIntervalMs: 1_000 }),
    );
    await flushPromiseSettlements();
    expect(
      harness.render(() =>
        useSocialOverview("user-1", { fetchOverview, pollIntervalMs: 1_000 }),
      ).overview,
    ).toBe(FIRST_OVERVIEW);

    const accountChangeRender = harness.render(() =>
      useSocialOverview("user-2", { fetchOverview, pollIntervalMs: 1_000 }),
    );

    expect(accountChangeRender).toMatchObject({
      error: null,
      isLoading: true,
      isRefreshing: false,
      overview: null,
    });

    const signOutRender = harness.render(() =>
      useSocialOverview(null, { fetchOverview, pollIntervalMs: 1_000 }),
    );

    expect(signOutRender).toMatchObject({
      error: null,
      isLoading: false,
      isRefreshing: false,
      overview: null,
    });

    secondAccountRequest.resolve(SECOND_OVERVIEW);
    await flushPromiseSettlements();
    expect(
      harness.render(() =>
        useSocialOverview(null, { fetchOverview, pollIntervalMs: 1_000 }),
      ).overview,
    ).toBeNull();
    harness.unmount();
  });

  it("coalesces focus and polling refreshes into a slow automatic request", async () => {
    const initialRequest = createDeferred<SocialOverview>();
    const fetchOverview = vi.fn(() => initialRequest.promise);
    const harness = new HookLifecycleHarness();

    harness.render(() =>
      useSocialOverview("user-1", { fetchOverview, pollIntervalMs: 1_000 }),
    );
    expect(fetchOverview).toHaveBeenCalledOnce();

    fakeWindow.dispatch("focus");
    await vi.advanceTimersByTimeAsync(1_000);

    expect(fetchOverview).toHaveBeenCalledOnce();

    initialRequest.resolve(FIRST_OVERVIEW);
    await flushPromiseSettlements();

    expect(
      harness.render(() =>
        useSocialOverview("user-1", { fetchOverview, pollIntervalMs: 1_000 }),
      ).overview,
    ).toBe(FIRST_OVERVIEW);
    harness.unmount();
  });

  it("does not reset or refetch when an injected fetcher changes identity", async () => {
    const fetchOverview = vi.fn(async () => FIRST_OVERVIEW);
    const harness = new HookLifecycleHarness();
    const renderWithInlineFetcher = () =>
      harness.render(() =>
        useSocialOverview("user-1", {
          fetchOverview: () => fetchOverview(),
          pollIntervalMs: 1_000,
        }),
      );

    renderWithInlineFetcher();
    await flushPromiseSettlements();

    expect(renderWithInlineFetcher()).toMatchObject({
      error: null,
      isLoading: false,
      isRefreshing: false,
      overview: FIRST_OVERVIEW,
    });
    expect(renderWithInlineFetcher().overview).toBe(FIRST_OVERVIEW);
    expect(fetchOverview).toHaveBeenCalledOnce();
    harness.unmount();
  });

  it("polls only while the document is visible", async () => {
    const fetchOverview = vi.fn(async () => FIRST_OVERVIEW);
    const harness = new HookLifecycleHarness();
    const useRenderedSocialOverview = () =>
      useSocialOverview("user-1", { fetchOverview, pollIntervalMs: 1_000 });

    harness.render(useRenderedSocialOverview);
    await flushPromiseSettlements();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchOverview).toHaveBeenCalledTimes(2);

    fakeDocument.visibilityState = "hidden";
    fakeDocument.dispatch("visibilitychange");
    await vi.advanceTimersByTimeAsync(3_000);
    expect(fetchOverview).toHaveBeenCalledTimes(2);

    fakeDocument.visibilityState = "visible";
    fakeDocument.dispatch("visibilitychange");
    await flushPromiseSettlements();
    expect(fetchOverview).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchOverview).toHaveBeenCalledTimes(4);
    harness.unmount();
  });

  it("refreshes on visible focus and visibility changes without refreshing while hidden", async () => {
    const fetchOverview = vi.fn(async () => FIRST_OVERVIEW);
    const harness = new HookLifecycleHarness();

    harness.render(() =>
      useSocialOverview("user-1", { fetchOverview, pollIntervalMs: 10_000 }),
    );
    await flushPromiseSettlements();

    fakeWindow.dispatch("focus");
    await flushPromiseSettlements();
    expect(fetchOverview).toHaveBeenCalledTimes(2);

    fakeDocument.visibilityState = "hidden";
    fakeWindow.dispatch("focus");
    fakeDocument.dispatch("visibilitychange");
    await flushPromiseSettlements();
    expect(fetchOverview).toHaveBeenCalledTimes(2);

    fakeDocument.visibilityState = "visible";
    fakeDocument.dispatch("visibilitychange");
    await flushPromiseSettlements();
    expect(fetchOverview).toHaveBeenCalledTimes(3);

    harness.unmount();
    expect(fakeDocument.listeners.get("visibilitychange")?.size ?? 0).toBe(0);
    expect(fakeWindow.listeners.get("focus")?.size ?? 0).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid poll interval %s",
    (pollIntervalMs) => {
      const harness = new HookLifecycleHarness();

      expect(() =>
        harness.render(() =>
          useSocialOverview("user-1", {
            fetchOverview: async () => FIRST_OVERVIEW,
            pollIntervalMs,
          }),
        ),
      ).toThrow("Social overview poll interval must be a positive integer.");
    },
  );
});

describe("getSocialPendingCount", () => {
  it("counts incoming friend requests and party invitations only", () => {
    const overview: SocialOverview = {
      ...EMPTY_OVERVIEW,
      incomingFriendRequests: [
        {
          createdAt: "2026-08-03T00:00:00.000Z",
          direction: "incoming",
          user: { displayName: "Grace", id: "user-2" },
        },
      ],
      incomingPartyInvitations: [
        {
          createdAt: "2026-08-03T00:00:00.000Z",
          expiresAt: "2026-08-03T00:05:00.000Z",
          id: "invite-1",
          intent: "play",
          inviter: { displayName: "Lin", id: "user-3" },
          recipient: { displayName: "Ada", id: "user-1" },
          resolvedAt: null,
          status: "pending",
          updatedAt: "2026-08-03T00:00:00.000Z",
        },
        {
          createdAt: "2026-08-03T00:01:00.000Z",
          expiresAt: "2026-08-03T00:06:00.000Z",
          id: "invite-2",
          intent: "watch",
          inviter: { displayName: "Katherine", id: "user-4" },
          recipient: { displayName: "Ada", id: "user-1" },
          resolvedAt: null,
          status: "pending",
          updatedAt: "2026-08-03T00:01:00.000Z",
        },
      ],
      outgoingFriendRequests: [
        {
          createdAt: "2026-08-03T00:00:00.000Z",
          direction: "outgoing",
          user: { displayName: "Margaret", id: "user-5" },
        },
      ],
    };

    expect(getSocialPendingCount(null)).toBe(0);
    expect(getSocialPendingCount(overview)).toBe(3);
  });
});
