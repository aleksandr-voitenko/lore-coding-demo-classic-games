import { describe, expect, it } from "vitest";

import { getBreakoutPaddleMovementKey } from "./breakout-paddle-input";

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
});
