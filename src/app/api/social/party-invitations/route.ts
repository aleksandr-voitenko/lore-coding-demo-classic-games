import { getMultiplayerRoomStore } from "@/lib/server/multiplayer-room-store";
import { getSocialStore } from "@/lib/server/sqlite-social-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

import { createPartyInvitationsRouteHandlers } from "./route-handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return createPartyInvitationsRouteHandlers({
    accountPartyAuthority: getMultiplayerRoomStore(),
    socialStore: getSocialStore(),
    userStore: getUserProfileStore(),
  }).POST(request);
}
