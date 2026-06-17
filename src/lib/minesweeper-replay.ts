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
  parseGameReplayCursorEvent,
  parseGameReplayEventEnvelope,
  parseGameReplayEvents,
  saveGameReplay,
  shouldRecordGameReplayCursorEvent,
  type BaseGameReplayPayload,
  type GameReplayCursorPosition,
  type GameReplayEventEnvelope,
  type GameReplayRun,
  type ParseGameReplayPayloadResult,
} from "@/lib/game-replay";
import { createGameLeaderboardKey } from "@/lib/leaderboard";
import {
  createInitialMinesweeperGame,
  getMinesweeperDifficultySettings,
  getMinesweeperCellId,
  normalizeMinesweeperDifficulty,
  revealMinesweeperCell,
  toggleMinesweeperFlag,
  type MinesweeperDifficulty,
  type MinesweeperGameState,
} from "@/lib/minesweeper-game-engine";

export type MinesweeperReplayRun = GameReplayRun;

type MinesweeperReplayEventInputFor<Event> = Omit<
  Event,
  "elapsedMs" | "seq" | "tick"
>;

export type MinesweeperReplayCursorPosition = GameReplayCursorPosition;

export type MinesweeperReplayStartEvent = GameReplayEventEnvelope<"start">;

export type MinesweeperReplayRevealEvent = GameReplayEventEnvelope<"reveal"> & {
  cellId: string;
};

export type MinesweeperReplayToggleFlagEvent =
  GameReplayEventEnvelope<"toggleFlag"> & {
  cellId: string;
};

export type MinesweeperReplayEvent =
  | MinesweeperReplayRevealEvent
  | MinesweeperReplayStartEvent
  | MinesweeperReplayToggleFlagEvent;

export type MinesweeperReplayEventInput =
  | MinesweeperReplayEventInputFor<MinesweeperReplayRevealEvent>
  | MinesweeperReplayEventInputFor<MinesweeperReplayStartEvent>
  | MinesweeperReplayEventInputFor<MinesweeperReplayToggleFlagEvent>;

export type MinesweeperReplayCursorEvent =
  GameReplayEventEnvelope<"cursorMove"> &
    MinesweeperReplayCursorPosition;

export type MinesweeperReplayCursorEventInput =
  MinesweeperReplayEventInputFor<MinesweeperReplayCursorEvent>;

type MinesweeperReplaySchemaVersion =
  | typeof MINESWEEPER_REPLAY_LEGACY_SCHEMA_VERSION
  | typeof MINESWEEPER_REPLAY_SCHEMA_VERSION;

export type MinesweeperReplayPayload = BaseGameReplayPayload<
  typeof MINESWEEPER_REPLAY_GAME_ID,
  MinesweeperReplaySchemaVersion
> & {
  boardHeight: number;
  boardWidth: number;
  cursorEvents: MinesweeperReplayCursorEvent[];
  difficulty: MinesweeperDifficulty;
  events: MinesweeperReplayEvent[];
  finalFlagCount: number;
  finalRevealedSafeCellCount: number;
  mineCount: number;
};

export type ParseMinesweeperReplayPayloadResult =
  ParseGameReplayPayloadResult<MinesweeperReplayPayload>;

export const MINESWEEPER_REPLAY_LEGACY_SCHEMA_VERSION = 2;
export const MINESWEEPER_REPLAY_SCHEMA_VERSION = 3;
export const MINESWEEPER_REPLAY_GAME_ID = "minesweeper";
export const MINESWEEPER_REPLAY_API_PATH = getGameReplayApiPath(
  MINESWEEPER_REPLAY_GAME_ID,
);
export const MINESWEEPER_REPLAY_RUN_API_PATH = getGameReplayRunApiPath(
  MINESWEEPER_REPLAY_GAME_ID,
);
export const MAX_MINESWEEPER_REPLAY_EVENTS = 80_000;
export const MAX_MINESWEEPER_REPLAY_CURSOR_EVENTS = 80_000;
export const MINESWEEPER_REPLAY_CURSOR_SAMPLE_INTERVAL_MS = 50;

const MINESWEEPER_EVENT_TYPES = new Set<MinesweeperReplayEvent["type"]>([
  "reveal",
  "start",
  "toggleFlag",
]);
const MINESWEEPER_CURSOR_EVENT_TYPES = new Set<
  MinesweeperReplayCursorEvent["type"]
>(["cursorMove"]);

