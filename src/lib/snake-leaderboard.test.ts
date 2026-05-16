import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createLeaderboardResponse,
  fetchLeaderboard,
  LEADERBOARD_API_PATH,
  LEADERBOARD_DATA_VERSION,
  MAX_LEADERBOARD_PLAYER_NAME_LENGTH,
  normalizeLeaderboard,
  normalizePlayerName,
  parseLeaderboardResponse,
  submitLeaderboardScore,
} from "./snake-leaderboard";

describe("snake leaderboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes player names by trimming and capping display length", () => {
    expect(normalizePlayerName("  Ada Lovelace  ")).toBe("Ada Lovelace");
    expect(normalizePlayerName("x".repeat(MAX_LEADERBOARD_PLAYER_NAME_LENGTH + 1))).toHaveLength(
      MAX_LEADERBOARD_PLAYER_NAME_LENGTH,
    );
    expect(normalizePlayerName(null)).toBe("");
  });

  it("normalizes versioned leaderboard responses by sorting, flooring, filtering, and capping", () => {
    const leaderboard = normalizeLeaderboard({
      entries: [
        { name: " Low ", score: 1.9 },
        { name: "Bad", score: 0 },
        { name: "Top", score: 12 },
        { name: "Invalid", score: Number.NaN },
        { name: "Fourth", score: 3 },
        { name: "Second", score: 7.8 },
      ],
      version: LEADERBOARD_DATA_VERSION,
    });

    expect(leaderboard).toEqual([
      { name: "Top", score: 12 },
      { name: "Second", score: 7 },
      { name: "Fourth", score: 3 },
    ]);
  });

  it("keeps legacy array payloads readable for shared normalization", () => {
    expect(
      normalizeLeaderboard([
        { name: "Legacy", score: 2 },
        { name: "Better", score: 4 },
      ]),
    ).toEqual([
      { name: "Better", score: 4 },
      { name: "Legacy", score: 2 },
    ]);
  });

  it("creates and parses leaderboard API responses", () => {
    const response = createLeaderboardResponse([{ name: "Saved", score: 5 }]);

    expect(response).toEqual({
      entries: [{ name: "Saved", score: 5 }],
      version: LEADERBOARD_DATA_VERSION,
    });
    expect(parseLeaderboardResponse(response)).toEqual([{ name: "Saved", score: 5 }]);
    expect(parseLeaderboardResponse({ entries: "bad", version: LEADERBOARD_DATA_VERSION })).toEqual(
      [],
    );
  });

  it("fetches leaderboard entries from the server API", async () => {
    const fetchStub = vi.fn(async () =>
      Response.json(createLeaderboardResponse([{ name: "Server", score: 8 }])),
    );

    vi.stubGlobal("fetch", fetchStub);

    await expect(fetchLeaderboard()).resolves.toEqual([{ name: "Server", score: 8 }]);
    expect(fetchStub).toHaveBeenCalledWith(LEADERBOARD_API_PATH, {
      cache: "no-store",
    });
  });

  it("submits scores to the server API and returns the updated leaderboard", async () => {
    const submission = {
      boardSize: 19,
      name: "Ada",
      score: 9,
    };
    const fetchStub = vi.fn(async () =>
      Response.json(
        {
          ...createLeaderboardResponse([{ name: "Ada", score: 9 }]),
          accepted: true,
          rank: 0,
        },
        { status: 201 },
      ),
    );

    vi.stubGlobal("fetch", fetchStub);

    await expect(submitLeaderboardScore(submission)).resolves.toEqual({
      accepted: true,
      entries: [{ name: "Ada", score: 9 }],
      rank: 0,
    });
    expect(fetchStub).toHaveBeenCalledWith(LEADERBOARD_API_PATH, {
      body: JSON.stringify(submission),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  });

  it("surfaces failed leaderboard API requests", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));

    await expect(fetchLeaderboard()).rejects.toThrow("status 503");
  });
});
