import "server-only";

import {
  createGameReplayRouteHandlers,
  createGameReplayRunRouteHandlers,
  type UserSessionLookup,
} from "@/app/api/replays/route-handlers";
import {
  BREAKOUT_REPLAY_GAME_ID,
  parseBreakoutReplayPayload,
} from "@/lib/breakout-replay";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";

export function createBreakoutReplayRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "getReplay" | "saveReplay">,
  userStore: UserSessionLookup,
) {
  return createGameReplayRouteHandlers(replayStore, userStore, {
    gameId: BREAKOUT_REPLAY_GAME_ID,
    parsePayload: parseBreakoutReplayPayload,
    replayLabel: "Breakout replay",
  });
}

export function createBreakoutReplayRunRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "createReplayRun">,
  userStore?: UserSessionLookup,
) {
  return createGameReplayRunRouteHandlers(replayStore, userStore, {
    gameId: BREAKOUT_REPLAY_GAME_ID,
  });
}
