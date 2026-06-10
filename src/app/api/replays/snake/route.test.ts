import { describe, expect, it, vi } from "vitest";

import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import type { SqliteUserProfileStore } from "@/lib/server/sqlite-user-profile-store";
import {
  SNAKE_REPLAY_SCHEMA_VERSION,
  type SnakeReplayPayload,
} from "@/lib/snake-replay";

import { createSnakeReplayRouteHandlers } from "./route";

function createReplayPayload(overrides: Partial<SnakeReplayPayload> = {}): SnakeReplayPayload {
  return {
    events: [
      {
        elapsedMs: 0,
        seq: 0,
        tick: 0,
        type: "start",
      },
    ],
    finalLevel: 1,
    finalScore: 4,
    finalStatus: "lost",
    finalTick: 0,
    gameId: "snake",
    leaderboardKey: "snake|mode=levels",
    runId: "run-1",
    schemaVersion: SNAKE_REPLAY_SCHEMA_VERSION,
    seed: 1234,
    startedAt: "2026-06-08T12:00:00.000Z",
    ...overrides,
  };
}

describe("snake replay route", () => {
  it("saves valid signed-in Snake replay uploads and labels save errors", async () => {
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
    const handlers = createSnakeReplayRouteHandlers(replayStore, userStore);
    const saveResponse = await handlers.POST(
      new Request("http://localhost/api/replays/snake", {
        body: JSON.stringify(replay),
        headers: {
          cookie: "game_user_session=session-token",
        },
        method: "POST",
      }),
    );
    const mismatchResponse = await handlers.POST(
      new Request("http://localhost/api/replays/snake", {
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
      error: "Snake replay seed does not match the issued run.",
    });
  });

  it("downloads the signed-in user's latest Snake replay", async () => {
    const user = { displayName: "Ada", id: "user-1" };
    const replay = createReplayPayload();
    const replayStore = {
      getReplay: vi.fn(async () => replay),
      saveReplay: vi.fn(),
    } as unknown as SqliteReplayStore;
    const userStore = {
      getUserBySessionToken: vi.fn(async () => user),
    } as unknown as SqliteUserProfileStore;
    const handlers = createSnakeReplayRouteHandlers(replayStore, userStore);
    const response = await handlers.GET(
      new Request("http://localhost/api/replays/snake", {
        headers: {
          cookie: "game_user_session=session-token",
        },
        method: "GET",
      }),
    );

    expect(response.status).toBe(200);
    expect(replayStore.getReplay).toHaveBeenCalledWith(
      user,
      "snake",
      expect.any(Function),
    );
    await expect(response.json()).resolves.toEqual({ replay });
  });
});
