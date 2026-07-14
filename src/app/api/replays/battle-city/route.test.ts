import { describe, expect, it, vi } from "vitest";

import {
  applyBattleCityReplayAdvanceFrame,
  applyBattleCityReplayEvent,
  createInitialBattleCityReplayGame,
  createBattleCityReplayLeaderboardKey,
  BATTLE_CITY_REPLAY_SCHEMA_VERSION,
  type BattleCityReplayEvent,
  type BattleCityReplayPayload,
} from "@/lib/battle-city-replay";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import type { SqliteUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

import { createBattleCityReplayRouteHandlers } from "./route-handlers";

function createReplayPayload(
  overrides: Partial<BattleCityReplayPayload> = {},
): BattleCityReplayPayload {
  const seed = 1_234;
  const initialTick = 12;
  const startingStage = 1;
  const startEvent: BattleCityReplayEvent = {
    elapsedMs: 0,
    seq: 0,
    tick: 0,
    type: "start",
  };
  const advanceEvent = {
    elapsedMs: 1,
    endElapsedMs: 1,
    frameCount: 1,
    input: {
      direction: null,
      fireRequested: false,
    },
    seq: 1,
    tick: 0,
    type: "advance",
  } as const;
  let frameCount = 0;
  let replayState = createInitialBattleCityReplayGame({
    initialTick,
    seed,
    startingStage,
  });

  replayState = applyBattleCityReplayEvent(replayState, startEvent);

  while (replayState.game.status !== "lost" && frameCount < 20_000) {
    replayState = applyBattleCityReplayAdvanceFrame(replayState, advanceEvent);
    frameCount += 1;
  }

  if (replayState.game.status !== "lost") {
    throw new Error("Expected the Tank Patrol route fixture to end lost.");
  }

  return {
    events: [
      startEvent,
      {
        ...advanceEvent,
        endElapsedMs: frameCount,
        frameCount,
      },
    ],
    finalBaseAlive: replayState.game.baseAlive,
    finalCycle: replayState.game.cycle === 2 ? 2 : 1,
    finalLives: replayState.game.lives,
    finalScore: replayState.game.score,
    finalStage: replayState.game.stage,
    finalStatus: replayState.game.status,
    finalTick: frameCount,
    gameId: "battle-city",
    initialTick,
    leaderboardKey: createBattleCityReplayLeaderboardKey(),
    runId: "run-1",
    schemaVersion: BATTLE_CITY_REPLAY_SCHEMA_VERSION,
    seed,
    startedAt: "2026-07-13T12:00:00.000Z",
    startingStage,
    ...overrides,
  };
}

describe("Tank Patrol replay route", () => {
  it("saves valid signed-in Tank Patrol replay uploads and labels save errors", async () => {
    const user = { displayName: "Ada", id: "user-1" };
    const replay = createReplayPayload();
    const replayStore = {
      getReplay: vi.fn(),
      saveReplay: vi
        .fn()
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({
          reason: "run-seed-mismatch",
          success: false,
        }),
    } as unknown as SqliteReplayStore;
    const userStore = {
      getUserBySessionToken: vi.fn(async () => user),
    } as unknown as SqliteUserProfileStore;
    const handlers = createBattleCityReplayRouteHandlers(replayStore, userStore);
    const saveResponse = await handlers.POST(
      new Request("http://localhost/api/replays/battle-city", {
        body: JSON.stringify(replay),
        headers: {
          cookie: "game_user_session=session-token",
        },
        method: "POST",
      }),
    );
    const mismatchResponse = await handlers.POST(
      new Request("http://localhost/api/replays/battle-city", {
        body: JSON.stringify(replay),
        headers: {
          cookie: "game_user_session=session-token",
        },
        method: "POST",
      }),
    );

    expect(saveResponse.status).toBe(201);
    expect(replayStore.saveReplay).toHaveBeenCalledWith(user, replay);
    await expect(saveResponse.json()).resolves.toEqual({ saved: true });
    expect(mismatchResponse.status).toBe(400);
    await expect(mismatchResponse.json()).resolves.toEqual({
      error: "Tank Patrol replay seed does not match the issued run.",
    });
  });

  it("downloads the signed-in user's latest Tank Patrol replay", async () => {
    const user = { displayName: "Ada", id: "user-1" };
    const replay = createReplayPayload();
    const replayStore = {
      getReplay: vi.fn(async () => replay),
      saveReplay: vi.fn(),
    } as unknown as SqliteReplayStore;
    const userStore = {
      getUserBySessionToken: vi.fn(async () => user),
    } as unknown as SqliteUserProfileStore;
    const handlers = createBattleCityReplayRouteHandlers(replayStore, userStore);
    const response = await handlers.GET(
      new Request("http://localhost/api/replays/battle-city", {
        headers: {
          cookie: "game_user_session=session-token",
        },
        method: "GET",
      }),
    );

    expect(response.status).toBe(200);
    expect(replayStore.getReplay).toHaveBeenCalledWith(
      user,
      "battle-city",
      expect.any(Function),
    );
    await expect(response.json()).resolves.toEqual({ replay });
  });
});
