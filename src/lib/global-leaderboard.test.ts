import { afterEach, describe, expect, it, vi } from "vitest";

import { GAME_CATALOG } from "@/lib/game-catalog";
import { createLeaderboardResponse, LEADERBOARD_API_PATH } from "@/lib/leaderboard";

import {
  createGlobalLeaderboardSlots,
  fetchGlobalLeaderboards,
  formatGlobalLeaderboardScore,
  getGlobalLeaderboardGameLabel,
  GLOBAL_LEADERBOARD_TARGETS,
} from "./global-leaderboard";

describe("global leaderboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defines one default leaderboard target for every catalog game", () => {
    expect(
      GLOBAL_LEADERBOARD_TARGETS.map((target) => ({
        id: target.gameId,
        label: getGlobalLeaderboardGameLabel(target),
      })),
    ).toEqual(GAME_CATALOG);
    expect(GLOBAL_LEADERBOARD_TARGETS.map((target) => target.leaderboardKey)).toEqual([
      "snake|mode=levels",
      "tetris|board=10x20|level=1",
      "breakout|board=420x560|lives=3",
      "minesweeper|difficulty=easy",
      "space-invaders|board=420x560|aliens=50",
      "twenty-forty-eight|board=4|goal=2048",
      "pong|board=420x560|target=5",
      "simon|difficulty=medium",
      "asteroids|difficulty=medium",
      "battle-city|mode=campaign",
    ]);
  });

  it("keeps Minesweeper as an ascending timed board", () => {
    const minesweeperTarget = GLOBAL_LEADERBOARD_TARGETS.find(
      (target) => target.gameId === "minesweeper",
    );

    expect(minesweeperTarget).toMatchObject({
      metric: "time",
      sortDirection: "asc",
    });
    expect(formatGlobalLeaderboardScore({ metric: "time" }, 73)).toBe("1:13");
    expect(formatGlobalLeaderboardScore({ metric: "score" }, 12345)).toBe("12,345");
  });

  it("keeps Tank Patrol on one descending campaign board", () => {
    const battleCityTarget = GLOBAL_LEADERBOARD_TARGETS.find(
      (target) => target.gameId === "battle-city",
    );

    expect(battleCityTarget).toEqual({
      gameId: "battle-city",
      leaderboardKey: "battle-city|mode=campaign",
      metric: "score",
      sortDirection: "desc",
      variantLabel: "classic campaign",
    });
  });

  it("creates fixed top-three slots", () => {
    expect(createGlobalLeaderboardSlots([{ name: "Ada", score: 12 }])).toEqual([
      { name: "Ada", score: 12 },
      null,
      null,
    ]);
  });

  it("fetches all target leaderboards with their sort directions", async () => {
    const fetchStub = vi.fn(async (url: string) => {
      const parsedUrl = new URL(url, "http://localhost");
      const key = parsedUrl.searchParams.get("key") ?? "";

      return Response.json(createLeaderboardResponse([{ name: key.split("|")[0], score: 8 }]));
    });

    vi.stubGlobal("fetch", fetchStub);

    await expect(
      fetchGlobalLeaderboards([
        {
          gameId: "snake",
          leaderboardKey: "snake|mode=levels",
          metric: "score",
          sortDirection: "desc",
          variantLabel: "Levels mode",
        },
        {
          gameId: "minesweeper",
          leaderboardKey: "minesweeper|difficulty=easy",
          metric: "time",
          sortDirection: "asc",
          variantLabel: "Easy difficulty",
        },
      ]),
    ).resolves.toEqual([
      {
        entries: [{ name: "snake", score: 8 }],
        loadFailed: false,
        target: expect.objectContaining({
          gameId: "snake",
          sortDirection: "desc",
        }),
      },
      {
        entries: [{ name: "minesweeper", score: 8 }],
        loadFailed: false,
        target: expect.objectContaining({
          gameId: "minesweeper",
          sortDirection: "asc",
        }),
      },
    ]);
    expect(fetchStub).toHaveBeenCalledWith(
      `${LEADERBOARD_API_PATH}?key=snake%7Cmode%3Dlevels&sort=desc`,
      { cache: "no-store" },
    );
    expect(fetchStub).toHaveBeenCalledWith(
      `${LEADERBOARD_API_PATH}?key=minesweeper%7Cdifficulty%3Deasy&sort=asc`,
      { cache: "no-store" },
    );
  });

  it("marks individual target failures without dropping other boards", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("minesweeper")
          ? new Response(null, { status: 503 })
          : Response.json(createLeaderboardResponse([{ name: "Ada", score: 9 }])),
      ),
    );

    await expect(
      fetchGlobalLeaderboards([
        {
          gameId: "snake",
          leaderboardKey: "snake|mode=levels",
          metric: "score",
          sortDirection: "desc",
          variantLabel: "Levels mode",
        },
        {
          gameId: "minesweeper",
          leaderboardKey: "minesweeper|difficulty=easy",
          metric: "time",
          sortDirection: "asc",
          variantLabel: "Easy difficulty",
        },
      ]),
    ).resolves.toMatchObject([
      {
        entries: [{ name: "Ada", score: 9 }],
        loadFailed: false,
      },
      {
        entries: [],
        loadFailed: true,
      },
    ]);
  });
});
