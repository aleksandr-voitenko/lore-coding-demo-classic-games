import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

import type { LeaderboardEntry, LeaderboardSortDirection } from "../leaderboard";
import {
  createSubmissionResult,
  getSubmissionRank,
  LEADERBOARD_LIMIT,
  type LeaderboardStore,
  type NormalizedLeaderboardScoreSubmission,
} from "./leaderboard-store";
import {
  getDefaultSqlitePath,
  initializeAppSchema,
  prepareSqliteDatabasePath,
  type SqliteDatabase,
} from "./sqlite-app-schema";

type CreateSqliteLeaderboardStoreOptions = {
  createId?: () => string;
  databasePath: string;
  now?: () => Date;
};

type InsertScoreParameters = {
  createdAt: string;
  gameSessionId: string | null;
  id: string;
  leaderboardKey: string;
  name: string;
  score: number;
  userId: string | null;
};

type SelectTopScoresParameters = {
  leaderboardKey: string;
  limit: number;
};

type LeaderboardRow = {
  name: string;
  score: number;
};

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
    this.#database = new Database(prepareSqliteDatabasePath(databasePath));
    this.#now = now;

    initializeAppSchema(this.#database);

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
      INSERT INTO leaderboard_scores (
        id,
        leaderboard_key,
        player_name,
        score,
        created_at,
        user_id,
        game_session_id
      )
      VALUES (
        @id,
        @leaderboardKey,
        @name,
        @score,
        @createdAt,
        @userId,
        @gameSessionId
      )
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
          gameSessionId: submission.gameSessionId ?? null,
          id: this.#createId(),
          leaderboardKey: submission.leaderboardKey,
          name: submission.name,
          score: submission.score,
          userId: submission.userId ?? null,
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
    : getDefaultSqlitePath();
}

export function getLeaderboardStore() {
  defaultStore ??= new SqliteLeaderboardStore({
    databasePath: getLeaderboardSqlitePath(),
  });

  return defaultStore;
}
