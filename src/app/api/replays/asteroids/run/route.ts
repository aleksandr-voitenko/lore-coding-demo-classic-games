import {
  createGameReplayRunRouteHandlers,
  type UserSessionLookup,
} from "@/app/api/replays/route-handlers";
import { ASTEROIDS_REPLAY_GAME_ID } from "@/lib/asteroids-replay";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import { getReplayStore } from "@/lib/server/sqlite-replay-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function createAsteroidsReplayRunRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "createReplayRun">,
  userStore?: UserSessionLookup,
) {
  return createGameReplayRunRouteHandlers(replayStore, userStore, {
    gameId: ASTEROIDS_REPLAY_GAME_ID,
  });
}

export async function POST(request: Request) {
  return createAsteroidsReplayRunRouteHandlers(getReplayStore(), getUserProfileStore()).POST(
    request,
  );
}
