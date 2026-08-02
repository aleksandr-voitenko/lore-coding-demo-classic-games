import "server-only";

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export type SqliteDatabase = InstanceType<typeof Database>;

export const DEFAULT_SQLITE_FILENAME = "snake-leaderboard.sqlite";
export const SCHEMA_VERSION = 6;

export function prepareSqliteDatabasePath(databasePath: string) {
  if (databasePath === ":memory:") {
    return databasePath;
  }

  const resolvedPath = resolve(databasePath);
  mkdirSync(dirname(resolvedPath), { recursive: true });

  return resolvedPath;
}

export function getDefaultSqlitePath(cwd = process.cwd()) {
  return join(cwd, ".data", DEFAULT_SQLITE_FILENAME);
}

function hasTable(database: SqliteDatabase, tableName: string) {
  const row = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName);

  return row !== undefined;
}

function hasColumn(database: SqliteDatabase, tableName: string, columnName: string) {
  const rows = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
    name: string;
  }>;

  return rows.some((row) => row.name === columnName);
}

function addColumnIfMissing(database: SqliteDatabase, tableName: string, definition: string) {
  const columnName = definition.split(/\s+/)[0];

  if (!hasColumn(database, tableName, columnName)) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
  }
}

export function initializeAppSchema(database: SqliteDatabase) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      display_name_key TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS user_sessions_user_idx
      ON user_sessions (user_id, expires_at);

    CREATE TABLE IF NOT EXISTS friend_requests (
      user_a_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_b_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      requester_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_a_id, user_b_id),
      CHECK (user_a_id < user_b_id),
      CHECK (requester_user_id IN (user_a_id, user_b_id))
    );

    CREATE INDEX IF NOT EXISTS friend_requests_requester_idx
      ON friend_requests (requester_user_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS friend_requests_user_b_idx
      ON friend_requests (user_b_id, user_a_id);

    CREATE TABLE IF NOT EXISTS friendships (
      user_a_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_b_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_a_id, user_b_id),
      CHECK (user_a_id < user_b_id)
    );

    CREATE INDEX IF NOT EXISTS friendships_user_b_idx
      ON friendships (user_b_id, user_a_id);

    CREATE TABLE IF NOT EXISTS user_blocks (
      blocker_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (blocker_user_id, blocked_user_id),
      CHECK (blocker_user_id <> blocked_user_id)
    );

    CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx
      ON user_blocks (blocked_user_id, blocker_user_id);

    CREATE TABLE IF NOT EXISTS party_invitations (
      id TEXT PRIMARY KEY,
      party_code TEXT NOT NULL,
      inviter_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      intent TEXT NOT NULL CHECK (intent IN ('play', 'watch')),
      status TEXT NOT NULL CHECK (
        status IN ('pending', 'accepted', 'declined', 'canceled', 'revoked', 'expired')
      ),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      resolved_at TEXT,
      CHECK (inviter_user_id <> recipient_user_id),
      CHECK (expires_at > created_at),
      CHECK (
        (status = 'pending' AND resolved_at IS NULL) OR
        (status <> 'pending' AND resolved_at IS NOT NULL)
      )
    );

    CREATE UNIQUE INDEX IF NOT EXISTS party_invitations_pending_party_recipient_idx
      ON party_invitations (party_code, recipient_user_id)
      WHERE status = 'pending';

    CREATE INDEX IF NOT EXISTS party_invitations_recipient_idx
      ON party_invitations (recipient_user_id, status, created_at DESC);

    CREATE INDEX IF NOT EXISTS party_invitations_inviter_idx
      ON party_invitations (inviter_user_id, status, created_at DESC);

    CREATE INDEX IF NOT EXISTS party_invitations_expiry_idx
      ON party_invitations (status, expires_at);

    CREATE TABLE IF NOT EXISTS game_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game_id TEXT NOT NULL,
      leaderboard_key TEXT NOT NULL,
      active_duration_ms INTEGER NOT NULL CHECK (active_duration_ms >= 0),
      final_score INTEGER NOT NULL CHECK (final_score >= 0),
      result TEXT NOT NULL CHECK (result IN ('won', 'lost', 'abandoned')),
      sort_direction TEXT NOT NULL CHECK (sort_direction IN ('asc', 'desc')),
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS game_sessions_user_summary_idx
      ON game_sessions (user_id, game_id, ended_at DESC);

    CREATE INDEX IF NOT EXISTS game_sessions_leaderboard_idx
      ON game_sessions (leaderboard_key, user_id);

    CREATE TABLE IF NOT EXISTS leaderboard_scores (
      id TEXT PRIMARY KEY,
      leaderboard_key TEXT NOT NULL,
      player_name TEXT NOT NULL,
      score INTEGER NOT NULL CHECK (score > 0),
      created_at TEXT NOT NULL,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      game_session_id TEXT REFERENCES game_sessions(id) ON DELETE SET NULL
    );
  `);

  addColumnIfMissing(database, "users", "password_hash TEXT");
  addColumnIfMissing(database, "leaderboard_scores", "user_id TEXT");
  addColumnIfMissing(database, "leaderboard_scores", "game_session_id TEXT");

  database.exec(`
    CREATE INDEX IF NOT EXISTS leaderboard_scores_desc_idx
      ON leaderboard_scores (leaderboard_key, score DESC, created_at ASC, id ASC);

    CREATE INDEX IF NOT EXISTS leaderboard_scores_asc_idx
      ON leaderboard_scores (leaderboard_key, score ASC, created_at ASC, id ASC);

    CREATE INDEX IF NOT EXISTS leaderboard_scores_user_idx
      ON leaderboard_scores (user_id, leaderboard_key);

    CREATE TABLE IF NOT EXISTS game_replay_runs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      game_id TEXT NOT NULL,
      seed INTEGER NOT NULL CHECK (seed > 0),
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS game_replay_runs_user_idx
      ON game_replay_runs (user_id, game_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS game_replays (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game_id TEXT NOT NULL,
      run_id TEXT NOT NULL REFERENCES game_replay_runs(id),
      leaderboard_key TEXT NOT NULL,
      final_score INTEGER NOT NULL CHECK (final_score >= 0),
      final_status TEXT NOT NULL CHECK (final_status IN ('lost', 'won')),
      final_tick INTEGER NOT NULL CHECK (final_tick >= 0),
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, game_id)
    );

    PRAGMA user_version = ${SCHEMA_VERSION};
  `);

  if (hasTable(database, "snake_scores")) {
    database.exec(`
      INSERT OR IGNORE INTO leaderboard_scores (
        id,
        leaderboard_key,
        player_name,
        score,
        created_at
      )
      SELECT
        id,
        'snake|board=' || board_size,
        player_name,
        score,
        created_at
      FROM snake_scores;
    `);
  }
}
