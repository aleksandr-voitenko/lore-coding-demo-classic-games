import { getMultiplayerRoomStore } from "@/lib/server/multiplayer-room-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

import { createMultiplayerRoomsRouteHandlers } from "../route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return createMultiplayerRoomsRouteHandlers(
    getMultiplayerRoomStore(),
    getUserProfileStore(),
  ).POST(request);
}
