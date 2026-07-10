import { describe, expect, it, vi } from "vitest";

import type { SqliteUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

import * as gameSessionsRoute from "./route";
import { createGameSessionRouteHandlers, parseGameSessionSubmission } from "./route-handlers";

describe("game sessions route", () => {
  it("exports only the supported Next.js route fields", () => {
    expect(Object.keys(gameSessionsRoute).sort()).toEqual(["POST", "dynamic", "runtime"]);
  });

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
        leaderboardKey: "minesweeper|difficulty=easy",
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

  it("rejects unsupported game-session payload shapes", () => {
    expect(parseGameSessionSubmission(null)).toEqual({
      error: "Game session must be a JSON object.",
      success: false,
    });
    expect(
      parseGameSessionSubmission({
        activeDurationMs: 1200,
        finalScore: 9,
        gameId: "unknown-game",
        leaderboardKey: "unknown-game|board=19",
        result: "won",
      }),
    ).toEqual({
      error: "Game id is not supported.",
      success: false,
    });
    expect(
      parseGameSessionSubmission({
        activeDurationMs: 1200,
        finalScore: 9,
        gameId: "snake",
        leaderboardKey: "bad key",
        result: "won",
      }),
    ).toEqual({
      error: "Leaderboard key is not supported.",
      success: false,
    });
    expect(
      parseGameSessionSubmission({
        activeDurationMs: 1200,
        finalScore: 1.5,
        gameId: "snake",
        leaderboardKey: "snake|board=19",
        result: "won",
      }),
    ).toEqual({
      error: "Final score must be a non-negative integer.",
      success: false,
    });
    expect(
      parseGameSessionSubmission({
        activeDurationMs: 1200,
        finalScore: 9,
        gameId: "snake",
        leaderboardKey: "snake|board=19",
        result: "quit",
      }),
    ).toEqual({
      error: "Game session result is not supported.",
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

  it("rejects malformed and invalid signed-in session requests before recording stats", async () => {
    const user = { displayName: "Ada", id: "user-1" };
    const store = {
      getUserBySessionToken: vi.fn(async () => user),
      recordGameSession: vi.fn(),
    } as unknown as SqliteUserProfileStore;
    const handlers = createGameSessionRouteHandlers(store);
    const invalidJsonResponse = await handlers.POST(
      new Request("http://localhost/api/game-sessions", {
        body: "{",
        headers: {
          cookie: "game_user_session=session-token",
        },
        method: "POST",
      }),
    );
    const invalidPayloadResponse = await handlers.POST(
      new Request("http://localhost/api/game-sessions", {
        body: JSON.stringify({ gameId: "bad game" }),
        headers: {
          cookie: "game_user_session=session-token",
        },
        method: "POST",
      }),
    );

    expect(invalidJsonResponse.status).toBe(400);
    await expect(invalidJsonResponse.json()).resolves.toEqual({
      error: "Request body must be valid JSON.",
    });
    expect(invalidPayloadResponse.status).toBe(400);
    await expect(invalidPayloadResponse.json()).resolves.toEqual({
      error: "Game id is not supported.",
    });
    expect(store.recordGameSession).not.toHaveBeenCalled();
  });
});
