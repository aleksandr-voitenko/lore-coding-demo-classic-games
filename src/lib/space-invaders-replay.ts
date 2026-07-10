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

export type SpaceInvadersReplayRun = GameReplayRun;

type SpaceInvadersReplayEventInputFor<Event> = Omit<
  Event,
  "elapsedMs" | "seq" | "tick"
>;

export type SpaceInvadersReplayStartEvent = GameReplayEventEnvelope<"start">;

export type SpaceInvadersReplayAdvanceEvent =
  GameReplayEventEnvelope<"advance">;

export type SpaceInvadersReplayFireEvent = GameReplayEventEnvelope<"fire">;

export type SpaceInvadersReplayMoveEvent = GameReplayEventEnvelope<"move"> & {
  direction: "left" | "right";
};

export type SpaceInvadersReplayEvent =
  | SpaceInvadersReplayAdvanceEvent
  | SpaceInvadersReplayFireEvent
  | SpaceInvadersReplayMoveEvent
  | SpaceInvadersReplayStartEvent;

export type SpaceInvadersReplayEventInput =
  | SpaceInvadersReplayEventInputFor<SpaceInvadersReplayAdvanceEvent>
  | SpaceInvadersReplayEventInputFor<SpaceInvadersReplayFireEvent>
  | SpaceInvadersReplayEventInputFor<SpaceInvadersReplayMoveEvent>
  | SpaceInvadersReplayEventInputFor<SpaceInvadersReplayStartEvent>;

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
  const envelope = parseGameReplayEventEnvelope(value, SPACE_INVADERS_EVENT_TYPES);

  if (envelope === null) {
    return null;
  }

  if (envelope.type === "move") {
    const event = value as Record<string, unknown>;

    if (event.direction !== "left" && event.direction !== "right") {
      return null;
    }

    return {
      ...envelope,
      direction: event.direction,
    };
  }

  return envelope;
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

  const events = parseGameReplayEvents(value.events, {
    maxEventCount: MAX_SPACE_INVADERS_REPLAY_EVENTS,
    parseEvent: parseSpaceInvadersReplayEvent,
    unsupportedEventError: "Space Invaders replay includes an unsupported event.",
    unsupportedEventsError: "Space Invaders replay events are not supported.",
  });

  if (!events.success) {
    return events;
  }

  return {
    payload: {
      ...baseReplay.payload,
      alienCount,
      boardHeight,
      boardWidth,
      events: events.payload,
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
