import {
  advanceBreakoutGame,
  BREAKOUT_BOARD_HEIGHT,
  BREAKOUT_BOARD_WIDTH,
  BREAKOUT_BRICK_COLUMNS,
  BREAKOUT_BRICK_ROWS,
  BREAKOUT_STARTING_LIVES,
  createInitialBreakoutGame,
  moveBreakoutPaddleLeft,
  moveBreakoutPaddleRight,
  startBreakoutGame,
  type BreakoutGameState,
} from "@/lib/breakout-game-engine";
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
  saveGameReplay,
  type BaseGameReplayPayload,
  type GameReplayRun,
  type ParseGameReplayPayloadResult,
} from "@/lib/game-replay";
import { createGameLeaderboardKey } from "@/lib/leaderboard";

export type BreakoutReplayRun = GameReplayRun;

export type BreakoutReplayStartEvent = {
  seq: number;
  tick: number;
  type: "start";
};

export type BreakoutReplayAdvanceEvent = {
  seq: number;
  tick: number;
  type: "advance";
};

export type BreakoutReplayMoveLeftEvent = {
  seq: number;
  tick: number;
  type: "moveLeft";
};

export type BreakoutReplayMoveRightEvent = {
  seq: number;
  tick: number;
  type: "moveRight";
};

export type BreakoutReplayEvent =
  | BreakoutReplayAdvanceEvent
  | BreakoutReplayMoveLeftEvent
  | BreakoutReplayMoveRightEvent
  | BreakoutReplayStartEvent;

export type BreakoutReplayEventInput = Omit<BreakoutReplayEvent, "seq" | "tick">;

export type BreakoutReplayPayload = BaseGameReplayPayload<
  typeof BREAKOUT_REPLAY_GAME_ID,
  typeof BREAKOUT_REPLAY_SCHEMA_VERSION
> & {
  boardHeight: number;
  boardWidth: number;
  events: BreakoutReplayEvent[];
  finalActiveBrickCount: number;
  finalLives: number;
  startingLives: number;
};

export type ParseBreakoutReplayPayloadResult =
  ParseGameReplayPayloadResult<BreakoutReplayPayload>;

export const BREAKOUT_REPLAY_SCHEMA_VERSION = 1;
export const BREAKOUT_REPLAY_GAME_ID = "breakout";
export const BREAKOUT_REPLAY_API_PATH = getGameReplayApiPath(BREAKOUT_REPLAY_GAME_ID);
export const BREAKOUT_REPLAY_RUN_API_PATH = getGameReplayRunApiPath(
  BREAKOUT_REPLAY_GAME_ID,
);
export const MAX_BREAKOUT_REPLAY_EVENTS = 120_000;

const BREAKOUT_MIN_BOARD_WIDTH = 240;
const BREAKOUT_MIN_BOARD_HEIGHT = 320;
const BREAKOUT_MIN_LIVES = 1;
const BREAKOUT_TOTAL_BRICKS = BREAKOUT_BRICK_COLUMNS * BREAKOUT_BRICK_ROWS;
const BREAKOUT_EVENT_TYPES = new Set<BreakoutReplayEvent["type"]>([
  "advance",
  "moveLeft",
  "moveRight",
  "start",
]);

export const normalizeBreakoutReplayRunId = normalizeGameReplayRunId;
export const normalizeBreakoutReplaySeed = normalizeGameReplaySeed;
export const createBreakoutReplayRandom = createGameReplayRandom;

function isMinimumInteger(value: unknown, minimum: number): value is number {
  return isNonNegativeInteger(value) && value >= minimum;
}

export function createBreakoutReplayLeaderboardKey({
  boardHeight,
  boardWidth,
  startingLives,
}: Pick<BreakoutReplayPayload, "boardHeight" | "boardWidth" | "startingLives">) {
  return createGameLeaderboardKey(BREAKOUT_REPLAY_GAME_ID, [
    { name: "board", value: `${boardWidth}x${boardHeight}` },
    { name: "lives", value: startingLives },
  ]);
}

function parseBreakoutReplayEvent(value: unknown): BreakoutReplayEvent | null {
  if (!isRecord(value) || !isNonNegativeInteger(value.seq) || !isNonNegativeInteger(value.tick)) {
    return null;
  }

  if (
    typeof value.type !== "string" ||
    !BREAKOUT_EVENT_TYPES.has(value.type as BreakoutReplayEvent["type"])
  ) {
    return null;
  }

  return {
    seq: value.seq,
    tick: value.tick,
    type: value.type as BreakoutReplayEvent["type"],
  } as BreakoutReplayEvent;
}

