"use client";

import type { SocialAvailability } from "@/lib/social";
import {
  releaseSocialPresence,
  renewSocialPresence,
  type SocialFetch,
  type SocialPresenceState,
} from "@/lib/social-client";

export const SOCIAL_PRESENCE_RENEW_INTERVAL_MS = 15_000;
export const SOCIAL_PRESENCE_REQUEST_TIMEOUT_MS = 5_000;

const SOCIAL_PRESENCE_CLIENT_ID_PATTERN = /^[a-zA-Z0-9_-]{16,128}$/;

export type BrowserSocialPresenceState = SocialPresenceState;

export type SocialPresenceClientSnapshot = {
  availability: SocialAvailability;
  error: Error | null;
};

type SocialPresenceTimerHandle = number;

export type SocialPresenceLifecycleTarget = {
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};

export type SocialPresenceControllerOptions = {
  clientId: string;
  clearTimer: (timer: SocialPresenceTimerHandle) => void;
  documentTarget: SocialPresenceLifecycleTarget;
  fetcher: SocialFetch;
  getVisibilityState: () => DocumentVisibilityState;
  renewIntervalMs?: number;
  requestTimeoutMs?: number;
  scheduleTimer: (
    callback: () => void,
    delayMs: number,
  ) => SocialPresenceTimerHandle;
  windowTarget: SocialPresenceLifecycleTarget;
};

type DesiredSocialPresence = {
  state: BrowserSocialPresenceState;
  userId: string;
};

type SocialPresenceOperation =
  | {
      keepalive: boolean;
      type: "release";
    }
  | {
      state: BrowserSocialPresenceState;
      type: "renew";
    };

type SocialPresenceCrypto = {
  getRandomValues: (bytes: Uint8Array) => Uint8Array;
  randomUUID?: () => string;
};

function normalizePositiveInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
}

function assertSupportedClientId(clientId: string) {
  if (!SOCIAL_PRESENCE_CLIENT_ID_PATTERN.test(clientId)) {
    throw new Error("Social presence client id is not supported.");
  }

  return clientId;
}

export function createSocialPresenceClientId(
  cryptoSource: SocialPresenceCrypto,
) {
  const randomUuid = cryptoSource.randomUUID?.();

  if (
    randomUuid !== undefined &&
    SOCIAL_PRESENCE_CLIENT_ID_PATTERN.test(randomUuid)
  ) {
    return randomUuid;
  }

  const randomBytes = cryptoSource.getRandomValues(new Uint8Array(16));
  const encodedBytes = Array.from(
    new Uint8Array(
      randomBytes.buffer,
      randomBytes.byteOffset,
      randomBytes.byteLength,
    ),
    (value) => value.toString(16).padStart(2, "0"),
  ).join("");

  return assertSupportedClientId(`client-${encodedBytes}`);
}

/**
 * Owns one document's volatile presence lease. Operations are serialized so a
 * slow renewal cannot overtake a newer state change or release.
 */
