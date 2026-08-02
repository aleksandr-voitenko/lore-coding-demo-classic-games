import { describe, expect, it, vi } from "vitest";

import {
  SOCIAL_PRESENCE_RENEW_INTERVAL_MS,
  SOCIAL_PRESENCE_REQUEST_TIMEOUT_MS,
  SocialPresenceController,
  createSocialPresenceClientId,
  type SocialPresenceLifecycleTarget,
} from "./social-presence-client";
import { SOCIAL_PRESENCE_API_PATH } from "./social-client";

class FakeLifecycleTarget implements SocialPresenceLifecycleTarget {
  readonly listeners = new Map<string, Set<() => void>>();

  addEventListener(type: string, listener: () => void) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type: string) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener();
    }
  }

  removeEventListener(type: string, listener: () => void) {
    this.listeners.get(type)?.delete(listener);
  }
}

function createDeferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

function createHarness() {
  const documentTarget = new FakeLifecycleTarget();
  const windowTarget = new FakeLifecycleTarget();
  const timers = new Map<number, { callback: () => void; delayMs: number }>();
  let nextTimerId = 1;
  let visibilityState: DocumentVisibilityState = "visible";
  const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const payload = JSON.parse(String(init?.body)) as {
      state?: "available" | "busy";
    };

    return Response.json({
      availability:
        init?.method === "DELETE" ? "offline" : (payload.state ?? "available"),
      changed: true,
    });
  });
  const controller = new SocialPresenceController({
    clientId: "browser-client-123",
    clearTimer: (timer) => {
      timers.delete(timer);
    },
    documentTarget,
    fetcher,
    getVisibilityState: () => visibilityState,
    scheduleTimer: (callback, delayMs) => {
      const timerId = nextTimerId;
      nextTimerId += 1;
      timers.set(timerId, { callback, delayMs });
      return timerId;
    },
    windowTarget,
  });

  return {
    controller,
    documentTarget,
    fetcher,
    runOnlyTimer() {
      expect(timers.size).toBe(1);
      const [timerId, timer] = [...timers.entries()][0]!;
      timers.delete(timerId);
      timer.callback();
      return timer.delayMs;
    },
    setVisibilityState(state: DocumentVisibilityState) {
      visibilityState = state;
    },
    timers,
    windowTarget,
  };
}

async function settleOperations() {
  for (let settlement = 0; settlement < 12; settlement += 1) {
    await Promise.resolve();
  }
}

function expectPresenceRequest(
  call: unknown[],
  method: "DELETE" | "POST",
  body: unknown,
  keepalive?: boolean,
) {
  expect(call).toEqual([
    SOCIAL_PRESENCE_API_PATH,
    {
      body: JSON.stringify(body),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      signal: expect.any(AbortSignal),
      ...(method === "DELETE"
        ? { keepalive: keepalive ?? true, method }
        : { method }),
    },
  ]);
}

