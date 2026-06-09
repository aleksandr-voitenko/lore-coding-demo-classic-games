import {
  createGameReplayRouteHandlers,
  type UserSessionLookup,
} from "@/app/api/replays/route-handlers";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import { getReplayStore } from "@/lib/server/sqlite-replay-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";
import {
  parseTwentyFortyEightReplayPayload,
  TWENTY_FORTY_EIGHT_REPLAY_GAME_ID,
} from "@/lib/twenty-forty-eight-replay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

export async function GET(request: Request) {
  return createTwentyFortyEightReplayRouteHandlers(
    getReplayStore(),
    getUserProfileStore(),
  ).GET(request);
}

export async function POST(request: Request) {
  return createTwentyFortyEightReplayRouteHandlers(
    getReplayStore(),
    getUserProfileStore(),
  ).POST(request);
}
