import { NextResponse } from "next/server";

import { normalizeLeaderboardKey } from "@/lib/leaderboard";
import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import { getReplayStore } from "@/lib/server/sqlite-replay-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";
import { getSessionTokenFromRequest } from "@/lib/server/user-session-cookie";
import { parseSnakeReplayPayload } from "@/lib/snake-replay";
import type { AuthenticatedUser } from "@/lib/user-profile";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type UserSessionLookup = {
  getUserBySessionToken: (sessionToken: string | null) => Promise<AuthenticatedUser | null>;
};

function getReplaySaveErrorMessage(reason: string) {
  if (reason === "run-user-mismatch") {
    return "Snake replay run belongs to another user.";
  }

  if (reason === "run-seed-mismatch") {
    return "Snake replay seed does not match the issued run.";
  }

  if (reason === "unsupported-game") {
    return "Snake replay game is not supported.";
  }

  return "Snake replay run was not found.";
}

export function createSnakeReplayRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "getSnakeReplay" | "saveSnakeReplay">,
  userStore: UserSessionLookup,
) {
  return {
    async GET(request: Request) {
      const user = await userStore.getUserBySessionToken(getSessionTokenFromRequest(request));

      if (user === null) {
        return NextResponse.json({ error: "Sign in before downloading replays." }, { status: 401 });
      }

      const replay = await replayStore.getSnakeReplay(user);

      if (replay === null) {
        return NextResponse.json({ error: "No Snake replay saved." }, { status: 404 });
      }

      return NextResponse.json({ replay });
    },

    async POST(request: Request) {
      const user = await userStore.getUserBySessionToken(getSessionTokenFromRequest(request));

      if (user === null) {
        return NextResponse.json({ error: "Sign in before saving replays." }, { status: 401 });
      }

      let payload: unknown;

      try {
        payload = await request.json();
      } catch {
        return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
      }

      const parsedReplay = parseSnakeReplayPayload(payload);

      if (!parsedReplay.success) {
        return NextResponse.json({ error: parsedReplay.error }, { status: 400 });
      }

      if (normalizeLeaderboardKey(parsedReplay.payload.leaderboardKey) === null) {
        return NextResponse.json(
          { error: "Snake replay leaderboard key is not supported." },
          { status: 400 },
        );
      }

      const saveResult = await replayStore.saveSnakeReplay(user, parsedReplay.payload);

      if (!saveResult.success) {
        return NextResponse.json(
          { error: getReplaySaveErrorMessage(saveResult.reason) },
          { status: saveResult.reason === "run-user-mismatch" ? 403 : 400 },
        );
      }

      return NextResponse.json({ saved: true }, { status: 201 });
    },
  };
}

export async function GET(request: Request) {
  return createSnakeReplayRouteHandlers(getReplayStore(), getUserProfileStore()).GET(request);
}

export async function POST(request: Request) {
  return createSnakeReplayRouteHandlers(getReplayStore(), getUserProfileStore()).POST(request);
}
