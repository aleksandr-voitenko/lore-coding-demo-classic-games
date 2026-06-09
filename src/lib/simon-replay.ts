import {
  advanceSimonMiss,
  advanceSimonPlayback,
  advanceSimonRound,
  clearSimonActivePad,
  createInitialSimonGame,
  playSimonPad,
  SIMON_DEFAULT_WIN_TARGET,
  SIMON_PADS,
  startSimonGame,
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
  parseGameReplayEventEnvelope,
  saveGameReplay,
  type BaseGameReplayPayload,
  type GameReplayRun,
  type ParseGameReplayPayloadResult,
} from "@/lib/game-replay";
import { createGameLeaderboardKey } from "@/lib/leaderboard";

export type SimonReplayRun = GameReplayRun;

export type SimonReplayStartEvent = {
  seq: number;
  tick: number;
  type: "start";
};

export type SimonReplayPlaybackEvent = {
  seq: number;
  tick: number;
  type: "playback";
};

export type SimonReplayPadEvent = {
  pad: SimonPadId;
  seq: number;
  tick: number;
  type: "pad";
};

export type SimonReplayClearEvent = {
  seq: number;
  tick: number;
  type: "clear";
};

export type SimonReplayAdvanceRoundEvent = {
  seq: number;
  tick: number;
  type: "advanceRound";
};

export type SimonReplayAdvanceMissEvent = {
  seq: number;
  tick: number;
  type: "advanceMiss";
};

export type SimonReplayEvent =
  | SimonReplayAdvanceMissEvent
  | SimonReplayAdvanceRoundEvent
  | SimonReplayClearEvent
  | SimonReplayPadEvent
  | SimonReplayPlaybackEvent
  | SimonReplayStartEvent;

export type SimonReplayEventInput =
  | Omit<SimonReplayAdvanceMissEvent, "seq" | "tick">
  | Omit<SimonReplayAdvanceRoundEvent, "seq" | "tick">
  | Omit<SimonReplayClearEvent, "seq" | "tick">
  | Omit<SimonReplayPadEvent, "seq" | "tick">
  | Omit<SimonReplayPlaybackEvent, "seq" | "tick">
  | Omit<SimonReplayStartEvent, "seq" | "tick">;

export type SimonReplayPayload = BaseGameReplayPayload<
  typeof SIMON_REPLAY_GAME_ID,
  typeof SIMON_REPLAY_SCHEMA_VERSION
> & {
  events: SimonReplayEvent[];
  finalInputIndex: number;
  finalRound: number;
  finalSequenceLength: number;
  winTarget: number;
};

export type ParseSimonReplayPayloadResult =
  ParseGameReplayPayloadResult<SimonReplayPayload>;

export const SIMON_REPLAY_SCHEMA_VERSION = 1;
export const SIMON_REPLAY_GAME_ID = "simon";
export const SIMON_REPLAY_API_PATH = getGameReplayApiPath(SIMON_REPLAY_GAME_ID);
export const SIMON_REPLAY_RUN_API_PATH = getGameReplayRunApiPath(SIMON_REPLAY_GAME_ID);
export const MAX_SIMON_REPLAY_EVENTS = 50_000;

const SIMON_MIN_WIN_TARGET = 1;
const SIMON_EVENT_TYPES = new Set<SimonReplayEvent["type"]>([
  "advanceMiss",
  "advanceRound",
  "clear",
  "pad",
  "playback",
  "start",
]);

export const normalizeSimonReplayRunId = normalizeGameReplayRunId;
export const normalizeSimonReplaySeed = normalizeGameReplaySeed;
export const createSimonReplayRandom = createGameReplayRandom;

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
}

function isSimonPadId(value: unknown): value is SimonPadId {
  return typeof value === "string" && (SIMON_PADS as readonly string[]).includes(value);
}

export function createSimonReplayLeaderboardKey({
  winTarget,
}: Pick<SimonReplayPayload, "winTarget">) {
  return createGameLeaderboardKey(SIMON_REPLAY_GAME_ID, [
    { name: "target", value: winTarget },
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

export function parseSimonReplayPayload(value: unknown): ParseSimonReplayPayloadResult {
  const baseReplay = parseBaseGameReplayPayload(value, {
    gameId: SIMON_REPLAY_GAME_ID,
    replayLabel: "Simon replay",
    schemaVersion: SIMON_REPLAY_SCHEMA_VERSION,
  });

  if (!baseReplay.success) {
    return baseReplay;
  }

  if (!isRecord(value)) {
    return {
      error: "Simon replay must be a JSON object.",
      success: false,
    };
  }

  if (!isPositiveInteger(value.winTarget) || value.winTarget < SIMON_MIN_WIN_TARGET) {
    return {
      error: "Simon replay parameters are not supported.",
      success: false,
    };
  }

  const winTarget = value.winTarget;

  if (baseReplay.payload.leaderboardKey !== createSimonReplayLeaderboardKey({ winTarget })) {
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

  if (!Array.isArray(value.events) || value.events.length > MAX_SIMON_REPLAY_EVENTS) {
    return {
      error: "Simon replay events are not supported.",
      success: false,
    };
  }

  const events = value.events.map(parseSimonReplayEvent);

  if (events.some((event) => event === null)) {
    return {
      error: "Simon replay includes an unsupported event.",
      success: false,
    };
  }

  return {
    payload: {
      ...baseReplay.payload,
      events: events as SimonReplayEvent[],
      finalInputIndex: value.finalInputIndex,
      finalRound: value.finalRound,
      finalSequenceLength: value.finalSequenceLength,
      winTarget,
    },
    success: true,
  };
}

export function createInitialSimonReplayGame(
  payload: Pick<SimonReplayPayload, "seed" | "winTarget">,
) {
  const random = createSimonReplayRandom(payload.seed);
  const game: SimonGameState = createInitialSimonGame({
    winTarget: payload.winTarget,
  });

  return {
    game,
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
    winTarget: SIMON_DEFAULT_WIN_TARGET,
  });
}
