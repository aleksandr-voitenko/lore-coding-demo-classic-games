import { getSocialStore } from "@/lib/server/sqlite-social-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

import { createSocialRelationshipRouteHandlers } from "../../relationship-route-handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type FriendRequestRouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function DELETE(
  request: Request,
  context: FriendRequestRouteContext,
) {
  const { userId } = await context.params;

  return createSocialRelationshipRouteHandlers(
    getSocialStore(),
    getUserProfileStore(),
  ).cancelFriendRequest(request, userId);
}

export async function PATCH(
  request: Request,
  context: FriendRequestRouteContext,
) {
  const { userId } = await context.params;

  return createSocialRelationshipRouteHandlers(
    getSocialStore(),
    getUserProfileStore(),
  ).acceptOrDeclineFriendRequest(request, userId);
}
