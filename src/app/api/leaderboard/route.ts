import { getLeaderboardStore } from "../../../lib/server/sqlite-leaderboard-store";
import { getUserProfileStore } from "../../../lib/server/sqlite-user-profile-store";

import { createLeaderboardRouteHandlers } from "./route-handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return createLeaderboardRouteHandlers(getLeaderboardStore()).GET(request);
}

export async function POST(request: Request) {
  return createLeaderboardRouteHandlers(getLeaderboardStore(), getUserProfileStore()).POST(request);
}
