import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

import { createSignupRouteHandlers } from "./route-handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return createSignupRouteHandlers(getUserProfileStore()).POST(request);
}
