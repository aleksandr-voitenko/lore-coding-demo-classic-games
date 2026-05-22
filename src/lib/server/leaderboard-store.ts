import {
  createLeaderboardResponse,
  getLeaderboardRank,
  LEADERBOARD_LIMIT,
  MAX_LEADERBOARD_PLAYER_NAME_LENGTH,
  normalizeLeaderboardKey,
  normalizeLeaderboardSortDirection,
  normalizePlayerName,
  type LeaderboardEntry,
  type LeaderboardScoreSubmission,
  type LeaderboardSortDirection,
  type SubmitLeaderboardScoreResult,
} from "../leaderboard";

export type LeaderboardStore = {
  close?: () => void;
  listTopScores: (
    leaderboardKey: string,
    sortDirection?: LeaderboardSortDirection,
    limit?: number,
  ) => Promise<LeaderboardEntry[]>;
  submitScore: (
    submission: NormalizedLeaderboardScoreSubmission,
  ) => Promise<SubmitLeaderboardScoreResult>;
};

export type NormalizedLeaderboardScoreSubmission = Required<LeaderboardScoreSubmission>;

export type ParseLeaderboardKeyResult =
  | {
      leaderboardKey: string;
      sortDirection: LeaderboardSortDirection;
      success: true;
    }
  | {
      error: string;
      success: false;
    };

type ParseScoreSubmissionResult =
  | {
      submission: NormalizedLeaderboardScoreSubmission;
      success: true;
    }
  | {
      error: string;
      success: false;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseLeaderboardKeySearchParams(
  searchParams: URLSearchParams,
): ParseLeaderboardKeyResult {
  const leaderboardKey = normalizeLeaderboardKey(searchParams.get("key"));

  if (leaderboardKey === null) {
    return {
      error: "Leaderboard key is not supported.",
      success: false,
    };
  }

  return {
    leaderboardKey,
    sortDirection: normalizeLeaderboardSortDirection(searchParams.get("sort")),
    success: true,
  };
}

export function parseScoreSubmission(value: unknown): ParseScoreSubmissionResult {
  if (!isRecord(value)) {
    return {
      error: "Score submission must be a JSON object.",
      success: false,
    };
  }

  const leaderboardKey = normalizeLeaderboardKey(value.leaderboardKey);
  const score = value.score;

  if (leaderboardKey === null) {
    return {
      error: "Leaderboard key is not supported.",
      success: false,
    };
  }

  if (typeof score !== "number" || !Number.isInteger(score) || score <= 0) {
    return {
      error: "Score must be a positive integer.",
      success: false,
    };
  }

  return {
    submission: {
      leaderboardKey,
      name: normalizePlayerName(value.name),
      score,
      sortDirection: normalizeLeaderboardSortDirection(value.sortDirection),
    },
    success: true,
  };
}

export function createLeaderboardJson(
  entries: LeaderboardEntry[],
  sortDirection: LeaderboardSortDirection = "desc",
) {
  return createLeaderboardResponse(entries, sortDirection);
}

export function createSubmissionResult(
  entries: LeaderboardEntry[],
  rank: number | null,
): SubmitLeaderboardScoreResult {
  return {
    accepted: rank !== null,
    entries,
    rank,
  };
}

export function getSubmissionRank(
  score: number,
  leaderboard: LeaderboardEntry[],
  sortDirection: LeaderboardSortDirection = "desc",
) {
  return getLeaderboardRank(score, leaderboard.slice(0, LEADERBOARD_LIMIT), sortDirection);
}

export { LEADERBOARD_LIMIT, MAX_LEADERBOARD_PLAYER_NAME_LENGTH };
