import Database from "better-sqlite3";
import { createHash, randomBytes, randomUUID } from "node:crypto";

import {
  createUserDisplayNameKey,
  normalizeUserDisplayName,
  type AuthenticatedUser,
  type GameSessionResult,
  type GameSessionSubmission,
  type UserProfileGameStat,
  type UserProfileSummary,
} from "../user-profile";
import {
  getDefaultSqlitePath,
  initializeAppSchema,
  prepareSqliteDatabasePath,
  type SqliteDatabase,
} from "./sqlite-app-schema";

type CreateSqliteUserProfileStoreOptions = {
  createId?: () => string;
  createSessionToken?: () => string;
  databasePath: string;
  now?: () => Date;
  sessionTtlMs?: number;
};

type UpsertUserParameters = {
  createdAt: string;
  displayName: string;
  displayNameKey: string;
  id: string;
  updatedAt: string;
};

type InsertUserSessionParameters = {
  createdAt: string;
  expiresAt: string;
  tokenHash: string;
  userId: string;
};

type SelectUserBySessionTokenParameters = {
  now: string;
  tokenHash: string;
};

type InsertGameSessionParameters = {
  activeDurationMs: number;
  createdAt: string;
  endedAt: string;
  finalScore: number;
  gameId: string;
  id: string;
  leaderboardKey: string;
  result: GameSessionResult;
  sortDirection: string;
  startedAt: string;
  updatedAt: string;
  userId: string;
};

type UserRow = {
  displayName: string;
  id: string;
};

type ProfileTotalsRow = {
  totalActiveDurationMs: number | null;
  totalSessionsPlayed: number;
};

type ProfileGameStatRow = {
  abandons: number;
  bestScore: number | null;
  fastestWinScore: number | null;
  gameId: string;
  lastPlayedAt: string;
  losses: number;
  sessionsPlayed: number;
  totalActiveDurationMs: number | null;
  wins: number;
};

const DEFAULT_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 60;

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createDefaultSessionToken() {
  return randomBytes(32).toString("base64url");
}

export class SqliteUserProfileStore {
  readonly #createId: () => string;
  readonly #createSessionToken: () => string;
  readonly #database: SqliteDatabase;
  readonly #deleteUserSession;
  readonly #insertGameSession;
  readonly #insertUserSession;
  readonly #now: () => Date;
  readonly #selectProfileGameStats;
  readonly #selectProfileTotals;
  readonly #selectUserById;
  readonly #selectUserBySessionToken;
  readonly #sessionTtlMs: number;
  readonly #upsertUser;

