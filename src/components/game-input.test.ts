import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createHeldDirectionMovementController,
  createHeldDirectionMovementKeyGetter,
  createHeldDirectionMovementState,
  isGamePauseKey,
  isTypingTarget,
  pressHeldDirectionMovementKey,
  registerHeldDirectionMovementBlurReset,
  registerGameKeyDown,
  registerGameKeyUp,
  releaseHeldDirectionMovementKey,
  resetHeldDirectionMovementState,
  shouldIgnoreGameKeyDown,
  type HeldDirectionMovementTimers,
} from "./game-input";

const originalHTMLElement = globalThis.HTMLElement;

class TestHTMLElement {
  isInsideGameModal = false;
  isContentEditable = false;
  tagName = "DIV";

  closest(selector: string) {
    if (selector === "[data-game-modal]" && this.isInsideGameModal) {
      return this;
    }

    return null;
  }
}

function createElement(
  tagName: string,
  isContentEditable = false,
  isInsideGameModal = false,
) {
  const element = new TestHTMLElement();

  element.tagName = tagName;
  element.isContentEditable = isContentEditable;
  element.isInsideGameModal = isInsideGameModal;

  return element as unknown as HTMLElement;
}

function createKeyboardTarget(expectedType: "keydown" | "keyup") {
  const listeners = new Set<(event: KeyboardEvent) => void>();
  const target: NonNullable<Parameters<typeof registerGameKeyDown>[1]> = {
    addEventListener(type, listener) {
      expect(type).toBe(expectedType);
      listeners.add(listener);
    },
    removeEventListener(type, listener) {
      expect(type).toBe(expectedType);
      listeners.delete(listener);
    },
  };

  return {
    dispatch(event: KeyboardEvent) {
      listeners.forEach((listener) => listener(event));
    },
    get listenerCount() {
      return listeners.size;
    },
    target,
  };
}

function createBlurTarget() {
  const listeners = new Set<(event: Event) => void>();
  const target = {
    addEventListener(type: "blur", listener: (event: Event) => void) {
      expect(type).toBe("blur");
      listeners.add(listener);
    },
    removeEventListener(type: "blur", listener: (event: Event) => void) {
      expect(type).toBe("blur");
      listeners.delete(listener);
    },
  };

  return {
    dispatch() {
      listeners.forEach((listener) => listener(new Event("blur")));
    },
    get listenerCount() {
      return listeners.size;
    },
    target,
  };
}

type TestMovementDirection = "left" | "right";

const TEST_MOVEMENT_DIRECTIONS = ["left", "right"] as const;

function createTestMovementState() {
  return createHeldDirectionMovementState(TEST_MOVEMENT_DIRECTIONS);
}

function createTestMovementTimers() {
  let nextIntervalId = 1;
  let nextTimeoutId = 1_001;
  const listeners = new Map<number, () => void>();
  const timeoutListeners = new Map<number, () => void>();
  const delays: number[] = [];
  const clearedIntervals: number[] = [];
  const clearedTimeouts: number[] = [];
  const timeoutDelays: number[] = [];
  const timers: HeldDirectionMovementTimers = {
    clearInterval(intervalId) {
      clearedIntervals.push(intervalId);
      listeners.delete(intervalId);
    },
    clearTimeout(timeoutId) {
      clearedTimeouts.push(timeoutId);
      timeoutListeners.delete(timeoutId);
    },
    setInterval(listener, intervalMs) {
      const intervalId = nextIntervalId;

      nextIntervalId += 1;
      delays.push(intervalMs);
      listeners.set(intervalId, listener);

      return intervalId;
    },
    setTimeout(listener, delayMs) {
      const timeoutId = nextTimeoutId;

      nextTimeoutId += 1;
      timeoutDelays.push(delayMs);
      timeoutListeners.set(timeoutId, listener);

      return timeoutId;
    },
  };

  return {
    get activeIntervalCount() {
      return listeners.size;
    },
    get activeTimeoutCount() {
      return timeoutListeners.size;
    },
    clearedIntervals,
    clearedTimeouts,
    delays,
    runActiveIntervals() {
      Array.from(listeners.values()).forEach((listener) => listener());
    },
    runActiveTimeouts() {
      Array.from(timeoutListeners.entries()).forEach(([timeoutId, listener]) => {
        timeoutListeners.delete(timeoutId);
        listener();
      });
    },
    timeoutDelays,
    timers,
  };
}

