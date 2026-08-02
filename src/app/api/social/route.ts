import { getMultiplayerRoomStore } from "@/lib/server/multiplayer-room-store";
import { getSocialStore } from "@/lib/server/sqlite-social-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

import { createSocialOverviewRouteHandlers } from "./route-handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return createSocialOverviewRouteHandlers(
    getSocialStore(),
    getUserProfileStore(),
    getMultiplayerRoomStore(),
  ).GET(request);
}
