import { describe, expect, it, vi } from "vitest";

import {
  createSpaceInvadersReplayLeaderboardKey,
  SPACE_INVADERS_REPLAY_SCHEMA_VERSION,
  type SpaceInvadersReplayPayload,
} from "@/lib/space-invaders-replay";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import type { SqliteUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

import { createSpaceInvadersReplayRouteHandlers } from "./route-handlers";

function createReplayPayload(
  overrides: Partial<SpaceInvadersReplayPayload> = {},
): SpaceInvadersReplayPayload {
  const alienCount = overrides.alienCount ?? 24;
  const boardHeight = overrides.boardHeight ?? 560;
  const boardWidth = overrides.boardWidth ?? 420;

  return {
    alienCount,
    boardHeight,
    boardWidth,
    events: [
      {
        elapsedMs: 0,
        seq: 0,
        tick: 0,
        type: "start",
      },
      {
        direction: "right",
        elapsedMs: 100,
        seq: 1,
        tick: 0,
        type: "move",
      },
      {
        elapsedMs: 200,
        seq: 2,
        tick: 0,
        type: "fire",
      },
      {
        elapsedMs: 300,
        seq: 3,
        tick: 0,
        type: "advance",
      },
    ],
    finalInvaderCount: 8,
    finalLives: 0,
    finalScore: 160,
    finalStatus: "lost",
    finalTick: 1,
    gameId: "space-invaders",
    leaderboardKey: createSpaceInvadersReplayLeaderboardKey({
      alienCount,
      boardHeight,
      boardWidth,
    }),
    runId: "run-1",
    schemaVersion: SPACE_INVADERS_REPLAY_SCHEMA_VERSION,
    seed: 1234,
    startedAt: "2026-06-09T12:00:00.000Z",
    ...overrides,
  };
}

describe("space invaders replay route", () => {
  it("saves valid signed-in Space Invaders replay uploads and labels save errors", async () => {
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
    const handlers = createSpaceInvadersReplayRouteHandlers(replayStore, userStore);
    const saveResponse = await handlers.POST(
      new Request("http://localhost/api/replays/space-invaders", {
        body: JSON.stringify(replay),
        headers: {
          cookie: "game_user_session=session-token",
        },
        method: "POST",
      }),
    );
    const mismatchResponse = await handlers.POST(
      new Request("http://localhost/api/replays/space-invaders", {
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
      error: "Space Invaders replay seed does not match the issued run.",
    });
  });

  it("downloads the signed-in user's latest Space Invaders replay", async () => {
    const user = { displayName: "Ada", id: "user-1" };
    const replay = createReplayPayload();
    const replayStore = {
      getReplay: vi.fn(async () => replay),
      saveReplay: vi.fn(),
    } as unknown as SqliteReplayStore;
    const userStore = {
      getUserBySessionToken: vi.fn(async () => user),
    } as unknown as SqliteUserProfileStore;
    const handlers = createSpaceInvadersReplayRouteHandlers(replayStore, userStore);
    const response = await handlers.GET(
      new Request("http://localhost/api/replays/space-invaders", {
        headers: {
          cookie: "game_user_session=session-token",
        },
        method: "GET",
      }),
    );

    expect(response.status).toBe(200);
    expect(replayStore.getReplay).toHaveBeenCalledWith(
      user,
      "space-invaders",
      expect.any(Function),
    );
    await expect(response.json()).resolves.toEqual({ replay });
  });
});
