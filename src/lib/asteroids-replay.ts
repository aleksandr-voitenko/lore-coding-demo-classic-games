import {
  advanceAsteroidsGame,
  ASTEROIDS_ASTEROID_COUNT_OPTIONS,
  ASTEROIDS_BOARD_HEIGHT,
  ASTEROIDS_BOARD_WIDTH,
  ASTEROIDS_STARTING_ASTEROID_COUNT,
  ASTEROIDS_STARTING_LIVES,
  createInitialAsteroidsGame,
  fireAsteroidsBullet,
  startAsteroidsGame,
  type AsteroidsControlInput,
  type AsteroidsGameState,
} from "@/lib/asteroids-game-engine";
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

export type AsteroidsReplayRun = GameReplayRun;

export type AsteroidsReplayControls = Required<AsteroidsControlInput>;

export type AsteroidsReplayStartEvent = {
  seq: number;
  tick: number;
  type: "start";
};

export type AsteroidsReplayAdvanceEvent = {
  seq: number;
  tick: number;
  type: "advance";
};

export type AsteroidsReplayFireEvent = {
  seq: number;
  tick: number;
  type: "fire";
};

export type AsteroidsReplayControlEvent = {
  controls: AsteroidsReplayControls;
  seq: number;
  tick: number;
  type: "control";
};

export type AsteroidsReplayEvent =
  | AsteroidsReplayAdvanceEvent
  | AsteroidsReplayControlEvent
  | AsteroidsReplayFireEvent
  | AsteroidsReplayStartEvent;

export type AsteroidsReplayEventInput =
  | Omit<AsteroidsReplayAdvanceEvent, "seq" | "tick">
  | Omit<AsteroidsReplayControlEvent, "seq" | "tick">
  | Omit<AsteroidsReplayFireEvent, "seq" | "tick">
  | Omit<AsteroidsReplayStartEvent, "seq" | "tick">;

export type AsteroidsReplayPayload = BaseGameReplayPayload<
  typeof ASTEROIDS_REPLAY_GAME_ID,
  typeof ASTEROIDS_REPLAY_SCHEMA_VERSION
> & {
  boardHeight: number;
  boardWidth: number;
  events: AsteroidsReplayEvent[];
  finalAsteroidCount: number;
  finalLives: number;
  finalWave: number;
  startingAsteroidCount: number;
};

export type AsteroidsReplayPlaybackState = {
  controls: AsteroidsReplayControls;
  game: AsteroidsGameState;
  random: () => number;
};

export type ParseAsteroidsReplayPayloadResult =
  ParseGameReplayPayloadResult<AsteroidsReplayPayload>;

export const ASTEROIDS_REPLAY_SCHEMA_VERSION = 1;
export const ASTEROIDS_REPLAY_GAME_ID = "asteroids";
export const ASTEROIDS_REPLAY_API_PATH = getGameReplayApiPath(ASTEROIDS_REPLAY_GAME_ID);
export const ASTEROIDS_REPLAY_RUN_API_PATH = getGameReplayRunApiPath(
  ASTEROIDS_REPLAY_GAME_ID,
);
export const MAX_ASTEROIDS_REPLAY_EVENTS = 240_000;

const ASTEROIDS_MIN_BOARD_WIDTH = 320;
const ASTEROIDS_MIN_BOARD_HEIGHT = 240;
const ASTEROIDS_EVENT_TYPES = new Set<AsteroidsReplayEvent["type"]>([
  "advance",
  "control",
  "fire",
  "start",
]);

export const normalizeAsteroidsReplayRunId = normalizeGameReplayRunId;
export const normalizeAsteroidsReplaySeed = normalizeGameReplaySeed;
export const createAsteroidsReplayRandom = createGameReplayRandom;

function isMinimumInteger(value: unknown, minimum: number): value is number {
  return isNonNegativeInteger(value) && value >= minimum;
}

function isSupportedAsteroidCount(value: unknown): value is number {
  return (
    isNonNegativeInteger(value) &&
    ASTEROIDS_ASTEROID_COUNT_OPTIONS.includes(
      value as (typeof ASTEROIDS_ASTEROID_COUNT_OPTIONS)[number],
    )
  );
}

function createDefaultAsteroidsReplayControls(): AsteroidsReplayControls {
  return {
    rotateLeft: false,
    rotateRight: false,
    thrust: false,
  };
}

function parseAsteroidsReplayControls(value: unknown): AsteroidsReplayControls | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.rotateLeft !== "boolean" ||
    typeof value.rotateRight !== "boolean" ||
    typeof value.thrust !== "boolean"
  ) {
    return null;
  }

  return {
    rotateLeft: value.rotateLeft,
    rotateRight: value.rotateRight,
    thrust: value.thrust,
  };
}

export function createAsteroidsReplayLeaderboardKey({
  boardHeight,
  boardWidth,
  startingAsteroidCount,
}: Pick<AsteroidsReplayPayload, "boardHeight" | "boardWidth" | "startingAsteroidCount">) {
  return createGameLeaderboardKey(ASTEROIDS_REPLAY_GAME_ID, [
    { name: "board", value: `${boardWidth}x${boardHeight}` },
    { name: "rocks", value: startingAsteroidCount },
  ]);
}

