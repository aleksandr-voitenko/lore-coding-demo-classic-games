import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EMPTY_LEADERBOARD_SNAPSHOT,
  getServerLeaderboardSnapshot,
  getStoredLeaderboardSnapshot,
  insertLeaderboardEntry,
  LEADERBOARD_CHANGE_EVENT,
  LEADERBOARD_STORAGE_KEY,
  LEADERBOARD_STORAGE_VERSION,
  MAX_LEADERBOARD_PLAYER_NAME_LENGTH,
  normalizeLeaderboard,
  normalizePlayerName,
  parseLeaderboardSnapshot,
  subscribeToLeaderboardStore,
  writeStoredLeaderboard,
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

  it("normalizes versioned leaderboard snapshots by sorting, flooring, filtering, and capping", () => {
    const leaderboard = normalizeLeaderboard({
      entries: [
        { name: " Low ", score: 1.9 },
        { name: "Bad", score: 0 },
        { name: "Top", score: 12 },
        { name: "Invalid", score: Number.NaN },
        { name: "Fourth", score: 3 },
        { name: "Second", score: 7.8 },
      ],
      version: LEADERBOARD_STORAGE_VERSION,
    });

    expect(leaderboard).toEqual([
      { name: "Top", score: 12 },
      { name: "Second", score: 7 },
      { name: "Fourth", score: 3 },
    ]);
  });

  it("keeps legacy array snapshots readable", () => {
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

  it("parses stored snapshots and ignores malformed data", () => {
    expect(
      parseLeaderboardSnapshot(
        JSON.stringify({
          entries: [{ name: "Saved", score: 5 }],
          version: LEADERBOARD_STORAGE_VERSION,
        }),
      ),
    ).toEqual([{ name: "Saved", score: 5 }]);
    expect(parseLeaderboardSnapshot(EMPTY_LEADERBOARD_SNAPSHOT)).toEqual([]);
    expect(parseLeaderboardSnapshot("{")).toEqual([]);
  });

  it("inserts entries using the same sorted and capped leaderboard rules", () => {
    const leaderboard = [
      { name: "First", score: 9 },
      { name: "Second", score: 6 },
      { name: "Third", score: 3 },
    ];

    expect(insertLeaderboardEntry(leaderboard, { name: "New", score: 7 })).toEqual([
      { name: "First", score: 9 },
      { name: "New", score: 7 },
      { name: "Second", score: 6 },
    ]);
  });

  it("returns empty no-op behavior when browser storage is unavailable", () => {
    expect(getStoredLeaderboardSnapshot()).toBe(EMPTY_LEADERBOARD_SNAPSHOT);
    expect(getServerLeaderboardSnapshot()).toBe(EMPTY_LEADERBOARD_SNAPSHOT);
    expect(() => writeStoredLeaderboard([{ name: "Offline", score: 1 }])).not.toThrow();
    expect(() => subscribeToLeaderboardStore(() => {})()).not.toThrow();
  });

  it("reads, writes, and subscribes through the versioned browser storage contract", () => {
    const storedSnapshot = JSON.stringify({
      entries: [{ name: "Stored", score: 8 }],
      version: LEADERBOARD_STORAGE_VERSION,
    });
    const windowStub = {
      addEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      localStorage: {
        getItem: vi.fn(() => storedSnapshot),
        setItem: vi.fn(),
      },
      removeEventListener: vi.fn(),
    };
    const onStoreChange = vi.fn();

    vi.stubGlobal("window", windowStub);

    expect(getStoredLeaderboardSnapshot()).toBe(storedSnapshot);

    const unsubscribe = subscribeToLeaderboardStore(onStoreChange);

    expect(windowStub.addEventListener).toHaveBeenCalledWith("storage", onStoreChange);
    expect(windowStub.addEventListener).toHaveBeenCalledWith(
      LEADERBOARD_CHANGE_EVENT,
      onStoreChange,
    );

    writeStoredLeaderboard([{ name: "Saved", score: 4 }]);

    expect(windowStub.localStorage.setItem).toHaveBeenCalledWith(
      LEADERBOARD_STORAGE_KEY,
      JSON.stringify({
        entries: [{ name: "Saved", score: 4 }],
        version: LEADERBOARD_STORAGE_VERSION,
      }),
    );
    expect(windowStub.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: LEADERBOARD_CHANGE_EVENT }),
    );

    unsubscribe();

    expect(windowStub.removeEventListener).toHaveBeenCalledWith("storage", onStoreChange);
    expect(windowStub.removeEventListener).toHaveBeenCalledWith(
      LEADERBOARD_CHANGE_EVENT,
      onStoreChange,
    );
  });
});
