import {
  advanceSpaceInvadersGame,
  createInitialSpaceInvadersGame,
  fireSpaceInvadersShot,
  moveSpaceInvadersPlayerLeft,
  moveSpaceInvadersPlayerRight,
  SPACE_INVADERS_ALIEN_COUNT_OPTIONS,
  SPACE_INVADERS_BOARD_HEIGHT,
  SPACE_INVADERS_BOARD_WIDTH,
  SPACE_INVADERS_COLUMNS,
  SPACE_INVADERS_ROWS,
  startSpaceInvadersGame,
  type SpaceInvadersGameState,
} from "@/lib/space-invaders-game-engine";
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

export type SpaceInvadersReplayRun = GameReplayRun;

export type SpaceInvadersReplayStartEvent = {
  seq: number;
  tick: number;
  type: "start";
};

export type SpaceInvadersReplayAdvanceEvent = {
  seq: number;
  tick: number;
  type: "advance";
};

export type SpaceInvadersReplayFireEvent = {
  seq: number;
  tick: number;
  type: "fire";
};

export type SpaceInvadersReplayMoveEvent = {
  direction: "left" | "right";
  seq: number;
  tick: number;
  type: "move";
};

export type SpaceInvadersReplayEvent =
  | SpaceInvadersReplayAdvanceEvent
  | SpaceInvadersReplayFireEvent
  | SpaceInvadersReplayMoveEvent
  | SpaceInvadersReplayStartEvent;

export type SpaceInvadersReplayEventInput =
  | Omit<SpaceInvadersReplayAdvanceEvent, "seq" | "tick">
  | Omit<SpaceInvadersReplayFireEvent, "seq" | "tick">
  | Omit<SpaceInvadersReplayMoveEvent, "seq" | "tick">
  | Omit<SpaceInvadersReplayStartEvent, "seq" | "tick">;

export type SpaceInvadersReplayPayload = BaseGameReplayPayload<
  typeof SPACE_INVADERS_REPLAY_GAME_ID,
  typeof SPACE_INVADERS_REPLAY_SCHEMA_VERSION
> & {
  alienCount: number;
  boardHeight: number;
  boardWidth: number;
  events: SpaceInvadersReplayEvent[];
  finalInvaderCount: number;
  finalLives: number;
};

export type SpaceInvadersReplayPlaybackState = {
  game: SpaceInvadersGameState;
  random: () => number;
};

export type ParseSpaceInvadersReplayPayloadResult =
  ParseGameReplayPayloadResult<SpaceInvadersReplayPayload>;

export const SPACE_INVADERS_REPLAY_SCHEMA_VERSION = 1;
export const SPACE_INVADERS_REPLAY_GAME_ID = "space-invaders";
export const SPACE_INVADERS_REPLAY_API_PATH = getGameReplayApiPath(
  SPACE_INVADERS_REPLAY_GAME_ID,
);
export const SPACE_INVADERS_REPLAY_RUN_API_PATH = getGameReplayRunApiPath(
  SPACE_INVADERS_REPLAY_GAME_ID,
);
export const MAX_SPACE_INVADERS_REPLAY_EVENTS = 240_000;

const SPACE_INVADERS_MIN_BOARD_WIDTH = 360;
const SPACE_INVADERS_MIN_BOARD_HEIGHT = 480;
const SPACE_INVADERS_EVENT_TYPES = new Set<SpaceInvadersReplayEvent["type"]>([
  "advance",
  "fire",
  "move",
  "start",
]);

export const normalizeSpaceInvadersReplayRunId = normalizeGameReplayRunId;
export const normalizeSpaceInvadersReplaySeed = normalizeGameReplaySeed;
export const createSpaceInvadersReplayRandom = createGameReplayRandom;

function isMinimumInteger(value: unknown, minimum: number): value is number {
  return isNonNegativeInteger(value) && value >= minimum;
}

function isSupportedAlienCount(value: unknown): value is number {
  return (
    isNonNegativeInteger(value) &&
    SPACE_INVADERS_ALIEN_COUNT_OPTIONS.some(
      (option) => option.alienCount === value,
    )
  );
}

export function createSpaceInvadersReplayLeaderboardKey({
  alienCount,
  boardHeight,
  boardWidth,
}: Pick<SpaceInvadersReplayPayload, "alienCount" | "boardHeight" | "boardWidth">) {
  return createGameLeaderboardKey(SPACE_INVADERS_REPLAY_GAME_ID, [
    { name: "board", value: `${boardWidth}x${boardHeight}` },
    { name: "aliens", value: alienCount },
  ]);
}

function parseSpaceInvadersReplayEvent(
  value: unknown,
): SpaceInvadersReplayEvent | null {
  if (!isRecord(value) || !isNonNegativeInteger(value.seq) || !isNonNegativeInteger(value.tick)) {
    return null;
  }

  if (
    typeof value.type !== "string" ||
    !SPACE_INVADERS_EVENT_TYPES.has(value.type as SpaceInvadersReplayEvent["type"])
  ) {
    return null;
  }

  if (value.type === "move") {
    if (value.direction !== "left" && value.direction !== "right") {
      return null;
    }

    return {
      direction: value.direction,
      seq: value.seq,
      tick: value.tick,
      type: "move",
    };
  }

  return {
    seq: value.seq,
    tick: value.tick,
    type: value.type as Exclude<SpaceInvadersReplayEvent["type"], "move">,
  } as SpaceInvadersReplayEvent;
}

