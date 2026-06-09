import {
  createGameReplayRunRouteHandlers,
  type UserSessionLookup,
} from "@/app/api/replays/route-handlers";
import { BREAKOUT_REPLAY_GAME_ID } from "@/lib/breakout-replay";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import { getReplayStore } from "@/lib/server/sqlite-replay-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function createBreakoutReplayRunRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "createReplayRun">,
  userStore?: UserSessionLookup,
) {
  return createGameReplayRunRouteHandlers(replayStore, userStore, {
    gameId: BREAKOUT_REPLAY_GAME_ID,
  });
}

export async function POST(request: Request) {
  return createBreakoutReplayRunRouteHandlers(getReplayStore(), getUserProfileStore()).POST(
    request,
  );
}
