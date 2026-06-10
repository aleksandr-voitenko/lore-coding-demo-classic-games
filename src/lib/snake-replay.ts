import {
  advanceSnakeGame,
  createInitialGame,
  expireTimedFood,
  isTimedFoodKind,
  queueGameDirection,
  spawnTimedFood,
  type Direction,
  type GameState,
  type TimedFoodKind,
} from "@/lib/snake-game-engine";
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

export type SnakeReplayRun = GameReplayRun;

type SnakeReplayEventInputFor<Event> = Omit<Event, "elapsedMs" | "seq" | "tick">;

export type SnakeReplayStartEvent = GameReplayEventEnvelope<"start">;

export type SnakeReplayDirectionEvent = GameReplayEventEnvelope<"direction"> & {
  direction: Direction;
};

export type SnakeReplayAdvanceEvent = GameReplayEventEnvelope<"advance">;

export type SnakeReplaySpawnTimedFoodEvent =
  GameReplayEventEnvelope<"spawnTimedFood"> & {
  kind: TimedFoodKind;
  nowMs: number;
};

export type SnakeReplayExpireTimedFoodEvent =
  GameReplayEventEnvelope<"expireTimedFood"> & {
  expiresAt: number;
  kind: TimedFoodKind;
};

export type SnakeReplayEvent =
  | SnakeReplayAdvanceEvent
  | SnakeReplayDirectionEvent
  | SnakeReplayExpireTimedFoodEvent
  | SnakeReplaySpawnTimedFoodEvent
  | SnakeReplayStartEvent;

export type SnakeReplayEventInput =
  | SnakeReplayEventInputFor<SnakeReplayAdvanceEvent>
  | SnakeReplayEventInputFor<SnakeReplayDirectionEvent>
  | SnakeReplayEventInputFor<SnakeReplayExpireTimedFoodEvent>
  | SnakeReplayEventInputFor<SnakeReplaySpawnTimedFoodEvent>
  | SnakeReplayEventInputFor<SnakeReplayStartEvent>;

export type SnakeReplayPayload = BaseGameReplayPayload<
  typeof SNAKE_REPLAY_GAME_ID,
  typeof SNAKE_REPLAY_SCHEMA_VERSION
> & {
  events: SnakeReplayEvent[];
  finalLevel: number;
};

export type ParseSnakeReplayPayloadResult =
  ParseGameReplayPayloadResult<SnakeReplayPayload>;

export const SNAKE_REPLAY_SCHEMA_VERSION = 1;
export const SNAKE_REPLAY_GAME_ID = "snake";
export const SNAKE_REPLAY_API_PATH = getGameReplayApiPath(SNAKE_REPLAY_GAME_ID);
export const SNAKE_REPLAY_RUN_API_PATH = getGameReplayRunApiPath(SNAKE_REPLAY_GAME_ID);
export const MAX_SNAKE_REPLAY_EVENTS = 50_000;

const DIRECTIONS = ["up", "right", "down", "left"] as const;
const SNAKE_EVENT_TYPES = new Set<SnakeReplayEvent["type"]>([
  "advance",
  "direction",
  "expireTimedFood",
  "spawnTimedFood",
  "start",
]);

function isDirection(value: unknown): value is Direction {
  return typeof value === "string" && (DIRECTIONS as readonly string[]).includes(value);
}

export const normalizeSnakeReplayRunId = normalizeGameReplayRunId;
export const normalizeSnakeReplaySeed = normalizeGameReplaySeed;
export const createSnakeReplayRandom = createGameReplayRandom;

function parseSnakeReplayEvent(value: unknown): SnakeReplayEvent | null {
  const envelope = parseGameReplayEventEnvelope(value, SNAKE_EVENT_TYPES);

  if (envelope === null) {
    return null;
  }

  const event = value as Record<string, unknown>;

  switch (envelope.type) {
    case "advance":
    case "start":
      return envelope;

    case "direction":
      if (!isDirection(event.direction)) {
        return null;
      }

      return {
        ...envelope,
        direction: event.direction,
      };

    case "expireTimedFood":
      if (!isTimedFoodKind(event.kind) || !isNonNegativeInteger(event.expiresAt)) {
        return null;
      }

      return {
        ...envelope,
        expiresAt: event.expiresAt,
        kind: event.kind,
      };

    case "spawnTimedFood":
      if (!isTimedFoodKind(event.kind) || !isNonNegativeInteger(event.nowMs)) {
        return null;
      }

      return {
        ...envelope,
        kind: event.kind,
        nowMs: event.nowMs,
      };
  }
}

export function parseSnakeReplayPayload(value: unknown): ParseSnakeReplayPayloadResult {
  const baseReplay = parseBaseGameReplayPayload(value, {
    gameId: SNAKE_REPLAY_GAME_ID,
    replayLabel: "Snake replay",
    schemaVersion: SNAKE_REPLAY_SCHEMA_VERSION,
  });

  if (!baseReplay.success) {
    return baseReplay;
  }

  if (!isRecord(value) || !isNonNegativeInteger(value.finalLevel)) {
    return {
      error: "Snake replay final state is not supported.",
      success: false,
    };
  }

  if (!Array.isArray(value.events) || value.events.length > MAX_SNAKE_REPLAY_EVENTS) {
    return {
      error: "Snake replay events are not supported.",
      success: false,
    };
  }

  const events = value.events.map(parseSnakeReplayEvent);

  if (events.some((event) => event === null)) {
    return {
      error: "Snake replay includes an unsupported event.",
      success: false,
    };
  }

  return {
    payload: {
      ...baseReplay.payload,
      events: events as SnakeReplayEvent[],
      finalLevel: value.finalLevel,
    },
    success: true,
  };
}

export function createInitialSnakeReplayGame(
  payload: Pick<SnakeReplayPayload, "seed">,
  bestScore = 0,
) {
  const random = createSnakeReplayRandom(payload.seed);
  const game: GameState = {
    ...createInitialGame({
      bestScore,
      random,
    }),
    status: "running",
  };

  return {
    game,
    random,
  };
}

export function applySnakeReplayEvent(
  current: GameState,
  event: SnakeReplayEvent,
  random: () => number,
) {
  switch (event.type) {
    case "advance":
      return advanceSnakeGame(current, { random });
    case "direction":
      return queueGameDirection(current, event.direction);
    case "expireTimedFood":
      return expireTimedFood(current, event.kind, event.expiresAt);
    case "spawnTimedFood":
      return spawnTimedFood(current, event.kind, {
        now: () => event.nowMs,
        random,
      });
    case "start":
      return current;
  }
}

export async function createSnakeReplayRun() {
  return createGenericGameReplayRun(SNAKE_REPLAY_GAME_ID, {
    replayLabel: "Snake replay",
  });
}

export async function saveSnakeReplay(payload: SnakeReplayPayload) {
  return saveGameReplay(SNAKE_REPLAY_GAME_ID, payload, {
    replayLabel: "Snake replay",
  });
}

export async function fetchSnakeReplay() {
  return fetchGameReplay(SNAKE_REPLAY_GAME_ID, parseSnakeReplayPayload, {
    replayLabel: "Snake replay",
  });
}
