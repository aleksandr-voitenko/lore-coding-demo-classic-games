import "server-only";

import { NextResponse } from "next/server";

import {
  createLeaderboardJson,
  parseLeaderboardKeySearchParams,
  parseScoreSubmission,
  type LeaderboardStore,
} from "@/lib/server/leaderboard-store";
import { getSessionTokenFromRequest } from "@/lib/server/user-session-cookie";
import type { AuthenticatedUser } from "@/lib/user-profile";

type UserSessionLookup = {
  getUserBySessionToken: (sessionToken: string | null) => Promise<AuthenticatedUser | null>;
};

export function createLeaderboardRouteHandlers(
  store: LeaderboardStore,
  userStore?: UserSessionLookup,
) {
  return {
    async GET(request: Request) {
      const parsedKey = parseLeaderboardKeySearchParams(new URL(request.url).searchParams);

      if (!parsedKey.success) {
        return NextResponse.json({ error: parsedKey.error }, { status: 400 });
      }

      const entries = await store.listTopScores(
        parsedKey.leaderboardKey,
        parsedKey.sortDirection,
      );

      return NextResponse.json(createLeaderboardJson(entries, parsedKey.sortDirection));
    },

    async POST(request: Request) {
      let payload: unknown;

      try {
        payload = await request.json();
      } catch {
        return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
      }

      const parsedSubmission = parseScoreSubmission(payload);

      if (!parsedSubmission.success) {
        return NextResponse.json({ error: parsedSubmission.error }, { status: 400 });
      }

      const user = userStore
        ? await userStore.getUserBySessionToken(getSessionTokenFromRequest(request))
        : null;
      const submission =
        user === null
          ? parsedSubmission.submission
          : {
              ...parsedSubmission.submission,
              userId: user.id,
            };
      const result = await store.submitScore(submission);

      return NextResponse.json(
        {
          ...createLeaderboardJson(
            result.entries,
            parsedSubmission.submission.sortDirection,
          ),
          accepted: result.accepted,
          rank: result.rank,
        },
        { status: result.accepted ? 201 : 200 },
      );
    },
  };
}
