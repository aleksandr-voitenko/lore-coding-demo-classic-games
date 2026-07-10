import "server-only";

import {
  createGameReplayRouteHandlers,
  createGameReplayRunRouteHandlers,
  type UserSessionLookup,
} from "@/app/api/replays/route-handlers";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import {
  parseSpaceInvadersReplayPayload,
  SPACE_INVADERS_REPLAY_GAME_ID,
} from "@/lib/space-invaders-replay";

export function createSpaceInvadersReplayRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "getReplay" | "saveReplay">,
  userStore: UserSessionLookup,
) {
  return createGameReplayRouteHandlers(replayStore, userStore, {
    gameId: SPACE_INVADERS_REPLAY_GAME_ID,
    parsePayload: parseSpaceInvadersReplayPayload,
    replayLabel: "Space Invaders replay",
  });
}

export function createSpaceInvadersReplayRunRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "createReplayRun">,
  userStore?: UserSessionLookup,
) {
  return createGameReplayRunRouteHandlers(replayStore, userStore, {
    gameId: SPACE_INVADERS_REPLAY_GAME_ID,
  });
}
