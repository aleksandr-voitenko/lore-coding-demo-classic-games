import { NextResponse } from "next/server";

import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import { getReplayStore } from "@/lib/server/sqlite-replay-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";
import { getSessionTokenFromRequest } from "@/lib/server/user-session-cookie";
import type { AuthenticatedUser } from "@/lib/user-profile";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type UserSessionLookup = {
  getUserBySessionToken: (sessionToken: string | null) => Promise<AuthenticatedUser | null>;
};

export function createSnakeReplayRunRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "createSnakeReplayRun">,
  userStore?: UserSessionLookup,
) {
  return {
    async POST(request: Request) {
      const user = userStore
        ? await userStore.getUserBySessionToken(getSessionTokenFromRequest(request))
        : null;
      const run = await replayStore.createSnakeReplayRun(user);

      return NextResponse.json(run, { status: 201 });
    },
  };
}

export async function POST(request: Request) {
  return createSnakeReplayRunRouteHandlers(getReplayStore(), getUserProfileStore()).POST(request);
}
