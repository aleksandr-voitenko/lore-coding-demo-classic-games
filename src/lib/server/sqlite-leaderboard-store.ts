import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import type { LeaderboardEntry, LeaderboardSortDirection } from "../leaderboard";
import {
  createSubmissionResult,
  getSubmissionRank,
  LEADERBOARD_LIMIT,
  type LeaderboardStore,
  type NormalizedLeaderboardScoreSubmission,
} from "./leaderboard-store";

type SqliteDatabase = InstanceType<typeof Database>;

type CreateSqliteLeaderboardStoreOptions = {
  createId?: () => string;
  databasePath: string;
  now?: () => Date;
};

type InsertScoreParameters = {
  createdAt: string;
  id: string;
  leaderboardKey: string;
  name: string;
  score: number;
};

type SelectTopScoresParameters = {
  leaderboardKey: string;
  limit: number;
};

type LeaderboardRow = {
  name: string;
  score: number;
};

const DEFAULT_SQLITE_FILENAME = "snake-leaderboard.sqlite";
const SCHEMA_VERSION = 2;

function prepareDatabaseDirectory(databasePath: string) {
  if (databasePath === ":memory:") {
    return databasePath;
  }

  const resolvedPath = resolve(databasePath);
  mkdirSync(dirname(resolvedPath), { recursive: true });

  return resolvedPath;
}

function hasTable(database: SqliteDatabase, tableName: string) {
  const row = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName);

  return row !== undefined;
}

function initializeSchema(database: SqliteDatabase) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS leaderboard_scores (
      id TEXT PRIMARY KEY,
      leaderboard_key TEXT NOT NULL,
      player_name TEXT NOT NULL,
      score INTEGER NOT NULL CHECK (score > 0),
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS leaderboard_scores_desc_idx
      ON leaderboard_scores (leaderboard_key, score DESC, created_at ASC, id ASC);

    CREATE INDEX IF NOT EXISTS leaderboard_scores_asc_idx
      ON leaderboard_scores (leaderboard_key, score ASC, created_at ASC, id ASC);

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

export class SqliteLeaderboardStore implements LeaderboardStore {
  readonly #createId: () => string;
  readonly #database: SqliteDatabase;
  readonly #insertScore;
  readonly #now: () => Date;
  readonly #selectTopScoresAsc;
  readonly #selectTopScoresDesc;
  readonly #submitScoreTransaction;

  constructor({
    createId = randomUUID,
    databasePath,
    now = () => new Date(),
  }: CreateSqliteLeaderboardStoreOptions) {
    this.#createId = createId;
    this.#database = new Database(prepareDatabaseDirectory(databasePath));
    this.#now = now;

    initializeSchema(this.#database);

    this.#selectTopScoresDesc = this.#database.prepare<SelectTopScoresParameters>(`
      SELECT player_name AS name, score
      FROM leaderboard_scores
      WHERE leaderboard_key = @leaderboardKey
      ORDER BY score DESC, created_at ASC, id ASC
      LIMIT @limit
    `);
    this.#selectTopScoresAsc = this.#database.prepare<SelectTopScoresParameters>(`
      SELECT player_name AS name, score
      FROM leaderboard_scores
      WHERE leaderboard_key = @leaderboardKey
      ORDER BY score ASC, created_at ASC, id ASC
      LIMIT @limit
    `);
    this.#insertScore = this.#database.prepare<InsertScoreParameters>(`
      INSERT INTO leaderboard_scores (id, leaderboard_key, player_name, score, created_at)
      VALUES (@id, @leaderboardKey, @name, @score, @createdAt)
    `);
    this.#submitScoreTransaction = this.#database.transaction(
      (submission: NormalizedLeaderboardScoreSubmission) => {
        const currentLeaderboard = this.listTopScoresSync(
          submission.leaderboardKey,
          submission.sortDirection,
        );
        const rank = getSubmissionRank(
          submission.score,
          currentLeaderboard,
          submission.sortDirection,
        );

        if (rank === null) {
          return createSubmissionResult(currentLeaderboard, rank);
        }

        this.#insertScore.run({
          createdAt: this.#now().toISOString(),
          id: this.#createId(),
          leaderboardKey: submission.leaderboardKey,
          name: submission.name,
          score: submission.score,
        });

        return createSubmissionResult(
          this.listTopScoresSync(submission.leaderboardKey, submission.sortDirection),
          rank,
        );
      },
    );
  }

  close() {
    this.#database.close();
  }

  async listTopScores(
    leaderboardKey: string,
    sortDirection: LeaderboardSortDirection = "desc",
    limit = LEADERBOARD_LIMIT,
  ) {
    return this.listTopScoresSync(leaderboardKey, sortDirection, limit);
  }

  async submitScore(submission: NormalizedLeaderboardScoreSubmission) {
    return this.#submitScoreTransaction(submission);
  }

  private listTopScoresSync(
    leaderboardKey: string,
    sortDirection: LeaderboardSortDirection = "desc",
    limit = LEADERBOARD_LIMIT,
  ): LeaderboardEntry[] {
    const statement =
      sortDirection === "asc" ? this.#selectTopScoresAsc : this.#selectTopScoresDesc;
    const rows = statement.all({ leaderboardKey, limit }) as LeaderboardRow[];

    return rows.map((row) => ({
      name: row.name,
      score: row.score,
    }));
  }
}

let defaultStore: LeaderboardStore | null = null;

export function getLeaderboardSqlitePath() {
  const configuredPath =
    process.env.GAME_LEADERBOARD_SQLITE_PATH?.trim() ||
    process.env.SNAKE_LEADERBOARD_SQLITE_PATH?.trim();

  return configuredPath && configuredPath.length > 0
    ? configuredPath
    : join(process.cwd(), ".data", DEFAULT_SQLITE_FILENAME);
}

export function getLeaderboardStore() {
  defaultStore ??= new SqliteLeaderboardStore({
    databasePath: getLeaderboardSqlitePath(),
  });

  return defaultStore;
}
