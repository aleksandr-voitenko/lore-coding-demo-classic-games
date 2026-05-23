import { describe, expect, it } from "vitest";

import {
  createSpaceInvadersPlayerMovementState,
  getSpaceInvadersPlayerMovementKey,
  pressSpaceInvadersPlayerMovementKey,
  releaseSpaceInvadersPlayerMovementKey,
  resetSpaceInvadersPlayerMovementState,
} from "./space-invaders-player-input";

describe("Space Invaders player input", () => {
  it("maps arrow and WASD movement keys while ignoring unrelated keys", () => {
    expect(getSpaceInvadersPlayerMovementKey("ArrowLeft")).toEqual({
      direction: "left",
      key: "ArrowLeft",
    });
    expect(getSpaceInvadersPlayerMovementKey("A")).toEqual({
      direction: "left",
      key: "a",
    });
    expect(getSpaceInvadersPlayerMovementKey("d")).toEqual({
      direction: "right",
      key: "d",
    });
    expect(getSpaceInvadersPlayerMovementKey("Enter")).toBeNull();
  });

  it("starts movement on key press and ignores repeated presses of the same key", () => {
    const state = createSpaceInvadersPlayerMovementState();
    const rightKey = getSpaceInvadersPlayerMovementKey("ArrowRight");

    expect(rightKey).not.toBeNull();
    expect(pressSpaceInvadersPlayerMovementKey(state, rightKey!)).toEqual({
      direction: "right",
      shouldMoveImmediately: true,
    });
    expect(state.direction).toBe("right");
    expect(pressSpaceInvadersPlayerMovementKey(state, rightKey!)).toEqual({
      direction: "right",
      shouldMoveImmediately: false,
    });
  });

  it("keeps moving until the held movement key is released", () => {
    const state = createSpaceInvadersPlayerMovementState();
    const rightKey = getSpaceInvadersPlayerMovementKey("ArrowRight");

    expect(rightKey).not.toBeNull();
    pressSpaceInvadersPlayerMovementKey(state, rightKey!);
    expect(releaseSpaceInvadersPlayerMovementKey(state, rightKey!)).toEqual({
      direction: null,
      handled: true,
    });
    expect(state.direction).toBeNull();
  });

  it("uses the latest pressed direction and falls back to a still-held opposite key", () => {
    const state = createSpaceInvadersPlayerMovementState();
    const leftKey = getSpaceInvadersPlayerMovementKey("ArrowLeft");
    const rightKey = getSpaceInvadersPlayerMovementKey("ArrowRight");

    expect(leftKey).not.toBeNull();
    expect(rightKey).not.toBeNull();
    pressSpaceInvadersPlayerMovementKey(state, leftKey!);
    pressSpaceInvadersPlayerMovementKey(state, rightKey!);
    expect(state.direction).toBe("right");
    expect(releaseSpaceInvadersPlayerMovementKey(state, rightKey!)).toEqual({
      direction: "left",
      handled: true,
    });
    expect(releaseSpaceInvadersPlayerMovementKey(state, leftKey!)).toEqual({
      direction: null,
      handled: true,
    });
  });

  it("keeps a direction active until every key for that direction is released", () => {
    const state = createSpaceInvadersPlayerMovementState();
    const arrowLeftKey = getSpaceInvadersPlayerMovementKey("ArrowLeft");
    const aKey = getSpaceInvadersPlayerMovementKey("a");

    expect(arrowLeftKey).not.toBeNull();
    expect(aKey).not.toBeNull();
    pressSpaceInvadersPlayerMovementKey(state, arrowLeftKey!);
    pressSpaceInvadersPlayerMovementKey(state, aKey!);
    expect(releaseSpaceInvadersPlayerMovementKey(state, aKey!)).toEqual({
      direction: "left",
      handled: true,
    });
    expect(releaseSpaceInvadersPlayerMovementKey(state, arrowLeftKey!)).toEqual({
      direction: null,
      handled: true,
    });
  });

  it("resets held keys and the active movement direction", () => {
    const state = createSpaceInvadersPlayerMovementState();
    const leftKey = getSpaceInvadersPlayerMovementKey("ArrowLeft");

    expect(leftKey).not.toBeNull();
    pressSpaceInvadersPlayerMovementKey(state, leftKey!);
    resetSpaceInvadersPlayerMovementState(state);

    expect(state.direction).toBeNull();
    expect(state.heldKeys.left.size).toBe(0);
    expect(state.heldKeys.right.size).toBe(0);
  });
});
