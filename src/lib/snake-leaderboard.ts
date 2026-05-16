import { LEADERBOARD_LIMIT, type LeaderboardEntry } from "./snake-game-engine";

export const LEADERBOARD_API_PATH = "/api/snake/leaderboard";
export const LEADERBOARD_DATA_VERSION = 1;
export const MAX_LEADERBOARD_PLAYER_NAME_LENGTH = 18;

export type LeaderboardScoreSubmission = {
  boardSize: number;
  name: string;
  score: number;
};

export type SubmitLeaderboardScoreResult = {
  accepted: boolean;
  entries: LeaderboardEntry[];
  rank: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizePlayerName(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, MAX_LEADERBOARD_PLAYER_NAME_LENGTH);
}

export function normalizeLeaderboard(value: unknown): LeaderboardEntry[] {
  const candidateEntries =
    isRecord(value) && value.version === LEADERBOARD_DATA_VERSION
      ? value.entries
      : Array.isArray(value)
        ? value
        : [];

  if (!Array.isArray(candidateEntries)) {
    return [];
  }

  return candidateEntries
    .flatMap((entry) => {
      if (!isRecord(entry) || typeof entry.score !== "number" || !Number.isFinite(entry.score)) {
        return [];
      }

      const score = Math.floor(entry.score);

      if (score <= 0) {
        return [];
      }

      return [
        {
          name: normalizePlayerName(entry.name),
          score,
        },
      ];
    })
    .sort((first, second) => second.score - first.score)
    .slice(0, LEADERBOARD_LIMIT);
}

export function createLeaderboardResponse(entries: LeaderboardEntry[]) {
  return {
    entries: normalizeLeaderboard(entries),
    version: LEADERBOARD_DATA_VERSION,
  };
}

export function parseLeaderboardResponse(value: unknown) {
  return normalizeLeaderboard(value);
}

function getResponseError(response: Response) {
  return new Error(`Leaderboard request failed with status ${response.status}`);
}

export async function fetchLeaderboard() {
  const response = await fetch(LEADERBOARD_API_PATH, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw getResponseError(response);
  }

  return parseLeaderboardResponse(await response.json());
}

export async function submitLeaderboardScore(
  submission: LeaderboardScoreSubmission,
): Promise<SubmitLeaderboardScoreResult> {
  const response = await fetch(LEADERBOARD_API_PATH, {
    body: JSON.stringify(submission),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw getResponseError(response);
  }

  const payload = await response.json();
  const entries = parseLeaderboardResponse(payload);
  const accepted = isRecord(payload) && payload.accepted === true;
  const rank =
    isRecord(payload) && typeof payload.rank === "number" && Number.isInteger(payload.rank)
      ? payload.rank
      : null;

  return {
    accepted,
    entries,
    rank,
  };
}
