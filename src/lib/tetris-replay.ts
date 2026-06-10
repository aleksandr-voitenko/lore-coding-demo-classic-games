import {
  advanceTetrisGame,
  createInitialTetrisGame,
  hardDropTetrisPiece,
  moveTetrisPiece,
  rotateTetrisPiece,
  softDropTetrisPiece,
  type TetrisGameState,
} from "@/lib/tetris-game-engine";
import { createGameLeaderboardKey } from "@/lib/leaderboard";
import {
  createGameReplayRandom,
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
  saveGameReplay,
  type BaseGameReplayPayload,
  type GameReplayEventEnvelope,
  type GameReplayRun,
  type ParseGameReplayPayloadResult,
} from "@/lib/game-replay";

export type TetrisReplayRun = GameReplayRun;

export type TetrisReplayStartEvent = GameReplayEventEnvelope<"start">;

export type TetrisReplayAdvanceEvent = GameReplayEventEnvelope<"advance">;

export type TetrisReplayMoveLeftEvent = GameReplayEventEnvelope<"moveLeft">;

export type TetrisReplayMoveRightEvent = GameReplayEventEnvelope<"moveRight">;

export type TetrisReplayRotateClockwiseEvent =
  GameReplayEventEnvelope<"rotateClockwise">;

export type TetrisReplayRotateCounterclockwiseEvent =
  GameReplayEventEnvelope<"rotateCounterclockwise">;

export type TetrisReplaySoftDropEvent = GameReplayEventEnvelope<"softDrop">;

export type TetrisReplayHardDropEvent = GameReplayEventEnvelope<"hardDrop">;

export type TetrisReplayEvent =
  | TetrisReplayAdvanceEvent
  | TetrisReplayHardDropEvent
  | TetrisReplayMoveLeftEvent
  | TetrisReplayMoveRightEvent
  | TetrisReplayRotateClockwiseEvent
  | TetrisReplayRotateCounterclockwiseEvent
  | TetrisReplaySoftDropEvent
  | TetrisReplayStartEvent;

export type TetrisReplayEventInput = Omit<
  TetrisReplayEvent,
  "elapsedMs" | "seq" | "tick"
>;

export type TetrisReplayPayload = BaseGameReplayPayload<
  typeof TETRIS_REPLAY_GAME_ID,
  typeof TETRIS_REPLAY_SCHEMA_VERSION
> & {
  boardHeight: number;
  boardWidth: number;
  events: TetrisReplayEvent[];
  finalLevel: number;
  finalLines: number;
  startLevel: number;
};

export type ParseTetrisReplayPayloadResult =
  ParseGameReplayPayloadResult<TetrisReplayPayload>;

export const TETRIS_REPLAY_SCHEMA_VERSION = 1;
export const TETRIS_REPLAY_GAME_ID = "tetris";
export const TETRIS_REPLAY_API_PATH = getGameReplayApiPath(TETRIS_REPLAY_GAME_ID);
export const TETRIS_REPLAY_RUN_API_PATH = getGameReplayRunApiPath(TETRIS_REPLAY_GAME_ID);
export const MAX_TETRIS_REPLAY_EVENTS = 80_000;

const TETRIS_MIN_BOARD_WIDTH = 4;
const TETRIS_MIN_BOARD_HEIGHT = 8;
const TETRIS_MIN_START_LEVEL = 1;
const TETRIS_EVENT_TYPES = new Set<TetrisReplayEvent["type"]>([
  "advance",
  "hardDrop",
  "moveLeft",
  "moveRight",
  "rotateClockwise",
  "rotateCounterclockwise",
  "softDrop",
  "start",
]);

export const normalizeTetrisReplayRunId = normalizeGameReplayRunId;
export const normalizeTetrisReplaySeed = normalizeGameReplaySeed;
export const createTetrisReplayRandom = createGameReplayRandom;

function isMinimumInteger(value: unknown, minimum: number): value is number {
  return isNonNegativeInteger(value) && value >= minimum;
}

export function createTetrisReplayLeaderboardKey({
  boardHeight,
  boardWidth,
  startLevel,
}: Pick<TetrisReplayPayload, "boardHeight" | "boardWidth" | "startLevel">) {
  return createGameLeaderboardKey(TETRIS_REPLAY_GAME_ID, [
    { name: "board", value: `${boardWidth}x${boardHeight}` },
    { name: "level", value: startLevel },
  ]);
}

