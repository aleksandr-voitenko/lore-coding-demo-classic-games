import { describe, expect, it, vi } from "vitest";

import {
  createPongReplayLeaderboardKey,
  PONG_REPLAY_SCHEMA_VERSION,
  type PongReplayPayload,
} from "@/lib/pong-replay";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import type { SqliteUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

import { createPongReplayRouteHandlers } from "./route";

function createReplayPayload(
  overrides: Partial<PongReplayPayload> = {},
): PongReplayPayload {
  const boardHeight = overrides.boardHeight ?? 480;
  const boardWidth = overrides.boardWidth ?? 360;
  const targetScore = overrides.targetScore ?? 3;

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
    finalCpuScore: 3,
    finalPlayerScore: 1,
    finalScore: 380,
    finalStatus: "lost",
    finalTick: 4,
    gameId: "pong",
    leaderboardKey: createPongReplayLeaderboardKey({
      boardHeight,
      boardWidth,
      targetScore,
    }),
    runId: "run-1",
    schemaVersion: PONG_REPLAY_SCHEMA_VERSION,
    seed: 1234,
    startedAt: "2026-06-08T12:00:00.000Z",
    targetScore,
    ...overrides,
  };
}

describe("pong replay route", () => {
  it("saves valid signed-in Pong replay uploads and labels save errors", async () => {
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
    const handlers = createPongReplayRouteHandlers(replayStore, userStore);
    const saveResponse = await handlers.POST(
      new Request("http://localhost/api/replays/pong", {
        body: JSON.stringify(replay),
        headers: {
          cookie: "game_user_session=session-token",
        },
        method: "POST",
      }),
    );
    const mismatchResponse = await handlers.POST(
      new Request("http://localhost/api/replays/pong", {
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
      error: "Pong replay seed does not match the issued run.",
    });
  });

  it("downloads the signed-in user's latest Pong replay", async () => {
    const user = { displayName: "Ada", id: "user-1" };
    const replay = createReplayPayload();
    const replayStore = {
      getReplay: vi.fn(async () => replay),
      saveReplay: vi.fn(),
    } as unknown as SqliteReplayStore;
    const userStore = {
      getUserBySessionToken: vi.fn(async () => user),
    } as unknown as SqliteUserProfileStore;
    const handlers = createPongReplayRouteHandlers(replayStore, userStore);
    const response = await handlers.GET(
      new Request("http://localhost/api/replays/pong", {
        headers: {
          cookie: "game_user_session=session-token",
        },
        method: "GET",
      }),
    );

    expect(response.status).toBe(200);
    expect(replayStore.getReplay).toHaveBeenCalledWith(user, "pong", expect.any(Function));
    await expect(response.json()).resolves.toEqual({ replay });
  });
});
