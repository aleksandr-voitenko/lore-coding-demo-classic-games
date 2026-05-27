import { describe, expect, it } from "vitest";

import { getSpaceInvadersPlayerMovementKey } from "./space-invaders-player-input";

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
});
