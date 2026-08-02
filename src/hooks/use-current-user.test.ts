import { afterEach, describe, expect, it, vi } from "vitest";

import { signOutAfterPresenceRelease } from "./use-current-user";

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

describe("current user presence coordination", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("releases the authenticated presence lease before deleting the session", async () => {
    const release = createDeferred();
    const releasePresence = vi.fn(() => release.promise);
    const deleteSession = vi.fn(async () => {});
    const signOut = signOutAfterPresenceRelease({
      deleteSession,
      releasePresence,
    });

    expect(releasePresence).toHaveBeenCalledOnce();
    expect(deleteSession).not.toHaveBeenCalled();

    release.resolve();
    await signOut;

    expect(deleteSession).toHaveBeenCalledOnce();
  });

  it("does not let a stalled advisory release block session deletion", async () => {
    vi.useFakeTimers();
    const releasePresence = vi.fn(() => new Promise<void>(() => {}));
    const deleteSession = vi.fn(async () => {});
    const signOut = signOutAfterPresenceRelease({
      deleteSession,
      releasePresence,
      releaseTimeoutMs: 50,
    });

    expect(deleteSession).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(50);
    await signOut;

    expect(deleteSession).toHaveBeenCalledOnce();
  });

  it("continues logout when best-effort release fails", async () => {
    const deleteSession = vi.fn(async () => {});

    await expect(
      signOutAfterPresenceRelease({
        deleteSession,
        releasePresence: async () => {
          throw new Error("presence offline");
        },
      }),
    ).resolves.toBeUndefined();
    expect(deleteSession).toHaveBeenCalledOnce();
  });

  it("continues logout when best-effort release throws synchronously", async () => {
    const deleteSession = vi.fn(async () => {});

    await expect(
      signOutAfterPresenceRelease({
        deleteSession,
        releasePresence: () => {
          throw new Error("presence client unavailable");
        },
      }),
    ).resolves.toBeUndefined();
    expect(deleteSession).toHaveBeenCalledOnce();
  });

  it("resumes presence when authenticated session deletion fails", async () => {
    const sessionError = new Error("session service unavailable");
    const resumePresence = vi.fn();

    await expect(
      signOutAfterPresenceRelease({
        deleteSession: async () => {
          throw sessionError;
        },
        releasePresence: async () => {},
        resumePresence,
      }),
    ).rejects.toBe(sessionError);
    expect(resumePresence).toHaveBeenCalledOnce();
  });
});
