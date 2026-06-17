import {
  advanceSimonMiss,
  advanceSimonPlayback,
  advanceSimonRound,
  clearSimonActivePad,
  createInitialSimonGame,
  getSimonDifficultySettings,
  normalizeSimonDifficulty,
  playSimonPad,
  SIMON_DEFAULT_DIFFICULTY,
  SIMON_PADS,
  startSimonGame,
  type SimonDifficulty,
  type SimonGameState,
  type SimonPadId,
} from "@/lib/simon-game-engine";
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

export type SimonReplayRun = GameReplayRun;

type SimonReplayEventInputFor<Event> = Omit<
  Event,
  "elapsedMs" | "seq" | "tick"
>;

export type SimonReplayCursorPosition = GameReplayCursorPosition;

export type SimonReplayStartEvent = GameReplayEventEnvelope<"start">;

export type SimonReplayPlaybackEvent = GameReplayEventEnvelope<"playback">;

export type SimonReplayPadEvent = GameReplayEventEnvelope<"pad"> & {
  pad: SimonPadId;
};

export type SimonReplayClearEvent = GameReplayEventEnvelope<"clear">;

export type SimonReplayAdvanceRoundEvent =
  GameReplayEventEnvelope<"advanceRound">;

export type SimonReplayAdvanceMissEvent =
  GameReplayEventEnvelope<"advanceMiss">;

export type SimonReplayEvent =
  | SimonReplayAdvanceMissEvent
  | SimonReplayAdvanceRoundEvent
  | SimonReplayClearEvent
  | SimonReplayPadEvent
  | SimonReplayPlaybackEvent
  | SimonReplayStartEvent;

export type SimonReplayEventInput =
  | SimonReplayEventInputFor<SimonReplayAdvanceMissEvent>
  | SimonReplayEventInputFor<SimonReplayAdvanceRoundEvent>
  | SimonReplayEventInputFor<SimonReplayClearEvent>
  | SimonReplayEventInputFor<SimonReplayPadEvent>
  | SimonReplayEventInputFor<SimonReplayPlaybackEvent>
  | SimonReplayEventInputFor<SimonReplayStartEvent>;

export type SimonReplayCursorEvent =
  GameReplayEventEnvelope<"cursorMove"> &
    SimonReplayCursorPosition;

export type SimonReplayCursorEventInput =
  SimonReplayEventInputFor<SimonReplayCursorEvent>;

type SimonReplaySchemaVersion =
  | typeof SIMON_REPLAY_LEGACY_SCHEMA_VERSION
  | typeof SIMON_REPLAY_SCHEMA_VERSION;

export type SimonReplayPayload = BaseGameReplayPayload<
  typeof SIMON_REPLAY_GAME_ID,
  SimonReplaySchemaVersion
> & {
  cursorEvents: SimonReplayCursorEvent[];
  difficulty: SimonDifficulty;
  events: SimonReplayEvent[];
  finalInputIndex: number;
  finalRound: number;
  finalSequenceLength: number;
  winTarget: number;
};

export type ParseSimonReplayPayloadResult =
  ParseGameReplayPayloadResult<SimonReplayPayload>;

export const SIMON_REPLAY_LEGACY_SCHEMA_VERSION = 2;
export const SIMON_REPLAY_SCHEMA_VERSION = 3;
export const SIMON_REPLAY_GAME_ID = "simon";
export const SIMON_REPLAY_API_PATH = getGameReplayApiPath(SIMON_REPLAY_GAME_ID);
export const SIMON_REPLAY_RUN_API_PATH = getGameReplayRunApiPath(SIMON_REPLAY_GAME_ID);
export const MAX_SIMON_REPLAY_EVENTS = 50_000;
export const MAX_SIMON_REPLAY_CURSOR_EVENTS = 80_000;
export const SIMON_REPLAY_CURSOR_SAMPLE_INTERVAL_MS = 50;

