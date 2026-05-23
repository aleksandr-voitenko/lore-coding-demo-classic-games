import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  isTypingTarget,
  registerGameKeyDown,
  registerGameKeyUp,
  shouldIgnoreGameKeyDown,
} from "./game-input";

const originalHTMLElement = globalThis.HTMLElement;

class TestHTMLElement {
  isContentEditable = false;
  tagName = "DIV";
}

function createElement(tagName: string, isContentEditable = false) {
  const element = new TestHTMLElement();

  element.tagName = tagName;
  element.isContentEditable = isContentEditable;

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

  it("ignores keyboard input during help, leaderboard entry, or typing targets", () => {
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
