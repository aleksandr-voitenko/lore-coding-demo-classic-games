import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

import { createCurrentUserRouteHandlers } from "./route-handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(request: Request) {
  return createCurrentUserRouteHandlers(getUserProfileStore()).DELETE(request);
}

export async function GET(request: Request) {
  return createCurrentUserRouteHandlers(getUserProfileStore()).GET(request);
}
