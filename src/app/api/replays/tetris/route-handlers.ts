import "server-only";

import {
  createGameReplayRouteHandlers,
  createGameReplayRunRouteHandlers,
  type UserSessionLookup,
} from "@/app/api/replays/route-handlers";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import {
  parseTetrisReplayPayload,
  TETRIS_REPLAY_GAME_ID,
} from "@/lib/tetris-replay";

export function createTetrisReplayRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "getReplay" | "saveReplay">,
  userStore: UserSessionLookup,
) {
  return createGameReplayRouteHandlers(replayStore, userStore, {
    gameId: TETRIS_REPLAY_GAME_ID,
    parsePayload: parseTetrisReplayPayload,
    replayLabel: "Tetris replay",
  });
}

export function createTetrisReplayRunRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "createReplayRun">,
  userStore?: UserSessionLookup,
) {
  return createGameReplayRunRouteHandlers(replayStore, userStore, {
    gameId: TETRIS_REPLAY_GAME_ID,
  });
}
