import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { parseScoreSubmission } from "./leaderboard-store";
import { SqliteLeaderboardStore } from "./sqlite-leaderboard-store";
import { SqliteUserProfileStore } from "./sqlite-user-profile-store";

const START_TIME = Date.parse("2026-05-08T00:00:00.000Z");

function createTempStore() {
  const tempDir = mkdtempSync(join(tmpdir(), "leaderboard-"));
  const databasePath = join(tempDir, "scores.sqlite");
  let nextId = 0;
  let nextTime = 0;
  const store = new SqliteLeaderboardStore({
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

describe("sqlite leaderboard store", () => {
  const disposables: Array<() => void> = [];

  afterEach(() => {
    while (disposables.length > 0) {
      disposables.pop()?.();
    }
  });

  it("parses score submissions with server-side validation", () => {
    expect(
      parseScoreSubmission({
        leaderboardKey: "snake|board=19",
        name: "  Ada Lovelace  ",
        score: 7,
      }),
    ).toEqual({
      submission: {
        leaderboardKey: "snake|board=19",
        name: "Ada Lovelace",
        score: 7,
        sortDirection: "desc",
      },
      success: true,
    });
    expect(
      parseScoreSubmission({
        leaderboardKey: "minesweeper|board=9x9|mines=10",
        name: "Grace",
        score: 42,
        sortDirection: "asc",
      }),
    ).toMatchObject({
      submission: {
        sortDirection: "asc",
      },
      success: true,
    });
    expect(parseScoreSubmission({ leaderboardKey: "snake|board=19", score: 1.5 })).toMatchObject({
      success: false,
    });
    expect(parseScoreSubmission({ leaderboardKey: "bad key", score: 1 })).toMatchObject({
      success: false,
    });
  });

  it("stores qualifying scores independently for each parameter key", async () => {
    const { dispose, store } = createTempStore();
    disposables.push(dispose);

    await store.submitScore({
      leaderboardKey: "snake|board=19",
      name: "Small",
      score: 5,
      sortDirection: "desc",
    });
    await store.submitScore({
      leaderboardKey: "snake|board=25",
      name: "Large",
      score: 9,
      sortDirection: "desc",
    });

    await expect(store.listTopScores("snake|board=19")).resolves.toEqual([
      { name: "Small", score: 5 },
    ]);
    await expect(store.listTopScores("snake|board=25")).resolves.toEqual([
      { name: "Large", score: 9 },
    ]);
  });

  it("keeps earlier ties ahead of later ties for high-score boards", async () => {
    const { dispose, store } = createTempStore();
    disposables.push(dispose);

    await expect(
      store.submitScore({
        leaderboardKey: "tetris|board=10x20|level=1",
        name: "First",
        score: 5,
        sortDirection: "desc",
      }),
    ).resolves.toMatchObject({ accepted: true, rank: 0 });
    await expect(
      store.submitScore({
        leaderboardKey: "tetris|board=10x20|level=1",
        name: "Second",
        score: 5,
        sortDirection: "desc",
      }),
    ).resolves.toMatchObject({ accepted: true, rank: 1 });
    await store.submitScore({
      leaderboardKey: "tetris|board=10x20|level=1",
      name: "Third",
      score: 4,
      sortDirection: "desc",
    });

    await expect(
      store.submitScore({
        leaderboardKey: "tetris|board=10x20|level=1",
        name: "Late tie",
        score: 4,
        sortDirection: "desc",
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
  });

  it("ranks lower scores first for timed leaderboards", async () => {
    const { dispose, store } = createTempStore();
    disposables.push(dispose);
    const leaderboardKey = "minesweeper|board=9x9|mines=10";

    await store.submitScore({
      leaderboardKey,
      name: "Slow",
      score: 40,
      sortDirection: "asc",
    });
    await store.submitScore({
      leaderboardKey,
      name: "Fast",
      score: 12,
      sortDirection: "asc",
    });
    await store.submitScore({
      leaderboardKey,
      name: "Mid",
      score: 20,
      sortDirection: "asc",
    });

    await expect(store.listTopScores(leaderboardKey, "asc")).resolves.toEqual([
      { name: "Fast", score: 12 },
      { name: "Mid", score: 20 },
      { name: "Slow", score: 40 },
    ]);
  });

  it("stores optional user and game-session links with qualifying scores", async () => {
    const { databasePath, dispose, store } = createTempStore();
    const userStore = new SqliteUserProfileStore({
      createId: () => "user-1",
      createSessionToken: () => "token-1",
      databasePath,
      now: () => new Date(START_TIME),
    });
    disposables.push(() => {
      userStore.close();
      dispose();
    });
    const userSession = await userStore.registerUser("Ada", "password123");

    expect(userSession.success).toBe(true);

    if (!userSession.success) {
      throw new Error(`Expected user registration to succeed, got ${userSession.reason}.`);
    }

    await userStore.recordGameSession(userSession.session.user, {
      activeDurationMs: 1000,
      finalScore: 9,
      gameId: "snake",
      leaderboardKey: "snake|board=19",
      result: "won",
      sortDirection: "desc",
    });

    await store.submitScore({
      gameSessionId: "user-1",
      leaderboardKey: "snake|board=19",
      name: "Ada",
      score: 9,
      sortDirection: "desc",
      userId: "user-1",
    });

    const database = new Database(databasePath);
    const row = database
      .prepare(
        "SELECT user_id AS userId, game_session_id AS gameSessionId FROM leaderboard_scores",
      )
      .get() as { gameSessionId: string; userId: string };
    database.close();

    expect(row).toEqual({
      gameSessionId: "user-1",
      userId: "user-1",
    });
  });

  it("migrates existing snake rows into board-scoped leaderboard keys", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "leaderboard-migration-"));
    const databasePath = join(tempDir, "scores.sqlite");
    const database = new Database(databasePath);
    database.exec(`
      CREATE TABLE snake_scores (
        id TEXT PRIMARY KEY,
        player_name TEXT NOT NULL,
        score INTEGER NOT NULL CHECK (score > 0),
        board_size INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      INSERT INTO snake_scores (id, player_name, score, board_size, created_at)
      VALUES
        ('old-19', 'Classic', 8, 19, '2026-05-08T00:00:00.000Z'),
        ('old-25', 'Large', 11, 25, '2026-05-08T00:00:01.000Z');
    `);
    database.close();

    const store = new SqliteLeaderboardStore({ databasePath });
    disposables.push(() => {
      store.close();
      rmSync(tempDir, { force: true, recursive: true });
    });

    await expect(store.listTopScores("snake|board=19")).resolves.toEqual([
      { name: "Classic", score: 8 },
    ]);
    await expect(store.listTopScores("snake|board=25")).resolves.toEqual([
      { name: "Large", score: 11 },
    ]);
  });
});
