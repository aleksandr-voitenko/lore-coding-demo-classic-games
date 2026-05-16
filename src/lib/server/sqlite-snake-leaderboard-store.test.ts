import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { parseScoreSubmission } from "./snake-leaderboard-store";

import { SqliteSnakeLeaderboardStore } from "./sqlite-snake-leaderboard-store";

const START_TIME = Date.parse("2026-05-08T00:00:00.000Z");

function createTempStore() {
  const tempDir = mkdtempSync(join(tmpdir(), "snake-leaderboard-"));
  const databasePath = join(tempDir, "scores.sqlite");
  let nextId = 0;
  let nextTime = 0;
  const store = new SqliteSnakeLeaderboardStore({
    createId: () => `score-${++nextId}`,
    databasePath,
    now: () => new Date(START_TIME + nextTime++),
  });

  return {
    databasePath,
    dispose() {
      store.close();
      rmSync(tempDir, { force: true, recursive: true });
    },
    store,
  };
}

describe("sqlite snake leaderboard store", () => {
  const disposables: Array<() => void> = [];

  afterEach(() => {
    while (disposables.length > 0) {
      disposables.pop()?.();
    }
  });

  it("parses score submissions with server-side validation", () => {
    expect(
      parseScoreSubmission({
        boardSize: 19,
        name: "  Ada Lovelace  ",
        score: 7,
      }),
    ).toEqual({
      submission: {
        boardSize: 19,
        name: "Ada Lovelace",
        score: 7,
      },
      success: true,
    });
    expect(parseScoreSubmission({ boardSize: 19, name: "Ada", score: 1.5 })).toMatchObject({
      success: false,
    });
    expect(parseScoreSubmission({ boardSize: 12, name: "Ada", score: 1 })).toMatchObject({
      success: false,
    });
  });

  it("stores qualifying scores and keeps earlier ties ahead of later ties", async () => {
    const { dispose, store } = createTempStore();
    disposables.push(dispose);

    await expect(
      store.submitScore({
        boardSize: 19,
        name: "First",
        score: 5,
      }),
    ).resolves.toMatchObject({ accepted: true, rank: 0 });
    await expect(
      store.submitScore({
        boardSize: 19,
        name: "Second",
        score: 5,
      }),
    ).resolves.toMatchObject({ accepted: true, rank: 1 });
    await store.submitScore({
      boardSize: 19,
      name: "Third",
      score: 4,
    });

    await expect(
      store.submitScore({
        boardSize: 19,
        name: "Late tie",
        score: 4,
      }),
    ).resolves.toEqual({
      accepted: false,
      entries: [
        { name: "First", score: 5 },
        { name: "Second", score: 5 },
        { name: "Third", score: 4 },
      ],
      rank: null,
    });

    await expect(
      store.submitScore({
        boardSize: 19,
        name: "Better",
        score: 6,
      }),
    ).resolves.toEqual({
      accepted: true,
      entries: [
        { name: "Better", score: 6 },
        { name: "First", score: 5 },
        { name: "Second", score: 5 },
      ],
      rank: 0,
    });
  });

  it("persists leaderboard rows at the configured SQLite path", async () => {
    const { databasePath, dispose, store } = createTempStore();
    disposables.push(dispose);

    await store.submitScore({
      boardSize: 19,
      name: "Saved",
      score: 8,
    });
    store.close();

    const reopenedStore = new SqliteSnakeLeaderboardStore({
      databasePath,
    });

    disposables.push(() => reopenedStore.close());

    await expect(reopenedStore.listTopScores()).resolves.toEqual([{ name: "Saved", score: 8 }]);
  });
});
