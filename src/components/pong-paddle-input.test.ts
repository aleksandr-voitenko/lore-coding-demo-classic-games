import { describe, expect, it } from "vitest";

import { getPongPaddleMovementKey } from "./pong-paddle-input";

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
});
