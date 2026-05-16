import { NextResponse } from "next/server";

import { getSnakeLeaderboardStore } from "../../../../lib/server/sqlite-snake-leaderboard-store";
import {
  createLeaderboardJson,
  parseScoreSubmission,
  type LeaderboardStore,
} from "../../../../lib/server/snake-leaderboard-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function createSnakeLeaderboardRouteHandlers(store: LeaderboardStore) {
  return {
    async GET() {
      const entries = await store.listTopScores();

      return NextResponse.json(createLeaderboardJson(entries));
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
          ...createLeaderboardJson(result.entries),
          accepted: result.accepted,
          rank: result.rank,
        },
        { status: result.accepted ? 201 : 200 },
      );
    },
  };
}

export async function GET() {
  return createSnakeLeaderboardRouteHandlers(getSnakeLeaderboardStore()).GET();
}

export async function POST(request: Request) {
  return createSnakeLeaderboardRouteHandlers(getSnakeLeaderboardStore()).POST(request);
}