export function parseBreakoutReplayPayload(
  value: unknown,
): ParseBreakoutReplayPayloadResult {
  const baseReplay = parseBaseGameReplayPayload(value, {
    gameId: BREAKOUT_REPLAY_GAME_ID,
    replayLabel: "Breakout replay",
    schemaVersion: BREAKOUT_REPLAY_SCHEMA_VERSION,
  });

  if (!baseReplay.success) {
    return baseReplay;
  }

  if (!isRecord(value)) {
    return {
      error: "Breakout replay must be a JSON object.",
      success: false,
    };
  }

  if (
    !isMinimumInteger(value.boardWidth, BREAKOUT_MIN_BOARD_WIDTH) ||
    !isMinimumInteger(value.boardHeight, BREAKOUT_MIN_BOARD_HEIGHT) ||
    !isMinimumInteger(value.startingLives, BREAKOUT_MIN_LIVES)
  ) {
    return {
      error: "Breakout replay parameters are not supported.",
      success: false,
    };
  }

  const boardHeight = value.boardHeight;
  const boardWidth = value.boardWidth;
  const startingLives = value.startingLives;

  if (
    baseReplay.payload.leaderboardKey !==
    createBreakoutReplayLeaderboardKey({
      boardHeight,
      boardWidth,
      startingLives,
    })
  ) {
    return {
      error: "Breakout replay leaderboard key is not supported.",
      success: false,
    };
  }

  if (
    !isNonNegativeInteger(value.finalLives) ||
    value.finalLives > startingLives ||
    !isNonNegativeInteger(value.finalActiveBrickCount) ||
    value.finalActiveBrickCount > BREAKOUT_TOTAL_BRICKS ||
    (baseReplay.payload.finalStatus === "lost" && value.finalLives !== 0) ||
    (baseReplay.payload.finalStatus === "won" && value.finalActiveBrickCount !== 0)
  ) {
    return {
      error: "Breakout replay final state is not supported.",
      success: false,
    };
  }

  if (!Array.isArray(value.events) || value.events.length > MAX_BREAKOUT_REPLAY_EVENTS) {
    return {
      error: "Breakout replay events are not supported.",
      success: false,
    };
  }

  const events = value.events.map(parseBreakoutReplayEvent);

  if (events.some((event) => event === null)) {
    return {
      error: "Breakout replay includes an unsupported event.",
      success: false,
    };
  }

  return {
    payload: {
      ...baseReplay.payload,
      boardHeight,
      boardWidth,
      events: events as BreakoutReplayEvent[],
      finalActiveBrickCount: value.finalActiveBrickCount,
      finalLives: value.finalLives,
      startingLives,
    },
    success: true,
  };
}

export function createInitialBreakoutReplayGame(
  payload: Pick<BreakoutReplayPayload, "boardHeight" | "boardWidth" | "seed" | "startingLives">,
) {
  const random = createBreakoutReplayRandom(payload.seed);
  const game: BreakoutGameState = createInitialBreakoutGame({
    boardHeight: payload.boardHeight,
    boardWidth: payload.boardWidth,
    lives: payload.startingLives,
  });

  return {
    game,
    random,
  };
}

export function applyBreakoutReplayEvent(
  current: BreakoutGameState,
  event: BreakoutReplayEvent,
  random: () => number,
) {
  switch (event.type) {
    case "advance":
      return advanceBreakoutGame(current, { random });
    case "moveLeft":
      return moveBreakoutPaddleLeft(current);
    case "moveRight":
      return moveBreakoutPaddleRight(current);
    case "start":
      return startBreakoutGame(current);
  }
}

export async function createBreakoutReplayRun() {
  return createGenericGameReplayRun(BREAKOUT_REPLAY_GAME_ID, {
    replayLabel: "Breakout replay",
  });
}

export async function saveBreakoutReplay(payload: BreakoutReplayPayload) {
  return saveGameReplay(BREAKOUT_REPLAY_GAME_ID, payload, {
    replayLabel: "Breakout replay",
  });
}

export async function fetchBreakoutReplay() {
  return fetchGameReplay(BREAKOUT_REPLAY_GAME_ID, parseBreakoutReplayPayload, {
    replayLabel: "Breakout replay",
  });
}

export function createDefaultBreakoutReplayLeaderboardKey() {
  return createBreakoutReplayLeaderboardKey({
    boardHeight: BREAKOUT_BOARD_HEIGHT,
    boardWidth: BREAKOUT_BOARD_WIDTH,
    startingLives: BREAKOUT_STARTING_LIVES,
  });
}