describe("isTypingTarget", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "HTMLElement", {
      configurable: true,
      value: TestHTMLElement,
    });
  });

  afterEach(() => {
    if (originalHTMLElement === undefined) {
      Reflect.deleteProperty(globalThis, "HTMLElement");
      return;
    }

    Object.defineProperty(globalThis, "HTMLElement", {
      configurable: true,
      value: originalHTMLElement,
    });
  });

  it("returns false for missing or non-HTML event targets", () => {
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget({ tagName: "INPUT" } as unknown as EventTarget)).toBe(false);
  });

  it.each(["INPUT", "SELECT", "TEXTAREA"])(
    "treats %s elements as typing targets",
    (tagName) => {
      expect(isTypingTarget(createElement(tagName))).toBe(true);
    },
  );

  it("treats editable elements as typing targets without blocking ordinary buttons", () => {
    expect(isTypingTarget(createElement("DIV", true))).toBe(true);
    expect(isTypingTarget(createElement("BUTTON"))).toBe(false);
  });
});

describe("shouldIgnoreGameKeyDown", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "HTMLElement", {
      configurable: true,
      value: TestHTMLElement,
    });
  });

  afterEach(() => {
    if (originalHTMLElement === undefined) {
      Reflect.deleteProperty(globalThis, "HTMLElement");
      return;
    }

    Object.defineProperty(globalThis, "HTMLElement", {
      configurable: true,
      value: originalHTMLElement,
    });
  });

  it("allows ordinary controls when no modal state is active", () => {
    expect(
      shouldIgnoreGameKeyDown({
        target: createElement("BUTTON"),
      }),
    ).toBe(false);
  });

  it("ignores keyboard input during help, game dialogs, leaderboard entry, or typing targets", () => {
    expect(
      shouldIgnoreGameKeyDown(
        {
          target: createElement("BUTTON"),
        },
        { isHelpVisible: true },
      ),
    ).toBe(true);
    expect(
      shouldIgnoreGameKeyDown(
        {
          target: createElement("BUTTON"),
        },
        { hasPendingLeaderboardEntry: true },
      ),
    ).toBe(true);
    expect(
      shouldIgnoreGameKeyDown({
        target: createElement("INPUT"),
      }),
    ).toBe(true);
    expect(
      shouldIgnoreGameKeyDown({
        target: createElement("BUTTON", false, true),
      }),
    ).toBe(true);
  });
});