export const normalizeMinesweeperReplayRunId = normalizeGameReplayRunId;
export const normalizeMinesweeperReplaySeed = normalizeGameReplaySeed;
export const createMinesweeperReplayRandom = createGameReplayRandom;

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
}

export function shouldRecordMinesweeperReplayCursorEvent({
  elapsedMs,
  force = false,
  lastElapsedMs,
}: {
  elapsedMs: number;
  force?: boolean;
  lastElapsedMs: number | null;
}) {
  return shouldRecordGameReplayCursorEvent({
    elapsedMs,
    force,
    lastElapsedMs,
    sampleIntervalMs: MINESWEEPER_REPLAY_CURSOR_SAMPLE_INTERVAL_MS,
  });
}

function parseReplayCellId(
  cellId: unknown,
  {
    boardHeight,
    boardWidth,
  }: Pick<MinesweeperReplayPayload, "boardHeight" | "boardWidth">,
) {
  if (typeof cellId !== "string") {
    return null;
  }

  const match = cellId.match(/^(\d+):(\d+)$/);

  if (match === null) {
    return null;
  }

  const x = Number(match[1]);
  const y = Number(match[2]);

  if (
    !Number.isSafeInteger(x) ||
    !Number.isSafeInteger(y) ||
    x < 0 ||
    x >= boardWidth ||
    y < 0 ||
    y >= boardHeight
  ) {
    return null;
  }

  return getMinesweeperCellId(x, y);
}

export function createMinesweeperReplayLeaderboardKey({
  difficulty,
}: Pick<MinesweeperReplayPayload, "difficulty">) {
  return createGameLeaderboardKey(MINESWEEPER_REPLAY_GAME_ID, [
    { name: "difficulty", value: difficulty },
  ]);
}

function parseMinesweeperReplayEvent(
  value: unknown,
  {
    boardHeight,
    boardWidth,
  }: Pick<MinesweeperReplayPayload, "boardHeight" | "boardWidth">,
): MinesweeperReplayEvent | null {
  const envelope = parseGameReplayEventEnvelope(value, MINESWEEPER_EVENT_TYPES);

  if (envelope === null) {
    return null;
  }

  if (envelope.type === "start") {
    return envelope;
  }

  const event = value as Record<string, unknown>;
  const cellId = parseReplayCellId(event.cellId, {
    boardHeight,
    boardWidth,
  });

  if (cellId === null) {
    return null;
  }

  return {
    ...envelope,
    cellId,
  };
}

function parseMinesweeperReplayCursorEvent(
  value: unknown,
): MinesweeperReplayCursorEvent | null {
  return parseGameReplayCursorEvent(
    value,
    MINESWEEPER_CURSOR_EVENT_TYPES,
  );
}

function parseMinesweeperBaseReplayPayload(
  value: unknown,
): ParseGameReplayPayloadResult<
  BaseGameReplayPayload<
    typeof MINESWEEPER_REPLAY_GAME_ID,
    MinesweeperReplaySchemaVersion
  >
> {
  if (isRecord(value) && value.schemaVersion === MINESWEEPER_REPLAY_LEGACY_SCHEMA_VERSION) {
    return parseBaseGameReplayPayload(value, {
      gameId: MINESWEEPER_REPLAY_GAME_ID,
      replayLabel: "Minesweeper replay",
      schemaVersion: MINESWEEPER_REPLAY_LEGACY_SCHEMA_VERSION,
    });
  }

  return parseBaseGameReplayPayload(value, {
    gameId: MINESWEEPER_REPLAY_GAME_ID,
    replayLabel: "Minesweeper replay",
    schemaVersion: MINESWEEPER_REPLAY_SCHEMA_VERSION,
  });
}

