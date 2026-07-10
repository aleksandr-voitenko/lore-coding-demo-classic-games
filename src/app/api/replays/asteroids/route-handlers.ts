import "server-only";

import {
  createGameReplayRouteHandlers,
  createGameReplayRunRouteHandlers,
  type UserSessionLookup,
} from "@/app/api/replays/route-handlers";
import {
  ASTEROIDS_REPLAY_GAME_ID,
  parseAsteroidsReplayPayload,
} from "@/lib/asteroids-replay";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";

export function createAsteroidsReplayRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "getReplay" | "saveReplay">,
  userStore: UserSessionLookup,
) {
  return createGameReplayRouteHandlers(replayStore, userStore, {
    gameId: ASTEROIDS_REPLAY_GAME_ID,
    parsePayload: parseAsteroidsReplayPayload,
    replayLabel: "Asteroids replay",
  });
}

export function createAsteroidsReplayRunRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "createReplayRun">,
  userStore?: UserSessionLookup,
) {
  return createGameReplayRunRouteHandlers(replayStore, userStore, {
    gameId: ASTEROIDS_REPLAY_GAME_ID,
  });
}