function parseAsteroidsReplayEvent(value: unknown): AsteroidsReplayEvent | null {
  if (!isRecord(value) || !isNonNegativeInteger(value.seq) || !isNonNegativeInteger(value.tick)) {
    return null;
  }

  if (
    typeof value.type !== "string" ||
    !ASTEROIDS_EVENT_TYPES.has(value.type as AsteroidsReplayEvent["type"])
  ) {
    return null;
  }

  if (value.type === "control") {
    const controls = parseAsteroidsReplayControls(value.controls);

    if (controls === null) {
      return null;
    }

    return {
      controls,
      seq: value.seq,
      tick: value.tick,
      type: "control",
    };
  }

  return {
    seq: value.seq,
    tick: value.tick,
    type: value.type as Exclude<AsteroidsReplayEvent["type"], "control">,
  } as AsteroidsReplayEvent;
}

export function parseAsteroidsReplayPayload(
  value: unknown,
): ParseAsteroidsReplayPayloadResult {
  const baseReplay = parseBaseGameReplayPayload(value, {
    gameId: ASTEROIDS_REPLAY_GAME_ID,
    replayLabel: "Asteroids replay",
    schemaVersion: ASTEROIDS_REPLAY_SCHEMA_VERSION,
  });

  if (!baseReplay.success) {
    return baseReplay;
  }

  if (!isRecord(value)) {
    return {
      error: "Asteroids replay must be a JSON object.",
      success: false,
    };
  }

  if (
    !isMinimumInteger(value.boardWidth, ASTEROIDS_MIN_BOARD_WIDTH) ||
    !isMinimumInteger(value.boardHeight, ASTEROIDS_MIN_BOARD_HEIGHT) ||
    !isSupportedAsteroidCount(value.startingAsteroidCount)
  ) {
    return {
      error: "Asteroids replay parameters are not supported.",
      success: false,
    };
  }

  const boardHeight = value.boardHeight;
  const boardWidth = value.boardWidth;
  const startingAsteroidCount = value.startingAsteroidCount;

  if (
    baseReplay.payload.leaderboardKey !==
    createAsteroidsReplayLeaderboardKey({
      boardHeight,
      boardWidth,
      startingAsteroidCount,
    })
  ) {
    return {
      error: "Asteroids replay leaderboard key is not supported.",
      success: false,
    };
  }

  if (
    baseReplay.payload.finalStatus !== "lost" ||
    !isNonNegativeInteger(value.finalLives) ||
    value.finalLives !== 0 ||
    value.finalLives > ASTEROIDS_STARTING_LIVES ||
    !isMinimumInteger(value.finalWave, 1) ||
    !isNonNegativeInteger(value.finalAsteroidCount)
  ) {
    return {
      error: "Asteroids replay final state is not supported.",
      success: false,
    };
  }

  if (!Array.isArray(value.events) || value.events.length > MAX_ASTEROIDS_REPLAY_EVENTS) {
    return {
      error: "Asteroids replay events are not supported.",
      success: false,
    };
  }

  const events = value.events.map(parseAsteroidsReplayEvent);

  if (events.some((event) => event === null)) {
    return {
      error: "Asteroids replay includes an unsupported event.",
      success: false,
    };
  }

  return {
    payload: {
      ...baseReplay.payload,
      boardHeight,
      boardWidth,
      events: events as AsteroidsReplayEvent[],
      finalAsteroidCount: value.finalAsteroidCount,
      finalLives: value.finalLives,
      finalWave: value.finalWave,
      startingAsteroidCount,
    },
    success: true,
  };
}

export function createInitialAsteroidsReplayGame(
  payload: Pick<
    AsteroidsReplayPayload,
    "boardHeight" | "boardWidth" | "seed" | "startingAsteroidCount"
  >,
): AsteroidsReplayPlaybackState {
  const random = createAsteroidsReplayRandom(payload.seed);
  const game = createInitialAsteroidsGame({
    asteroidCount: payload.startingAsteroidCount,
    boardHeight: payload.boardHeight,
    boardWidth: payload.boardWidth,
    random,
  });

  return {
    controls: createDefaultAsteroidsReplayControls(),
    game,
    random,
  };
}

export function applyAsteroidsReplayEvent(
  current: AsteroidsReplayPlaybackState,
  event: AsteroidsReplayEvent,
): AsteroidsReplayPlaybackState {
  switch (event.type) {
    case "advance":
      return {
        ...current,
        game: advanceAsteroidsGame(current.game, current.controls, {
          random: current.random,
        }),
      };
    case "control":
      return {
        ...current,
        controls: event.controls,
      };
    case "fire":
      return {
        ...current,
        game: fireAsteroidsBullet(current.game),
      };
    case "start":
      return {
        ...current,
        game: startAsteroidsGame(current.game),
      };
  }
}

export async function createAsteroidsReplayRun() {
  return createGenericGameReplayRun(ASTEROIDS_REPLAY_GAME_ID, {
    replayLabel: "Asteroids replay",
  });
}

export async function saveAsteroidsReplay(payload: AsteroidsReplayPayload) {
  return saveGameReplay(ASTEROIDS_REPLAY_GAME_ID, payload, {
    replayLabel: "Asteroids replay",
  });
}

export async function fetchAsteroidsReplay() {
  return fetchGameReplay(ASTEROIDS_REPLAY_GAME_ID, parseAsteroidsReplayPayload, {
    replayLabel: "Asteroids replay",
  });
}

export function createDefaultAsteroidsReplayLeaderboardKey() {
  return createAsteroidsReplayLeaderboardKey({
    boardHeight: ASTEROIDS_BOARD_HEIGHT,
    boardWidth: ASTEROIDS_BOARD_WIDTH,
    startingAsteroidCount: ASTEROIDS_STARTING_ASTEROID_COUNT,
  });
}
