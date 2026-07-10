import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

import { createLoginRouteHandlers } from "./route-handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return createLoginRouteHandlers(getUserProfileStore()).POST(request);
}
