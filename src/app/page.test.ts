import { describe, expect, it } from "vitest";

import { getInitialReplayGameId } from "./page";

describe("home replay query parsing", () => {
  it("allows only games with replay players to launch in latest replay mode", () => {
    expect(getInitialReplayGameId("snake")).toBe("snake");
    expect(getInitialReplayGameId("tetris")).toBe("tetris");
    expect(getInitialReplayGameId("twenty-forty-eight")).toBe("twenty-forty-eight");
    expect(getInitialReplayGameId(["tetris", "snake"])).toBe("tetris");
    expect(getInitialReplayGameId("breakout")).toBeNull();
    expect(getInitialReplayGameId("minesweeper")).toBeNull();
    expect(getInitialReplayGameId(undefined)).toBeNull();
  });
});
