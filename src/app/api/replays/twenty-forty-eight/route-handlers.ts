import "server-only";

import {
  createGameReplayRouteHandlers,
  createGameReplayRunRouteHandlers,
  type UserSessionLookup,
} from "@/app/api/replays/route-handlers";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import {
  parseTwentyFortyEightReplayPayload,
  TWENTY_FORTY_EIGHT_REPLAY_GAME_ID,
} from "@/lib/twenty-forty-eight-replay";

export function createTwentyFortyEightReplayRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "getReplay" | "saveReplay">,
  userStore: UserSessionLookup,
) {
  return createGameReplayRouteHandlers(replayStore, userStore, {
    gameId: TWENTY_FORTY_EIGHT_REPLAY_GAME_ID,
    parsePayload: parseTwentyFortyEightReplayPayload,
    replayLabel: "2048 replay",
  });
}

export function createTwentyFortyEightReplayRunRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "createReplayRun">,
  userStore?: UserSessionLookup,
) {
  return createGameReplayRunRouteHandlers(replayStore, userStore, {
    gameId: TWENTY_FORTY_EIGHT_REPLAY_GAME_ID,
  });
}