describe("held direction movement input", () => {
  const getMovementKey = createHeldDirectionMovementKeyGetter<TestMovementDirection>({
    left: ["ArrowLeft", "a"],
    right: ["ArrowRight", "D"],
  });

  it("maps configured keys with single-character case normalization", () => {
    expect(getMovementKey("ArrowLeft")).toEqual({
      direction: "left",
      key: "ArrowLeft",
    });
    expect(getMovementKey("A")).toEqual({ direction: "left", key: "a" });
    expect(getMovementKey("d")).toEqual({ direction: "right", key: "d" });
    expect(getMovementKey("Enter")).toBeNull();
  });

  it("tracks latest pressed direction without duplicate immediate moves for a repeated key", () => {
    const state = createTestMovementState();
    const rightKey = getMovementKey("ArrowRight");

    expect(rightKey).not.toBeNull();
    expect(pressHeldDirectionMovementKey(state, rightKey!)).toEqual({
      direction: "right",
      shouldMoveImmediately: true,
    });
    expect(state.direction).toBe("right");
    expect(pressHeldDirectionMovementKey(state, rightKey!)).toEqual({
      direction: "right",
      shouldMoveImmediately: false,
    });
  });

  it("falls back to the opposite still-held key when the latest key is released", () => {
    const state = createTestMovementState();
    const leftKey = getMovementKey("ArrowLeft");
    const rightKey = getMovementKey("ArrowRight");

    expect(leftKey).not.toBeNull();
    expect(rightKey).not.toBeNull();
    pressHeldDirectionMovementKey(state, leftKey!);
    pressHeldDirectionMovementKey(state, rightKey!);

    expect(state.direction).toBe("right");
    expect(releaseHeldDirectionMovementKey(state, rightKey!)).toEqual({
      direction: "left",
      handled: true,
    });
    expect(releaseHeldDirectionMovementKey(state, leftKey!)).toEqual({
      direction: null,
      handled: true,
    });
  });

  it("keeps a direction active until every physical key for it is released", () => {
    const state = createTestMovementState();
    const arrowLeftKey = getMovementKey("ArrowLeft");
    const aKey = getMovementKey("a");

    expect(arrowLeftKey).not.toBeNull();
    expect(aKey).not.toBeNull();
    pressHeldDirectionMovementKey(state, arrowLeftKey!);
    pressHeldDirectionMovementKey(state, aKey!);

    expect(releaseHeldDirectionMovementKey(state, aKey!)).toEqual({
      direction: "left",
      handled: true,
    });
    expect(releaseHeldDirectionMovementKey(state, arrowLeftKey!)).toEqual({
      direction: null,
      handled: true,
    });
  });

  it("reports unhandled releases without changing the active direction", () => {
    const state = createTestMovementState();
    const leftKey = getMovementKey("ArrowLeft");

    expect(leftKey).not.toBeNull();
    expect(releaseHeldDirectionMovementKey(state, leftKey!)).toEqual({
      direction: null,
      handled: false,
    });
  });

  it("resets held keys and the active movement direction", () => {
    const state = createTestMovementState();
    const leftKey = getMovementKey("ArrowLeft");

    expect(leftKey).not.toBeNull();
    pressHeldDirectionMovementKey(state, leftKey!);
    resetHeldDirectionMovementState(state);

    expect(state.direction).toBeNull();
    expect(state.heldKeys.left.size).toBe(0);
    expect(state.heldKeys.right.size).toBe(0);
  });

  it("runs continuous movement on one interval and clears it during reset", () => {
    const state = createTestMovementState();
    const testTimers = createTestMovementTimers();
    const moves: TestMovementDirection[] = [];
    const controller = createHeldDirectionMovementController({
      intervalMs: 16,
      move: (direction) => moves.push(direction),
      state,
      timers: testTimers.timers,
    });
    const rightKey = getMovementKey("ArrowRight");

    expect(rightKey).not.toBeNull();
    controller.beginMovement(rightKey!);

    expect(moves).toEqual(["right"]);
    expect(testTimers.activeIntervalCount).toBe(1);
    expect(testTimers.delays).toEqual([16]);

    controller.beginMovement(rightKey!);
    expect(moves).toEqual(["right"]);
    expect(testTimers.activeIntervalCount).toBe(1);

    testTimers.runActiveIntervals();
    expect(moves).toEqual(["right", "right"]);

    controller.resetMovement();

    expect(state.direction).toBeNull();
    expect(state.heldKeys.left.size).toBe(0);
    expect(state.heldKeys.right.size).toBe(0);
    expect(testTimers.activeIntervalCount).toBe(0);
    expect(testTimers.clearedIntervals).toEqual([1]);

    testTimers.runActiveIntervals();
    expect(moves).toEqual(["right", "right"]);
  });

  it("can delay the first repeated movement before starting the interval", () => {
    const state = createTestMovementState();
    const testTimers = createTestMovementTimers();
    const moves: TestMovementDirection[] = [];
    const controller = createHeldDirectionMovementController({
      initialDelayMs: 80,
      intervalMs: 16,
      move: (direction) => moves.push(direction),
      state,
      timers: testTimers.timers,
    });
    const rightKey = getMovementKey("ArrowRight");

    expect(rightKey).not.toBeNull();
    controller.beginMovement(rightKey!);

    expect(moves).toEqual(["right"]);
    expect(testTimers.timeoutDelays).toEqual([80]);
    expect(testTimers.activeTimeoutCount).toBe(1);
    expect(testTimers.activeIntervalCount).toBe(0);

    testTimers.runActiveTimeouts();

    expect(moves).toEqual(["right", "right"]);
    expect(testTimers.activeTimeoutCount).toBe(0);
    expect(testTimers.activeIntervalCount).toBe(1);
    expect(testTimers.delays).toEqual([16]);

    testTimers.runActiveIntervals();
    expect(moves).toEqual(["right", "right", "right"]);
  });

  it("clears a delayed movement repeat during reset before the interval starts", () => {
    const state = createTestMovementState();
    const testTimers = createTestMovementTimers();
    const moves: TestMovementDirection[] = [];
    const controller = createHeldDirectionMovementController({
      initialDelayMs: 80,
      intervalMs: 16,
      move: (direction) => moves.push(direction),
      state,
      timers: testTimers.timers,
    });
    const leftKey = getMovementKey("ArrowLeft");

    expect(leftKey).not.toBeNull();
    controller.beginMovement(leftKey!);
    controller.resetMovement();

    expect(moves).toEqual(["left"]);
    expect(testTimers.clearedTimeouts).toEqual([1_001]);
    expect(testTimers.activeTimeoutCount).toBe(0);
    expect(testTimers.activeIntervalCount).toBe(0);

    testTimers.runActiveTimeouts();
    testTimers.runActiveIntervals();

    expect(moves).toEqual(["left"]);
  });

  it("switches and stops controller movement through key releases", () => {
    const state = createTestMovementState();
    const testTimers = createTestMovementTimers();
    const moves: TestMovementDirection[] = [];
    const controller = createHeldDirectionMovementController({
      intervalMs: 16,
      move: (direction) => moves.push(direction),
      state,
      timers: testTimers.timers,
    });
    const leftKey = getMovementKey("ArrowLeft");
    const rightKey = getMovementKey("ArrowRight");

    expect(leftKey).not.toBeNull();
    expect(rightKey).not.toBeNull();

    controller.beginMovement(leftKey!);
    controller.beginMovement(rightKey!);

    expect(moves).toEqual(["left", "right"]);
    expect(testTimers.activeIntervalCount).toBe(1);

    expect(controller.endMovement(rightKey!)).toBe(true);
    expect(state.direction).toBe("left");
    expect(testTimers.activeIntervalCount).toBe(1);

    testTimers.runActiveIntervals();
    expect(moves).toEqual(["left", "right", "left"]);

    expect(controller.endMovement(rightKey!)).toBe(false);
    expect(controller.endMovement(leftKey!)).toBe(true);
    expect(state.direction).toBeNull();
    expect(testTimers.activeIntervalCount).toBe(0);
    expect(testTimers.clearedIntervals).toEqual([1]);
  });

  it("uses window timers when no custom timers are provided", () => {
    const originalWindow = globalThis.window;
    const intervalListeners = new Map<number, () => void>();
    const clearedIntervals: number[] = [];

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        clearInterval(intervalId: number) {
          clearedIntervals.push(intervalId);
          intervalListeners.delete(intervalId);
        },
        setInterval(listener: () => void, intervalMs: number) {
          expect(intervalMs).toBe(16);
          intervalListeners.set(99, listener);

          return 99;
        },
      },
    });

    try {
      const state = createTestMovementState();
      const moves: TestMovementDirection[] = [];
      const controller = createHeldDirectionMovementController({
        intervalMs: 16,
        move: (direction) => moves.push(direction),
        state,
      });
      const rightKey = getMovementKey("ArrowRight");

      expect(rightKey).not.toBeNull();
      controller.beginMovement(rightKey!);

      expect(moves).toEqual(["right"]);
      intervalListeners.get(99)?.();
      expect(moves).toEqual(["right", "right"]);

      controller.resetMovement();

      expect(clearedIntervals).toEqual([99]);
      expect(intervalListeners.size).toBe(0);
    } finally {
      if (originalWindow === undefined) {
        Reflect.deleteProperty(globalThis, "window");
      } else {
        Object.defineProperty(globalThis, "window", {
          configurable: true,
          value: originalWindow,
        });
      }
    }
  });

  it("registers blur cleanup that resets active movement and cleans up on unmount", () => {
    const state = createTestMovementState();
    const testTimers = createTestMovementTimers();
    const controller = createHeldDirectionMovementController({
      intervalMs: 16,
      move: () => undefined,
      state,
      timers: testTimers.timers,
    });
    const rightKey = getMovementKey("ArrowRight");
    const blurTarget = createBlurTarget();

    expect(rightKey).not.toBeNull();
    controller.beginMovement(rightKey!);

    const cleanup = registerHeldDirectionMovementBlurReset(controller, blurTarget.target);

    expect(blurTarget.listenerCount).toBe(1);
    expect(testTimers.activeIntervalCount).toBe(1);

    blurTarget.dispatch();

    expect(state.direction).toBeNull();
    expect(testTimers.activeIntervalCount).toBe(0);

    controller.beginMovement(rightKey!);
    cleanup();

    expect(blurTarget.listenerCount).toBe(0);
    expect(state.direction).toBeNull();
    expect(testTimers.activeIntervalCount).toBe(0);
  });
});

