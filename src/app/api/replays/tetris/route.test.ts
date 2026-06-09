import { describe, expect, it, vi } from "vitest";

import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import type { SqliteUserProfileStore } from "@/lib/server/sqlite-user-profile-store";
import {
  createTetrisReplayLeaderboardKey,
  TETRIS_REPLAY_SCHEMA_VERSION,
  type TetrisReplayPayload,
} from "@/lib/tetris-replay";

import { createTetrisReplayRouteHandlers } from "./route";

function createReplayPayload(
  overrides: Partial<TetrisReplayPayload> = {},
): TetrisReplayPayload {
  const boardHeight = overrides.boardHeight ?? 20;
  const boardWidth = overrides.boardWidth ?? 10;
  const startLevel = overrides.startLevel ?? 3;

  return {
    boardHeight,
    boardWidth,
    events: [
      {
        seq: 0,
        tick: 0,
        type: "start",
      },
    ],
    finalLevel: 3,
    finalLines: 0,
    finalScore: 4,
    finalStatus: "lost",
    finalTick: 0,
    gameId: "tetris",
    leaderboardKey: createTetrisReplayLeaderboardKey({
      boardHeight,
      boardWidth,
      startLevel,
    }),
    runId: "run-1",
    schemaVersion: TETRIS_REPLAY_SCHEMA_VERSION,
    seed: 1234,
    startLevel,
    startedAt: "2026-06-08T12:00:00.000Z",
    ...overrides,
  };
}

describe("tetris replay route", () => {
  it("saves valid signed-in Tetris replay uploads and labels save errors", async () => {
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
    const handlers = createTetrisReplayRouteHandlers(replayStore, userStore);
    const saveResponse = await handlers.POST(
      new Request("http://localhost/api/replays/tetris", {
        body: JSON.stringify(replay),
        headers: {
          cookie: "game_user_session=session-token",
        },
        method: "POST",
      }),
    );
    const mismatchResponse = await handlers.POST(
      new Request("http://localhost/api/replays/tetris", {
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
      error: "Tetris replay seed does not match the issued run.",
    });
  });

  it("downloads the signed-in user's latest Tetris replay", async () => {
    const user = { displayName: "Ada", id: "user-1" };
    const replay = createReplayPayload();
    const replayStore = {
      getReplay: vi.fn(async () => replay),
      saveReplay: vi.fn(),
    } as unknown as SqliteReplayStore;
    const userStore = {
      getUserBySessionToken: vi.fn(async () => user),
    } as unknown as SqliteUserProfileStore;
    const handlers = createTetrisReplayRouteHandlers(replayStore, userStore);
    const response = await handlers.GET(
      new Request("http://localhost/api/replays/tetris", {
        headers: {
          cookie: "game_user_session=session-token",
        },
        method: "GET",
      }),
    );

    expect(response.status).toBe(200);
    expect(replayStore.getReplay).toHaveBeenCalledWith(
      user,
      "tetris",
      expect.any(Function),
    );
    await expect(response.json()).resolves.toEqual({ replay });
  });
});
