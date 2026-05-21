import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isTypingTarget } from "./game-input";

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
