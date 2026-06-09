import {
  createGameReplayRouteHandlers,
  type UserSessionLookup,
} from "@/app/api/replays/route-handlers";
import {
  ASTEROIDS_REPLAY_GAME_ID,
  parseAsteroidsReplayPayload,
} from "@/lib/asteroids-replay";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import { getReplayStore } from "@/lib/server/sqlite-replay-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function createAsteroidsReplayRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "getReplay" | "saveReplay">,
  userStore: UserSessionLookup,
) {
  return createGameReplayRouteHandlers(replayStore, userStore, {
    gameId: ASTEROIDS_REPLAY_GAME_ID,
    parsePayload: parseAsteroidsReplayPayload,
    replayLabel: "Asteroids replay",
  });
}

export async function GET(request: Request) {
  return createAsteroidsReplayRouteHandlers(getReplayStore(), getUserProfileStore()).GET(
    request,
  );
}

export async function POST(request: Request) {
  return createAsteroidsReplayRouteHandlers(getReplayStore(), getUserProfileStore()).POST(
    request,
  );
}
