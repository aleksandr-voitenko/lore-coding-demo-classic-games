import {
  createGameReplayRunRouteHandlers,
  type UserSessionLookup,
} from "@/app/api/replays/route-handlers";
import { SIMON_REPLAY_GAME_ID } from "@/lib/simon-replay";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import { getReplayStore } from "@/lib/server/sqlite-replay-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function createSimonReplayRunRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "createReplayRun">,
  userStore?: UserSessionLookup,
) {
  return createGameReplayRunRouteHandlers(replayStore, userStore, {
    gameId: SIMON_REPLAY_GAME_ID,
  });
}

export async function POST(request: Request) {
  return createSimonReplayRunRouteHandlers(getReplayStore(), getUserProfileStore()).POST(
    request,
  );
}
