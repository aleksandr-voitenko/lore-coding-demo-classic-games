import { describe, expect, it, vi } from "vitest";

import * as leaderboardRoute from "./route";
import { createLeaderboardRouteHandlers } from "./route-handlers";

describe("leaderboard route", () => {
  it("exports only the supported Next.js route fields", () => {
    expect(Object.keys(leaderboardRoute).sort()).toEqual([
      "GET",
      "POST",
      "dynamic",
      "runtime",
    ]);
  });

  it("returns leaderboard entries for the requested key", async () => {
    const store = {
      listTopScores: vi.fn(async () => [{ name: "Server", score: 8 }]),
      submitScore: vi.fn(),
    };
    const handlers = createLeaderboardRouteHandlers(store);
    const request = new Request(
      "http://localhost/api/leaderboard?key=snake%7Cboard%3D19&sort=desc",
    );
    const response = await handlers.GET(request);

    expect(response.status).toBe(200);
    expect(store.listTopScores).toHaveBeenCalledWith("snake|board=19", "desc");
    await expect(response.json()).resolves.toEqual({
      entries: [{ name: "Server", score: 8 }],
      version: 1,
    });
  });

  it("rejects invalid leaderboard keys before calling the store", async () => {
    const store = {
      listTopScores: vi.fn(),
      submitScore: vi.fn(),
    };
    const handlers = createLeaderboardRouteHandlers(store);
    const request = new Request("http://localhost/api/leaderboard?key=bad%20key");
    const response = await handlers.GET(request);

    expect(response.status).toBe(400);
    expect(store.listTopScores).not.toHaveBeenCalled();
  });

  it("rejects invalid score submissions before calling the store", async () => {
    const store = {
      listTopScores: vi.fn(),
      submitScore: vi.fn(),
    };
    const handlers = createLeaderboardRouteHandlers(store);
    const request = new Request("http://localhost/api/leaderboard", {
      body: JSON.stringify({ leaderboardKey: "snake|board=19", name: "Bad", score: 0 }),
      method: "POST",
    });
    const response = await handlers.POST(request);

    expect(response.status).toBe(400);
    expect(store.submitScore).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON before calling the store", async () => {
    const store = {
      listTopScores: vi.fn(),
      submitScore: vi.fn(),
    };
    const handlers = createLeaderboardRouteHandlers(store);
    const request = new Request("http://localhost/api/leaderboard", {
      body: "{",
      method: "POST",
    });
    const response = await handlers.POST(request);

    expect(response.status).toBe(400);
    expect(store.submitScore).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: "Request body must be valid JSON.",
    });
  });

  it("submits valid scores and returns the updated leaderboard", async () => {
    const store = {
      listTopScores: vi.fn(),
      submitScore: vi.fn(async () => ({
        accepted: true,
        entries: [{ name: "Ada", score: 9 }],
        rank: 0,
      })),
    };
    const handlers = createLeaderboardRouteHandlers(store);
    const request = new Request("http://localhost/api/leaderboard", {
      body: JSON.stringify({
        leaderboardKey: "snake|board=19",
        name: "  Ada  ",
        score: 9,
        sortDirection: "desc",
      }),
      method: "POST",
    });
    const response = await handlers.POST(request);

    expect(response.status).toBe(201);
    expect(store.submitScore).toHaveBeenCalledWith({
      leaderboardKey: "snake|board=19",
      name: "Ada",
      score: 9,
      sortDirection: "desc",
    });
    await expect(response.json()).resolves.toEqual({
      accepted: true,
      entries: [{ name: "Ada", score: 9 }],
      rank: 0,
      version: 1,
    });
  });

  it("returns a successful non-qualifying result without creating a new entry", async () => {
    const entries = [
      { name: "Ada", score: 9 },
      { name: "Grace", score: 8 },
      { name: "Linus", score: 7 },
    ];
    const store = {
      listTopScores: vi.fn(),
      submitScore: vi.fn(async () => ({
        accepted: false,
        entries,
        rank: null,
      })),
    };
    const handlers = createLeaderboardRouteHandlers(store);
    const request = new Request("http://localhost/api/leaderboard", {
      body: JSON.stringify({
        leaderboardKey: "snake|board=19",
        name: "Player",
        score: 6,
      }),
      method: "POST",
    });
    const response = await handlers.POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      accepted: false,
      entries,
      rank: null,
      version: 1,
    });
  });

  it("attaches the signed-in user and game session to score submissions", async () => {
    const store = {
      listTopScores: vi.fn(),
      submitScore: vi.fn(async () => ({
        accepted: true,
        entries: [{ name: "Ada", score: 9 }],
        rank: 0,
      })),
    };
    const userStore = {
      getUserBySessionToken: vi.fn(async () => ({ displayName: "Ada", id: "user-1" })),
    };
    const handlers = createLeaderboardRouteHandlers(store, userStore);
    const request = new Request("http://localhost/api/leaderboard", {
      body: JSON.stringify({
        gameSessionId: "session-1",
        leaderboardKey: "snake|board=19",
        name: "Ada",
        score: 9,
      }),
      headers: {
        cookie: "game_user_session=session-token",
      },
      method: "POST",
    });
    const response = await handlers.POST(request);

    expect(response.status).toBe(201);
    expect(userStore.getUserBySessionToken).toHaveBeenCalledWith("session-token");
    expect(store.submitScore).toHaveBeenCalledWith({
      gameSessionId: "session-1",
      leaderboardKey: "snake|board=19",
      name: "Ada",
      score: 9,
      sortDirection: "desc",
      userId: "user-1",
    });
  });
});