const SIMON_MIN_WIN_TARGET = 1;
const SIMON_EVENT_TYPES = new Set<SimonReplayEvent["type"]>([
  "advanceMiss",
  "advanceRound",
  "clear",
  "pad",
  "playback",
  "start",
]);
const SIMON_CURSOR_EVENT_TYPES = new Set<
  SimonReplayCursorEvent["type"]
>(["cursorMove"]);

export const normalizeSimonReplayRunId = normalizeGameReplayRunId;
export const normalizeSimonReplaySeed = normalizeGameReplaySeed;
export const createSimonReplayRandom = createGameReplayRandom;

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
}

function isSimonPadId(value: unknown): value is SimonPadId {
  return typeof value === "string" && (SIMON_PADS as readonly string[]).includes(value);
}

export function shouldRecordSimonReplayCursorEvent({
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
    sampleIntervalMs: SIMON_REPLAY_CURSOR_SAMPLE_INTERVAL_MS,
  });
}

export function createSimonReplayLeaderboardKey({
  difficulty,
}: Pick<SimonReplayPayload, "difficulty">) {
  return createGameLeaderboardKey(SIMON_REPLAY_GAME_ID, [
    { name: "difficulty", value: difficulty },
  ]);
}

function parseSimonReplayEvent(value: unknown): SimonReplayEvent | null {
  const envelope = parseGameReplayEventEnvelope(value, SIMON_EVENT_TYPES);

  if (envelope === null) {
    return null;
  }

  if (envelope.type === "pad") {
    const event = value as Record<string, unknown>;

    if (!isSimonPadId(event.pad)) {
      return null;
    }

    return {
      ...envelope,
      pad: event.pad,
    };
  }

  return envelope;
}

function parseSimonReplayCursorEvent(
  value: unknown,
): SimonReplayCursorEvent | null {
  return parseGameReplayCursorEvent(
    value,
    SIMON_CURSOR_EVENT_TYPES,
  );
}

function parseSimonBaseReplayPayload(
  value: unknown,
): ParseGameReplayPayloadResult<
  BaseGameReplayPayload<
    typeof SIMON_REPLAY_GAME_ID,
    SimonReplaySchemaVersion
  >
> {
  if (isRecord(value) && value.schemaVersion === SIMON_REPLAY_LEGACY_SCHEMA_VERSION) {
    return parseBaseGameReplayPayload(value, {
      gameId: SIMON_REPLAY_GAME_ID,
      replayLabel: "Simon replay",
      schemaVersion: SIMON_REPLAY_LEGACY_SCHEMA_VERSION,
    });
  }

  return parseBaseGameReplayPayload(value, {
    gameId: SIMON_REPLAY_GAME_ID,
    replayLabel: "Simon replay",
    schemaVersion: SIMON_REPLAY_SCHEMA_VERSION,
  });
}