export class SocialPresenceController {
  readonly #clearTimer: SocialPresenceControllerOptions["clearTimer"];
  readonly #clientId: string;
  readonly #documentTarget: SocialPresenceLifecycleTarget;
  readonly #fetcher: SocialFetch;
  readonly #getVisibilityState: () => DocumentVisibilityState;
  readonly #handleFocus = () => {
    if (this.#getVisibilityState() === "visible") {
      this.#isSuspended = false;
      void this.#renewNow();
    }
  };
  readonly #handlePageHide = () => {
    void this.#suspendAndRelease(true);
  };
  readonly #handleVisibilityChange = () => {
    if (this.#getVisibilityState() === "visible") {
      this.#isSuspended = false;
      void this.#renewNow();
      return;
    }

    void this.#suspendAndRelease(true);
  };
  readonly #renewIntervalMs: number;
  readonly #requestTimeoutMs: number;
  readonly #scheduleTimer: SocialPresenceControllerOptions["scheduleTimer"];
  readonly #windowTarget: SocialPresenceLifecycleTarget;
  #attached = false;
  #desiredPresence: DesiredSocialPresence | null = null;
  #isReleaseHeld = false;
  #isSuspended = true;
  #latestOperationGeneration = 0;
  #operationQueue: Promise<void> = Promise.resolve();
  #renewCycle = 0;
  #renewTimer: SocialPresenceTimerHandle | null = null;
  #snapshot: SocialPresenceClientSnapshot = {
    availability: "offline",
    error: null,
  };
  readonly #snapshotListeners = new Set<
    (snapshot: SocialPresenceClientSnapshot) => void
  >();

  constructor({
    clientId,
    clearTimer,
    documentTarget,
    fetcher,
    getVisibilityState,
    renewIntervalMs = SOCIAL_PRESENCE_RENEW_INTERVAL_MS,
    requestTimeoutMs = SOCIAL_PRESENCE_REQUEST_TIMEOUT_MS,
    scheduleTimer,
    windowTarget,
  }: SocialPresenceControllerOptions) {
    this.#clientId = assertSupportedClientId(clientId);
    this.#clearTimer = clearTimer;
    this.#documentTarget = documentTarget;
    this.#fetcher = fetcher;
    this.#getVisibilityState = getVisibilityState;
    this.#renewIntervalMs = normalizePositiveInteger(
      renewIntervalMs,
      "Social presence renewal interval",
    );
    this.#requestTimeoutMs = normalizePositiveInteger(
      requestTimeoutMs,
      "Social presence request timeout",
    );
    this.#scheduleTimer = scheduleTimer;
    this.#windowTarget = windowTarget;
  }

  start() {
    if (this.#attached) {
      return;
    }

    this.#attached = true;
    this.#documentTarget.addEventListener(
      "visibilitychange",
      this.#handleVisibilityChange,
    );
    this.#windowTarget.addEventListener("focus", this.#handleFocus);
    this.#windowTarget.addEventListener("pagehide", this.#handlePageHide);

    if (this.#getVisibilityState() === "visible") {
      this.#isSuspended = false;
      void this.#renewNow();
    }
  }

  async stop() {
    if (!this.#attached) {
      return;
    }

    this.#attached = false;
    this.#documentTarget.removeEventListener(
      "visibilitychange",
      this.#handleVisibilityChange,
    );
    this.#windowTarget.removeEventListener("focus", this.#handleFocus);
    this.#windowTarget.removeEventListener("pagehide", this.#handlePageHide);

    await this.#suspendAndRelease(true);
  }

  async update(
    userId: string | null,
    state: BrowserSocialPresenceState,
  ) {
    const previousPresence = this.#desiredPresence;
    const nextPresence =
      userId === null
        ? null
        : {
            state,
            userId,
          };
    const changed =
      previousPresence?.userId !== nextPresence?.userId ||
      previousPresence?.state !== nextPresence?.state;

    if (nextPresence === null) {
      this.#isReleaseHeld = false;
      this.#desiredPresence = null;
      this.#setSnapshot({ availability: "offline", error: null });
      await this.#suspendAndRelease(true, false, previousPresence !== null);
      return;
    }

    this.#desiredPresence = nextPresence;

    if (changed) {
      this.#isReleaseHeld = false;
      this.#setSnapshot({
        availability: state === "busy" ? "busy" : "unknown",
        error: null,
      });
    }

    if (
      changed &&
      this.#attached &&
      this.#getVisibilityState() === "visible"
    ) {
      this.#isSuspended = false;
      await this.#renewNow();
    }
  }

  async releaseForSignOut() {
    this.#isReleaseHeld = true;
    await this.#suspendAndRelease(true, true);
  }

  resumeAfterFailedSignOut() {
    if (!this.#isReleaseHeld) {
      return;
    }

    this.#isReleaseHeld = false;

    if (
      this.#attached &&
      this.#desiredPresence !== null &&
      this.#getVisibilityState() === "visible"
    ) {
      this.#isSuspended = false;
      void this.#renewNow();
    }
  }

  getSnapshot() {
    return this.#snapshot;
  }

  subscribe(listener: (snapshot: SocialPresenceClientSnapshot) => void) {
    this.#snapshotListeners.add(listener);

    return () => {
      this.#snapshotListeners.delete(listener);
    };
  }

  #clearRenewTimer() {
    if (this.#renewTimer !== null) {
      this.#clearTimer(this.#renewTimer);
      this.#renewTimer = null;
    }
  }

  #enqueueOperation(operation: SocialPresenceOperation) {
    const operationGeneration = this.#latestOperationGeneration + 1;
    this.#latestOperationGeneration = operationGeneration;

    const queuedOperation = this.#operationQueue.then(async () => {
      if (operationGeneration !== this.#latestOperationGeneration) {
        return;
      }

      const update = await this.#performOperation(
        operation,
        operationGeneration,
      );

      if (operationGeneration !== this.#latestOperationGeneration) {
        return;
      }

      this.#setSnapshot({ availability: update.availability, error: null });
    });

    const settledOperation = queuedOperation.catch((error: unknown) => {
      // Presence is advisory. The lease TTL is the failure fallback.
      if (operationGeneration !== this.#latestOperationGeneration) {
        return;
      }

      this.#setSnapshot({
        availability: "unknown",
        error:
          error instanceof Error
            ? error
            : new Error("Social presence is unavailable."),
      });
    });

    this.#operationQueue = settledOperation;

    return settledOperation;
  }

  async #performOperation(
    operation: SocialPresenceOperation,
    operationGeneration: number,
  ) {
    const abortController = new AbortController();
    const operationFetcher: SocialFetch = (input, init) =>
      this.#fetcher(input, { ...init, signal: abortController.signal });
    let requestTimeout: SocialPresenceTimerHandle | null = null;
    const timeout = new Promise<never>((_resolve, reject) => {
      requestTimeout = this.#scheduleTimer(() => {
        abortController.abort();
        reject(new Error("Social presence request timed out."));
      }, this.#requestTimeoutMs);
    });
    const request =
      operation.type === "renew"
        ? renewSocialPresence(
            {
              clientId: this.#clientId,
              operationGeneration,
              state: operation.state,
            },
            operationFetcher,
          )
        : releaseSocialPresence(
            this.#clientId,
            operationGeneration,
            operationFetcher,
            { keepalive: operation.keepalive },
          );

    try {
      return await Promise.race([request, timeout]);
    } finally {
      if (requestTimeout !== null) {
        this.#clearTimer(requestTimeout);
      }
    }
  }

  async #renewNow() {
    if (
      !this.#attached ||
      this.#isReleaseHeld ||
      this.#isSuspended ||
      this.#desiredPresence === null ||
      this.#getVisibilityState() !== "visible"
    ) {
      return;
    }

    this.#clearRenewTimer();
    const renewCycle = this.#renewCycle + 1;
    this.#renewCycle = renewCycle;
    const { state } = this.#desiredPresence;

    await this.#enqueueOperation({ state, type: "renew" });

    if (
      renewCycle !== this.#renewCycle ||
      !this.#attached ||
      this.#isReleaseHeld ||
      this.#isSuspended ||
      this.#desiredPresence === null ||
      this.#getVisibilityState() !== "visible"
    ) {
      return;
    }

    this.#renewTimer = this.#scheduleTimer(() => {
      this.#renewTimer = null;
      void this.#renewNow();
    }, this.#renewIntervalMs);
  }

  #setSnapshot(snapshot: SocialPresenceClientSnapshot) {
    if (
      snapshot.availability === this.#snapshot.availability &&
      snapshot.error === this.#snapshot.error
    ) {
      return;
    }

    this.#snapshot = snapshot;

    for (const listener of this.#snapshotListeners) {
      listener(snapshot);
    }
  }

  async #suspendAndRelease(
    keepalive: boolean,
    force = false,
    shouldRelease = this.#desiredPresence !== null,
  ) {
    this.#renewCycle += 1;
    this.#clearRenewTimer();

    if (this.#isSuspended && !force) {
      return;
    }

    this.#isSuspended = true;

    if (shouldRelease) {
      await this.#enqueueOperation({ keepalive, type: "release" });
    }
  }
}

