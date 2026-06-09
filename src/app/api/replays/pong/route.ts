import {
  createGameReplayRouteHandlers,
  type UserSessionLookup,
} from "@/app/api/replays/route-handlers";
import {
  parsePongReplayPayload,
  PONG_REPLAY_GAME_ID,
} from "@/lib/pong-replay";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import { getReplayStore } from "@/lib/server/sqlite-replay-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function createPongReplayRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "getReplay" | "saveReplay">,
  userStore: UserSessionLookup,
) {
  return createGameReplayRouteHandlers(replayStore, userStore, {
    gameId: PONG_REPLAY_GAME_ID,
    parsePayload: parsePongReplayPayload,
    replayLabel: "Pong replay",
  });
}

export async function GET(request: Request) {
  return createPongReplayRouteHandlers(getReplayStore(), getUserProfileStore()).GET(request);
}

export async function POST(request: Request) {
  return createPongReplayRouteHandlers(getReplayStore(), getUserProfileStore()).POST(request);
}