export function parseSimonReplayPayload(value: unknown): ParseSimonReplayPayloadResult {
  const baseReplay = parseSimonBaseReplayPayload(value);

  if (!baseReplay.success) {
    return baseReplay;
  }

  if (!isRecord(value)) {
    return {
      error: "Simon replay must be a JSON object.",
      success: false,
    };
  }

  if (
    typeof value.difficulty !== "string" ||
    !isPositiveInteger(value.winTarget) ||
    value.winTarget < SIMON_MIN_WIN_TARGET
  ) {
    return {
      error: "Simon replay parameters are not supported.",
      success: false,
    };
  }

  const difficulty = normalizeSimonDifficulty(value.difficulty);
  const difficultySettings = getSimonDifficultySettings(difficulty);
  const winTarget = value.winTarget;

  if (
    difficulty !== value.difficulty ||
    winTarget !== difficultySettings.winTarget
  ) {
    return {
      error: "Simon replay parameters are not supported.",
      success: false,
    };
  }

  if (baseReplay.payload.leaderboardKey !== createSimonReplayLeaderboardKey({ difficulty })) {
    return {
      error: "Simon replay leaderboard key is not supported.",
      success: false,
    };
  }

  if (
    !isNonNegativeInteger(value.finalRound) ||
    !isNonNegativeInteger(value.finalInputIndex) ||
    !isNonNegativeInteger(value.finalSequenceLength) ||
    value.finalSequenceLength !== value.finalRound ||
    value.finalInputIndex > value.finalSequenceLength ||
    (baseReplay.payload.finalStatus === "won" &&
      (baseReplay.payload.finalScore !== winTarget ||
        value.finalRound !== winTarget ||
        value.finalInputIndex !== value.finalSequenceLength)) ||
    (baseReplay.payload.finalStatus === "lost" &&
      (baseReplay.payload.finalScore >= winTarget ||
        value.finalRound !== baseReplay.payload.finalScore + 1))
  ) {
    return {
      error: "Simon replay final state is not supported.",
      success: false,
    };
  }

  const events = parseGameReplayEvents(value.events, {
    maxEventCount: MAX_SIMON_REPLAY_EVENTS,
    parseEvent: parseSimonReplayEvent,
    unsupportedEventError: "Simon replay includes an unsupported event.",
    unsupportedEventsError: "Simon replay events are not supported.",
  });

  if (!events.success) {
    return events;
  }

  const cursorEvents =
    baseReplay.payload.schemaVersion === SIMON_REPLAY_LEGACY_SCHEMA_VERSION &&
    value.cursorEvents === undefined
      ? {
          payload: [] satisfies SimonReplayCursorEvent[],
          success: true as const,
        }
      : parseGameReplayEvents(value.cursorEvents, {
          maxEventCount: MAX_SIMON_REPLAY_CURSOR_EVENTS,
          parseEvent: parseSimonReplayCursorEvent,
          unsupportedEventError:
            "Simon replay includes an unsupported cursor event.",
          unsupportedEventsError:
            "Simon replay cursor events are not supported.",
        });

  if (!cursorEvents.success) {
    return cursorEvents;
  }

  return {
    payload: {
      ...baseReplay.payload,
      cursorEvents: cursorEvents.payload,
      difficulty,
      events: events.payload,
      finalInputIndex: value.finalInputIndex,
      finalRound: value.finalRound,
      finalSequenceLength: value.finalSequenceLength,
      winTarget,
    },
    success: true,
  };
}

export function createInitialSimonReplayGame(
  payload: Pick<SimonReplayPayload, "difficulty" | "seed" | "winTarget">,
) {
  const random = createSimonReplayRandom(payload.seed);
  const game: SimonGameState = createInitialSimonGame({
    difficulty: payload.difficulty,
  });

  return {
    game: {
      ...game,
      winTarget: payload.winTarget,
    },
    random,
  };
}

export function applySimonReplayEvent(
  current: SimonGameState,
  event: SimonReplayEvent,
  random: () => number,
) {
  switch (event.type) {
    case "advanceMiss":
      return advanceSimonMiss(current);
    case "advanceRound":
      return advanceSimonRound(current, { random });
    case "clear":
      return clearSimonActivePad(current);
    case "pad":
      return playSimonPad(current, event.pad);
    case "playback":
      return advanceSimonPlayback(current);
    case "start":
      return startSimonGame(current, { random });
  }
}

export async function createSimonReplayRun() {
  return createGenericGameReplayRun(SIMON_REPLAY_GAME_ID, {
    replayLabel: "Simon replay",
  });
}

export async function saveSimonReplay(payload: SimonReplayPayload) {
  return saveGameReplay(SIMON_REPLAY_GAME_ID, payload, {
    replayLabel: "Simon replay",
  });
}

export async function fetchSimonReplay() {
  return fetchGameReplay(SIMON_REPLAY_GAME_ID, parseSimonReplayPayload, {
    replayLabel: "Simon replay",
  });
}

export function createDefaultSimonReplayLeaderboardKey() {
  return createSimonReplayLeaderboardKey({
    difficulty: SIMON_DEFAULT_DIFFICULTY,
  });
}
