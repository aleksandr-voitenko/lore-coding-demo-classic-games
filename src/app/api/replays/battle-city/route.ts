import { getReplayStore } from "@/lib/server/sqlite-replay-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

import { createBattleCityReplayRouteHandlers } from "./route-handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return createBattleCityReplayRouteHandlers(
    getReplayStore(),
    getUserProfileStore(),
  ).GET(request);
}

export async function POST(request: Request) {
  return createBattleCityReplayRouteHandlers(
    getReplayStore(),
    getUserProfileStore(),
  ).POST(request);
}
