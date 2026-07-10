import "server-only";

import {
  createGameReplayRouteHandlers,
  createGameReplayRunRouteHandlers,
  type UserSessionLookup,
} from "@/app/api/replays/route-handlers";
import {
  parsePongReplayPayload,
  PONG_REPLAY_GAME_ID,
} from "@/lib/pong-replay";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";

export function createPongReplayRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "getReplay" | "saveReplay">,
  userStore: UserSessionLookup,
) {
  return createGameReplayRouteHandlers(replayStore, userStore, {
    gameId: PONG_REPLAY_GAME_ID,
    parsePayload: parsePongReplayPayload,
    replayLabel: "Pong replay",
  });
}

export function createPongReplayRunRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "createReplayRun">,
  userStore?: UserSessionLookup,
) {
  return createGameReplayRunRouteHandlers(replayStore, userStore, {
    gameId: PONG_REPLAY_GAME_ID,
  });
}
