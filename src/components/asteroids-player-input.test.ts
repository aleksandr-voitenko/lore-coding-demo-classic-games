import { describe, expect, it } from "vitest";

import {
  createAsteroidsControlState,
  getAsteroidsControlInput,
  getAsteroidsControlKey,
  pressAsteroidsControlKey,
  releaseAsteroidsControlKey,
  resetAsteroidsControlState,
} from "./asteroids-player-input";

describe("Asteroids player input", () => {
  it("maps arrow and WASD controls while ignoring unrelated keys", () => {
    expect(getAsteroidsControlKey("ArrowLeft")).toEqual({
      direction: "rotate-left",
      key: "ArrowLeft",
    });
    expect(getAsteroidsControlKey("A")).toEqual({
      direction: "rotate-left",
      key: "a",
    });
    expect(getAsteroidsControlKey("d")).toEqual({
      direction: "rotate-right",
      key: "d",
    });
    expect(getAsteroidsControlKey("ArrowUp")).toEqual({
      direction: "thrust",
      key: "ArrowUp",
    });
    expect(getAsteroidsControlKey("Enter")).toBeNull();
  });

  it("tracks simultaneous rotation and thrust controls", () => {
    const state = createAsteroidsControlState();
    const leftKey = getAsteroidsControlKey("ArrowLeft");
    const thrustKey = getAsteroidsControlKey("w");

    expect(leftKey).not.toBeNull();
    expect(thrustKey).not.toBeNull();

    pressAsteroidsControlKey(state, leftKey!);
    pressAsteroidsControlKey(state, thrustKey!);

    expect(getAsteroidsControlInput(state)).toEqual({
      rotateLeft: true,
      rotateRight: false,
      thrust: true,
    });

    expect(releaseAsteroidsControlKey(state, leftKey!)).toBe(true);
    expect(getAsteroidsControlInput(state)).toEqual({
      rotateLeft: false,
      rotateRight: false,
      thrust: true,
    });

    resetAsteroidsControlState(state);

    expect(getAsteroidsControlInput(state)).toEqual({
      rotateLeft: false,
      rotateRight: false,
      thrust: false,
    });
  });
});