let browserPresenceController: SocialPresenceController | null | undefined;

function createBrowserLifecycleTarget(
  target: Document | Window,
): SocialPresenceLifecycleTarget {
  return {
    addEventListener: (type, listener) => {
      target.addEventListener(type, listener);
    },
    removeEventListener: (type, listener) => {
      target.removeEventListener(type, listener);
    },
  };
}

export function getBrowserSocialPresenceController() {
  if (browserPresenceController !== undefined) {
    return browserPresenceController;
  }

  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof crypto === "undefined"
  ) {
    browserPresenceController = null;
    return browserPresenceController;
  }

  try {
    browserPresenceController = new SocialPresenceController({
      clientId: createSocialPresenceClientId(crypto),
      clearTimer: (timer) => window.clearTimeout(timer),
      documentTarget: createBrowserLifecycleTarget(document),
      fetcher: (input, init) => fetch(input, init),
      getVisibilityState: () => document.visibilityState,
      scheduleTimer: (callback, delayMs) =>
        window.setTimeout(callback, delayMs),
      windowTarget: createBrowserLifecycleTarget(window),
    });
  } catch {
    browserPresenceController = null;
  }

  return browserPresenceController;
}

export async function releaseCurrentSocialPresenceLease() {
  await getBrowserSocialPresenceController()?.releaseForSignOut();
}

export function resumeCurrentSocialPresenceLease() {
  getBrowserSocialPresenceController()?.resumeAfterFailedSignOut();
}

const UNAVAILABLE_BROWSER_PRESENCE_SNAPSHOT: SocialPresenceClientSnapshot = {
  availability: "offline",
  error: null,
};

export function getBrowserSocialPresenceSnapshot() {
  return (
    getBrowserSocialPresenceController()?.getSnapshot() ??
    UNAVAILABLE_BROWSER_PRESENCE_SNAPSHOT
  );
}

export function subscribeBrowserSocialPresence(
  listener: () => void,
) {
  return (
    getBrowserSocialPresenceController()?.subscribe(listener) ?? (() => {})
  );
}