function parseTetrisReplayEvent(value: unknown): TetrisReplayEvent | null {
  return parseGameReplayEventEnvelope(value, TETRIS_EVENT_TYPES);
}

export function parseTetrisReplayPayload(value: unknown): ParseTetrisReplayPayloadResult {
  const baseReplay = parseBaseGameReplayPayload(value, {
    gameId: TETRIS_REPLAY_GAME_ID,
    replayLabel: "Tetris replay",
    schemaVersion: TETRIS_REPLAY_SCHEMA_VERSION,
  });

  if (!baseReplay.success) {
    return baseReplay;
  }

  if (!isRecord(value)) {
    return {
      error: "Tetris replay must be a JSON object.",
      success: false,
    };
  }

  if (
    !isMinimumInteger(value.boardWidth, TETRIS_MIN_BOARD_WIDTH) ||
    !isMinimumInteger(value.boardHeight, TETRIS_MIN_BOARD_HEIGHT) ||
    !isMinimumInteger(value.startLevel, TETRIS_MIN_START_LEVEL)
  ) {
    return {
      error: "Tetris replay parameters are not supported.",
      success: false,
    };
  }

  const boardHeight = value.boardHeight;
  const boardWidth = value.boardWidth;
  const startLevel = value.startLevel;

  if (
    baseReplay.payload.leaderboardKey !==
    createTetrisReplayLeaderboardKey({
      boardHeight,
      boardWidth,
      startLevel,
    })
  ) {
    return {
      error: "Tetris replay leaderboard key is not supported.",
      success: false,
    };
  }

  if (
    baseReplay.payload.finalStatus !== "lost" ||
    !isNonNegativeInteger(value.finalLevel) ||
    !isNonNegativeInteger(value.finalLines)
  ) {
    return {
      error: "Tetris replay final state is not supported.",
      success: false,
    };
  }

  if (!Array.isArray(value.events) || value.events.length > MAX_TETRIS_REPLAY_EVENTS) {
    return {
      error: "Tetris replay events are not supported.",
      success: false,
    };
  }

  const events = value.events.map(parseTetrisReplayEvent);

  if (events.some((event) => event === null)) {
    return {
      error: "Tetris replay includes an unsupported event.",
      success: false,
    };
  }

  return {
    payload: {
      ...baseReplay.payload,
      boardHeight,
      boardWidth,
      events: events as TetrisReplayEvent[],
      finalLevel: value.finalLevel,
      finalLines: value.finalLines,
      startLevel,
    },
    success: true,
  };
}

export function createInitialTetrisReplayGame(
  payload: Pick<TetrisReplayPayload, "boardHeight" | "boardWidth" | "seed" | "startLevel">,
) {
  const random = createTetrisReplayRandom(payload.seed);
  const game: TetrisGameState = {
    ...createInitialTetrisGame({
      boardHeight: payload.boardHeight,
      boardWidth: payload.boardWidth,
      random,
      startLevel: payload.startLevel,
    }),
    status: "running",
  };

  return {
    game,
    random,
  };
}

export function applyTetrisReplayEvent(
  current: TetrisGameState,
  event: TetrisReplayEvent,
  random: () => number,
) {
  switch (event.type) {
    case "advance":
      return advanceTetrisGame(current, { random });
    case "hardDrop":
      return hardDropTetrisPiece(current, { random });
    case "moveLeft":
      return moveTetrisPiece(current, -1, 0);
    case "moveRight":
      return moveTetrisPiece(current, 1, 0);
    case "rotateClockwise":
      return rotateTetrisPiece(current);
    case "rotateCounterclockwise":
      return rotateTetrisPiece(current, "counterclockwise");
    case "softDrop":
      return softDropTetrisPiece(current, { random });
    case "start":
      return current;
  }
}

export async function createTetrisReplayRun() {
  return createGenericGameReplayRun(TETRIS_REPLAY_GAME_ID, {
    replayLabel: "Tetris replay",
  });
}

export async function saveTetrisReplay(payload: TetrisReplayPayload) {
  return saveGameReplay(TETRIS_REPLAY_GAME_ID, payload, {
    replayLabel: "Tetris replay",
  });
}

export async function fetchTetrisReplay() {
  return fetchGameReplay(TETRIS_REPLAY_GAME_ID, parseTetrisReplayPayload, {
    replayLabel: "Tetris replay",
  });
}
