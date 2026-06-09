import {
  createGameReplayRouteHandlers,
  type UserSessionLookup,
} from "@/app/api/replays/route-handlers";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import { getReplayStore } from "@/lib/server/sqlite-replay-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";
import {
  parseTetrisReplayPayload,
  TETRIS_REPLAY_GAME_ID,
} from "@/lib/tetris-replay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function createTetrisReplayRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "getReplay" | "saveReplay">,
  userStore: UserSessionLookup,
) {
  return createGameReplayRouteHandlers(replayStore, userStore, {
    gameId: TETRIS_REPLAY_GAME_ID,
    parsePayload: parseTetrisReplayPayload,
    replayLabel: "Tetris replay",
  });
}

export async function GET(request: Request) {
  return createTetrisReplayRouteHandlers(getReplayStore(), getUserProfileStore()).GET(request);
}

export async function POST(request: Request) {
  return createTetrisReplayRouteHandlers(getReplayStore(), getUserProfileStore()).POST(request);
}
