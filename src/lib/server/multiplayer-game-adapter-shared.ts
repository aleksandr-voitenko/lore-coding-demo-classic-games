import type {
  MultiplayerServerGameRuntimeErrorCode,
  MultiplayerServerGameRuntimeFailure,
} from "./multiplayer-game-adapter-contract";

export const INITIAL_GAME_SEQUENCE = 1;

export function createGameRuntimeFailure(
  code: MultiplayerServerGameRuntimeErrorCode,
  error: string,
): MultiplayerServerGameRuntimeFailure {
  return {
    code,
    error,
    success: false,
  };
}

export function getCappedElapsedTicks(
  lastTickMs: number,
  nowMs: number,
  tickDelayMs: number,
  tickLimit: number,
) {
  if (tickDelayMs <= 0 || nowMs <= lastTickMs) {
    return 0;
  }

  return Math.min(Math.floor((nowMs - lastTickMs) / tickDelayMs), tickLimit);
}

export function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
