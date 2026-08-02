import { getMultiplayerRoomStore } from "@/lib/server/multiplayer-room-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

import { createSocialPresenceRouteHandlers } from "./route-handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(request: Request) {
  return createSocialPresenceRouteHandlers(
    getUserProfileStore(),
    getMultiplayerRoomStore(),
  ).DELETE(request);
}

export async function POST(request: Request) {
  return createSocialPresenceRouteHandlers(
    getUserProfileStore(),
    getMultiplayerRoomStore(),
  ).POST(request);
}
