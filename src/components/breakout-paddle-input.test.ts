import { describe, expect, it } from "vitest";

import {
  createBreakoutPaddleMovementState,
  getBreakoutPaddleMovementKey,
  pressBreakoutPaddleMovementKey,
  releaseBreakoutPaddleMovementKey,
  resetBreakoutPaddleMovementState,
} from "./breakout-paddle-input";

describe("Breakout paddle input", () => {
  it("maps arrow and WASD movement keys while ignoring unrelated keys", () => {
    expect(getBreakoutPaddleMovementKey("ArrowLeft")).toEqual({
      direction: "left",
      key: "ArrowLeft",
    });
    expect(getBreakoutPaddleMovementKey("A")).toEqual({ direction: "left", key: "a" });
    expect(getBreakoutPaddleMovementKey("d")).toEqual({ direction: "right", key: "d" });
    expect(getBreakoutPaddleMovementKey("Enter")).toBeNull();
  });

  it("starts movement on key press and ignores repeated presses of the same key", () => {
    const state = createBreakoutPaddleMovementState();
    const rightKey = getBreakoutPaddleMovementKey("ArrowRight");

    expect(rightKey).not.toBeNull();
    expect(pressBreakoutPaddleMovementKey(state, rightKey!)).toEqual({
      direction: "right",
      shouldMoveImmediately: true,
    });
    expect(state.direction).toBe("right");
    expect(pressBreakoutPaddleMovementKey(state, rightKey!)).toEqual({
      direction: "right",
      shouldMoveImmediately: false,
    });
  });

  it("keeps moving until the held movement key is released", () => {
    const state = createBreakoutPaddleMovementState();
    const rightKey = getBreakoutPaddleMovementKey("ArrowRight");

    expect(rightKey).not.toBeNull();
    pressBreakoutPaddleMovementKey(state, rightKey!);
    expect(releaseBreakoutPaddleMovementKey(state, rightKey!)).toEqual({
      direction: null,
      handled: true,
    });
    expect(state.direction).toBeNull();
  });

  it("uses the latest pressed direction and falls back to a still-held opposite key", () => {
    const state = createBreakoutPaddleMovementState();
    const leftKey = getBreakoutPaddleMovementKey("ArrowLeft");
    const rightKey = getBreakoutPaddleMovementKey("ArrowRight");

    expect(leftKey).not.toBeNull();
    expect(rightKey).not.toBeNull();
    pressBreakoutPaddleMovementKey(state, leftKey!);
    pressBreakoutPaddleMovementKey(state, rightKey!);
    expect(state.direction).toBe("right");
    expect(releaseBreakoutPaddleMovementKey(state, rightKey!)).toEqual({
      direction: "left",
      handled: true,
    });
    expect(releaseBreakoutPaddleMovementKey(state, leftKey!)).toEqual({
      direction: null,
      handled: true,
    });
  });

  it("keeps a direction active until every key for that direction is released", () => {
    const state = createBreakoutPaddleMovementState();
    const arrowLeftKey = getBreakoutPaddleMovementKey("ArrowLeft");
    const aKey = getBreakoutPaddleMovementKey("a");

    expect(arrowLeftKey).not.toBeNull();
    expect(aKey).not.toBeNull();
    pressBreakoutPaddleMovementKey(state, arrowLeftKey!);
    pressBreakoutPaddleMovementKey(state, aKey!);
    expect(releaseBreakoutPaddleMovementKey(state, aKey!)).toEqual({
      direction: "left",
      handled: true,
    });
    expect(releaseBreakoutPaddleMovementKey(state, arrowLeftKey!)).toEqual({
      direction: null,
      handled: true,
    });
  });

  it("resets held keys and the active movement direction", () => {
    const state = createBreakoutPaddleMovementState();
    const leftKey = getBreakoutPaddleMovementKey("ArrowLeft");

    expect(leftKey).not.toBeNull();
    pressBreakoutPaddleMovementKey(state, leftKey!);
    resetBreakoutPaddleMovementState(state);

    expect(state.direction).toBeNull();
    expect(state.heldKeys.left.size).toBe(0);
    expect(state.heldKeys.right.size).toBe(0);
  });
});
