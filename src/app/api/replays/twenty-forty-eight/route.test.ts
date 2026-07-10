import { describe, expect, it, vi } from "vitest";

import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import type { SqliteUserProfileStore } from "@/lib/server/sqlite-user-profile-store";
import {
  createTwentyFortyEightReplayLeaderboardKey,
  TWENTY_FORTY_EIGHT_REPLAY_SCHEMA_VERSION,
  type TwentyFortyEightReplayPayload,
} from "@/lib/twenty-forty-eight-replay";

import { createTwentyFortyEightReplayRouteHandlers } from "./route-handlers";

function createReplayPayload(
  overrides: Partial<TwentyFortyEightReplayPayload> = {},
): TwentyFortyEightReplayPayload {
  const boardSize = overrides.boardSize ?? 4;
  const winTile = overrides.winTile ?? 2048;

  return {
    boardSize,
    events: [
      {
        elapsedMs: 0,
        seq: 0,
        tick: 0,
        type: "start",
      },
    ],
    finalMoveCount: 3,
    finalScore: 2048,
    finalStatus: "won",
    finalTick: 0,
    finalTopTile: 2048,
    gameId: "twenty-forty-eight",
    leaderboardKey: createTwentyFortyEightReplayLeaderboardKey({
      boardSize,
      winTile,
    }),
    runId: "run-1",
    schemaVersion: TWENTY_FORTY_EIGHT_REPLAY_SCHEMA_VERSION,
    seed: 1234,
    startedAt: "2026-06-08T12:00:00.000Z",
    winTile,
    ...overrides,
  };
}

describe("2048 replay route", () => {
  it("saves valid signed-in 2048 replay uploads and labels save errors", async () => {
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
    const handlers = createTwentyFortyEightReplayRouteHandlers(replayStore, userStore);
    const saveResponse = await handlers.POST(
      new Request("http://localhost/api/replays/twenty-forty-eight", {
        body: JSON.stringify(replay),
        headers: {
          cookie: "game_user_session=session-token",
        },
        method: "POST",
      }),
    );
    const mismatchResponse = await handlers.POST(
      new Request("http://localhost/api/replays/twenty-forty-eight", {
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
      error: "2048 replay seed does not match the issued run.",
    });
  });

  it("downloads the signed-in user's latest 2048 replay", async () => {
    const user = { displayName: "Ada", id: "user-1" };
    const replay = createReplayPayload();
    const replayStore = {
      getReplay: vi.fn(async () => replay),
      saveReplay: vi.fn(),
    } as unknown as SqliteReplayStore;
    const userStore = {
      getUserBySessionToken: vi.fn(async () => user),
    } as unknown as SqliteUserProfileStore;
    const handlers = createTwentyFortyEightReplayRouteHandlers(replayStore, userStore);
    const response = await handlers.GET(
      new Request("http://localhost/api/replays/twenty-forty-eight", {
        headers: {
          cookie: "game_user_session=session-token",
        },
        method: "GET",
      }),
    );

    expect(response.status).toBe(200);
    expect(replayStore.getReplay).toHaveBeenCalledWith(
      user,
      "twenty-forty-eight",
      expect.any(Function),
    );
    await expect(response.json()).resolves.toEqual({ replay });
  });
});
