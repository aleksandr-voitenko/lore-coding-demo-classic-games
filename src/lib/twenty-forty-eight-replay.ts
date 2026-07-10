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
import {
  createInitialTwentyFortyEightGame,
  moveTwentyFortyEightGame,
  type TwentyFortyEightDirection,
  type TwentyFortyEightGameState,
} from "@/lib/twenty-forty-eight-game-engine";

export type TwentyFortyEightReplayRun = GameReplayRun;

type TwentyFortyEightReplayEventInputFor<Event> = Omit<
  Event,
  "elapsedMs" | "seq" | "tick"
>;

export type TwentyFortyEightReplayStartEvent =
  GameReplayEventEnvelope<"start">;

export type TwentyFortyEightReplayMoveEvent =
  GameReplayEventEnvelope<"move"> & {
  direction: TwentyFortyEightDirection;
};

export type TwentyFortyEightReplayEvent =
  | TwentyFortyEightReplayMoveEvent
  | TwentyFortyEightReplayStartEvent;

export type TwentyFortyEightReplayEventInput =
  | TwentyFortyEightReplayEventInputFor<TwentyFortyEightReplayMoveEvent>
  | TwentyFortyEightReplayEventInputFor<TwentyFortyEightReplayStartEvent>;

export type TwentyFortyEightReplayPayload = BaseGameReplayPayload<
  typeof TWENTY_FORTY_EIGHT_REPLAY_GAME_ID,
  typeof TWENTY_FORTY_EIGHT_REPLAY_SCHEMA_VERSION
> & {
  boardSize: number;
  events: TwentyFortyEightReplayEvent[];
  finalMoveCount: number;
  finalTopTile: number;
  winTile: number;
};

export type ParseTwentyFortyEightReplayPayloadResult =
  ParseGameReplayPayloadResult<TwentyFortyEightReplayPayload>;

export const TWENTY_FORTY_EIGHT_REPLAY_SCHEMA_VERSION = 1;
export const TWENTY_FORTY_EIGHT_REPLAY_GAME_ID = "twenty-forty-eight";
export const MAX_TWENTY_FORTY_EIGHT_REPLAY_EVENTS = 50_000;

const TWENTY_FORTY_EIGHT_MIN_BOARD_SIZE = 2;
const TWENTY_FORTY_EIGHT_MIN_WIN_TILE = 4;
const TWENTY_FORTY_EIGHT_DIRECTIONS = ["up", "down", "left", "right"] as const;
const TWENTY_FORTY_EIGHT_EVENT_TYPES = new Set<TwentyFortyEightReplayEvent["type"]>([
  "move",
  "start",
]);

export const normalizeTwentyFortyEightReplayRunId = normalizeGameReplayRunId;
export const normalizeTwentyFortyEightReplaySeed = normalizeGameReplaySeed;
export const createTwentyFortyEightReplayRandom = createGameReplayRandom;

function isMinimumInteger(value: unknown, minimum: number): value is number {
  return isNonNegativeInteger(value) && value >= minimum;
}

function isTwentyFortyEightDirection(value: unknown): value is TwentyFortyEightDirection {
  return (
    typeof value === "string" &&
    (TWENTY_FORTY_EIGHT_DIRECTIONS as readonly string[]).includes(value)
  );
}

export function createTwentyFortyEightReplayLeaderboardKey({
  boardSize,
  winTile,
}: Pick<TwentyFortyEightReplayPayload, "boardSize" | "winTile">) {
  return createGameLeaderboardKey(TWENTY_FORTY_EIGHT_REPLAY_GAME_ID, [
    { name: "board", value: boardSize },
    { name: "goal", value: winTile },
  ]);
}

function parseTwentyFortyEightReplayEvent(
  value: unknown,
): TwentyFortyEightReplayEvent | null {
  const envelope = parseGameReplayEventEnvelope(value, TWENTY_FORTY_EIGHT_EVENT_TYPES);

  if (envelope === null) {
    return null;
  }

  if (envelope.type === "start") {
    return envelope;
  }

  const event = value as Record<string, unknown>;

  if (!isTwentyFortyEightDirection(event.direction)) {
    return null;
  }

  return {
    ...envelope,
    direction: event.direction,
  };
}

