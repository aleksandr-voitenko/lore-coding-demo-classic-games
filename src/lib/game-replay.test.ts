import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createGameReplayRandom,
  createGameReplayRun,
  fetchGameReplay,
  getGameReplayApiPath,
  getGameReplayRunApiPath,
  normalizeGameReplayRunId,
  normalizeGameReplaySeed,
  parseBaseGameReplayPayload,
  saveGameReplay,
  type BaseGameReplayPayload,
} from "./game-replay";

function createBaseReplayPayload(
  overrides: Partial<BaseGameReplayPayload<"tetris", 1>> = {},
): BaseGameReplayPayload<"tetris", 1> {
  return {
    finalScore: 12,
    finalStatus: "lost",
    finalTick: 8,
    gameId: "tetris",
    leaderboardKey: "tetris|board=10x20",
    runId: "run-1",
    schemaVersion: 1,
    seed: 1234,
    startedAt: "2026-06-08T12:00:00.000Z",
    ...overrides,
  };
}

function parseTetrisReplayPayload(value: unknown) {
  return parseBaseGameReplayPayload(value, {
    gameId: "tetris",
    replayLabel: "Tetris replay",
    schemaVersion: 1,
  });
}

describe("game replay", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes replay run ids and seeds used by API responses", () => {
    expect(normalizeGameReplayRunId(" run-1 ")).toBe("run-1");
    expect(normalizeGameReplayRunId("bad run")).toBeNull();
    expect(normalizeGameReplayRunId("")).toBeNull();
    expect(normalizeGameReplaySeed(1)).toBe(1);
    expect(normalizeGameReplaySeed(2_147_483_646)).toBe(2_147_483_646);
    expect(normalizeGameReplaySeed(0)).toBeNull();
    expect(normalizeGameReplaySeed(2_147_483_647)).toBeNull();
  });

  it("builds generic replay API paths from game ids", () => {
    expect(getGameReplayApiPath("space-invaders")).toBe("/api/replays/space-invaders");
    expect(getGameReplayRunApiPath("space-invaders")).toBe(
      "/api/replays/space-invaders/run",
    );
  });

  it("creates deterministic replay random sources from a seed", () => {
    const first = createGameReplayRandom(1234);
    const second = createGameReplayRandom(1234);

    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
  });

  it("parses shared replay payload fields before game-specific event validation", () => {
    expect(parseTetrisReplayPayload(createBaseReplayPayload())).toEqual({
      payload: createBaseReplayPayload(),
      success: true,
    });
    expect(parseTetrisReplayPayload({})).toEqual({
      error: "Tetris replay version is not supported.",
      success: false,
    });
    expect(
      parseTetrisReplayPayload(
        createBaseReplayPayload({
          runId: "bad run",
        }),
      ),
    ).toEqual({
      error: "Tetris replay run is not supported.",
      success: false,
    });
    expect(
      parseTetrisReplayPayload(
        createBaseReplayPayload({
          finalTick: -1,
        }),
      ),
    ).toEqual({
      error: "Tetris replay final state is not supported.",
      success: false,
    });
  });

  it("shares run creation, save, and fetch API clients by game id", async () => {
    const replay = createBaseReplayPayload();
    const fetchStub = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: "run-1", seed: 1234 }, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ saved: true }, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ replay }));

    vi.stubGlobal("fetch", fetchStub);

    await expect(createGameReplayRun("tetris", { replayLabel: "Tetris replay" })).resolves.toEqual({
      id: "run-1",
      seed: 1234,
    });
    await expect(
      saveGameReplay("tetris", replay, { replayLabel: "Tetris replay" }),
    ).resolves.toBeUndefined();
    await expect(
      fetchGameReplay("tetris", parseTetrisReplayPayload, { replayLabel: "Tetris replay" }),
    ).resolves.toEqual(replay);

    expect(fetchStub).toHaveBeenNthCalledWith(1, "/api/replays/tetris/run", {
      method: "POST",
    });
    expect(fetchStub).toHaveBeenNthCalledWith(2, "/api/replays/tetris", {
      body: JSON.stringify(replay),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    expect(fetchStub).toHaveBeenNthCalledWith(3, "/api/replays/tetris", {
      cache: "no-store",
    });
  });
});
