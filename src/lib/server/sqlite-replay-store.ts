import "server-only";

import Database from "better-sqlite3";
import { randomInt, randomUUID } from "node:crypto";

import {
  MAX_GAME_REPLAY_SEED,
  type BaseGameReplayPayload,
  type GameReplayPayloadParser,
  type GameReplayRun,
} from "@/lib/game-replay";
import {
  SNAKE_REPLAY_GAME_ID,
  parseSnakeReplayPayload,
  type SnakeReplayPayload,
  type SnakeReplayRun,
} from "@/lib/snake-replay";
import type { AuthenticatedUser } from "@/lib/user-profile";

import {
  getDefaultSqlitePath,
  initializeAppSchema,
  prepareSqliteDatabasePath,
  type SqliteDatabase,
} from "./sqlite-app-schema";

type CreateSqliteReplayStoreOptions = {
  createId?: () => string;
  createSeed?: () => number;
  databasePath: string;
  now?: () => Date;
};

type InsertReplayRunParameters = {
  createdAt: string;
  gameId: string;
  id: string;
  seed: number;
  userId: string | null;
};

type UpsertReplayParameters = {
  createdAt: string;
  finalScore: number;
  finalStatus: string;
  finalTick: number;
  gameId: string;
  leaderboardKey: string;
  payloadJson: string;
  runId: string;
  updatedAt: string;
  userId: string;
};

type ReplayRunRow = {
  gameId: string;
  id: string;
  seed: number;
  userId: string | null;
};

type ReplayPayloadRow = {
  payloadJson: string;
};

export type SaveReplayResult =
  | {
      success: true;
    }
  | {
      reason:
        | "run-not-found"
        | "run-seed-mismatch"
        | "run-user-mismatch"
        | "unsupported-game";
      success: false;
    };

function createDefaultSeed() {
  return randomInt(1, MAX_GAME_REPLAY_SEED + 1);
}

export class SqliteReplayStore {
  readonly #createId: () => string;
  readonly #createSeed: () => number;
  readonly #database: SqliteDatabase;
  readonly #insertReplayRun;
  readonly #now: () => Date;
  readonly #selectReplayRunById;
  readonly #selectReplayPayload;
  readonly #upsertReplay;

  constructor({
    createId = randomUUID,
    createSeed = createDefaultSeed,
    databasePath,
    now = () => new Date(),
  }: CreateSqliteReplayStoreOptions) {
    this.#createId = createId;
    this.#createSeed = createSeed;
    this.#database = new Database(prepareSqliteDatabasePath(databasePath));
    this.#now = now;

    initializeAppSchema(this.#database);

    this.#insertReplayRun = this.#database.prepare<InsertReplayRunParameters>(`
      INSERT INTO game_replay_runs (
        id,
        user_id,
        game_id,
        seed,
        created_at
      )
      VALUES (
        @id,
        @userId,
        @gameId,
        @seed,
        @createdAt
      )
      RETURNING id, seed
    `);
    this.#selectReplayRunById = this.#database.prepare<{ runId: string }>(`
      SELECT
        id,
        user_id AS userId,
        game_id AS gameId,
        seed
      FROM game_replay_runs
      WHERE id = @runId
    `);
    this.#upsertReplay = this.#database.prepare<UpsertReplayParameters>(`
      INSERT INTO game_replays (
        user_id,
        game_id,
        run_id,
        leaderboard_key,
        final_score,
        final_status,
        final_tick,
        payload_json,
        created_at,
        updated_at
      )
      VALUES (
        @userId,
        @gameId,
        @runId,
        @leaderboardKey,
        @finalScore,
        @finalStatus,
        @finalTick,
        @payloadJson,
        @createdAt,
        @updatedAt
      )
      ON CONFLICT(user_id, game_id) DO UPDATE SET
        run_id = excluded.run_id,
        leaderboard_key = excluded.leaderboard_key,
        final_score = excluded.final_score,
        final_status = excluded.final_status,
        final_tick = excluded.final_tick,
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `);
    this.#selectReplayPayload = this.#database.prepare<{ gameId: string; userId: string }>(`
      SELECT payload_json AS payloadJson
      FROM game_replays
      WHERE user_id = @userId
        AND game_id = @gameId
    `);
  }

  close() {
    this.#database.close();
  }

  async createReplayRun(
    gameId: string,
    user: AuthenticatedUser | null,
  ): Promise<GameReplayRun> {
    const run = this.#insertReplayRun.get({
      createdAt: this.#now().toISOString(),
      gameId,
      id: this.#createId(),
      seed: this.#createSeed(),
      userId: user?.id ?? null,
    }) as GameReplayRun;

    return run;
  }

  async createSnakeReplayRun(user: AuthenticatedUser | null): Promise<SnakeReplayRun> {
    return this.createReplayRun(SNAKE_REPLAY_GAME_ID, user);
  }

  async saveReplay(
    user: AuthenticatedUser,
    payload: BaseGameReplayPayload,
  ): Promise<SaveReplayResult> {
    const run = this.#selectReplayRunById.get({
      runId: payload.runId,
    }) as ReplayRunRow | undefined;

    if (run === undefined) {
      return {
        reason: "run-not-found",
        success: false,
      };
    }

    if (run.gameId !== payload.gameId) {
      return {
        reason: "unsupported-game",
        success: false,
      };
    }

    if (run.seed !== payload.seed) {
      return {
        reason: "run-seed-mismatch",
        success: false,
      };
    }

    if (run.userId !== null && run.userId !== user.id) {
      return {
        reason: "run-user-mismatch",
        success: false,
      };
    }

    const timestamp = this.#now().toISOString();

    this.#upsertReplay.run({
      createdAt: timestamp,
      finalScore: payload.finalScore,
      finalStatus: payload.finalStatus,
      finalTick: payload.finalTick,
      gameId: payload.gameId,
      leaderboardKey: payload.leaderboardKey,
      payloadJson: JSON.stringify(payload),
      runId: payload.runId,
      updatedAt: timestamp,
      userId: user.id,
    });

    return {
      success: true,
    };
  }

  async saveSnakeReplay(
    user: AuthenticatedUser,
    payload: SnakeReplayPayload,
  ): Promise<SaveReplayResult> {
    return this.saveReplay(user, payload);
  }

  async getReplay<Payload>(
    user: AuthenticatedUser,
    gameId: string,
    parsePayload: GameReplayPayloadParser<Payload>,
  ) {
    const row = this.#selectReplayPayload.get({
      gameId,
      userId: user.id,
    }) as ReplayPayloadRow | undefined;

    if (row === undefined) {
      return null;
    }

    try {
      const parsedReplay = parsePayload(JSON.parse(row.payloadJson));

      return parsedReplay.success ? parsedReplay.payload : null;
    } catch {
      return null;
    }
  }

  async getSnakeReplay(user: AuthenticatedUser) {
    return this.getReplay(user, SNAKE_REPLAY_GAME_ID, parseSnakeReplayPayload);
  }
}

let defaultStore: SqliteReplayStore | null = null;

export function getReplaySqlitePath() {
  const configuredPath =
    process.env.GAME_LEADERBOARD_SQLITE_PATH?.trim() ||
    process.env.SNAKE_LEADERBOARD_SQLITE_PATH?.trim();

  return configuredPath && configuredPath.length > 0 ? configuredPath : getDefaultSqlitePath();
}

export function getReplayStore() {
  defaultStore ??= new SqliteReplayStore({
    databasePath: getReplaySqlitePath(),
  });

  return defaultStore;
}
