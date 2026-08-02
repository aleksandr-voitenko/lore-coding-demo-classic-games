import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { initializeAppSchema, SCHEMA_VERSION } from "./sqlite-app-schema";

const V5_SCHEMA = `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    display_name_key TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE user_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE game_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_id TEXT NOT NULL,
    leaderboard_key TEXT NOT NULL,
    active_duration_ms INTEGER NOT NULL,
    final_score INTEGER NOT NULL,
    result TEXT NOT NULL,
    sort_direction TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE leaderboard_scores (
    id TEXT PRIMARY KEY,
    leaderboard_key TEXT NOT NULL,
    player_name TEXT NOT NULL,
    score INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    game_session_id TEXT REFERENCES game_sessions(id) ON DELETE SET NULL
  );

  CREATE TABLE game_replay_runs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    game_id TEXT NOT NULL,
    seed INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE game_replays (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_id TEXT NOT NULL,
    run_id TEXT NOT NULL REFERENCES game_replay_runs(id),
    leaderboard_key TEXT NOT NULL,
    final_score INTEGER NOT NULL,
    final_status TEXT NOT NULL,
    final_tick INTEGER NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, game_id)
  );

  PRAGMA user_version = 5;
`;

const CREATED_AT = "2026-08-03T00:00:00.000Z";

