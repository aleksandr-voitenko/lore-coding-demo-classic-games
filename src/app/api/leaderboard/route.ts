import { NextResponse } from "next/server";

import {
  createLeaderboardJson,
  parseLeaderboardKeySearchParams,
  parseScoreSubmission,
  type LeaderboardStore,
} from "../../../lib/server/leaderboard-store";
import { getLeaderboardStore } from "../../../lib/server/sqlite-leaderboard-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function createLeaderboardRouteHandlers(store: LeaderboardStore) {
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

      const result = await store.submitScore(parsedSubmission.submission);

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

export async function GET(request: Request) {
  return createLeaderboardRouteHandlers(getLeaderboardStore()).GET(request);
}

export async function POST(request: Request) {
  return createLeaderboardRouteHandlers(getLeaderboardStore()).POST(request);
}
