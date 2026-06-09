import {
  advanceSnakeGame,
  createInitialGame,
  expireTimedFood,
  isTimedFoodKind,
  queueGameDirection,
  spawnTimedFood,
  type Direction,
  type GameState,
  type GameStatus,
  type TimedFoodKind,
} from "@/lib/snake-game-engine";

export type SnakeReplayRun = {
  id: string;
  seed: number;
};

export type SnakeReplayStartEvent = {
  seq: number;
  tick: number;
  type: "start";
};

export type SnakeReplayDirectionEvent = {
  direction: Direction;
  seq: number;
  tick: number;
  type: "direction";
};

export type SnakeReplayAdvanceEvent = {
  seq: number;
  tick: number;
  type: "advance";
};

export type SnakeReplaySpawnTimedFoodEvent = {
  kind: TimedFoodKind;
  nowMs: number;
  seq: number;
  tick: number;
  type: "spawnTimedFood";
};

export type SnakeReplayExpireTimedFoodEvent = {
  expiresAt: number;
  kind: TimedFoodKind;
  seq: number;
  tick: number;
  type: "expireTimedFood";
};

export type SnakeReplayEvent =
  | SnakeReplayAdvanceEvent
  | SnakeReplayDirectionEvent
  | SnakeReplayExpireTimedFoodEvent
  | SnakeReplaySpawnTimedFoodEvent
  | SnakeReplayStartEvent;

export type SnakeReplayEventInput =
  | Omit<SnakeReplayAdvanceEvent, "seq" | "tick">
  | Omit<SnakeReplayDirectionEvent, "seq" | "tick">
  | Omit<SnakeReplayExpireTimedFoodEvent, "seq" | "tick">
  | Omit<SnakeReplaySpawnTimedFoodEvent, "seq" | "tick">
  | Omit<SnakeReplayStartEvent, "seq" | "tick">;

export type SnakeReplayPayload = {
  events: SnakeReplayEvent[];
  finalLevel: number;
  finalScore: number;
  finalStatus: Extract<GameStatus, "lost" | "won">;
  finalTick: number;
  gameId: "snake";
  leaderboardKey: string;
  runId: string;
  schemaVersion: typeof SNAKE_REPLAY_SCHEMA_VERSION;
  seed: number;
  startedAt: string;
};

export type ParseSnakeReplayPayloadResult =
  | {
      payload: SnakeReplayPayload;
      success: true;
    }
  | {
      error: string;
      success: false;
    };

export const SNAKE_REPLAY_API_PATH = "/api/replays/snake";
export const SNAKE_REPLAY_RUN_API_PATH = "/api/replays/snake/run";
export const SNAKE_REPLAY_SCHEMA_VERSION = 1;
export const SNAKE_REPLAY_GAME_ID = "snake";
export const MAX_SNAKE_REPLAY_EVENTS = 50_000;

const MAX_REPLAY_SEED = 2_147_483_646;
const REPLAY_RUN_ID_PATTERN = /^[a-zA-Z0-9-]{1,80}$/;
const DIRECTIONS = ["up", "right", "down", "left"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isDirection(value: unknown): value is Direction {
  return typeof value === "string" && (DIRECTIONS as readonly string[]).includes(value);
}

export function normalizeSnakeReplayRunId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const runId = value.trim();

  return REPLAY_RUN_ID_PATTERN.test(runId) ? runId : null;
}

export function normalizeSnakeReplaySeed(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_REPLAY_SEED
  ) {
    return null;
  }

  return value;
}

export function createSnakeReplayRandom(seed: number) {
  let value = seed % 2_147_483_647;

  if (value <= 0) {
    value += 2_147_483_646;
  }

  return () => {
    value = (value * 16_807) % 2_147_483_647;

    return (value - 1) / 2_147_483_646;
  };
}

