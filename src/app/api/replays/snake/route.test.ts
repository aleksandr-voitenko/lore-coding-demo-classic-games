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
  it("requires a signed-in user before saving or downloading replays", async () => {
    const replayStore = {
      getSnakeReplay: vi.fn(),
      saveSnakeReplay: vi.fn(),
    } as unknown as SqliteReplayStore;
    const userStore = {
      getUserBySessionToken: vi.fn(async () => null),
    } as unknown as SqliteUserProfileStore;
    const handlers = createSnakeReplayRouteHandlers(replayStore, userStore);
    const getResponse = await handlers.GET(
      new Request("http://localhost/api/replays/snake", {
        method: "GET",
      }),
    );
    const postResponse = await handlers.POST(
      new Request("http://localhost/api/replays/snake", {
        body: JSON.stringify(createReplayPayload()),
        method: "POST",
      }),
    );

    expect(getResponse.status).toBe(401);
    expect(postResponse.status).toBe(401);
    expect(replayStore.getSnakeReplay).not.toHaveBeenCalled();
    expect(replayStore.saveSnakeReplay).not.toHaveBeenCalled();
  });

  it("saves valid signed-in Snake replay uploads", async () => {
    const user = { displayName: "Ada", id: "user-1" };
    const replay = createReplayPayload();
    const replayStore = {
      getSnakeReplay: vi.fn(),
      saveSnakeReplay: vi.fn(async () => ({ success: true })),
    } as unknown as SqliteReplayStore;
    const userStore = {
      getUserBySessionToken: vi.fn(async () => user),
    } as unknown as SqliteUserProfileStore;
    const handlers = createSnakeReplayRouteHandlers(replayStore, userStore);
    const response = await handlers.POST(
      new Request("http://localhost/api/replays/snake", {
        body: JSON.stringify(replay),
        headers: {
          cookie: "game_user_session=session-token",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(201);
    expect(replayStore.saveSnakeReplay).toHaveBeenCalledWith(user, replay);
    await expect(response.json()).resolves.toEqual({ saved: true });
  });

  it("rejects malformed replays and issued-run mismatches", async () => {
    const user = { displayName: "Ada", id: "user-1" };
    const replayStore = {
      getSnakeReplay: vi.fn(),
      saveSnakeReplay: vi.fn(async () => ({
        reason: "run-seed-mismatch",
        success: false,
      })),
    } as unknown as SqliteReplayStore;
    const userStore = {
      getUserBySessionToken: vi.fn(async () => user),
    } as unknown as SqliteUserProfileStore;
    const handlers = createSnakeReplayRouteHandlers(replayStore, userStore);
    const malformedResponse = await handlers.POST(
      new Request("http://localhost/api/replays/snake", {
        body: JSON.stringify({}),
        headers: {
          cookie: "game_user_session=session-token",
        },
        method: "POST",
      }),
    );
    const mismatchResponse = await handlers.POST(
      new Request("http://localhost/api/replays/snake", {
        body: JSON.stringify(createReplayPayload()),
        headers: {
          cookie: "game_user_session=session-token",
        },
        method: "POST",
      }),
    );

    expect(malformedResponse.status).toBe(400);
    expect(mismatchResponse.status).toBe(400);
    await expect(mismatchResponse.json()).resolves.toEqual({
      error: "Snake replay seed does not match the issued run.",
    });
  });

  it("downloads the signed-in user's latest Snake replay", async () => {
    const user = { displayName: "Ada", id: "user-1" };
    const replay = createReplayPayload();
    const replayStore = {
      getSnakeReplay: vi.fn(async () => replay),
      saveSnakeReplay: vi.fn(),
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
    expect(replayStore.getSnakeReplay).toHaveBeenCalledWith(user);
    await expect(response.json()).resolves.toEqual({ replay });
  });
});
