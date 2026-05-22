import { describe, expect, it, vi } from "vitest";

import { createLeaderboardRouteHandlers } from "./route";

describe("leaderboard route", () => {
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
});
