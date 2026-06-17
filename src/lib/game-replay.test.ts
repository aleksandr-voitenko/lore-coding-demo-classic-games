import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createGameReplayActiveClock,
  createGameReplayRandom,
  createGameReplayRun,
  fetchGameReplay,
  getGameReplayActiveElapsedMs,
  getGameReplayApiPath,
  getGameReplayEventDelayMs,
  getGameReplayRunApiPath,
  normalizeGameReplayRunId,
  normalizeGameReplaySeed,
  pauseGameReplayActiveClock,
  parseBaseGameReplayPayload,
  parseGameReplayCursorEvent,
  parseGameReplayEventEnvelope,
  parseGameReplayEvents,
  resumeGameReplayActiveClock,
  saveGameReplay,
  shouldRecordGameReplayCursorEvent,
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

  it("tracks active replay elapsed time while excluding pauses", () => {
    const clock = createGameReplayActiveClock(-10);

    expect(clock).toEqual({
      activeElapsedMs: 0,
      lastStartedAtMs: 0,
    });
    expect(getGameReplayActiveElapsedMs(clock, 10.4)).toBe(10);

    pauseGameReplayActiveClock(clock, 10.6);
    pauseGameReplayActiveClock(clock, 50);

    expect(clock).toEqual({
      activeElapsedMs: 11,
      lastStartedAtMs: null,
    });
    expect(getGameReplayActiveElapsedMs(clock, 50)).toBe(11);

    resumeGameReplayActiveClock(clock, 100);
    resumeGameReplayActiveClock(clock, 120);

    expect(clock.lastStartedAtMs).toBe(100);
    expect(getGameReplayActiveElapsedMs(clock, 125)).toBe(36);
  });

  it("computes replay event delays from required elapsed timing", () => {
    expect(
      getGameReplayEventDelayMs({
        event: { elapsedMs: 1_500 },
        previousElapsedMs: 1_000,
      }),
    ).toBe(500);
    expect(
      getGameReplayEventDelayMs({
        event: { elapsedMs: 900 },
        previousElapsedMs: 1_000,
      }),
    ).toBe(0);
    expect(() =>
      getGameReplayEventDelayMs({
        event: {},
        previousElapsedMs: 1_000,
      }),
    ).toThrow("Replay event is missing elapsed timing.");
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

  it("parses replay event envelopes with allowed event types", () => {
    const allowedTypes = new Set(["advance", "start"] as const);

    expect(
      parseGameReplayEventEnvelope(
        {
          elapsedMs: 1200,
          ignored: "game-specific",
          seq: 2,
          tick: 8,
          type: "advance",
        },
        allowedTypes,
      ),
    ).toEqual({
      elapsedMs: 1200,
      seq: 2,
      tick: 8,
      type: "advance",
    });
  });

  it("rejects unsupported replay event envelopes", () => {
    const allowedTypes = new Set(["advance", "start"] as const);

    expect(parseGameReplayEventEnvelope([], allowedTypes)).toBeNull();
    expect(
      parseGameReplayEventEnvelope(
        {
          seq: -1,
          tick: 8,
          type: "advance",
        },
        allowedTypes,
      ),
    ).toBeNull();
    expect(
      parseGameReplayEventEnvelope(
        {
          seq: 2,
          tick: 1.5,
          type: "advance",
        },
        allowedTypes,
      ),
    ).toBeNull();
    expect(
      parseGameReplayEventEnvelope(
        {
          seq: 2,
          tick: 8,
          type: "advance",
        },
        allowedTypes,
      ),
    ).toBeNull();
    expect(
      parseGameReplayEventEnvelope(
        {
          elapsedMs: -1,
          seq: 2,
          tick: 8,
          type: "advance",
        },
        allowedTypes,
      ),
    ).toBeNull();
    expect(
      parseGameReplayEventEnvelope(
        {
          elapsedMs: 0,
          seq: 2,
          tick: 8,
          type: "unsupported",
        },
        allowedTypes,
      ),
    ).toBeNull();
  });

  it("parses shared replay cursor events with normalized board coordinates", () => {
    const allowedTypes = new Set(["cursorMove"] as const);

    expect(
      parseGameReplayCursorEvent(
        {
          elapsedMs: 1200,
          seq: 2,
          tick: 8,
          type: "cursorMove",
          x: 0.25,
          y: 1,
        },
        allowedTypes,
      ),
    ).toEqual({
      elapsedMs: 1200,
      seq: 2,
      tick: 8,
      type: "cursorMove",
      x: 0.25,
      y: 1,
    });

    expect(
      parseGameReplayCursorEvent(
        {
          elapsedMs: 1200,
          seq: 2,
          tick: 8,
          type: "cursorMove",
          x: -0.01,
          y: 0.5,
        },
        allowedTypes,
      ),
    ).toBeNull();
    expect(
      parseGameReplayCursorEvent(
        {
          elapsedMs: 1200,
          seq: 2,
          tick: 8,
          type: "drag",
          x: 0.25,
          y: 0.5,
        },
        allowedTypes,
      ),
    ).toBeNull();
  });

  it("shares replay cursor sampling throttles with forced samples", () => {
    expect(
      shouldRecordGameReplayCursorEvent({
        elapsedMs: 100,
        lastElapsedMs: null,
        sampleIntervalMs: 50,
      }),
    ).toBe(true);
    expect(
      shouldRecordGameReplayCursorEvent({
        elapsedMs: 149,
        lastElapsedMs: 100,
        sampleIntervalMs: 50,
      }),
    ).toBe(false);
    expect(
      shouldRecordGameReplayCursorEvent({
        elapsedMs: 149,
        force: true,
        lastElapsedMs: 100,
        sampleIntervalMs: 50,
      }),
    ).toBe(true);
    expect(
      shouldRecordGameReplayCursorEvent({
        elapsedMs: 150,
        lastElapsedMs: 100,
        sampleIntervalMs: 50,
      }),
    ).toBe(true);
  });

  it("parses replay event arrays with the provided game event parser", () => {
    const parseEvent = (value: unknown) =>
      typeof value === "string" ? { type: value.toUpperCase() } : null;

    expect(
      parseGameReplayEvents(["start", "advance"], {
        maxEventCount: 2,
        parseEvent,
        unsupportedEventError: "Tetris replay includes an unsupported event.",
        unsupportedEventsError: "Tetris replay events are not supported.",
      }),
    ).toEqual({
      payload: [{ type: "START" }, { type: "ADVANCE" }],
      success: true,
    });
  });

  it("rejects replay event arrays that are missing or exceed the max event count", () => {
    const options = {
      maxEventCount: 1,
      parseEvent: (value: unknown) => (typeof value === "string" ? value : null),
      unsupportedEventError: "Tetris replay includes an unsupported event.",
      unsupportedEventsError: "Tetris replay events are not supported.",
    };

    expect(parseGameReplayEvents(undefined, options)).toEqual({
      error: "Tetris replay events are not supported.",
      success: false,
    });
    expect(parseGameReplayEvents(["start", "advance"], options)).toEqual({
      error: "Tetris replay events are not supported.",
      success: false,
    });
  });

  it("rejects replay event arrays with unsupported parsed events", () => {
    expect(
      parseGameReplayEvents(["start", 42], {
        maxEventCount: 2,
        parseEvent: (value) => (typeof value === "string" ? value : null),
        unsupportedEventError: "Tetris replay includes an unsupported event.",
        unsupportedEventsError: "Tetris replay events are not supported.",
      }),
    ).toEqual({
      error: "Tetris replay includes an unsupported event.",
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

  it("surfaces failed replay API statuses with request context", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ error: "Nope" }, { status: 503 })),
    );

    await expect(
      createGameReplayRun("tetris", { replayLabel: "Tetris replay" }),
    ).rejects.toThrow("Tetris replay run request failed with status 503");
  });
});
