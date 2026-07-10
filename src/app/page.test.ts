import { describe, expect, it } from "vitest";

import { getInitialReplayGameId, getInitialRoomCode } from "./home-search-params";
import * as homePage from "./page";

describe("home page entry exports", () => {
  it("exposes only supported Next.js page fields", () => {
    expect(Object.keys(homePage).sort()).toEqual(["default", "dynamic", "runtime"]);
  });
});

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

describe("home room query parsing", () => {
  it("normalizes supported room codes and preserves present unsupported values", () => {
    expect(getInitialRoomCode("abc-123")).toBe("ABC-123");
    expect(getInitialRoomCode(["pong-1", "pong-2"])).toBe("PONG-1");
    expect(getInitialRoomCode(" room code ")).toBe("room code");
    expect(getInitialRoomCode("")).toBe("");
    expect(getInitialRoomCode(undefined)).toBeNull();
  });
});
