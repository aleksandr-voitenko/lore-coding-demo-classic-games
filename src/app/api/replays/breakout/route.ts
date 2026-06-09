import {
  createGameReplayRouteHandlers,
  type UserSessionLookup,
} from "@/app/api/replays/route-handlers";
import {
  BREAKOUT_REPLAY_GAME_ID,
  parseBreakoutReplayPayload,
} from "@/lib/breakout-replay";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import { getReplayStore } from "@/lib/server/sqlite-replay-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function createBreakoutReplayRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "getReplay" | "saveReplay">,
  userStore: UserSessionLookup,
) {
  return createGameReplayRouteHandlers(replayStore, userStore, {
    gameId: BREAKOUT_REPLAY_GAME_ID,
    parsePayload: parseBreakoutReplayPayload,
    replayLabel: "Breakout replay",
  });
}

export async function GET(request: Request) {
  return createBreakoutReplayRouteHandlers(getReplayStore(), getUserProfileStore()).GET(request);
}

export async function POST(request: Request) {
  return createBreakoutReplayRouteHandlers(getReplayStore(), getUserProfileStore()).POST(request);
}
