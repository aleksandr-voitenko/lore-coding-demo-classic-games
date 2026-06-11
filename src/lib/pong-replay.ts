import {
  advancePongGame,
  createInitialPongGame,
  decrementPongRemainingScore,
  getPongMaximumScore,
  movePongPlayerDown,
  movePongPlayerUp,
  PONG_BOARD_HEIGHT,
  PONG_BOARD_WIDTH,
  PONG_TARGET_SCORE,
  startPongGame,
  type PongGameState,
} from "@/lib/pong-game-engine";
import {
  createGameReplayRun as createGenericGameReplayRun,
  fetchGameReplay,
  getGameReplayApiPath,
  getGameReplayRunApiPath,
  isNonNegativeInteger,
  isRecord,
  normalizeGameReplayRunId,
  normalizeGameReplaySeed,
  parseBaseGameReplayPayload,
  parseGameReplayEventEnvelope,
  parseGameReplayEvents,
  saveGameReplay,
  type BaseGameReplayPayload,
  type GameReplayEventEnvelope,
  type GameReplayRun,
  type ParseGameReplayPayloadResult,
} from "@/lib/game-replay";
import { createGameLeaderboardKey } from "@/lib/leaderboard";

export type PongReplayRun = GameReplayRun;

export type PongReplayStartEvent = GameReplayEventEnvelope<"start">;

export type PongReplayAdvanceEvent = GameReplayEventEnvelope<"advance">;

export type PongReplayMoveUpEvent = GameReplayEventEnvelope<"moveUp">;

export type PongReplayMoveDownEvent = GameReplayEventEnvelope<"moveDown">;

export type PongReplayScoreTickEvent = GameReplayEventEnvelope<"scoreTick">;

export type PongReplayEvent =
  | PongReplayAdvanceEvent
  | PongReplayMoveDownEvent
  | PongReplayMoveUpEvent
  | PongReplayScoreTickEvent
  | PongReplayStartEvent;

export type PongReplayEventInput = Omit<
  PongReplayEvent,
  "elapsedMs" | "seq" | "tick"
>;

export type PongReplayPayload = BaseGameReplayPayload<
  typeof PONG_REPLAY_GAME_ID,
  typeof PONG_REPLAY_SCHEMA_VERSION
> & {
  boardHeight: number;
  boardWidth: number;
  events: PongReplayEvent[];
  finalCpuScore: number;
  finalPlayerScore: number;
  targetScore: number;
};

export type ParsePongReplayPayloadResult = ParseGameReplayPayloadResult<PongReplayPayload>;

export const PONG_REPLAY_SCHEMA_VERSION = 1;
export const PONG_REPLAY_GAME_ID = "pong";
export const PONG_REPLAY_API_PATH = getGameReplayApiPath(PONG_REPLAY_GAME_ID);
export const PONG_REPLAY_RUN_API_PATH = getGameReplayRunApiPath(PONG_REPLAY_GAME_ID);
export const MAX_PONG_REPLAY_EVENTS = 180_000;

const PONG_MIN_BOARD_WIDTH = 240;
const PONG_MIN_BOARD_HEIGHT = 320;
const PONG_MIN_TARGET_SCORE = 1;
const PONG_EVENT_TYPES = new Set<PongReplayEvent["type"]>([
  "advance",
  "moveDown",
  "moveUp",
  "scoreTick",
  "start",
]);

export const normalizePongReplayRunId = normalizeGameReplayRunId;
export const normalizePongReplaySeed = normalizeGameReplaySeed;

function isMinimumInteger(value: unknown, minimum: number): value is number {
  return isNonNegativeInteger(value) && value >= minimum;
}

export function createPongReplayLeaderboardKey({
  boardHeight,
  boardWidth,
  targetScore,
}: Pick<PongReplayPayload, "boardHeight" | "boardWidth" | "targetScore">) {
  return createGameLeaderboardKey(PONG_REPLAY_GAME_ID, [
    { name: "board", value: `${boardWidth}x${boardHeight}` },
    { name: "target", value: targetScore },
  ]);
}

function parsePongReplayEvent(value: unknown): PongReplayEvent | null {
  return parseGameReplayEventEnvelope(value, PONG_EVENT_TYPES);
}