  constructor({
    createId = randomUUID,
    createSessionToken = createDefaultSessionToken,
    databasePath,
    now = () => new Date(),
    sessionTtlMs = DEFAULT_SESSION_TTL_MS,
  }: CreateSqliteUserProfileStoreOptions) {
    this.#createId = createId;
    this.#createSessionToken = createSessionToken;
    this.#database = new Database(prepareSqliteDatabasePath(databasePath));
    this.#now = now;
    this.#sessionTtlMs = sessionTtlMs;

    initializeAppSchema(this.#database);

    this.#upsertUser = this.#database.prepare<UpsertUserParameters>(`
      INSERT INTO users (id, display_name, display_name_key, created_at, updated_at)
      VALUES (@id, @displayName, @displayNameKey, @createdAt, @updatedAt)
      ON CONFLICT(display_name_key) DO UPDATE SET
        display_name = excluded.display_name,
        updated_at = excluded.updated_at
      RETURNING id, display_name AS displayName
    `);
    this.#insertUserSession = this.#database.prepare<InsertUserSessionParameters>(`
      INSERT INTO user_sessions (token_hash, user_id, created_at, expires_at)
      VALUES (@tokenHash, @userId, @createdAt, @expiresAt)
    `);
    this.#selectUserBySessionToken =
      this.#database.prepare<SelectUserBySessionTokenParameters>(`
        SELECT users.id, users.display_name AS displayName
        FROM user_sessions
        INNER JOIN users ON users.id = user_sessions.user_id
        WHERE user_sessions.token_hash = @tokenHash
          AND user_sessions.expires_at > @now
      `);
    this.#deleteUserSession = this.#database.prepare<{ tokenHash: string }>(`
      DELETE FROM user_sessions
      WHERE token_hash = @tokenHash
    `);
    this.#selectUserById = this.#database.prepare<{ userId: string }>(`
      SELECT id, display_name AS displayName
      FROM users
      WHERE id = @userId
    `);
    this.#insertGameSession = this.#database.prepare<InsertGameSessionParameters>(`
      INSERT INTO game_sessions (
        id,
        user_id,
        game_id,
        leaderboard_key,
        active_duration_ms,
        final_score,
        result,
        sort_direction,
        started_at,
        ended_at,
        created_at,
        updated_at
      )
      VALUES (
        @id,
        @userId,
        @gameId,
        @leaderboardKey,
        @activeDurationMs,
        @finalScore,
        @result,
        @sortDirection,
        @startedAt,
        @endedAt,
        @createdAt,
        @updatedAt
      )
    `);
    this.#selectProfileTotals = this.#database.prepare<{ userId: string }>(`
      SELECT
        COUNT(*) AS totalSessionsPlayed,
        COALESCE(SUM(active_duration_ms), 0) AS totalActiveDurationMs
      FROM game_sessions
      WHERE user_id = @userId
    `);
    this.#selectProfileGameStats = this.#database.prepare<{ userId: string }>(`
      SELECT
        game_id AS gameId,
        COUNT(*) AS sessionsPlayed,
        COALESCE(SUM(active_duration_ms), 0) AS totalActiveDurationMs,
        SUM(CASE WHEN result = 'won' THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN result = 'lost' THEN 1 ELSE 0 END) AS losses,
        SUM(CASE WHEN result = 'abandoned' THEN 1 ELSE 0 END) AS abandons,
        MAX(CASE
          WHEN result != 'abandoned' AND sort_direction = 'desc' THEN final_score
          ELSE NULL
        END) AS bestScore,
        MIN(CASE
          WHEN result = 'won' AND sort_direction = 'asc' THEN final_score
          ELSE NULL
        END) AS fastestWinScore,
        MAX(ended_at) AS lastPlayedAt
      FROM game_sessions
      WHERE user_id = @userId
      GROUP BY game_id
      ORDER BY totalActiveDurationMs DESC, game_id ASC
    `);
  }

  close() {
    this.#database.close();
  }

  async createUserSession(displayNameValue: unknown) {
    const displayName = normalizeUserDisplayName(displayNameValue);

    if (displayName.length === 0) {
      return null;
    }

    const now = this.#now();
    const timestamp = now.toISOString();
    const user = this.#upsertUser.get({
      createdAt: timestamp,
      displayName,
      displayNameKey: createUserDisplayNameKey(displayName),
      id: this.#createId(),
      updatedAt: timestamp,
    }) as UserRow;
    const sessionToken = this.#createSessionToken();
    const expiresAt = new Date(now.getTime() + this.#sessionTtlMs).toISOString();

    this.#insertUserSession.run({
      createdAt: timestamp,
      expiresAt,
      tokenHash: hashSessionToken(sessionToken),
      userId: user.id,
    });

    return {
      expiresAt,
      sessionToken,
      user,
    };
  }

  async deleteUserSession(sessionToken: string | null) {
    if (sessionToken === null) {
      return;
    }

    this.#deleteUserSession.run({ tokenHash: hashSessionToken(sessionToken) });
  }

  async getUserById(userId: string) {
    return (this.#selectUserById.get({ userId }) as UserRow | undefined) ?? null;
  }

  async getUserBySessionToken(sessionToken: string | null) {
    if (sessionToken === null) {
      return null;
    }

    return (
      (this.#selectUserBySessionToken.get({
        now: this.#now().toISOString(),
        tokenHash: hashSessionToken(sessionToken),
      }) as UserRow | undefined) ?? null
    );
  }

  async getUserProfile(user: AuthenticatedUser): Promise<UserProfileSummary> {
    const totals = this.#selectProfileTotals.get({ userId: user.id }) as ProfileTotalsRow;
    const gameRows = this.#selectProfileGameStats.all({
      userId: user.id,
    }) as ProfileGameStatRow[];

    return {
      games: gameRows.map((row): UserProfileGameStat => ({
        abandons: row.abandons,
        bestScore: row.bestScore,
        fastestWinScore: row.fastestWinScore,
        gameId: row.gameId,
        lastPlayedAt: row.lastPlayedAt,
        losses: row.losses,
        sessionsPlayed: row.sessionsPlayed,
        totalActiveDurationMs: row.totalActiveDurationMs ?? 0,
        wins: row.wins,
      })),
      totalActiveDurationMs: totals.totalActiveDurationMs ?? 0,
      totalSessionsPlayed: totals.totalSessionsPlayed,
      user,
    };
  }

  async recordGameSession(user: AuthenticatedUser, submission: Required<GameSessionSubmission>) {
    const endedAt = this.#now();
    const activeDurationMs = Math.max(0, submission.activeDurationMs);
    const startedAt = new Date(endedAt.getTime() - activeDurationMs);
    const timestamp = endedAt.toISOString();
    const id = this.#createId();

    this.#insertGameSession.run({
      activeDurationMs,
      createdAt: timestamp,
      endedAt: timestamp,
      finalScore: submission.finalScore,
      gameId: submission.gameId,
      id,
      leaderboardKey: submission.leaderboardKey,
      result: submission.result,
      sortDirection: submission.sortDirection,
      startedAt: startedAt.toISOString(),
      updatedAt: timestamp,
      userId: user.id,
    });

    return { id };
  }
}

let defaultStore: SqliteUserProfileStore | null = null;

export function getUserProfileSqlitePath() {
  const configuredPath =
    process.env.GAME_LEADERBOARD_SQLITE_PATH?.trim() ||
    process.env.SNAKE_LEADERBOARD_SQLITE_PATH?.trim();

  return configuredPath && configuredPath.length > 0 ? configuredPath : getDefaultSqlitePath();
}

export function getUserProfileStore() {
  defaultStore ??= new SqliteUserProfileStore({
    databasePath: getUserProfileSqlitePath(),
  });

  return defaultStore;
}
