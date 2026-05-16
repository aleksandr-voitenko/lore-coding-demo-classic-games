import { describe, expect, it, vi } from "vitest";

import { createSnakeLeaderboardRouteHandlers } from "./route";

describe("snake leaderboard route", () => {
  it("returns the current leaderboard entries", async () => {
    const handlers = createSnakeLeaderboardRouteHandlers({
      listTopScores: vi.fn(async () => [{ name: "Server", score: 8 }]),
      submitScore: vi.fn(),
    });

    const response = await handlers.GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      entries: [{ name: "Server", score: 8 }],
      version: 1,
    });
  });

  it("rejects invalid score submissions before calling the store", async () => {
    const store = {
      listTopScores: vi.fn(),
      submitScore: vi.fn(),
    };
    const handlers = createSnakeLeaderboardRouteHandlers(store);
    const request = new Request("http://localhost/api/snake/leaderboard", {
      body: JSON.stringify({ boardSize: 19, name: "Bad", score: 0 }),
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
    const handlers = createSnakeLeaderboardRouteHandlers(store);
    const request = new Request("http://localhost/api/snake/leaderboard", {
      body: JSON.stringify({ boardSize: 19, name: "  Ada  ", score: 9 }),
      method: "POST",
    });
    const response = await handlers.POST(request);

    expect(response.status).toBe(201);
    expect(store.submitScore).toHaveBeenCalledWith({
      boardSize: 19,
      name: "Ada",
      score: 9,
    });
    await expect(response.json()).resolves.toEqual({
      accepted: true,
      entries: [{ name: "Ada", score: 9 }],
      rank: 0,
      version: 1,
    });
  });
});
