import {
  createGameReplayRouteHandlers,
  type UserSessionLookup,
} from "@/app/api/replays/route-handlers";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import { getReplayStore } from "@/lib/server/sqlite-replay-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";
import {
  SNAKE_REPLAY_GAME_ID,
  parseSnakeReplayPayload,
} from "@/lib/snake-replay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

export async function GET(request: Request) {
  return createSnakeReplayRouteHandlers(getReplayStore(), getUserProfileStore()).GET(request);
}

export async function POST(request: Request) {
  return createSnakeReplayRouteHandlers(getReplayStore(), getUserProfileStore()).POST(request);
}
