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
import {
  createInitialTwentyFortyEightGame,
  moveTwentyFortyEightGame,
  type TwentyFortyEightDirection,
  type TwentyFortyEightGameState,
} from "@/lib/twenty-forty-eight-game-engine";

export type TwentyFortyEightReplayRun = GameReplayRun;

export type TwentyFortyEightReplayStartEvent = {
  seq: number;
  tick: number;
  type: "start";
};

export type TwentyFortyEightReplayMoveEvent = {
  direction: TwentyFortyEightDirection;
  seq: number;
  tick: number;
  type: "move";
};

export type TwentyFortyEightReplayEvent =
  | TwentyFortyEightReplayMoveEvent
  | TwentyFortyEightReplayStartEvent;

export type TwentyFortyEightReplayEventInput =
  | Omit<TwentyFortyEightReplayMoveEvent, "seq" | "tick">
  | Omit<TwentyFortyEightReplayStartEvent, "seq" | "tick">;

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
export const TWENTY_FORTY_EIGHT_REPLAY_API_PATH = getGameReplayApiPath(
  TWENTY_FORTY_EIGHT_REPLAY_GAME_ID,
);
export const TWENTY_FORTY_EIGHT_REPLAY_RUN_API_PATH = getGameReplayRunApiPath(
  TWENTY_FORTY_EIGHT_REPLAY_GAME_ID,
);
export const MAX_TWENTY_FORTY_EIGHT_REPLAY_EVENTS = 50_000;

const TWENTY_FORTY_EIGHT_MIN_BOARD_SIZE = 2;
const TWENTY_FORTY_EIGHT_MIN_WIN_TILE = 4;
const TWENTY_FORTY_EIGHT_DIRECTIONS = ["up", "down", "left", "right"] as const;

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

  if (value.type === "move" && isTwentyFortyEightDirection(value.direction)) {
    return {
      direction: value.direction,
      seq: value.seq,
      tick: value.tick,
      type: "move",
    };
  }

  return null;
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

  if (
    !Array.isArray(value.events) ||
    value.events.length > MAX_TWENTY_FORTY_EIGHT_REPLAY_EVENTS
  ) {
    return {
      error: "2048 replay events are not supported.",
      success: false,
    };
  }

  const events = value.events.map(parseTwentyFortyEightReplayEvent);

  if (events.some((event) => event === null)) {
    return {
      error: "2048 replay includes an unsupported event.",
      success: false,
    };
  }

  return {
    payload: {
      ...baseReplay.payload,
      boardSize,
      events: events as TwentyFortyEightReplayEvent[],
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
