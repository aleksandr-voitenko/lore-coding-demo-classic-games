import { getReplayStore } from "@/lib/server/sqlite-replay-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

import { createTetrisReplayRunRouteHandlers } from "../route-handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return createTetrisReplayRunRouteHandlers(getReplayStore(), getUserProfileStore()).POST(request);
}
