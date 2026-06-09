import {
  createGameReplayRouteHandlers,
  type UserSessionLookup,
} from "@/app/api/replays/route-handlers";
import {
  MINESWEEPER_REPLAY_GAME_ID,
  parseMinesweeperReplayPayload,
} from "@/lib/minesweeper-replay";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import { getReplayStore } from "@/lib/server/sqlite-replay-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function createMinesweeperReplayRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "getReplay" | "saveReplay">,
  userStore: UserSessionLookup,
) {
  return createGameReplayRouteHandlers(replayStore, userStore, {
    gameId: MINESWEEPER_REPLAY_GAME_ID,
    parsePayload: parseMinesweeperReplayPayload,
    replayLabel: "Minesweeper replay",
  });
}

export async function GET(request: Request) {
  return createMinesweeperReplayRouteHandlers(
    getReplayStore(),
    getUserProfileStore(),
  ).GET(request);
}

export async function POST(request: Request) {
  return createMinesweeperReplayRouteHandlers(
    getReplayStore(),
    getUserProfileStore(),
  ).POST(request);
}