export function parseTwentyFortyEightReplayPayload(
  value: unknown,
): ParseTwentyFortyEightReplayPayloadResult {
  const baseReplay = parseBaseGameReplayPayload(value, {
    gameId: TWENTY_FORTY_EIGHT_REPLAY_GAME_ID,
    replayLabel: "2048 replay",
    schemaVersion: TWENTY_FORTY_EIGHT_REPLAY_SCHEMA_VERSION,
  });

  if (!baseReplay.success) {
    return baseReplay;
  }

  if (!isRecord(value)) {
    return {
      error: "2048 replay must be a JSON object.",
      success: false,
    };
  }

  if (
    !isMinimumInteger(value.boardSize, TWENTY_FORTY_EIGHT_MIN_BOARD_SIZE) ||
    !isMinimumInteger(value.winTile, TWENTY_FORTY_EIGHT_MIN_WIN_TILE)
  ) {
    return {
      error: "2048 replay parameters are not supported.",
      success: false,
    };
  }

  const boardSize = value.boardSize;
  const winTile = value.winTile;

  if (
    baseReplay.payload.leaderboardKey !==
    createTwentyFortyEightReplayLeaderboardKey({ boardSize, winTile })
  ) {
    return {
      error: "2048 replay leaderboard key is not supported.",
      success: false,
    };
  }

  if (
    !isNonNegativeInteger(value.finalMoveCount) ||
    !isNonNegativeInteger(value.finalTopTile) ||
    (baseReplay.payload.finalStatus === "won"
      ? value.finalTopTile < winTile
      : value.finalTopTile >= winTile)
  ) {
    return {
      error: "2048 replay final state is not supported.",
      success: false,
    };
  }

  const events = parseGameReplayEvents(value.events, {
    maxEventCount: MAX_TWENTY_FORTY_EIGHT_REPLAY_EVENTS,
    parseEvent: parseTwentyFortyEightReplayEvent,
    unsupportedEventError: "2048 replay includes an unsupported event.",
    unsupportedEventsError: "2048 replay events are not supported.",
  });

  if (!events.success) {
    return events;
  }

  return {
    payload: {
      ...baseReplay.payload,
      boardSize,
      events: events.payload,
      finalMoveCount: value.finalMoveCount,
      finalTopTile: value.finalTopTile,
      winTile,
    },
    success: true,
  };
}

export function createInitialTwentyFortyEightReplayGame(
  payload: Pick<TwentyFortyEightReplayPayload, "boardSize" | "seed" | "winTile">,
) {
  const random = createTwentyFortyEightReplayRandom(payload.seed);
  const game: TwentyFortyEightGameState = {
    ...createInitialTwentyFortyEightGame({
      boardSize: payload.boardSize,
      random,
      winTile: payload.winTile,
    }),
    status: "running",
  };

  return {
    game,
    random,
  };
}

export function applyTwentyFortyEightReplayEvent(
  current: TwentyFortyEightGameState,
  event: TwentyFortyEightReplayEvent,
  random: () => number,
) {
  switch (event.type) {
    case "move":
      return moveTwentyFortyEightGame(current, event.direction, { random });
    case "start":
      return current;
  }
}

export async function createTwentyFortyEightReplayRun() {
  return createGenericGameReplayRun(TWENTY_FORTY_EIGHT_REPLAY_GAME_ID, {
    replayLabel: "2048 replay",
  });
}

export async function saveTwentyFortyEightReplay(
  payload: TwentyFortyEightReplayPayload,
) {
  return saveGameReplay(TWENTY_FORTY_EIGHT_REPLAY_GAME_ID, payload, {
    replayLabel: "2048 replay",
  });
}

export async function fetchTwentyFortyEightReplay() {
  return fetchGameReplay(
    TWENTY_FORTY_EIGHT_REPLAY_GAME_ID,
    parseTwentyFortyEightReplayPayload,
    {
      replayLabel: "2048 replay",
    },
  );
}
