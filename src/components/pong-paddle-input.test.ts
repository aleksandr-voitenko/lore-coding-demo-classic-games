import { describe, expect, it } from "vitest";

import {
  createPongPaddleMovementState,
  getPongPaddleMovementKey,
  pressPongPaddleMovementKey,
  releasePongPaddleMovementKey,
  resetPongPaddleMovementState,
} from "./pong-paddle-input";

describe("Pong paddle input", () => {
  it("maps arrow and WASD movement keys while ignoring unrelated keys", () => {
    expect(getPongPaddleMovementKey("ArrowUp")).toEqual({
      direction: "up",
      key: "ArrowUp",
    });
    expect(getPongPaddleMovementKey("W")).toEqual({ direction: "up", key: "w" });
    expect(getPongPaddleMovementKey("s")).toEqual({ direction: "down", key: "s" });
    expect(getPongPaddleMovementKey("Enter")).toBeNull();
  });

  it("starts movement on key press and ignores repeated presses of the same key", () => {
    const state = createPongPaddleMovementState();
    const downKey = getPongPaddleMovementKey("ArrowDown");

    expect(downKey).not.toBeNull();
    expect(pressPongPaddleMovementKey(state, downKey!)).toEqual({
      direction: "down",
      shouldMoveImmediately: true,
    });
    expect(state.direction).toBe("down");
    expect(pressPongPaddleMovementKey(state, downKey!)).toEqual({
      direction: "down",
      shouldMoveImmediately: false,
    });
  });

  it("keeps moving until the held movement key is released", () => {
    const state = createPongPaddleMovementState();
    const upKey = getPongPaddleMovementKey("ArrowUp");

    expect(upKey).not.toBeNull();
    pressPongPaddleMovementKey(state, upKey!);
    expect(releasePongPaddleMovementKey(state, upKey!)).toEqual({
      direction: null,
      handled: true,
    });
    expect(state.direction).toBeNull();
  });

  it("uses the latest pressed direction and falls back to a still-held opposite key", () => {
    const state = createPongPaddleMovementState();
    const upKey = getPongPaddleMovementKey("ArrowUp");
    const downKey = getPongPaddleMovementKey("ArrowDown");

    expect(upKey).not.toBeNull();
    expect(downKey).not.toBeNull();
    pressPongPaddleMovementKey(state, upKey!);
    pressPongPaddleMovementKey(state, downKey!);
    expect(state.direction).toBe("down");
    expect(releasePongPaddleMovementKey(state, downKey!)).toEqual({
      direction: "up",
      handled: true,
    });
    expect(releasePongPaddleMovementKey(state, upKey!)).toEqual({
      direction: null,
      handled: true,
    });
  });

  it("keeps a direction active until every key for that direction is released", () => {
    const state = createPongPaddleMovementState();
    const arrowUpKey = getPongPaddleMovementKey("ArrowUp");
    const wKey = getPongPaddleMovementKey("w");

    expect(arrowUpKey).not.toBeNull();
    expect(wKey).not.toBeNull();
    pressPongPaddleMovementKey(state, arrowUpKey!);
    pressPongPaddleMovementKey(state, wKey!);
    expect(releasePongPaddleMovementKey(state, wKey!)).toEqual({
      direction: "up",
      handled: true,
    });
    expect(releasePongPaddleMovementKey(state, arrowUpKey!)).toEqual({
      direction: null,
      handled: true,
    });
  });

  it("resets held keys and the active movement direction", () => {
    const state = createPongPaddleMovementState();
    const upKey = getPongPaddleMovementKey("ArrowUp");

    expect(upKey).not.toBeNull();
    pressPongPaddleMovementKey(state, upKey!);
    resetPongPaddleMovementState(state);

    expect(state.direction).toBeNull();
    expect(state.heldKeys.down.size).toBe(0);
    expect(state.heldKeys.up.size).toBe(0);
  });
});
