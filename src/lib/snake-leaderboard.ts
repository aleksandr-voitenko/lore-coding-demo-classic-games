import { LEADERBOARD_LIMIT, type LeaderboardEntry } from "./snake-game-engine";

export const EMPTY_LEADERBOARD_SNAPSHOT = "";
export const LEADERBOARD_CHANGE_EVENT = "classic-snake:leaderboard-change";
export const LEADERBOARD_STORAGE_KEY = "classic-snake:leaderboard:v1";
export const LEADERBOARD_STORAGE_VERSION = 1;
export const MAX_LEADERBOARD_PLAYER_NAME_LENGTH = 18;

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
    isRecord(value) && value.version === LEADERBOARD_STORAGE_VERSION
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

export function getStoredLeaderboardSnapshot() {
  if (typeof window === "undefined") {
    return EMPTY_LEADERBOARD_SNAPSHOT;
  }

  try {
    return window.localStorage.getItem(LEADERBOARD_STORAGE_KEY) ?? EMPTY_LEADERBOARD_SNAPSHOT;
  } catch {
    return EMPTY_LEADERBOARD_SNAPSHOT;
  }
}

export function getServerLeaderboardSnapshot() {
  return EMPTY_LEADERBOARD_SNAPSHOT;
}

export function parseLeaderboardSnapshot(snapshot: string) {
  if (snapshot === EMPTY_LEADERBOARD_SNAPSHOT) {
    return [];
  }

  try {
    return normalizeLeaderboard(JSON.parse(snapshot));
  } catch {
    return [];
  }
}

export function subscribeToLeaderboardStore(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("storage", onStoreChange);
  window.addEventListener(LEADERBOARD_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(LEADERBOARD_CHANGE_EVENT, onStoreChange);
  };
}

export function writeStoredLeaderboard(leaderboard: LeaderboardEntry[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      LEADERBOARD_STORAGE_KEY,
      JSON.stringify({
        entries: leaderboard,
        version: LEADERBOARD_STORAGE_VERSION,
      }),
    );
    window.dispatchEvent(new Event(LEADERBOARD_CHANGE_EVENT));
  } catch {
    return;
  }
}

export function insertLeaderboardEntry(
  leaderboard: LeaderboardEntry[],
  entry: LeaderboardEntry,
) {
  return normalizeLeaderboard({
    entries: [...leaderboard, entry],
    version: LEADERBOARD_STORAGE_VERSION,
  });
}
