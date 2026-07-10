import { getMultiplayerRoomStore } from "@/lib/server/multiplayer-room-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

import { createMultiplayerRoomRouteHandlers } from "./route-handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type MultiplayerRoomRouteContext = {
  params: Promise<{
    code: string;
  }>;
};

export async function GET(request: Request, context: MultiplayerRoomRouteContext) {
  const { code } = await context.params;

  return createMultiplayerRoomRouteHandlers(
    getMultiplayerRoomStore(),
    getUserProfileStore(),
  ).GET(request, { code });
}

export async function POST(request: Request, context: MultiplayerRoomRouteContext) {
  const { code } = await context.params;

  return createMultiplayerRoomRouteHandlers(
    getMultiplayerRoomStore(),
    getUserProfileStore(),
  ).POST(request, { code });
}
