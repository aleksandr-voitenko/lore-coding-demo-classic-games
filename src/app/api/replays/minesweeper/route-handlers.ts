import "server-only";

import {
  createGameReplayRouteHandlers,
  createGameReplayRunRouteHandlers,
  type UserSessionLookup,
} from "@/app/api/replays/route-handlers";
import {
  MINESWEEPER_REPLAY_GAME_ID,
  parseMinesweeperReplayPayload,
} from "@/lib/minesweeper-replay";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";

export function createMinesweeperReplayRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "getReplay" | "saveReplay">,
  userStore: UserSessionLookup,
) {
  return createGameReplayRouteHandlers(replayStore, userStore, {
    gameId: MINESWEEPER_REPLAY_GAME_ID,
    parsePayload: parseMinesweeperReplayPayload,
    replayLabel: "Minesweeper replay",
  });
}

export function createMinesweeperReplayRunRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "createReplayRun">,
  userStore?: UserSessionLookup,
) {
  return createGameReplayRunRouteHandlers(replayStore, userStore, {
    gameId: MINESWEEPER_REPLAY_GAME_ID,
  });
}
