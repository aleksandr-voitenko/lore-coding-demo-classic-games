import type { LeaderboardSortDirection } from "@/lib/leaderboard";

export type AuthenticatedUser = {
  displayName: string;
  id: string;
};

export type GameSessionResult = "abandoned" | "lost" | "won";

export type GameSessionSubmission = {
  activeDurationMs: number;
  finalScore: number;
  gameId: string;
  leaderboardKey: string;
  result: GameSessionResult;
  sortDirection?: LeaderboardSortDirection;
};

export type RecordedGameSession = {
  id: string;
};

export type UserProfileGameStat = {
  abandons: number;
  bestScore: number | null;
  fastestWinScore: number | null;
  gameId: string;
  lastPlayedAt: string;
  losses: number;
  sessionsPlayed: number;
  totalActiveDurationMs: number;
  wins: number;
};

export type UserProfileSummary = {
  games: UserProfileGameStat[];
  totalActiveDurationMs: number;
  totalSessionsPlayed: number;
  user: AuthenticatedUser;
};

export const CURRENT_USER_API_PATH = "/api/me";
export const GAME_SESSIONS_API_PATH = "/api/game-sessions";
export const MAX_USER_DISPLAY_NAME_LENGTH = 24;

const GAME_ID_PATTERN = /^[a-z0-9-]+$/;
const GAME_SESSION_ID_PATTERN = /^[a-z0-9-]{1,80}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeUserDisplayName(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, MAX_USER_DISPLAY_NAME_LENGTH);
}

export function createUserDisplayNameKey(displayName: string) {
  return normalizeUserDisplayName(displayName).toLocaleLowerCase("en-US");
}

export function normalizeGameId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const gameId = value.trim();

  return GAME_ID_PATTERN.test(gameId) ? gameId : null;
}

export function normalizeGameSessionId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const sessionId = value.trim();

  return GAME_SESSION_ID_PATTERN.test(sessionId) ? sessionId : null;
}

export function isGameSessionResult(value: unknown): value is GameSessionResult {
  return value === "abandoned" || value === "lost" || value === "won";
}

function getResponseError(response: Response) {
  return new Error(`User profile request failed with status ${response.status}`);
}

export async function fetchCurrentUser() {
  const response = await fetch(CURRENT_USER_API_PATH, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw getResponseError(response);
  }

  const payload: unknown = await response.json();

  return isRecord(payload) && isRecord(payload.user)
    ? {
        displayName: normalizeUserDisplayName(payload.user.displayName),
        id: String(payload.user.id),
      }
    : null;
}

export async function signInUser(displayName: string) {
  const response = await fetch(CURRENT_USER_API_PATH, {
    body: JSON.stringify({ displayName }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw getResponseError(response);
  }

  const payload: unknown = await response.json();

  if (!isRecord(payload) || !isRecord(payload.user)) {
    throw new Error("Sign-in response did not include a user.");
  }

  return {
    displayName: normalizeUserDisplayName(payload.user.displayName),
    id: String(payload.user.id),
  };
}

export async function signOutUser() {
  const response = await fetch(CURRENT_USER_API_PATH, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw getResponseError(response);
  }
}

export async function submitGameSession(
  submission: GameSessionSubmission,
  { keepalive = false }: { keepalive?: boolean } = {},
) {
  const response = await fetch(GAME_SESSIONS_API_PATH, {
    body: JSON.stringify(submission),
    headers: {
      "Content-Type": "application/json",
    },
    keepalive,
    method: "POST",
  });

  if (!response.ok) {
    throw getResponseError(response);
  }

  const payload: unknown = await response.json();

  if (!isRecord(payload) || typeof payload.id !== "string") {
    throw new Error("Game session response did not include an id.");
  }

  return {
    id: payload.id,
  };
}
