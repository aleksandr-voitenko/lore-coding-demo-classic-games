import { describe, expect, it } from "vitest";

import { getInitialReplayGameId } from "./page";

describe("home replay query parsing", () => {
  it("allows only games with replay players to launch in latest replay mode", () => {
    expect(getInitialReplayGameId("snake")).toBe("snake");
    expect(getInitialReplayGameId("tetris")).toBe("tetris");
    expect(getInitialReplayGameId("breakout")).toBe("breakout");
    expect(getInitialReplayGameId("minesweeper")).toBe("minesweeper");
    expect(getInitialReplayGameId("pong")).toBe("pong");
    expect(getInitialReplayGameId("simon")).toBe("simon");
    expect(getInitialReplayGameId("space-invaders")).toBe("space-invaders");
    expect(getInitialReplayGameId("asteroids")).toBe("asteroids");
    expect(getInitialReplayGameId("twenty-forty-eight")).toBe("twenty-forty-eight");
    expect(getInitialReplayGameId(["tetris", "snake"])).toBe("tetris");
    expect(getInitialReplayGameId("pac-man")).toBeNull();
    expect(getInitialReplayGameId(undefined)).toBeNull();
  });
});
