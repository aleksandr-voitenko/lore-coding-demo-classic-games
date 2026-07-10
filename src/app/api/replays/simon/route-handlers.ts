import "server-only";

import {
  createGameReplayRouteHandlers,
  createGameReplayRunRouteHandlers,
  type UserSessionLookup,
} from "@/app/api/replays/route-handlers";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import {
  parseSimonReplayPayload,
  SIMON_REPLAY_GAME_ID,
} from "@/lib/simon-replay";

export function createSimonReplayRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "getReplay" | "saveReplay">,
  userStore: UserSessionLookup,
) {
  return createGameReplayRouteHandlers(replayStore, userStore, {
    gameId: SIMON_REPLAY_GAME_ID,
    parsePayload: parseSimonReplayPayload,
    replayLabel: "Simon replay",
  });
}

export function createSimonReplayRunRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "createReplayRun">,
  userStore?: UserSessionLookup,
) {
  return createGameReplayRunRouteHandlers(replayStore, userStore, {
    gameId: SIMON_REPLAY_GAME_ID,
  });
}
