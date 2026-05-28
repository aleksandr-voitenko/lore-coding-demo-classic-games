import { describe, expect, it, vi } from "vitest";

import type { SqliteUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

import { createGameSessionRouteHandlers, parseGameSessionSubmission } from "./route";

describe("game sessions route", () => {
  it("parses game sessions with server-side validation", () => {
    expect(
      parseGameSessionSubmission({
        activeDurationMs: 1200,
        finalScore: 9,
        gameId: "snake",
        leaderboardKey: "snake|board=19",
        result: "won",
      }),
    ).toEqual({
      submission: {
        activeDurationMs: 1200,
        finalScore: 9,
        gameId: "snake",
        leaderboardKey: "snake|board=19",
        result: "won",
        sortDirection: "desc",
      },
      success: true,
    });
    expect(
      parseGameSessionSubmission({
        activeDurationMs: 3200,
        finalScore: 32,
        gameId: "minesweeper",
        leaderboardKey: "minesweeper|board=9x9|mines=10",
        result: "won",
        sortDirection: "asc",
      }),
    ).toMatchObject({
      submission: {
        sortDirection: "asc",
      },
      success: true,
    });
    expect(parseGameSessionSubmission({ gameId: "bad game" })).toMatchObject({
      success: false,
    });
    expect(
      parseGameSessionSubmission({
        activeDurationMs: -1,
        finalScore: 0,
        gameId: "snake",
        leaderboardKey: "snake|board=19",
        result: "abandoned",
      }),
    ).toMatchObject({
      success: false,
    });
  });

  it("requires a signed-in user before recording stats", async () => {
    const store = {
      getUserBySessionToken: vi.fn(async () => null),
      recordGameSession: vi.fn(),
    } as unknown as SqliteUserProfileStore;
    const handlers = createGameSessionRouteHandlers(store);
    const request = new Request("http://localhost/api/game-sessions", {
      body: JSON.stringify({
        activeDurationMs: 1200,
        finalScore: 9,
        gameId: "snake",
        leaderboardKey: "snake|board=19",
        result: "won",
      }),
      method: "POST",
    });
    const response = await handlers.POST(request);

    expect(response.status).toBe(401);
    expect(store.recordGameSession).not.toHaveBeenCalled();
  });

  it("records valid sessions for the signed-in user", async () => {
    const user = { displayName: "Ada", id: "user-1" };
    const store = {
      getUserBySessionToken: vi.fn(async () => user),
      recordGameSession: vi.fn(async () => ({ id: "session-1" })),
    } as unknown as SqliteUserProfileStore;
    const handlers = createGameSessionRouteHandlers(store);
    const request = new Request("http://localhost/api/game-sessions", {
      body: JSON.stringify({
        activeDurationMs: 1200,
        finalScore: 9,
        gameId: "snake",
        leaderboardKey: "snake|board=19",
        result: "won",
      }),
      headers: {
        cookie: "game_user_session=session-token",
      },
      method: "POST",
    });
    const response = await handlers.POST(request);

    expect(response.status).toBe(201);
    expect(store.getUserBySessionToken).toHaveBeenCalledWith("session-token");
    expect(store.recordGameSession).toHaveBeenCalledWith(user, {
      activeDurationMs: 1200,
      finalScore: 9,
      gameId: "snake",
      leaderboardKey: "snake|board=19",
      result: "won",
      sortDirection: "desc",
    });
    await expect(response.json()).resolves.toEqual({ id: "session-1" });
  });
});
