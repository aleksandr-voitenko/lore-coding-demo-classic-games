import { NextResponse } from "next/server";

import { isGameId } from "@/lib/game-catalog";
import {
  isLeaderboardSortDirection,
  normalizeLeaderboardKey,
  type LeaderboardSortDirection,
} from "@/lib/leaderboard";
import {
  isGameSessionResult,
  normalizeGameId,
  type GameSessionSubmission,
} from "@/lib/user-profile";
import type { SqliteUserProfileStore } from "@/lib/server/sqlite-user-profile-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";
import { getSessionTokenFromRequest } from "@/lib/server/user-session-cookie";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ParseGameSessionSubmissionResult =
  | {
      submission: Required<GameSessionSubmission>;
      success: true;
    }
  | {
      error: string;
      success: false;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseGameSessionSubmission(value: unknown): ParseGameSessionSubmissionResult {
  if (!isRecord(value)) {
    return {
      error: "Game session must be a JSON object.",
      success: false,
    };
  }

  const gameId = normalizeGameId(value.gameId);
  const leaderboardKey = normalizeLeaderboardKey(value.leaderboardKey);
  const { activeDurationMs, finalScore, result } = value;
  const sortDirection: LeaderboardSortDirection = isLeaderboardSortDirection(value.sortDirection)
    ? value.sortDirection
    : "desc";

  if (gameId === null || !isGameId(gameId)) {
    return {
      error: "Game id is not supported.",
      success: false,
    };
  }

  if (leaderboardKey === null) {
    return {
      error: "Leaderboard key is not supported.",
      success: false,
    };
  }

  if (
    typeof activeDurationMs !== "number" ||
    !Number.isInteger(activeDurationMs) ||
    activeDurationMs < 0
  ) {
    return {
      error: "Active duration must be a non-negative integer.",
      success: false,
    };
  }

  if (typeof finalScore !== "number" || !Number.isInteger(finalScore) || finalScore < 0) {
    return {
      error: "Final score must be a non-negative integer.",
      success: false,
    };
  }

  if (!isGameSessionResult(result)) {
    return {
      error: "Game session result is not supported.",
      success: false,
    };
  }

  return {
    submission: {
      activeDurationMs,
      finalScore,
      gameId,
      leaderboardKey,
      result,
      sortDirection,
    },
    success: true,
  };
}

export function createGameSessionRouteHandlers(store: SqliteUserProfileStore) {
  return {
    async POST(request: Request) {
      const user = await store.getUserBySessionToken(getSessionTokenFromRequest(request));

      if (user === null) {
        return NextResponse.json({ error: "Sign in before recording stats." }, { status: 401 });
      }

      let payload: unknown;

      try {
        payload = await request.json();
      } catch {
        return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
      }

      const parsedSession = parseGameSessionSubmission(payload);

      if (!parsedSession.success) {
        return NextResponse.json({ error: parsedSession.error }, { status: 400 });
      }

      const session = await store.recordGameSession(user, parsedSession.submission);

      return NextResponse.json(session, { status: 201 });
    },
  };
}

export async function POST(request: Request) {
  return createGameSessionRouteHandlers(getUserProfileStore()).POST(request);
}
