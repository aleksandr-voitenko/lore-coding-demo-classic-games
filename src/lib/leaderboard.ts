export type LeaderboardSortDirection = "asc" | "desc";

export type LeaderboardEntry = {
  name: string;
  score: number;
};

export type PendingLeaderboardEntry = {
  rank: number;
  score: number;
};

export type LeaderboardScoreSubmission = {
  leaderboardKey: string;
  name: string;
  score: number;
  sortDirection?: LeaderboardSortDirection;
};

export type SubmitLeaderboardScoreResult = {
  accepted: boolean;
  entries: LeaderboardEntry[];
  rank: number | null;
};

export type GameLeaderboardParameter = {
  name: string;
  value: number | string;
};

export const LEADERBOARD_API_PATH = "/api/leaderboard";
export const LEADERBOARD_DATA_VERSION = 1;
export const LEADERBOARD_LIMIT = 3;
export const MAX_LEADERBOARD_KEY_LENGTH = 140;
export const MAX_LEADERBOARD_PLAYER_NAME_LENGTH = 18;

const LEADERBOARD_KEY_PATTERN = /^[a-z0-9-]+(?:\|[a-z0-9-]+=[a-z0-9-]+)*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeKeySegment(value: number | string) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function createGameLeaderboardKey(
  gameId: string,
  parameters: readonly GameLeaderboardParameter[],
) {
  const normalizedGameId = normalizeKeySegment(gameId);
  const normalizedParameters = parameters.map(({ name, value }) => {
    const normalizedName = normalizeKeySegment(name);
    const normalizedValue = normalizeKeySegment(value);

    return `${normalizedName}=${normalizedValue}`;
  });

  return [normalizedGameId, ...normalizedParameters].join("|");
}

export function normalizeLeaderboardKey(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const key = value.trim();

  if (
    key.length === 0 ||
    key.length > MAX_LEADERBOARD_KEY_LENGTH ||
    !LEADERBOARD_KEY_PATTERN.test(key)
  ) {
    return null;
  }

  return key;
}

export function isLeaderboardSortDirection(value: unknown): value is LeaderboardSortDirection {
  return value === "asc" || value === "desc";
}

export function normalizeLeaderboardSortDirection(value: unknown): LeaderboardSortDirection {
  return isLeaderboardSortDirection(value) ? value : "desc";
}

export function normalizePlayerName(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, MAX_LEADERBOARD_PLAYER_NAME_LENGTH);
}

function compareScores(
  first: LeaderboardEntry,
  second: LeaderboardEntry,
  sortDirection: LeaderboardSortDirection,
) {
  return sortDirection === "asc" ? first.score - second.score : second.score - first.score;
}

export function normalizeLeaderboard(
  value: unknown,
  sortDirection: LeaderboardSortDirection = "desc",
): LeaderboardEntry[] {
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
    .sort((first, second) => compareScores(first, second, sortDirection))
    .slice(0, LEADERBOARD_LIMIT);
}

export function createLeaderboardResponse(
  entries: LeaderboardEntry[],
  sortDirection: LeaderboardSortDirection = "desc",
) {
  return {
    entries: normalizeLeaderboard(entries, sortDirection),
    version: LEADERBOARD_DATA_VERSION,
  };
}

export function parseLeaderboardResponse(
  value: unknown,
  sortDirection: LeaderboardSortDirection = "desc",
) {
  return normalizeLeaderboard(value, sortDirection);
}

export function getLeaderboardRank(
  score: number,
  leaderboard: LeaderboardEntry[],
  sortDirection: LeaderboardSortDirection = "desc",
) {
  if (!Number.isInteger(score) || score <= 0) {
    return null;
  }

  const nextRank = leaderboard.findIndex((entry) =>
    sortDirection === "asc" ? score < entry.score : score > entry.score,
  );

  if (nextRank >= 0) {
    return nextRank;
  }

  return leaderboard.length < LEADERBOARD_LIMIT ? leaderboard.length : null;
}

export function createPendingLeaderboardEntry(
  score: number,
  leaderboard: LeaderboardEntry[],
  sortDirection: LeaderboardSortDirection = "desc",
): PendingLeaderboardEntry | null {
  const rank = getLeaderboardRank(score, leaderboard, sortDirection);

  return rank === null
    ? null
    : {
        rank,
        score,
      };
}

function getResponseError(response: Response) {
  return new Error(`Leaderboard request failed with status ${response.status}`);
}

export async function fetchLeaderboard({
  leaderboardKey,
  sortDirection = "desc",
}: {
  leaderboardKey: string;
  sortDirection?: LeaderboardSortDirection;
}) {
  const searchParams = new URLSearchParams({
    key: leaderboardKey,
    sort: sortDirection,
  });
  const response = await fetch(`${LEADERBOARD_API_PATH}?${searchParams.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw getResponseError(response);
  }

  return parseLeaderboardResponse(await response.json(), sortDirection);
}

export async function submitLeaderboardScore(
  submission: LeaderboardScoreSubmission,
): Promise<SubmitLeaderboardScoreResult> {
  const sortDirection = submission.sortDirection ?? "desc";
  const response = await fetch(LEADERBOARD_API_PATH, {
    body: JSON.stringify({ ...submission, sortDirection }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw getResponseError(response);
  }

  const payload = await response.json();
  const entries = parseLeaderboardResponse(payload, sortDirection);
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
