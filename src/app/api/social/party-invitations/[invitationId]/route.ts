import { getMultiplayerRoomStore } from "@/lib/server/multiplayer-room-store";
import { getSocialStore } from "@/lib/server/sqlite-social-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

import { createPartyInvitationRouteHandlers } from "./route-handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PartyInvitationRouteContext = {
  params: Promise<{
    invitationId: string;
  }>;
};

export async function DELETE(
  request: Request,
  context: PartyInvitationRouteContext,
) {
  const { invitationId } = await context.params;

  return createPartyInvitationRouteHandlers({
    accountPartyAuthority: getMultiplayerRoomStore(),
    socialStore: getSocialStore(),
    userStore: getUserProfileStore(),
  }).DELETE(request, invitationId);
}

export async function PATCH(
  request: Request,
  context: PartyInvitationRouteContext,
) {
  const { invitationId } = await context.params;

  return createPartyInvitationRouteHandlers({
    accountPartyAuthority: getMultiplayerRoomStore(),
    socialStore: getSocialStore(),
    userStore: getUserProfileStore(),
  }).PATCH(request, invitationId);
}
