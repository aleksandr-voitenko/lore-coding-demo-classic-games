import {
  createGameReplayRouteHandlers,
  type UserSessionLookup,
} from "@/app/api/replays/route-handlers";
import {
  parseSpaceInvadersReplayPayload,
  SPACE_INVADERS_REPLAY_GAME_ID,
} from "@/lib/space-invaders-replay";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import { getReplayStore } from "@/lib/server/sqlite-replay-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function createSpaceInvadersReplayRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "getReplay" | "saveReplay">,
  userStore: UserSessionLookup,
) {
  return createGameReplayRouteHandlers(replayStore, userStore, {
    gameId: SPACE_INVADERS_REPLAY_GAME_ID,
    parsePayload: parseSpaceInvadersReplayPayload,
    replayLabel: "Space Invaders replay",
  });
}

export async function GET(request: Request) {
  return createSpaceInvadersReplayRouteHandlers(
    getReplayStore(),
    getUserProfileStore(),
  ).GET(request);
}

export async function POST(request: Request) {
  return createSpaceInvadersReplayRouteHandlers(
    getReplayStore(),
    getUserProfileStore(),
  ).POST(request);
}
