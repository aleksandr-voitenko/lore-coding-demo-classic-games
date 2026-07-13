import { describe, expect, it } from "vitest";

import {
  createBattleCityPlayerMovementState,
  getBattleCityPlayerMovementKey,
  pressBattleCityPlayerMovementKey,
  releaseBattleCityPlayerMovementKey,
  resetBattleCityPlayerMovementState,
} from "./battle-city-player-input";

describe("Battle City player input", () => {
  it("maps arrow and WASD keys to all four cardinal directions", () => {
    expect(getBattleCityPlayerMovementKey("ArrowUp")).toEqual({
      direction: "up",
      key: "ArrowUp",
    });
    expect(getBattleCityPlayerMovementKey("D")).toEqual({
      direction: "right",
      key: "d",
    });
    expect(getBattleCityPlayerMovementKey("ArrowDown")).toEqual({
      direction: "down",
      key: "ArrowDown",
    });
    expect(getBattleCityPlayerMovementKey("a")).toEqual({
      direction: "left",
      key: "a",
    });
    expect(getBattleCityPlayerMovementKey("Enter")).toBeNull();
  });

  it("uses the NES Right, Left, Down, Up priority for simultaneous holds", () => {
    const state = createBattleCityPlayerMovementState();
    const up = getBattleCityPlayerMovementKey("w");
    const right = getBattleCityPlayerMovementKey("ArrowRight");

    if (up === null || right === null) {
      throw new Error("Expected Battle City movement keys to be registered.");
    }

    expect(pressBattleCityPlayerMovementKey(state, up)).toEqual({
      direction: "up",
      shouldMoveImmediately: true,
    });
    expect(pressBattleCityPlayerMovementKey(state, right)).toEqual({
      direction: "right",
      shouldMoveImmediately: true,
    });
    expect(state.direction).toBe("right");

    expect(pressBattleCityPlayerMovementKey(state, up)).toEqual({
      direction: "right",
      shouldMoveImmediately: false,
    });
    expect(state.direction).toBe("right");

    expect(releaseBattleCityPlayerMovementKey(state, right)).toEqual({
      direction: "up",
      handled: true,
    });
    expect(state.direction).toBe("up");
  });

  it("coalesces repeated keys while retaining alternate bindings", () => {
    const state = createBattleCityPlayerMovementState();
    const arrowUp = getBattleCityPlayerMovementKey("ArrowUp");
    const letterUp = getBattleCityPlayerMovementKey("W");

    if (arrowUp === null || letterUp === null) {
      throw new Error("Expected Battle City movement keys to be registered.");
    }

    expect(pressBattleCityPlayerMovementKey(state, arrowUp)).toEqual({
      direction: "up",
      shouldMoveImmediately: true,
    });
    expect(pressBattleCityPlayerMovementKey(state, arrowUp)).toEqual({
      direction: "up",
      shouldMoveImmediately: false,
    });
    expect(pressBattleCityPlayerMovementKey(state, letterUp)).toEqual({
      direction: "up",
      shouldMoveImmediately: true,
    });

    expect(releaseBattleCityPlayerMovementKey(state, letterUp)).toEqual({
      direction: "up",
      handled: true,
    });
    expect(releaseBattleCityPlayerMovementKey(state, arrowUp)).toEqual({
      direction: null,
      handled: true,
    });
  });

  it("clears every held key during blur or modal cleanup", () => {
    const state = createBattleCityPlayerMovementState();
    const left = getBattleCityPlayerMovementKey("ArrowLeft");
    const down = getBattleCityPlayerMovementKey("s");

    if (left === null || down === null) {
      throw new Error("Expected Battle City movement keys to be registered.");
    }

    pressBattleCityPlayerMovementKey(state, left);
    pressBattleCityPlayerMovementKey(state, down);
    resetBattleCityPlayerMovementState(state);

    expect(state.direction).toBeNull();
    expect(state.lastDirection).toBeNull();
    expect(Object.values(state.heldKeys).every((keys) => keys.size === 0)).toBe(true);
  });
});