describe("social presence client", () => {
  it("creates a valid per-document id from browser cryptography", () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.fill(10);
      return bytes;
    });

    expect(
      createSocialPresenceClientId({
        getRandomValues,
        randomUUID: () => "123e4567-e89b-12d3-a456-426614174000",
      }),
    ).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(getRandomValues).not.toHaveBeenCalled();

    expect(
      createSocialPresenceClientId({
        getRandomValues,
        randomUUID: () => "unsupported id",
      }),
    ).toBe(`client-${"0a".repeat(16)}`);
  });

  it("renews immediately, recursively, and replaces state without releasing", async () => {
    const harness = createHarness();

    harness.controller.start();
    await harness.controller.update("user-1", "available");

    expect(harness.fetcher).toHaveBeenCalledOnce();
    expectPresenceRequest(harness.fetcher.mock.calls[0]!, "POST", {
      clientId: "browser-client-123",
      operationGeneration: 1,
      state: "available",
    });
    expect(harness.runOnlyTimer()).toBe(SOCIAL_PRESENCE_RENEW_INTERVAL_MS);

    await settleOperations();
    expect(harness.fetcher).toHaveBeenCalledTimes(2);

    await harness.controller.update("user-1", "busy");
    expect(harness.fetcher).toHaveBeenCalledTimes(3);
    expectPresenceRequest(harness.fetcher.mock.calls[2]!, "POST", {
      clientId: "browser-client-123",
      operationGeneration: 3,
      state: "busy",
    });
    expect(
      harness.fetcher.mock.calls.some((call) => call[1]?.method === "DELETE"),
    ).toBe(false);
  });

  it("releases while hidden and renews immediately when visible or focused", async () => {
    const harness = createHarness();

    harness.controller.start();
    await harness.controller.update("user-1", "available");
    harness.setVisibilityState("hidden");
    harness.documentTarget.dispatch("visibilitychange");
    await settleOperations();

    expectPresenceRequest(harness.fetcher.mock.calls[1]!, "DELETE", {
      clientId: "browser-client-123",
      operationGeneration: 2,
    });
    expect(harness.timers.size).toBe(0);

    await harness.controller.update("user-1", "busy");
    expect(harness.fetcher).toHaveBeenCalledTimes(2);

    harness.setVisibilityState("visible");
    harness.documentTarget.dispatch("visibilitychange");
    await settleOperations();
    expectPresenceRequest(harness.fetcher.mock.calls[2]!, "POST", {
      clientId: "browser-client-123",
      operationGeneration: 3,
      state: "busy",
    });

    harness.windowTarget.dispatch("focus");
    await settleOperations();
    expectPresenceRequest(harness.fetcher.mock.calls[3]!, "POST", {
      clientId: "browser-client-123",
      operationGeneration: 4,
      state: "busy",
    });
  });

  it("uses keepalive release on pagehide and stop without duplicating a suspended release", async () => {
    const harness = createHarness();

    harness.controller.start();
    await harness.controller.update("user-1", "available");
    harness.windowTarget.dispatch("pagehide");
    await settleOperations();
    await harness.controller.stop();

    expect(harness.fetcher).toHaveBeenCalledTimes(2);
    expectPresenceRequest(harness.fetcher.mock.calls[1]!, "DELETE", {
      clientId: "browser-client-123",
      operationGeneration: 2,
    });
    expect(harness.documentTarget.listeners.get("visibilitychange")?.size ?? 0).toBe(0);
    expect(harness.windowTarget.listeners.get("focus")?.size ?? 0).toBe(0);
    expect(harness.windowTarget.listeners.get("pagehide")?.size ?? 0).toBe(0);
  });

  it("serializes requests and skips an obsolete queued renewal", async () => {
    const harness = createHarness();
    const firstResponse = createDeferred<Response>();
    const observedAvailabilities: string[] = [];

    harness.controller.subscribe((snapshot) => {
      observedAvailabilities.push(snapshot.availability);
    });

    harness.fetcher
      .mockImplementationOnce(() => firstResponse.promise)
      .mockResolvedValue(
        Response.json({ availability: "busy", changed: true }),
      );
    harness.controller.start();

    const firstUpdate = harness.controller.update("user-1", "available");
    await settleOperations();
    const secondUpdate = harness.controller.update("user-1", "busy");

    expect(harness.fetcher).toHaveBeenCalledOnce();
    firstResponse.resolve(
      Response.json({ availability: "available", changed: true }),
    );
    await Promise.all([firstUpdate, secondUpdate]);

    expect(harness.fetcher).toHaveBeenCalledTimes(2);
    expectPresenceRequest(harness.fetcher.mock.calls[1]!, "POST", {
      clientId: "browser-client-123",
      operationGeneration: 2,
      state: "busy",
    });
    const busySnapshotIndex = observedAvailabilities.lastIndexOf("busy");

    expect(busySnapshotIndex).toBeGreaterThanOrEqual(0);
    expect(observedAvailabilities.slice(busySnapshotIndex)).toEqual(["busy"]);

    const secondHarness = createHarness();
    secondHarness.controller.start();
    const obsolete = secondHarness.controller.update("user-1", "available");
    const latest = secondHarness.controller.update("user-1", "busy");
    await Promise.all([obsolete, latest]);

    expect(secondHarness.fetcher).toHaveBeenCalledOnce();
    expectPresenceRequest(secondHarness.fetcher.mock.calls[0]!, "POST", {
      clientId: "browser-client-123",
      operationGeneration: 2,
      state: "busy",
    });
  });

  it("retries renewal after a network failure", async () => {
    const harness = createHarness();

    harness.fetcher
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(
        Response.json({ availability: "available", changed: true }),
      );
    harness.controller.start();
    await expect(
      harness.controller.update("user-1", "available"),
    ).resolves.toBeUndefined();

    expect(harness.runOnlyTimer()).toBe(SOCIAL_PRESENCE_RENEW_INTERVAL_MS);
    await settleOperations();
    expect(harness.fetcher).toHaveBeenCalledTimes(2);
  });

  it("holds renewal after the awaited best-effort sign-out release", async () => {
    const harness = createHarness();

    harness.controller.start();
    await harness.controller.update("user-1", "available");
    await expect(
      harness.controller.releaseForSignOut(),
    ).resolves.toBeUndefined();

    expectPresenceRequest(harness.fetcher.mock.calls[1]!, "DELETE", {
      clientId: "browser-client-123",
      operationGeneration: 2,
    });
    expect(harness.timers.size).toBe(0);

    harness.windowTarget.dispatch("focus");
    await settleOperations();
    expect(harness.fetcher).toHaveBeenCalledTimes(2);
  });

  it("resumes renewal when session deletion fails after release", async () => {
    const harness = createHarness();

    harness.controller.start();
    await harness.controller.update("user-1", "available");
    await harness.controller.releaseForSignOut();
    harness.controller.resumeAfterFailedSignOut();
    await settleOperations();

    expect(harness.fetcher).toHaveBeenCalledTimes(3);
    expectPresenceRequest(harness.fetcher.mock.calls[2]!, "POST", {
      clientId: "browser-client-123",
      operationGeneration: 3,
      state: "available",
    });
    expect(harness.controller.getSnapshot()).toEqual({
      availability: "available",
      error: null,
    });
  });

  it("bounds a stalled release so failed sign-out recovery can renew", async () => {
    const harness = createHarness();

    harness.controller.start();
    await harness.controller.update("user-1", "available");
    const stalledRelease = createDeferred<Response>();
    harness.fetcher
      .mockImplementationOnce(() => stalledRelease.promise)
      .mockResolvedValueOnce(
        Response.json({ availability: "available", changed: true }),
      );

    const release = harness.controller.releaseForSignOut();
    await settleOperations();
    expect(harness.fetcher).toHaveBeenCalledTimes(2);
    expect(harness.runOnlyTimer()).toBe(SOCIAL_PRESENCE_REQUEST_TIMEOUT_MS);
    await expect(release).resolves.toBeUndefined();

    harness.controller.resumeAfterFailedSignOut();
    await settleOperations();

    expect(harness.fetcher).toHaveBeenCalledTimes(3);
    expectPresenceRequest(harness.fetcher.mock.calls[2]!, "POST", {
      clientId: "browser-client-123",
      operationGeneration: 3,
      state: "available",
    });
    expect(harness.controller.getSnapshot()).toEqual({
      availability: "available",
      error: null,
    });
  });

  it("releases the previous lease when the signed-in user becomes null", async () => {
    const harness = createHarness();

    harness.controller.start();
    await harness.controller.update("user-1", "available");
    await harness.controller.update(null, "available");

    expect(harness.fetcher).toHaveBeenCalledTimes(2);
    expectPresenceRequest(harness.fetcher.mock.calls[1]!, "DELETE", {
      clientId: "browser-client-123",
      operationGeneration: 2,
    });
    expect(harness.controller.getSnapshot()).toEqual({ availability: "offline", error: null });
  });

  it("does not release again after the awaited sign-out release", async () => {
    const harness = createHarness();

    harness.controller.start();
    await harness.controller.update("user-1", "available");
    await harness.controller.releaseForSignOut();
    await harness.controller.update(null, "available");

    expect(harness.fetcher).toHaveBeenCalledTimes(2);
    expect(harness.controller.getSnapshot()).toEqual({
      availability: "offline",
      error: null,
    });
  });

  it("does nothing for a signed-out document", async () => {
    const harness = createHarness();

    harness.controller.start();
    await harness.controller.update(null, "available");
    harness.windowTarget.dispatch("focus");
    await settleOperations();
    await harness.controller.stop();

    expect(harness.fetcher).not.toHaveBeenCalled();
  });
});
