import { describe, expect, it, vi } from "vitest";

import {
  createMinesweeperReplayLeaderboardKey,
  MINESWEEPER_REPLAY_SCHEMA_VERSION,
  type MinesweeperReplayPayload,
} from "@/lib/minesweeper-replay";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import type { SqliteUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

import { createMinesweeperReplayRouteHandlers } from "./route";

function createReplayPayload(
  overrides: Partial<MinesweeperReplayPayload> = {},
): MinesweeperReplayPayload {
  const boardHeight = overrides.boardHeight ?? 9;
  const boardWidth = overrides.boardWidth ?? 9;
  const mineCount = overrides.mineCount ?? 10;

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
    finalFlagCount: 0,
    finalRevealedSafeCellCount: 71,
    finalScore: 42,
    finalStatus: "won",
    finalTick: 42,
    gameId: "minesweeper",
    leaderboardKey: createMinesweeperReplayLeaderboardKey({
      boardHeight,
      boardWidth,
      mineCount,
    }),
    mineCount,
    runId: "run-1",
    schemaVersion: MINESWEEPER_REPLAY_SCHEMA_VERSION,
    seed: 1234,
    startedAt: "2026-06-08T12:00:00.000Z",
    ...overrides,
  };
}

describe("minesweeper replay route", () => {
  it("saves valid signed-in Minesweeper replay uploads and labels save errors", async () => {
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
    const handlers = createMinesweeperReplayRouteHandlers(replayStore, userStore);
    const saveResponse = await handlers.POST(
      new Request("http://localhost/api/replays/minesweeper", {
        body: JSON.stringify(replay),
        headers: {
          cookie: "game_user_session=session-token",
        },
        method: "POST",
      }),
    );
    const mismatchResponse = await handlers.POST(
      new Request("http://localhost/api/replays/minesweeper", {
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
      error: "Minesweeper replay seed does not match the issued run.",
    });
  });

  it("downloads the signed-in user's latest Minesweeper replay", async () => {
    const user = { displayName: "Ada", id: "user-1" };
    const replay = createReplayPayload();
    const replayStore = {
      getReplay: vi.fn(async () => replay),
      saveReplay: vi.fn(),
    } as unknown as SqliteReplayStore;
    const userStore = {
      getUserBySessionToken: vi.fn(async () => user),
    } as unknown as SqliteUserProfileStore;
    const handlers = createMinesweeperReplayRouteHandlers(replayStore, userStore);
    const response = await handlers.GET(
      new Request("http://localhost/api/replays/minesweeper", {
        headers: {
          cookie: "game_user_session=session-token",
        },
        method: "GET",
      }),
    );

    expect(response.status).toBe(200);
    expect(replayStore.getReplay).toHaveBeenCalledWith(
      user,
      "minesweeper",
      expect.any(Function),
    );
    await expect(response.json()).resolves.toEqual({ replay });
  });
});
