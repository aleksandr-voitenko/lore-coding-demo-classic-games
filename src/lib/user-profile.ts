import type { LeaderboardSortDirection } from "@/lib/leaderboard";

export type AuthenticatedUser = {
  displayName: string;
  id: string;
};

export type UserAuthMode = "login" | "signup";

export type UserAuthField = "displayName" | "password" | "passwordConfirmation";

export type UserAuthFieldErrors = Partial<Record<UserAuthField, string>>;

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
  hasLastReplay: boolean;
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

export const AUTH_LOGIN_API_PATH = "/api/auth/login";
export const AUTH_SIGNUP_API_PATH = "/api/auth/signup";
export const CURRENT_USER_API_PATH = "/api/me";
export const GAME_SESSIONS_API_PATH = "/api/game-sessions";
export const MAX_USER_DISPLAY_NAME_LENGTH = 24;
export const MIN_USER_PASSWORD_LENGTH = 8;
export const MAX_USER_PASSWORD_LENGTH = 128;

const GAME_ID_PATTERN = /^[a-z0-9-]+$/;
const GAME_SESSION_ID_PATTERN = /^[a-z0-9-]{1,80}$/;
const USER_AUTH_FIELDS = ["displayName", "password", "passwordConfirmation"] as const;

export class UserAuthError extends Error {
  readonly fieldErrors: UserAuthFieldErrors;
  readonly status: number;

  constructor({
    fieldErrors = {},
    message,
    status,
  }: {
    fieldErrors?: UserAuthFieldErrors;
    message: string;
    status: number;
  }) {
    super(message);
    this.name = "UserAuthError";
    this.fieldErrors = fieldErrors;
    this.status = status;
  }
}

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

export function getUserPasswordValidationError(value: unknown) {
  if (typeof value !== "string" || value.length === 0) {
    return "Password is required.";
  }

  if (value.length < MIN_USER_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_USER_PASSWORD_LENGTH} characters.`;
  }

  if (value.length > MAX_USER_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_USER_PASSWORD_LENGTH} characters.`;
  }

  return null;
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

function parseAuthFieldErrors(value: unknown): UserAuthFieldErrors {
  if (!isRecord(value)) {
    return {};
  }

  return USER_AUTH_FIELDS.reduce<UserAuthFieldErrors>((fieldErrors, field) => {
    if (typeof value[field] === "string") {
      fieldErrors[field] = value[field];
    }

    return fieldErrors;
  }, {});
}

async function getUserAuthError(response: Response) {
  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    return new UserAuthError({
      message: `User authentication request failed with status ${response.status}`,
      status: response.status,
    });
  }

  const message =
    isRecord(payload) && typeof payload.error === "string"
      ? payload.error
      : `User authentication request failed with status ${response.status}`;
  const fieldErrors =
    isRecord(payload) && "fieldErrors" in payload
      ? parseAuthFieldErrors(payload.fieldErrors)
      : {};

  return new UserAuthError({
    fieldErrors,
    message,
    status: response.status,
  });
}

function parseAuthenticatedUser(payload: unknown, context: string) {
  if (!isRecord(payload) || !isRecord(payload.user)) {
    throw new Error(`${context} response did not include a user.`);
  }

  return {
    displayName: normalizeUserDisplayName(payload.user.displayName),
    id: String(payload.user.id),
  };
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

export async function logInUser(displayName: string, password: string) {
  const response = await fetch(AUTH_LOGIN_API_PATH, {
    body: JSON.stringify({ displayName, password }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw await getUserAuthError(response);
  }

  const payload: unknown = await response.json();

  return parseAuthenticatedUser(payload, "Log-in");
}

export async function signUpUser(
  displayName: string,
  password: string,
  passwordConfirmation: string,
) {
  const response = await fetch(AUTH_SIGNUP_API_PATH, {
    body: JSON.stringify({ displayName, password, passwordConfirmation }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw await getUserAuthError(response);
  }

  const payload: unknown = await response.json();

  return parseAuthenticatedUser(payload, "Sign-up");
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
