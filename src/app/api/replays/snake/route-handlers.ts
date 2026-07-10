import "server-only";

import {
  createGameReplayRouteHandlers,
  createGameReplayRunRouteHandlers,
  type UserSessionLookup,
} from "@/app/api/replays/route-handlers";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import {
  SNAKE_REPLAY_GAME_ID,
  parseSnakeReplayPayload,
} from "@/lib/snake-replay";

export function createSnakeReplayRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "getReplay" | "saveReplay">,
  userStore: UserSessionLookup,
) {
  return createGameReplayRouteHandlers(replayStore, userStore, {
    gameId: SNAKE_REPLAY_GAME_ID,
    parsePayload: parseSnakeReplayPayload,
    replayLabel: "Snake replay",
  });
}

export function createSnakeReplayRunRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "createReplayRun">,
  userStore?: UserSessionLookup,
) {
  return createGameReplayRunRouteHandlers(replayStore, userStore, {
    gameId: SNAKE_REPLAY_GAME_ID,
  });
}
