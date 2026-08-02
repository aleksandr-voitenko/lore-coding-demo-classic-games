import { getSocialStore } from "@/lib/server/sqlite-social-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

import { createSocialDiscoveryRouteHandlers } from "./route-handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return createSocialDiscoveryRouteHandlers(
    getSocialStore(),
    getUserProfileStore(),
  ).GET(request);
}