describe("isGamePauseKey", () => {
  it("only treats P as the direct keyboard pause key", () => {
    expect(isGamePauseKey("p")).toBe(true);
    expect(isGamePauseKey("P")).toBe(true);
    expect(isGamePauseKey(" ")).toBe(false);
    expect(isGamePauseKey("Escape")).toBe(false);
  });
});

describe("registerGameKeyDown", () => {
  it("registers a keydown handler and removes it during cleanup", () => {
    const events: KeyboardEvent[] = [];
    const keyboardTarget = createKeyboardTarget("keydown");
    const cleanup = registerGameKeyDown((event) => events.push(event), keyboardTarget.target);
    const handledEvent = { key: "ArrowLeft" } as KeyboardEvent;

    expect(keyboardTarget.listenerCount).toBe(1);

    keyboardTarget.dispatch(handledEvent);
    expect(events).toEqual([handledEvent]);

    cleanup();
    keyboardTarget.dispatch({ key: "ArrowRight" } as KeyboardEvent);

    expect(keyboardTarget.listenerCount).toBe(0);
    expect(events).toEqual([handledEvent]);
  });
});

describe("registerGameKeyUp", () => {
  it("registers a keyup handler and removes it during cleanup", () => {
    const events: KeyboardEvent[] = [];
    const keyboardTarget = createKeyboardTarget("keyup");
    const cleanup = registerGameKeyUp((event) => events.push(event), keyboardTarget.target);
    const handledEvent = { key: "ArrowLeft" } as KeyboardEvent;

    expect(keyboardTarget.listenerCount).toBe(1);

    keyboardTarget.dispatch(handledEvent);
    expect(events).toEqual([handledEvent]);

    cleanup();
    keyboardTarget.dispatch({ key: "ArrowRight" } as KeyboardEvent);

    expect(keyboardTarget.listenerCount).toBe(0);
    expect(events).toEqual([handledEvent]);
  });
});
