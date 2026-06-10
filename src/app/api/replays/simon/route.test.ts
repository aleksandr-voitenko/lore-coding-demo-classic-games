import { describe, expect, it, vi } from "vitest";

import {
  createSimonReplayLeaderboardKey,
  SIMON_REPLAY_SCHEMA_VERSION,
  type SimonReplayPayload,
} from "@/lib/simon-replay";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import type { SqliteUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

import { createSimonReplayRouteHandlers } from "./route";

function createReplayPayload(
  overrides: Partial<SimonReplayPayload> = {},
): SimonReplayPayload {
  const winTarget = overrides.winTarget ?? 3;

  return {
    events: [
      {
        elapsedMs: 0,
        seq: 0,
        tick: 0,
        type: "start",
      },
      {
        elapsedMs: 1000,
        seq: 1,
        tick: 1,
        type: "playback",
      },
    ],
    finalInputIndex: 0,
    finalRound: 2,
    finalScore: 1,
    finalSequenceLength: 2,
    finalStatus: "lost",
    finalTick: 2,
    gameId: "simon",
    leaderboardKey: createSimonReplayLeaderboardKey({ winTarget }),
    runId: "run-1",
    schemaVersion: SIMON_REPLAY_SCHEMA_VERSION,
    seed: 1234,
    startedAt: "2026-06-08T12:00:00.000Z",
    winTarget,
    ...overrides,
  };
}

describe("simon replay route", () => {
  it("saves valid signed-in Simon replay uploads and labels save errors", async () => {
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
    const handlers = createSimonReplayRouteHandlers(replayStore, userStore);
    const saveResponse = await handlers.POST(
      new Request("http://localhost/api/replays/simon", {
        body: JSON.stringify(replay),
        headers: {
          cookie: "game_user_session=session-token",
        },
        method: "POST",
      }),
    );
    const mismatchResponse = await handlers.POST(
      new Request("http://localhost/api/replays/simon", {
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
      error: "Simon replay seed does not match the issued run.",
    });
  });

  it("downloads the signed-in user's latest Simon replay", async () => {
    const user = { displayName: "Ada", id: "user-1" };
    const replay = createReplayPayload();
    const replayStore = {
      getReplay: vi.fn(async () => replay),
      saveReplay: vi.fn(),
    } as unknown as SqliteReplayStore;
    const userStore = {
      getUserBySessionToken: vi.fn(async () => user),
    } as unknown as SqliteUserProfileStore;
    const handlers = createSimonReplayRouteHandlers(replayStore, userStore);
    const response = await handlers.GET(
      new Request("http://localhost/api/replays/simon", {
        headers: {
          cookie: "game_user_session=session-token",
        },
        method: "GET",
      }),
    );

    expect(response.status).toBe(200);
    expect(replayStore.getReplay).toHaveBeenCalledWith(user, "simon", expect.any(Function));
    await expect(response.json()).resolves.toEqual({ replay });
  });
});
