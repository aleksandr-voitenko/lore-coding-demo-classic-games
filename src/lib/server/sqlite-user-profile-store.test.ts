import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  getUserProfileSqlitePath,
  SqliteUserProfileStore,
} from "./sqlite-user-profile-store";

const START_TIME = Date.parse("2026-05-28T10:00:00.000Z");
const ORIGINAL_GAME_LEADERBOARD_SQLITE_PATH = process.env.GAME_LEADERBOARD_SQLITE_PATH;
const ORIGINAL_SNAKE_LEADERBOARD_SQLITE_PATH = process.env.SNAKE_LEADERBOARD_SQLITE_PATH;

function restoreEnvValue(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function createTempStore() {
  const tempDir = mkdtempSync(join(tmpdir(), "user-profile-"));
  const databasePath = join(tempDir, "profile.sqlite");
  let nextId = 0;
  let nextSessionToken = 0;
  let nextTime = 0;
  const store = new SqliteUserProfileStore({
    createId: () => `id-${++nextId}`,
    createSessionToken: () => `token-${++nextSessionToken}`,
    databasePath,
    now: () => new Date(START_TIME + nextTime++ * 1000),
  });

  return {
    dispose() {
      store.close();
      rmSync(tempDir, { force: true, recursive: true });
    },
    store,
  };
}

describe("sqlite user profile store", () => {
  const disposables: Array<() => void> = [];

  afterEach(() => {
    while (disposables.length > 0) {
      disposables.pop()?.();
    }

    restoreEnvValue("GAME_LEADERBOARD_SQLITE_PATH", ORIGINAL_GAME_LEADERBOARD_SQLITE_PATH);
    restoreEnvValue("SNAKE_LEADERBOARD_SQLITE_PATH", ORIGINAL_SNAKE_LEADERBOARD_SQLITE_PATH);
  });

  it("creates reusable display-name sessions and resolves active session users", async () => {
    const { dispose, store } = createTempStore();
    disposables.push(dispose);

    const firstSession = await store.createUserSession("  Ada   Lovelace  ");
    const secondSession = await store.createUserSession("ada lovelace");

    expect(firstSession).toMatchObject({
      sessionToken: "token-1",
      user: {
        displayName: "Ada Lovelace",
        id: "id-1",
      },
    });
    expect(secondSession).toMatchObject({
      sessionToken: "token-2",
      user: {
        displayName: "ada lovelace",
        id: "id-1",
      },
    });
    await expect(store.getUserBySessionToken("token-1")).resolves.toEqual({
      displayName: "ada lovelace",
      id: "id-1",
    });

    await store.deleteUserSession("token-1");
    await expect(store.getUserBySessionToken("token-1")).resolves.toBeNull();
    await expect(store.getUserBySessionToken("token-2")).resolves.toEqual({
      displayName: "ada lovelace",
      id: "id-1",
    });
  });

  it("records signed-in game sessions and aggregates profile stats by game", async () => {
    const { dispose, store } = createTempStore();
    disposables.push(dispose);
    const session = await store.createUserSession("Grace");

    expect(session).not.toBeNull();

    const user = session!.user;

    await expect(
      store.recordGameSession(user, {
        activeDurationMs: 60_000,
        finalScore: 9,
        gameId: "snake",
        leaderboardKey: "snake|board=19",
        result: "lost",
        sortDirection: "desc",
      }),
    ).resolves.toEqual({ id: "id-2" });
    await store.recordGameSession(user, {
      activeDurationMs: 90_000,
      finalScore: 14,
      gameId: "snake",
      leaderboardKey: "snake|board=19",
      result: "won",
      sortDirection: "desc",
    });
    await store.recordGameSession(user, {
      activeDurationMs: 45_000,
      finalScore: 32,
      gameId: "minesweeper",
      leaderboardKey: "minesweeper|board=9x9|mines=10",
      result: "won",
      sortDirection: "asc",
    });
    await store.recordGameSession(user, {
      activeDurationMs: 12_000,
      finalScore: 7,
      gameId: "snake",
      leaderboardKey: "snake|board=19",
      result: "abandoned",
      sortDirection: "desc",
    });

    await expect(store.getUserProfile(user)).resolves.toMatchObject({
      games: [
        {
          abandons: 1,
          bestScore: 14,
          fastestWinScore: null,
          gameId: "snake",
          losses: 1,
          sessionsPlayed: 3,
          totalActiveDurationMs: 162_000,
          wins: 1,
        },
        {
          abandons: 0,
          bestScore: null,
          fastestWinScore: 32,
          gameId: "minesweeper",
          losses: 0,
          sessionsPlayed: 1,
          totalActiveDurationMs: 45_000,
          wins: 1,
        },
      ],
      totalActiveDurationMs: 207_000,
      totalSessionsPlayed: 4,
      user,
    });
  });

  it("ignores blank names and absent session tokens without mutating sessions", async () => {
    const { dispose, store } = createTempStore();
    disposables.push(dispose);
    const user = { displayName: "Missing", id: "missing-user" };

    await expect(store.createUserSession("   ")).resolves.toBeNull();
    await expect(store.deleteUserSession(null)).resolves.toBeUndefined();
    await expect(store.getUserBySessionToken(null)).resolves.toBeNull();
    await expect(store.getUserById(user.id)).resolves.toBeNull();
    await expect(store.getUserProfile(user)).resolves.toEqual({
      games: [],
      totalActiveDurationMs: 0,
      totalSessionsPlayed: 0,
      user,
    });
  });

  it("expires sessions using the configured session ttl", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "user-profile-expiring-"));
    const databasePath = join(tempDir, "profile.sqlite");
    let nextId = 0;
    let nextSessionToken = 0;
    let currentTime = START_TIME;
    const store = new SqliteUserProfileStore({
      createId: () => `id-${++nextId}`,
      createSessionToken: () => `token-${++nextSessionToken}`,
      databasePath,
      now: () => new Date(currentTime),
      sessionTtlMs: 500,
    });
    disposables.push(() => {
      store.close();
      rmSync(tempDir, { force: true, recursive: true });
    });

    const session = await store.createUserSession("Katherine");

    expect(session).toMatchObject({
      expiresAt: "2026-05-28T10:00:00.500Z",
      sessionToken: "token-1",
    });
    currentTime = START_TIME + 1000;
    await expect(store.getUserBySessionToken("token-1")).resolves.toBeNull();
  });

  it("selects the configured profile sqlite path with the legacy snake fallback", () => {
    process.env.GAME_LEADERBOARD_SQLITE_PATH = "  /tmp/game-profile.sqlite  ";
    process.env.SNAKE_LEADERBOARD_SQLITE_PATH = "  /tmp/snake-profile.sqlite  ";

    expect(getUserProfileSqlitePath()).toBe("/tmp/game-profile.sqlite");

    process.env.GAME_LEADERBOARD_SQLITE_PATH = "   ";

    expect(getUserProfileSqlitePath()).toBe("/tmp/snake-profile.sqlite");

    process.env.SNAKE_LEADERBOARD_SQLITE_PATH = "   ";

    expect(getUserProfileSqlitePath()).toContain(".data/snake-leaderboard.sqlite");
  });
});
