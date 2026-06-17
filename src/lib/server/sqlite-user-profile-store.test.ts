import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import {
  getUserProfileSqlitePath,
  SqliteUserProfileStore,
  type UserAuthenticationResult,
  type UserSession,
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

function getSuccessfulSession(result: UserAuthenticationResult): UserSession {
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(`Expected successful auth result, got ${result.reason}.`);
  }

  return result.session;
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

  it("registers unique display-name accounts and resolves active session users", async () => {
    const { dispose, store } = createTempStore();
    disposables.push(dispose);

    const firstSession = getSuccessfulSession(
      await store.registerUser("  Ada   Lovelace  ", "password123"),
    );
    const duplicateSignup = await store.registerUser("ada lovelace", "password456");
    const secondSession = getSuccessfulSession(
      await store.authenticateUser("ada lovelace", "password123"),
    );

    expect(firstSession).toMatchObject({
      sessionToken: "token-1",
      user: {
        displayName: "Ada Lovelace",
        id: "id-1",
      },
    });
    expect(duplicateSignup).toEqual({
      reason: "display-name-taken",
      success: false,
    });
    expect(secondSession).toMatchObject({
      sessionToken: "token-2",
      user: {
        displayName: "Ada Lovelace",
        id: "id-1",
      },
    });
    await expect(store.getUserBySessionToken("token-1")).resolves.toEqual({
      displayName: "Ada Lovelace",
      id: "id-1",
    });

    await store.deleteUserSession("token-1");
    await expect(store.getUserBySessionToken("token-1")).resolves.toBeNull();
    await expect(store.getUserBySessionToken("token-2")).resolves.toEqual({
      displayName: "Ada Lovelace",
      id: "id-1",
    });
    await expect(store.authenticateUser("Ada Lovelace", "wrongpass")).resolves.toEqual({
      reason: "invalid-credentials",
      success: false,
    });
  });

  it("records signed-in game sessions and aggregates profile stats by game", async () => {
    const { dispose, store } = createTempStore();
    disposables.push(dispose);
    const session = getSuccessfulSession(await store.registerUser("Grace", "password123"));
    const user = session.user;

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
      leaderboardKey: "minesweeper|difficulty=easy",
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

    await expect(store.registerUser("   ", "password123")).resolves.toEqual({
      reason: "invalid-display-name",
      success: false,
    });
    await expect(store.registerUser("Ada", "short")).resolves.toEqual({
      reason: "invalid-password",
      success: false,
    });
    await expect(store.authenticateUser("   ", "password123")).resolves.toEqual({
      reason: "invalid-display-name",
      success: false,
    });
    await expect(store.authenticateUser("Ada", "")).resolves.toEqual({
      reason: "invalid-password",
      success: false,
    });
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

    const session = getSuccessfulSession(await store.registerUser("Katherine", "password123"));

    expect(session).toMatchObject({
      expiresAt: "2026-05-28T10:00:00.500Z",
      sessionToken: "token-1",
    });
    currentTime = START_TIME + 1000;
    await expect(store.getUserBySessionToken("token-1")).resolves.toBeNull();
  });

  it("reserves legacy passwordless users without allowing account claiming", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "user-profile-legacy-"));
    const databasePath = join(tempDir, "profile.sqlite");
    const database = new Database(databasePath);

    database.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        display_name_key TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      INSERT INTO users (
        id,
        display_name,
        display_name_key,
        created_at,
        updated_at
      )
      VALUES (
        'legacy-user',
        'Legacy Hero',
        'legacy hero',
        '2026-05-28T09:00:00.000Z',
        '2026-05-28T09:00:00.000Z'
      );
    `);
    database.close();

    const store = new SqliteUserProfileStore({
      createId: () => "id-1",
      createSessionToken: () => "token-1",
      databasePath,
      now: () => new Date(START_TIME),
    });
    disposables.push(() => {
      store.close();
      rmSync(tempDir, { force: true, recursive: true });
    });

    await expect(store.registerUser("legacy hero", "password123")).resolves.toEqual({
      reason: "display-name-taken",
      success: false,
    });
    await expect(store.authenticateUser("Legacy Hero", "password123")).resolves.toEqual({
      reason: "invalid-credentials",
      success: false,
    });
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