export function parsePongReplayPayload(value: unknown): ParsePongReplayPayloadResult {
  const baseReplay = parseBaseGameReplayPayload(value, {
    gameId: PONG_REPLAY_GAME_ID,
    replayLabel: "Pong replay",
    schemaVersion: PONG_REPLAY_SCHEMA_VERSION,
  });

  if (!baseReplay.success) {
    return baseReplay;
  }

  if (!isRecord(value)) {
    return {
      error: "Pong replay must be a JSON object.",
      success: false,
    };
  }

  if (
    !isMinimumInteger(value.boardWidth, PONG_MIN_BOARD_WIDTH) ||
    !isMinimumInteger(value.boardHeight, PONG_MIN_BOARD_HEIGHT) ||
    !isMinimumInteger(value.targetScore, PONG_MIN_TARGET_SCORE)
  ) {
    return {
      error: "Pong replay parameters are not supported.",
      success: false,
    };
  }

  const boardHeight = value.boardHeight;
  const boardWidth = value.boardWidth;
  const targetScore = value.targetScore;

  if (
    baseReplay.payload.leaderboardKey !==
    createPongReplayLeaderboardKey({
      boardHeight,
      boardWidth,
      targetScore,
    })
  ) {
    return {
      error: "Pong replay leaderboard key is not supported.",
      success: false,
    };
  }

  if (
    !isNonNegativeInteger(value.finalPlayerScore) ||
    !isNonNegativeInteger(value.finalCpuScore) ||
    value.finalPlayerScore > targetScore ||
    value.finalCpuScore > targetScore ||
    baseReplay.payload.finalScore > getPongMaximumScore(targetScore) ||
    (baseReplay.payload.finalStatus === "won" &&
      (value.finalPlayerScore !== targetScore || value.finalCpuScore >= targetScore)) ||
    (baseReplay.payload.finalStatus === "lost" &&
      (value.finalCpuScore !== targetScore || value.finalPlayerScore >= targetScore))
  ) {
    return {
      error: "Pong replay final state is not supported.",
      success: false,
    };
  }

  const events = parseGameReplayEvents(value.events, {
    maxEventCount: MAX_PONG_REPLAY_EVENTS,
    parseEvent: parsePongReplayEvent,
    unsupportedEventError: "Pong replay includes an unsupported event.",
    unsupportedEventsError: "Pong replay events are not supported.",
  });

  if (!events.success) {
    return events;
  }

  return {
    payload: {
      ...baseReplay.payload,
      boardHeight,
      boardWidth,
      events: events.payload,
      finalCpuScore: value.finalCpuScore,
      finalPlayerScore: value.finalPlayerScore,
      targetScore,
    },
    success: true,
  };
}

export function createInitialPongReplayGame(
  payload: Pick<PongReplayPayload, "boardHeight" | "boardWidth" | "targetScore">,
) {
  const game: PongGameState = createInitialPongGame({
    boardHeight: payload.boardHeight,
    boardWidth: payload.boardWidth,
    targetScore: payload.targetScore,
  });

  return {
    game,
  };
}

export function applyPongReplayEvent(current: PongGameState, event: PongReplayEvent) {
  switch (event.type) {
    case "advance":
      return advancePongGame(current);
    case "moveDown":
      return movePongPlayerDown(current);
    case "moveUp":
      return movePongPlayerUp(current);
    case "scoreTick":
      return decrementPongRemainingScore(current);
    case "start":
      return startPongGame(current);
  }
}

export async function createPongReplayRun() {
  return createGenericGameReplayRun(PONG_REPLAY_GAME_ID, {
    replayLabel: "Pong replay",
  });
}

export async function savePongReplay(payload: PongReplayPayload) {
  return saveGameReplay(PONG_REPLAY_GAME_ID, payload, {
    replayLabel: "Pong replay",
  });
}

export async function fetchPongReplay() {
  return fetchGameReplay(PONG_REPLAY_GAME_ID, parsePongReplayPayload, {
    replayLabel: "Pong replay",
  });
}

export function createDefaultPongReplayLeaderboardKey() {
  return createPongReplayLeaderboardKey({
    boardHeight: PONG_BOARD_HEIGHT,
    boardWidth: PONG_BOARD_WIDTH,
    targetScore: PONG_TARGET_SCORE,
  });
}
