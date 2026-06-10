import { describe, expect, it, vi } from "vitest";

import {
  createBreakoutReplayLeaderboardKey,
  BREAKOUT_REPLAY_SCHEMA_VERSION,
  type BreakoutReplayPayload,
} from "@/lib/breakout-replay";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import type { SqliteUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

import { createBreakoutReplayRouteHandlers } from "./route";

function createReplayPayload(
  overrides: Partial<BreakoutReplayPayload> = {},
): BreakoutReplayPayload {
  const boardHeight = overrides.boardHeight ?? 480;
  const boardWidth = overrides.boardWidth ?? 360;
  const startingLives = overrides.startingLives ?? 2;

  return {
    boardHeight,
    boardWidth,
    events: [
      {
        elapsedMs: 0,
        seq: 0,
        tick: 0,
        type: "start",
      },
    ],
    finalActiveBrickCount: 10,
    finalLives: 0,
    finalScore: 40,
    finalStatus: "lost",
    finalTick: 4,
    gameId: "breakout",
    leaderboardKey: createBreakoutReplayLeaderboardKey({
      boardHeight,
      boardWidth,
      startingLives,
    }),
    runId: "run-1",
    schemaVersion: BREAKOUT_REPLAY_SCHEMA_VERSION,
    seed: 1234,
    startedAt: "2026-06-08T12:00:00.000Z",
    startingLives,
    ...overrides,
  };
}

describe("breakout replay route", () => {
  it("saves valid signed-in Breakout replay uploads and labels save errors", async () => {
    const user = { displayName: "Ada", id: "user-1" };
    const replay = createReplayPayload();
    const replayStore = {
      getReplay: vi.fn(),
      saveReplay: vi
        .fn()
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({
          reason: "run-seed-mismatch",
          success: false,
        }),
    } as unknown as SqliteReplayStore;
    const userStore = {
      getUserBySessionToken: vi.fn(async () => user),
    } as unknown as SqliteUserProfileStore;
    const handlers = createBreakoutReplayRouteHandlers(replayStore, userStore);
    const saveResponse = await handlers.POST(
      new Request("http://localhost/api/replays/breakout", {
        body: JSON.stringify(replay),
        headers: {
          cookie: "game_user_session=session-token",
        },
        method: "POST",
      }),
    );
    const mismatchResponse = await handlers.POST(
      new Request("http://localhost/api/replays/breakout", {
        body: JSON.stringify(replay),
        headers: {
          cookie: "game_user_session=session-token",
        },
        method: "POST",
      }),
    );

    expect(saveResponse.status).toBe(201);
    expect(replayStore.saveReplay).toHaveBeenCalledWith(user, replay);
    await expect(saveResponse.json()).resolves.toEqual({ saved: true });
    expect(mismatchResponse.status).toBe(400);
    await expect(mismatchResponse.json()).resolves.toEqual({
      error: "Breakout replay seed does not match the issued run.",
    });
  });

  it("downloads the signed-in user's latest Breakout replay", async () => {
    const user = { displayName: "Ada", id: "user-1" };
    const replay = createReplayPayload();
    const replayStore = {
      getReplay: vi.fn(async () => replay),
      saveReplay: vi.fn(),
    } as unknown as SqliteReplayStore;
    const userStore = {
      getUserBySessionToken: vi.fn(async () => user),
    } as unknown as SqliteUserProfileStore;
    const handlers = createBreakoutReplayRouteHandlers(replayStore, userStore);
    const response = await handlers.GET(
      new Request("http://localhost/api/replays/breakout", {
        headers: {
          cookie: "game_user_session=session-token",
        },
        method: "GET",
      }),
    );

    expect(response.status).toBe(200);
    expect(replayStore.getReplay).toHaveBeenCalledWith(
      user,
      "breakout",
      expect.any(Function),
    );
    await expect(response.json()).resolves.toEqual({ replay });
  });
});
