import {
  createGameReplayRouteHandlers,
  type UserSessionLookup,
} from "@/app/api/replays/route-handlers";
import {
  parseSimonReplayPayload,
  SIMON_REPLAY_GAME_ID,
} from "@/lib/simon-replay";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import { getReplayStore } from "@/lib/server/sqlite-replay-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function createSimonReplayRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "getReplay" | "saveReplay">,
  userStore: UserSessionLookup,
) {
  return createGameReplayRouteHandlers(replayStore, userStore, {
    gameId: SIMON_REPLAY_GAME_ID,
    parsePayload: parseSimonReplayPayload,
    replayLabel: "Simon replay",
  });
}

export async function GET(request: Request) {
  return createSimonReplayRouteHandlers(getReplayStore(), getUserProfileStore()).GET(request);
}

export async function POST(request: Request) {
  return createSimonReplayRouteHandlers(getReplayStore(), getUserProfileStore()).POST(request);
}
