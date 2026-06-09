import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  parseBaseGameReplayPayload,
  type BaseGameReplayPayload,
  type GameReplayRun,
} from "@/lib/game-replay";
import {
  SNAKE_REPLAY_SCHEMA_VERSION,
  type SnakeReplayPayload,
  type SnakeReplayRun,
} from "@/lib/snake-replay";

import {
  SqliteUserProfileStore,
  type UserAuthenticationResult,
  type UserSession,
} from "./sqlite-user-profile-store";
import { SqliteReplayStore } from "./sqlite-replay-store";

const START_TIME = Date.parse("2026-06-08T12:00:00.000Z");

function getSuccessfulSession(result: UserAuthenticationResult): UserSession {
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(`Expected successful auth result, got ${result.reason}.`);
  }

  return result.session;
}

function createReplayPayload(run: SnakeReplayRun, finalScore = 4): SnakeReplayPayload {
  return {
    events: [
      {
        seq: 0,
        tick: 0,
        type: "start",
      },
      {
        seq: 1,
        tick: 0,
        type: "advance",
      },
    ],
    finalLevel: 1,
    finalScore,
    finalStatus: "lost",
    finalTick: 1,
    gameId: "snake",
    leaderboardKey: "snake|mode=levels",
    runId: run.id,
    schemaVersion: SNAKE_REPLAY_SCHEMA_VERSION,
    seed: run.seed,
    startedAt: "2026-06-08T12:00:00.000Z",
  };
}

function createBaseReplayPayload<const GameId extends string>(
  run: GameReplayRun,
  gameId: GameId,
  finalScore = 4,
): BaseGameReplayPayload<GameId, 1> {
  return {
    finalScore,
    finalStatus: "lost",
    finalTick: 1,
    gameId,
    leaderboardKey: `${gameId}|mode=test`,
    runId: run.id,
    schemaVersion: 1,
    seed: run.seed,
    startedAt: "2026-06-08T12:00:00.000Z",
  };
}

function parseTetrisReplayPayload(value: unknown) {
  return parseBaseGameReplayPayload(value, {
    gameId: "tetris",
    replayLabel: "Tetris replay",
    schemaVersion: 1,
  });
}

function createStores() {
  const tempDir = mkdtempSync(join(tmpdir(), "snake-replay-"));
  const databasePath = join(tempDir, "replay.sqlite");
  let userId = 0;
  let sessionToken = 0;
  let replayRunId = 0;
  let seed = 1000;
  let currentTime = START_TIME;
  const userStore = new SqliteUserProfileStore({
    createId: () => `user-id-${++userId}`,
    createSessionToken: () => `token-${++sessionToken}`,
    databasePath,
    now: () => new Date(currentTime++),
  });
  const replayStore = new SqliteReplayStore({
    createId: () => `run-${++replayRunId}`,
    createSeed: () => ++seed,
    databasePath,
    now: () => new Date(currentTime++),
  });

  return {
    dispose() {
      replayStore.close();
      userStore.close();
      rmSync(tempDir, { force: true, recursive: true });
    },
    replayStore,
    userStore,
  };
}

describe("sqlite replay store", () => {
  const disposables: Array<() => void> = [];

  afterEach(() => {
    while (disposables.length > 0) {
      disposables.pop()?.();
    }
  });

  it("issues replay runs and stores the signed-in user's latest Snake replay", async () => {
    const { dispose, replayStore, userStore } = createStores();
    disposables.push(dispose);
    const session = getSuccessfulSession(await userStore.registerUser("Ada", "password123"));
    const user = session.user;

    await userStore.recordGameSession(user, {
      activeDurationMs: 15_000,
      finalScore: 4,
      gameId: "snake",
      leaderboardKey: "snake|mode=levels",
      result: "lost",
      sortDirection: "desc",
    });

    const firstRun = await replayStore.createSnakeReplayRun(user);
    const secondRun = await replayStore.createSnakeReplayRun(user);

    await expect(replayStore.saveSnakeReplay(user, createReplayPayload(firstRun, 4))).resolves.toEqual({
      success: true,
    });
    await expect(replayStore.getSnakeReplay(user)).resolves.toMatchObject({
      finalScore: 4,
      runId: "run-1",
    });

    await expect(replayStore.saveSnakeReplay(user, createReplayPayload(secondRun, 9))).resolves.toEqual({
      success: true,
    });
    await expect(replayStore.getSnakeReplay(user)).resolves.toMatchObject({
      finalScore: 9,
      runId: "run-2",
    });
    await expect(userStore.getUserProfile(user)).resolves.toMatchObject({
      games: [
        {
          gameId: "snake",
          hasLastReplay: true,
        },
      ],
    });
  });

  it("stores and reads latest replays through the generic game replay methods", async () => {
    const { dispose, replayStore, userStore } = createStores();
    disposables.push(dispose);
    const session = getSuccessfulSession(await userStore.registerUser("Katherine", "password123"));
    const user = session.user;
    const snakeRun = await replayStore.createSnakeReplayRun(user);
    const tetrisRun = await replayStore.createReplayRun("tetris", user);

    await expect(replayStore.saveSnakeReplay(user, createReplayPayload(snakeRun, 5))).resolves.toEqual({
      success: true,
    });
    await expect(
      replayStore.saveReplay(user, createBaseReplayPayload(tetrisRun, "tetris", 12)),
    ).resolves.toEqual({
      success: true,
    });

    await expect(replayStore.getSnakeReplay(user)).resolves.toMatchObject({
      finalScore: 5,
      gameId: "snake",
    });
    await expect(
      replayStore.getReplay(user, "tetris", parseTetrisReplayPayload),
    ).resolves.toMatchObject({
      finalScore: 12,
      gameId: "tetris",
    });
  });

  it("rejects replay uploads that do not match an issued run", async () => {
    const { dispose, replayStore, userStore } = createStores();
    disposables.push(dispose);
    const session = getSuccessfulSession(await userStore.registerUser("Grace", "password123"));
    const user = session.user;
    const run = await replayStore.createSnakeReplayRun(user);

    await expect(
      replayStore.saveSnakeReplay(user, {
        ...createReplayPayload(run),
        seed: run.seed + 1,
      }),
    ).resolves.toEqual({
      reason: "run-seed-mismatch",
      success: false,
    });
    await expect(
      replayStore.saveSnakeReplay(user, {
        ...createReplayPayload(run),
        runId: "missing-run",
      }),
    ).resolves.toEqual({
      reason: "run-not-found",
      success: false,
    });

    const tetrisRun = await replayStore.createReplayRun("tetris", user);

    await expect(
      replayStore.saveReplay(user, createBaseReplayPayload(tetrisRun, "breakout")),
    ).resolves.toEqual({
      reason: "unsupported-game",
      success: false,
    });
  });
});