describe("SQLite app schema", () => {
  const disposables: Array<() => void> = [];

  afterEach(() => {
    while (disposables.length > 0) {
      disposables.pop()?.();
    }
  });

  function createDatabase(prefix: string) {
    const tempDir = mkdtempSync(join(tmpdir(), prefix));
    const database = new Database(join(tempDir, "app.sqlite"));

    disposables.push(() => {
      database.close();
      rmSync(tempDir, { force: true, recursive: true });
    });

    return database;
  }

  it("migrates an existing v5 database to social schema v6 idempotently", () => {
    const database = createDatabase("app-schema-v5-");

    database.exec(V5_SCHEMA);
    database
      .prepare(
        `INSERT INTO users (
          id, display_name, display_name_key, password_hash, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run("user-1", "Ada", "ada", "password-hash", CREATED_AT, CREATED_AT);
    database
      .prepare(
        `INSERT INTO users (
          id, display_name, display_name_key, password_hash, created_at, updated_at
        ) VALUES (?, ?, ?, NULL, ?, ?)`,
      )
      .run("legacy-user", "Legacy", "legacy", CREATED_AT, CREATED_AT);
    database
      .prepare(
        `INSERT INTO user_sessions (token_hash, user_id, created_at, expires_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run("token-hash", "user-1", CREATED_AT, "2026-09-03T00:00:00.000Z");
    database
      .prepare(
        `INSERT INTO game_sessions (
          id, user_id, game_id, leaderboard_key, active_duration_ms,
          final_score, result, sort_direction, started_at, ended_at,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "session-1",
        "user-1",
        "snake",
        "snake|board=19",
        1_000,
        10,
        "won",
        "desc",
        CREATED_AT,
        CREATED_AT,
        CREATED_AT,
        CREATED_AT,
      );
    database
      .prepare(
        `INSERT INTO leaderboard_scores (
          id, leaderboard_key, player_name, score, created_at, user_id, game_session_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "score-1",
        "snake|board=19",
        "Ada",
        10,
        CREATED_AT,
        "user-1",
        "session-1",
      );
    database
      .prepare(
        `INSERT INTO game_replay_runs (id, user_id, game_id, seed, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run("run-1", "user-1", "snake", 7, CREATED_AT);
    database
      .prepare(
        `INSERT INTO game_replays (
          user_id, game_id, run_id, leaderboard_key, final_score,
          final_status, final_tick, payload_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "user-1",
        "snake",
        "run-1",
        "snake|board=19",
        10,
        "won",
        20,
        "{}",
        CREATED_AT,
        CREATED_AT,
      );

    initializeAppSchema(database);
    initializeAppSchema(database);

    expect(database.pragma("user_version", { simple: true })).toBe(
      SCHEMA_VERSION,
    );
    expect(
      database
        .prepare(
          `SELECT name FROM sqlite_master
           WHERE type = 'table'
             AND name IN (
               'friend_requests', 'friendships', 'user_blocks', 'party_invitations'
             )
           ORDER BY name`,
        )
        .all(),
    ).toEqual([
      { name: "friend_requests" },
      { name: "friendships" },
      { name: "party_invitations" },
      { name: "user_blocks" },
    ]);
    expect(
      database
        .prepare(
          `SELECT id, display_name AS displayName, password_hash AS passwordHash
           FROM users ORDER BY id`,
        )
        .all(),
    ).toEqual([
      { displayName: "Legacy", id: "legacy-user", passwordHash: null },
      { displayName: "Ada", id: "user-1", passwordHash: "password-hash" },
    ]);
    expect(
      database.prepare("SELECT id FROM game_sessions").all(),
    ).toEqual([{ id: "session-1" }]);
    expect(
      database.prepare("SELECT id FROM leaderboard_scores").all(),
    ).toEqual([{ id: "score-1" }]);
    expect(
      database.prepare("SELECT run_id AS runId FROM game_replays").all(),
    ).toEqual([{ runId: "run-1" }]);
    expect(database.pragma("foreign_key_check")).toEqual([]);
  });

  it("enforces social pair, invitation, uniqueness, and cascade invariants", () => {
    const database = createDatabase("app-schema-social-");

    initializeAppSchema(database);

    for (const [id, displayName] of [
      ["user-1", "Ada"],
      ["user-2", "Grace"],
      ["user-3", "Lin"],
    ] as const) {
      database
        .prepare(
          `INSERT INTO users (
            id, display_name, display_name_key, password_hash, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          displayName,
          displayName.toLowerCase(),
          "password-hash",
          CREATED_AT,
          CREATED_AT,
        );
    }

    expect(() =>
      database
        .prepare(
          `INSERT INTO friend_requests (
            user_a_id, user_b_id, requester_user_id, created_at
          ) VALUES (?, ?, ?, ?)`,
        )
        .run("user-2", "user-1", "user-2", CREATED_AT),
    ).toThrow(/CHECK constraint failed/);
    expect(() =>
      database
        .prepare(
          `INSERT INTO user_blocks (blocker_user_id, blocked_user_id, created_at)
           VALUES (?, ?, ?)`,
        )
        .run("user-1", "user-1", CREATED_AT),
    ).toThrow(/CHECK constraint failed/);

    database
      .prepare(
        `INSERT INTO friend_requests (
          user_a_id, user_b_id, requester_user_id, created_at
        ) VALUES (?, ?, ?, ?)`,
      )
      .run("user-1", "user-2", "user-1", CREATED_AT);
    database
      .prepare(
        `INSERT INTO friendships (user_a_id, user_b_id, created_at)
         VALUES (?, ?, ?)`,
      )
      .run("user-2", "user-3", CREATED_AT);
    database
      .prepare(
        `INSERT INTO user_blocks (blocker_user_id, blocked_user_id, created_at)
         VALUES (?, ?, ?)`,
      )
      .run("user-2", "user-3", CREATED_AT);
    database
      .prepare(
        `INSERT INTO party_invitations (
          id, party_code, inviter_user_id, recipient_user_id, intent, status,
          created_at, updated_at, expires_at, resolved_at
        ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, NULL)`,
      )
      .run(
        "invite-1",
        "PARTY-1",
        "user-2",
        "user-1",
        "play",
        CREATED_AT,
        CREATED_AT,
        "2026-08-03T00:05:00.000Z",
      );

    expect(() =>
      database
        .prepare(
          `INSERT INTO party_invitations (
            id, party_code, inviter_user_id, recipient_user_id, intent, status,
            created_at, updated_at, expires_at, resolved_at
          ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, NULL)`,
        )
        .run(
          "invite-2",
          "PARTY-1",
          "user-3",
          "user-1",
          "watch",
          CREATED_AT,
          CREATED_AT,
          "2026-08-03T00:05:00.000Z",
        ),
    ).toThrow(/UNIQUE constraint failed/);

    database.prepare("DELETE FROM users WHERE id = ?").run("user-2");

    expect(database.prepare("SELECT * FROM friend_requests").all()).toEqual([]);
    expect(database.prepare("SELECT * FROM friendships").all()).toEqual([]);
    expect(database.prepare("SELECT * FROM user_blocks").all()).toEqual([]);
    expect(database.prepare("SELECT * FROM party_invitations").all()).toEqual([]);
    expect(database.pragma("foreign_key_check")).toEqual([]);
  });
});