export function parseSpaceInvadersReplayPayload(
  value: unknown,
): ParseSpaceInvadersReplayPayloadResult {
  const baseReplay = parseBaseGameReplayPayload(value, {
    gameId: SPACE_INVADERS_REPLAY_GAME_ID,
    replayLabel: "Space Invaders replay",
    schemaVersion: SPACE_INVADERS_REPLAY_SCHEMA_VERSION,
  });

  if (!baseReplay.success) {
    return baseReplay;
  }

  if (!isRecord(value)) {
    return {
      error: "Space Invaders replay must be a JSON object.",
      success: false,
    };
  }

  if (
    !isMinimumInteger(value.boardWidth, SPACE_INVADERS_MIN_BOARD_WIDTH) ||
    !isMinimumInteger(value.boardHeight, SPACE_INVADERS_MIN_BOARD_HEIGHT) ||
    !isSupportedAlienCount(value.alienCount)
  ) {
    return {
      error: "Space Invaders replay parameters are not supported.",
      success: false,
    };
  }

  const alienCount = value.alienCount;
  const boardHeight = value.boardHeight;
  const boardWidth = value.boardWidth;

  if (
    baseReplay.payload.leaderboardKey !==
    createSpaceInvadersReplayLeaderboardKey({
      alienCount,
      boardHeight,
      boardWidth,
    })
  ) {
    return {
      error: "Space Invaders replay leaderboard key is not supported.",
      success: false,
    };
  }

  if (
    !isNonNegativeInteger(value.finalLives) ||
    !isNonNegativeInteger(value.finalInvaderCount) ||
    (baseReplay.payload.finalStatus === "lost" && value.finalLives !== 0) ||
    (baseReplay.payload.finalStatus === "won" && value.finalInvaderCount !== 0)
  ) {
    return {
      error: "Space Invaders replay final state is not supported.",
      success: false,
    };
  }

  if (
    !Array.isArray(value.events) ||
    value.events.length > MAX_SPACE_INVADERS_REPLAY_EVENTS
  ) {
    return {
      error: "Space Invaders replay events are not supported.",
      success: false,
    };
  }

  const events = value.events.map(parseSpaceInvadersReplayEvent);

  if (events.some((event) => event === null)) {
    return {
      error: "Space Invaders replay includes an unsupported event.",
      success: false,
    };
  }

  return {
    payload: {
      ...baseReplay.payload,
      alienCount,
      boardHeight,
      boardWidth,
      events: events as SpaceInvadersReplayEvent[],
      finalInvaderCount: value.finalInvaderCount,
      finalLives: value.finalLives,
    },
    success: true,
  };
}

export function createInitialSpaceInvadersReplayGame(
  payload: Pick<
    SpaceInvadersReplayPayload,
    "alienCount" | "boardHeight" | "boardWidth" | "seed"
  >,
): SpaceInvadersReplayPlaybackState {
  const random = createSpaceInvadersReplayRandom(payload.seed);
  const game = createInitialSpaceInvadersGame({
    alienCount: payload.alienCount,
    boardHeight: payload.boardHeight,
    boardWidth: payload.boardWidth,
    random,
  });

  return {
    game,
    random,
  };
}

export function applySpaceInvadersReplayEvent(
  current: SpaceInvadersReplayPlaybackState,
  event: SpaceInvadersReplayEvent,
): SpaceInvadersReplayPlaybackState {
  switch (event.type) {
    case "advance":
      return {
        ...current,
        game: advanceSpaceInvadersGame(current.game, current.random),
      };
    case "fire":
      return {
        ...current,
        game: fireSpaceInvadersShot(current.game),
      };
    case "move":
      return {
        ...current,
        game:
          event.direction === "left"
            ? moveSpaceInvadersPlayerLeft(current.game)
            : moveSpaceInvadersPlayerRight(current.game),
      };
    case "start":
      return {
        ...current,
        game: startSpaceInvadersGame(current.game),
      };
  }
}

export async function createSpaceInvadersReplayRun() {
  return createGenericGameReplayRun(SPACE_INVADERS_REPLAY_GAME_ID, {
    replayLabel: "Space Invaders replay",
  });
}

export async function saveSpaceInvadersReplay(payload: SpaceInvadersReplayPayload) {
  return saveGameReplay(SPACE_INVADERS_REPLAY_GAME_ID, payload, {
    replayLabel: "Space Invaders replay",
  });
}

export async function fetchSpaceInvadersReplay() {
  return fetchGameReplay(
    SPACE_INVADERS_REPLAY_GAME_ID,
    parseSpaceInvadersReplayPayload,
    {
      replayLabel: "Space Invaders replay",
    },
  );
}

export function createDefaultSpaceInvadersReplayLeaderboardKey() {
  return createSpaceInvadersReplayLeaderboardKey({
    alienCount: SPACE_INVADERS_COLUMNS * SPACE_INVADERS_ROWS,
    boardHeight: SPACE_INVADERS_BOARD_HEIGHT,
    boardWidth: SPACE_INVADERS_BOARD_WIDTH,
  });
}
