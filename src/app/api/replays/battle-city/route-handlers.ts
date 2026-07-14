import "server-only";

import {
  createGameReplayRouteHandlers,
  createGameReplayRunRouteHandlers,
  type UserSessionLookup,
} from "@/app/api/replays/route-handlers";
import {
  BATTLE_CITY_REPLAY_GAME_ID,
  parseBattleCityReplayPayload,
} from "@/lib/battle-city-replay";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";

export function createBattleCityReplayRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "getReplay" | "saveReplay">,
  userStore: UserSessionLookup,
) {
  return createGameReplayRouteHandlers(replayStore, userStore, {
    gameId: BATTLE_CITY_REPLAY_GAME_ID,
    parsePayload: parseBattleCityReplayPayload,
    replayLabel: "Tank Patrol replay",
  });
}

export function createBattleCityReplayRunRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "createReplayRun">,
  userStore?: UserSessionLookup,
) {
  return createGameReplayRunRouteHandlers(replayStore, userStore, {
    gameId: BATTLE_CITY_REPLAY_GAME_ID,
  });
}
