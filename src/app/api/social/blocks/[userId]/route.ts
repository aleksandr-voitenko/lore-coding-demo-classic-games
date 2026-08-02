import { getSocialStore } from "@/lib/server/sqlite-social-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

import { createSocialRelationshipRouteHandlers } from "../../relationship-route-handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type BlockRouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function DELETE(request: Request, context: BlockRouteContext) {
  const { userId } = await context.params;

  return createSocialRelationshipRouteHandlers(
    getSocialStore(),
    getUserProfileStore(),
  ).unblockUser(request, userId);
}
