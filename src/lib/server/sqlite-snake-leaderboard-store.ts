import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

import {
  createSubmissionResult,
  getSubmissionRank,
  LEADERBOARD_LIMIT,
  type LeaderboardStore,
  type NormalizedLeaderboardScoreSubmission,
} from "./snake-leaderboard-store";
import type { LeaderboardEntry } from "../snake-game-engine";

type SqliteDatabase = InstanceType<typeof Database>;

type CreateSqliteLeaderboardStoreOptions = {
  createId?: () => string;
  databasePath: string;
  now?: () => Date;
};

type InsertScoreParameters = {
  boardSize: number;
  createdAt: string;
  id: string;
  name: string;
  score: number;
};

type LeaderboardRow = {
  name: string;
  score: number;
};

const DEFAULT_SQLITE_FILENAME = "snake-leaderboard.sqlite";
const SCHEMA_VERSION = 1;

function prepareDatabaseDirectory(databasePath: string) {
  if (databasePath === ":memory:") {
    return databasePath;
  }

  const resolvedPath = resolve(databasePath);
  mkdirSync(dirname(resolvedPath), { recursive: true });

  return resolvedPath;
}

function initializeSchema(database: SqliteDatabase) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS snake_scores (
      id TEXT PRIMARY KEY,
      player_name TEXT NOT NULL,
      score INTEGER NOT NULL CHECK (score > 0),
      board_size INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS snake_scores_leaderboard_idx
      ON snake_scores (score DESC, created_at ASC, id ASC);

    PRAGMA user_version = ${SCHEMA_VERSION};
  `);
}

export class SqliteSnakeLeaderboardStore implements LeaderboardStore {
  readonly #createId: () => string;
  readonly #database: SqliteDatabase;
  readonly #insertScore;
  readonly #now: () => Date;
  readonly #selectTopScores;
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

    this.#selectTopScores = this.#database.prepare(`
      SELECT player_name AS name, score
      FROM snake_scores
      ORDER BY score DESC, created_at ASC, id ASC
      LIMIT @limit
    `);
    this.#insertScore = this.#database.prepare<InsertScoreParameters>(`
      INSERT INTO snake_scores (id, player_name, score, board_size, created_at)
      VALUES (@id, @name, @score, @boardSize, @createdAt)
    `);
    this.#submitScoreTransaction = this.#database.transaction(
      (submission: NormalizedLeaderboardScoreSubmission) => {
        const currentLeaderboard = this.listTopScoresSync();
        const rank = getSubmissionRank(submission.score, currentLeaderboard);

        if (rank === null) {
          return createSubmissionResult(currentLeaderboard, rank);
        }

        this.#insertScore.run({
          boardSize: submission.boardSize,
          createdAt: this.#now().toISOString(),
          id: this.#createId(),
          name: submission.name,
          score: submission.score,
        });

        return createSubmissionResult(this.listTopScoresSync(), rank);
      },
    );
  }

  close() {
    this.#database.close();
  }

  async listTopScores(limit = LEADERBOARD_LIMIT) {
    return this.listTopScoresSync(limit);
  }

  async submitScore(submission: NormalizedLeaderboardScoreSubmission) {
    return this.#submitScoreTransaction(submission);
  }

  private listTopScoresSync(limit = LEADERBOARD_LIMIT): LeaderboardEntry[] {
    const rows = this.#selectTopScores.all({ limit }) as LeaderboardRow[];

    return rows.map((row) => ({
      name: row.name,
      score: row.score,
    }));
  }
}

let defaultStore: LeaderboardStore | null = null;

export function getSnakeLeaderboardSqlitePath() {
  const configuredPath = process.env.SNAKE_LEADERBOARD_SQLITE_PATH?.trim();

  return configuredPath && configuredPath.length > 0
    ? configuredPath
    : join(process.cwd(), ".data", DEFAULT_SQLITE_FILENAME);
}

export function getSnakeLeaderboardStore() {
  defaultStore ??= new SqliteSnakeLeaderboardStore({
    databasePath: getSnakeLeaderboardSqlitePath(),
  });

  return defaultStore;
}
