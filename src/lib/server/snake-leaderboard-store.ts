import {
  createLeaderboardResponse,
  MAX_LEADERBOARD_PLAYER_NAME_LENGTH,
  normalizePlayerName,
  type LeaderboardScoreSubmission,
  type SubmitLeaderboardScoreResult,
} from "../snake-leaderboard";
import {
  getLeaderboardRank,
  LEADERBOARD_LIMIT,
  normalizeBoardSize,
  type LeaderboardEntry,
} from "../snake-game-engine";

export type LeaderboardStore = {
  close?: () => void;
  listTopScores: (limit?: number) => Promise<LeaderboardEntry[]>;
  submitScore: (
    submission: NormalizedLeaderboardScoreSubmission,
  ) => Promise<SubmitLeaderboardScoreResult>;
};

export type NormalizedLeaderboardScoreSubmission = LeaderboardScoreSubmission;

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

export function parseScoreSubmission(value: unknown): ParseScoreSubmissionResult {
  if (!isRecord(value)) {
    return {
      error: "Score submission must be a JSON object.",
      success: false,
    };
  }

  const score = value.score;
  const boardSize = value.boardSize;

  if (typeof score !== "number" || !Number.isInteger(score) || score <= 0) {
    return {
      error: "Score must be a positive integer.",
      success: false,
    };
  }

  if (
    typeof boardSize !== "number" ||
    !Number.isInteger(boardSize) ||
    normalizeBoardSize(boardSize) !== boardSize
  ) {
    return {
      error: "Board size is not supported.",
      success: false,
    };
  }

  return {
    submission: {
      boardSize,
      name: normalizePlayerName(value.name),
      score,
    },
    success: true,
  };
}

export function createLeaderboardJson(entries: LeaderboardEntry[]) {
  return createLeaderboardResponse(entries);
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

export function getSubmissionRank(score: number, leaderboard: LeaderboardEntry[]) {
  return getLeaderboardRank(score, leaderboard.slice(0, LEADERBOARD_LIMIT));
}

export { LEADERBOARD_LIMIT, MAX_LEADERBOARD_PLAYER_NAME_LENGTH };