export function parseMinesweeperReplayPayload(
  value: unknown,
): ParseMinesweeperReplayPayloadResult {
  const baseReplay = parseMinesweeperBaseReplayPayload(value);

  if (!baseReplay.success) {
    return baseReplay;
  }

  if (!isRecord(value)) {
    return {
      error: "Minesweeper replay must be a JSON object.",
      success: false,
    };
  }

  if (
    typeof value.difficulty !== "string" ||
    !isPositiveInteger(value.boardWidth) ||
    !isPositiveInteger(value.boardHeight) ||
    !isNonNegativeInteger(value.mineCount) ||
    value.mineCount >= value.boardWidth * value.boardHeight
  ) {
    return {
      error: "Minesweeper replay parameters are not supported.",
      success: false,
    };
  }

  const difficulty = normalizeMinesweeperDifficulty(value.difficulty);
  const difficultySettings = getMinesweeperDifficultySettings(difficulty);
  const boardHeight = value.boardHeight;
  const boardWidth = value.boardWidth;
  const mineCount = value.mineCount;
  const safeCellCount = boardWidth * boardHeight - mineCount;

  if (
    difficulty !== value.difficulty ||
    boardHeight !== difficultySettings.height ||
    boardWidth !== difficultySettings.width ||
    mineCount !== difficultySettings.mineCount
  ) {
    return {
      error: "Minesweeper replay parameters are not supported.",
      success: false,
    };
  }

  if (
    baseReplay.payload.leaderboardKey !==
    createMinesweeperReplayLeaderboardKey({
      difficulty,
    })
  ) {
    return {
      error: "Minesweeper replay leaderboard key is not supported.",
      success: false,
    };
  }

  if (
    !isNonNegativeInteger(value.finalFlagCount) ||
    value.finalFlagCount > mineCount ||
    !isNonNegativeInteger(value.finalRevealedSafeCellCount) ||
    value.finalRevealedSafeCellCount > safeCellCount ||
    (baseReplay.payload.finalStatus === "won" &&
      value.finalRevealedSafeCellCount !== safeCellCount)
  ) {
    return {
      error: "Minesweeper replay final state is not supported.",
      success: false,
    };
  }

  const events = parseGameReplayEvents(value.events, {
    maxEventCount: MAX_MINESWEEPER_REPLAY_EVENTS,
    parseEvent: (event) =>
      parseMinesweeperReplayEvent(event, {
        boardHeight,
        boardWidth,
      }),
    unsupportedEventError: "Minesweeper replay includes an unsupported event.",
    unsupportedEventsError: "Minesweeper replay events are not supported.",
  });

  if (!events.success) {
    return events;
  }

  const cursorEvents =
    baseReplay.payload.schemaVersion === MINESWEEPER_REPLAY_LEGACY_SCHEMA_VERSION &&
    value.cursorEvents === undefined
      ? {
          payload: [] satisfies MinesweeperReplayCursorEvent[],
          success: true as const,
        }
      : parseGameReplayEvents(value.cursorEvents, {
          maxEventCount: MAX_MINESWEEPER_REPLAY_CURSOR_EVENTS,
          parseEvent: parseMinesweeperReplayCursorEvent,
          unsupportedEventError:
            "Minesweeper replay includes an unsupported cursor event.",
          unsupportedEventsError:
            "Minesweeper replay cursor events are not supported.",
        });

  if (!cursorEvents.success) {
    return cursorEvents;
  }

  return {
    payload: {
      ...baseReplay.payload,
      boardHeight,
      boardWidth,
      cursorEvents: cursorEvents.payload,
      difficulty,
      events: events.payload,
      finalFlagCount: value.finalFlagCount,
      finalRevealedSafeCellCount: value.finalRevealedSafeCellCount,
      mineCount,
    },
    success: true,
  };
}

export function createInitialMinesweeperReplayGame(
  payload: Pick<
    MinesweeperReplayPayload,
    "boardHeight" | "boardWidth" | "difficulty" | "mineCount" | "seed"
  >,
) {
  const random = createMinesweeperReplayRandom(payload.seed);
  const game = createInitialMinesweeperGame({
    difficulty: payload.difficulty,
    height: payload.boardHeight,
    mineCount: payload.mineCount,
    width: payload.boardWidth,
  });

  return {
    game,
    random,
  };
}

export function applyMinesweeperReplayEvent(
  current: MinesweeperGameState,
  event: MinesweeperReplayEvent,
  random: () => number,
) {
  switch (event.type) {
    case "reveal":
      return revealMinesweeperCell(current, event.cellId, { random });
    case "start":
      return current;
    case "toggleFlag":
      return toggleMinesweeperFlag(current, event.cellId);
  }
}

export async function createMinesweeperReplayRun() {
  return createGenericGameReplayRun(MINESWEEPER_REPLAY_GAME_ID, {
    replayLabel: "Minesweeper replay",
  });
}

export async function saveMinesweeperReplay(payload: MinesweeperReplayPayload) {
  return saveGameReplay(MINESWEEPER_REPLAY_GAME_ID, payload, {
    replayLabel: "Minesweeper replay",
  });
}

export async function fetchMinesweeperReplay() {
  return fetchGameReplay(MINESWEEPER_REPLAY_GAME_ID, parseMinesweeperReplayPayload, {
    replayLabel: "Minesweeper replay",
  });
}
