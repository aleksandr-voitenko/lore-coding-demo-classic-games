import { describe, expect, it } from "vitest";

import { getTetrisPieceMovementKey } from "./tetris-piece-input";

describe("Tetris piece input", () => {
  it("maps arrow and WASD horizontal movement keys while ignoring unrelated keys", () => {
    expect(getTetrisPieceMovementKey("ArrowLeft")).toEqual({
      direction: "left",
      key: "ArrowLeft",
    });
    expect(getTetrisPieceMovementKey("A")).toEqual({ direction: "left", key: "a" });
    expect(getTetrisPieceMovementKey("d")).toEqual({ direction: "right", key: "d" });
    expect(getTetrisPieceMovementKey("ArrowDown")).toBeNull();
  });
});
