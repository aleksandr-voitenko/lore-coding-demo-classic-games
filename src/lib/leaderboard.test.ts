import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createGameLeaderboardKey,
  createLeaderboardResponse,
  createPendingLeaderboardEntry,
  fetchLeaderboard,
  LEADERBOARD_API_PATH,
  LEADERBOARD_DATA_VERSION,
  MAX_LEADERBOARD_PLAYER_NAME_LENGTH,
  normalizeLeaderboard,
  normalizeLeaderboardKey,
  normalizePlayerName,
  parseLeaderboardResponse,
  submitLeaderboardScore,
} from "./leaderboard";

describe("leaderboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates stable game-and-parameter leaderboard keys", () => {
    expect(
      createGameLeaderboardKey("Tetris", [
        { name: "Board", value: "10 x 20" },
        { name: "Level", value: 3 },
      ]),
    ).toBe("tetris|board=10-x-20|level=3");
    expect(
      createGameLeaderboardKey("tetris", [
        { name: "board", value: "10x20" },
        { name: "level", value: 1 },
      ]),
    ).not.toBe(
      createGameLeaderboardKey("tetris", [
        { name: "board", value: "12x22" },
        { name: "level", value: 1 },
      ]),
    );
  });

  it("validates leaderboard keys accepted by the API", () => {
    expect(normalizeLeaderboardKey("snake|board=19")).toBe("snake|board=19");
    expect(normalizeLeaderboardKey("bad key")).toBeNull();
    expect(normalizeLeaderboardKey("")).toBeNull();
  });

  it("normalizes player names by trimming and capping display length", () => {
    expect(normalizePlayerName("  Ada Lovelace  ")).toBe("Ada Lovelace");
    expect(normalizePlayerName("x".repeat(MAX_LEADERBOARD_PLAYER_NAME_LENGTH + 1))).toHaveLength(
      MAX_LEADERBOARD_PLAYER_NAME_LENGTH,
    );
    expect(normalizePlayerName(null)).toBe("");
  });

  it("normalizes high-score leaderboard responses by sorting, flooring, filtering, and capping", () => {
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

  it("normalizes low-score leaderboard responses for timed games", () => {
    expect(
      normalizeLeaderboard(
        {
          entries: [
            { name: "Slow", score: 40 },
            { name: "Fast", score: 12 },
            { name: "Mid", score: 20 },
          ],
          version: LEADERBOARD_DATA_VERSION,
        },
        "asc",
      ),
    ).toEqual([
      { name: "Fast", score: 12 },
      { name: "Mid", score: 20 },
      { name: "Slow", score: 40 },
    ]);
  });

  it("creates pending entries with strict ranking in both directions", () => {
    expect(createPendingLeaderboardEntry(8, [{ name: "Best", score: 10 }])).toEqual({
      rank: 1,
      score: 8,
    });
    expect(
      createPendingLeaderboardEntry(
        7,
        [
          { name: "Fast", score: 5 },
          { name: "Mid", score: 8 },
          { name: "Slow", score: 10 },
        ],
        "asc",
      ),
    ).toEqual({ rank: 1, score: 7 });
    expect(
      createPendingLeaderboardEntry(
        10,
        [
          { name: "Fast", score: 5 },
          { name: "Mid", score: 8 },
          { name: "Slow", score: 10 },
        ],
        "asc",
      ),
    ).toBeNull();
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

  it("fetches parameter-scoped leaderboard entries from the server API", async () => {
    const fetchStub = vi.fn(async () =>
      Response.json(createLeaderboardResponse([{ name: "Server", score: 8 }])),
    );

    vi.stubGlobal("fetch", fetchStub);

    await expect(
      fetchLeaderboard({
        leaderboardKey: "snake|board=19",
      }),
    ).resolves.toEqual([{ name: "Server", score: 8 }]);
    expect(fetchStub).toHaveBeenCalledWith(
      `${LEADERBOARD_API_PATH}?key=snake%7Cboard%3D19&sort=desc`,
      {
        cache: "no-store",
      },
    );
  });

  it("submits scores to the server API and returns the updated leaderboard", async () => {
    const submission = {
      leaderboardKey: "snake|board=19",
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
      body: JSON.stringify({ ...submission, sortDirection: "desc" }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  });

  it("surfaces failed leaderboard API requests", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));

    await expect(
      fetchLeaderboard({
        leaderboardKey: "snake|board=19",
      }),
    ).rejects.toThrow("status 503");
  });
});
