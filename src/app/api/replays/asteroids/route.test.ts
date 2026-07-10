import { describe, expect, it, vi } from "vitest";

import {
  createAsteroidsReplayLeaderboardKey,
  ASTEROIDS_REPLAY_SCHEMA_VERSION,
  type AsteroidsReplayPayload,
} from "@/lib/asteroids-replay";
import {
  ASTEROIDS_BOARD_HEIGHT,
  ASTEROIDS_BOARD_WIDTH,
  ASTEROIDS_DEFAULT_DIFFICULTY,
  getAsteroidsDifficultySettings,
} from "@/lib/asteroids-game-engine";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import type { SqliteUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

import { createAsteroidsReplayRouteHandlers } from "./route-handlers";

function createReplayPayload(
  overrides: Partial<AsteroidsReplayPayload> = {},
): AsteroidsReplayPayload {
  const boardHeight = overrides.boardHeight ?? ASTEROIDS_BOARD_HEIGHT;
  const boardWidth = overrides.boardWidth ?? ASTEROIDS_BOARD_WIDTH;
  const difficulty = overrides.difficulty ?? ASTEROIDS_DEFAULT_DIFFICULTY;
  const startingAsteroidCount =
    overrides.startingAsteroidCount ??
    getAsteroidsDifficultySettings(difficulty).asteroidCount;

  return {
    boardHeight,
    boardWidth,
    difficulty,
    events: [
      {
        elapsedMs: 0,
        seq: 0,
        tick: 0,
        type: "start",
      },
      {
        controls: {
          rotateLeft: false,
          rotateRight: true,
          thrust: true,
        },
        elapsedMs: 100,
        seq: 1,
        tick: 0,
        type: "control",
      },
      {
        elapsedMs: 200,
        seq: 2,
        tick: 0,
        type: "advance",
      },
    ],
    finalAsteroidCount: 5,
    finalLives: 0,
    finalScore: 120,
    finalStatus: "lost",
    finalTick: 1,
    finalWave: 2,
    gameId: "asteroids",
    leaderboardKey: createAsteroidsReplayLeaderboardKey({
      difficulty,
    }),
    runId: "run-1",
    schemaVersion: ASTEROIDS_REPLAY_SCHEMA_VERSION,
    seed: 1234,
    startedAt: "2026-06-09T12:00:00.000Z",
    startingAsteroidCount,
    ...overrides,
  };
}

describe("asteroids replay route", () => {
  it("saves valid signed-in Asteroids replay uploads and labels save errors", async () => {
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
    const handlers = createAsteroidsReplayRouteHandlers(replayStore, userStore);
    const saveResponse = await handlers.POST(
      new Request("http://localhost/api/replays/asteroids", {
        body: JSON.stringify(replay),
        headers: {
          cookie: "game_user_session=session-token",
        },
        method: "POST",
      }),
    );
    const mismatchResponse = await handlers.POST(
      new Request("http://localhost/api/replays/asteroids", {
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
      error: "Asteroids replay seed does not match the issued run.",
    });
  });

  it("downloads the signed-in user's latest Asteroids replay", async () => {
    const user = { displayName: "Ada", id: "user-1" };
    const replay = createReplayPayload();
    const replayStore = {
      getReplay: vi.fn(async () => replay),
      saveReplay: vi.fn(),
    } as unknown as SqliteReplayStore;
    const userStore = {
      getUserBySessionToken: vi.fn(async () => user),
    } as unknown as SqliteUserProfileStore;
    const handlers = createAsteroidsReplayRouteHandlers(replayStore, userStore);
    const response = await handlers.GET(
      new Request("http://localhost/api/replays/asteroids", {
        headers: {
          cookie: "game_user_session=session-token",
        },
        method: "GET",
      }),
    );

    expect(response.status).toBe(200);
    expect(replayStore.getReplay).toHaveBeenCalledWith(
      user,
      "asteroids",
      expect.any(Function),
    );
    await expect(response.json()).resolves.toEqual({ replay });
  });
});
