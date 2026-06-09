import {
  createGameReplayRunRouteHandlers,
  type UserSessionLookup,
} from "@/app/api/replays/route-handlers";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import { getReplayStore } from "@/lib/server/sqlite-replay-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";
import { SNAKE_REPLAY_GAME_ID } from "@/lib/snake-replay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function createSnakeReplayRunRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "createReplayRun">,
  userStore?: UserSessionLookup,
) {
  return createGameReplayRunRouteHandlers(replayStore, userStore, {
    gameId: SNAKE_REPLAY_GAME_ID,
  });
}

export async function POST(request: Request) {
  return createSnakeReplayRunRouteHandlers(getReplayStore(), getUserProfileStore()).POST(request);
}