function parseSnakeReplayEvent(value: unknown): SnakeReplayEvent | null {
  if (!isRecord(value) || !isNonNegativeInteger(value.seq) || !isNonNegativeInteger(value.tick)) {
    return null;
  }

  if (value.type === "start") {
    return {
      seq: value.seq,
      tick: value.tick,
      type: "start",
    };
  }

  if (value.type === "advance") {
    return {
      seq: value.seq,
      tick: value.tick,
      type: "advance",
    };
  }

  if (value.type === "direction" && isDirection(value.direction)) {
    return {
      direction: value.direction,
      seq: value.seq,
      tick: value.tick,
      type: "direction",
    };
  }

  if (
    value.type === "spawnTimedFood" &&
    isTimedFoodKind(value.kind) &&
    isNonNegativeInteger(value.nowMs)
  ) {
    return {
      kind: value.kind,
      nowMs: value.nowMs,
      seq: value.seq,
      tick: value.tick,
      type: "spawnTimedFood",
    };
  }

  if (
    value.type === "expireTimedFood" &&
    isTimedFoodKind(value.kind) &&
    isNonNegativeInteger(value.expiresAt)
  ) {
    return {
      expiresAt: value.expiresAt,
      kind: value.kind,
      seq: value.seq,
      tick: value.tick,
      type: "expireTimedFood",
    };
  }

  return null;
}

export function parseSnakeReplayPayload(value: unknown): ParseSnakeReplayPayloadResult {
  if (!isRecord(value)) {
    return {
      error: "Snake replay must be a JSON object.",
      success: false,
    };
  }

  if (value.schemaVersion !== SNAKE_REPLAY_SCHEMA_VERSION || value.gameId !== SNAKE_REPLAY_GAME_ID) {
    return {
      error: "Snake replay version is not supported.",
      success: false,
    };
  }

  const runId = normalizeSnakeReplayRunId(value.runId);
  const seed = normalizeSnakeReplaySeed(value.seed);

  if (runId === null || seed === null) {
    return {
      error: "Snake replay run is not supported.",
      success: false,
    };
  }

  if (typeof value.leaderboardKey !== "string" || value.leaderboardKey.length === 0) {
    return {
      error: "Snake replay leaderboard key is not supported.",
      success: false,
    };
  }

  if (typeof value.startedAt !== "string" || Number.isNaN(Date.parse(value.startedAt))) {
    return {
      error: "Snake replay start time is not supported.",
      success: false,
    };
  }

  if (
    !isNonNegativeInteger(value.finalScore) ||
    !isNonNegativeInteger(value.finalLevel) ||
    !isNonNegativeInteger(value.finalTick) ||
    (value.finalStatus !== "lost" && value.finalStatus !== "won")
  ) {
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
      events: events as SnakeReplayEvent[],
      finalLevel: value.finalLevel,
      finalScore: value.finalScore,
      finalStatus: value.finalStatus,
      finalTick: value.finalTick,
      gameId: SNAKE_REPLAY_GAME_ID,
      leaderboardKey: value.leaderboardKey,
      runId,
      schemaVersion: SNAKE_REPLAY_SCHEMA_VERSION,
      seed,
      startedAt: value.startedAt,
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

function getResponseError(response: Response, context: string) {
  return new Error(`${context} failed with status ${response.status}`);
}

export async function createSnakeReplayRun() {
  const response = await fetch(SNAKE_REPLAY_RUN_API_PATH, {
    method: "POST",
  });

  if (!response.ok) {
    throw getResponseError(response, "Snake replay run request");
  }

  const payload: unknown = await response.json();

  if (!isRecord(payload)) {
    throw new Error("Snake replay run response was not a JSON object.");
  }

  const id = normalizeSnakeReplayRunId(payload.id);
  const seed = normalizeSnakeReplaySeed(payload.seed);

  if (id === null || seed === null) {
    throw new Error("Snake replay run response did not include a valid run.");
  }

  return {
    id,
    seed,
  };
}

export async function saveSnakeReplay(payload: SnakeReplayPayload) {
  const response = await fetch(SNAKE_REPLAY_API_PATH, {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw getResponseError(response, "Snake replay save request");
  }
}

export async function fetchSnakeReplay() {
  const response = await fetch(SNAKE_REPLAY_API_PATH, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw getResponseError(response, "Snake replay download request");
  }

  const payload: unknown = await response.json();
  const replayValue = isRecord(payload) ? payload.replay : null;
  const parsedReplay = parseSnakeReplayPayload(replayValue);

  if (!parsedReplay.success) {
    throw new Error(parsedReplay.error);
  }

  return parsedReplay.payload;
}
