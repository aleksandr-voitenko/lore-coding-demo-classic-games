import { getSocialStore } from "@/lib/server/sqlite-social-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

import { createSocialRelationshipRouteHandlers } from "../relationship-route-handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return createSocialRelationshipRouteHandlers(
    getSocialStore(),
    getUserProfileStore(),
  ).createFriendRequest(request);
}
