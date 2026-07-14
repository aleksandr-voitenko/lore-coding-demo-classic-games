import {
  advanceBattleCityGame,
  advanceBattleCityPausedFrames,
  BATTLE_CITY_STAGE_COUNT,
  BATTLE_CITY_TICK_MS,
  createInitialBattleCityGame,
  pauseBattleCityGame,
  resumeBattleCityGame,
  startBattleCityGame,
  type BattleCityDirection,
  type BattleCityFrameInput,
  type BattleCityGameState,
} from "@/lib/battle-city-game-engine";
import type { BattleCityCanonicalCycle } from "@/lib/battle-city/stage-progression";
import {
  createGameReplayRandom,
  createGameReplayRun as createGenericGameReplayRun,
  fetchGameReplay,
  isNonNegativeInteger,
  isRecord,
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

export type BattleCityReplayRun = GameReplayRun;

type BattleCityReplayEventInputFor<Event> = Omit<
  Event,
  "elapsedMs" | "seq" | "tick"
>;

export type BattleCityReplayStartEvent = GameReplayEventEnvelope<"start">;
export type BattleCityReplayPauseEvent = GameReplayEventEnvelope<"pause"> & {
  frameCount: number;
};
export type BattleCityReplayResumeEvent = GameReplayEventEnvelope<"resume">;
export type BattleCityReplayAdvanceEvent = GameReplayEventEnvelope<"advance"> & {
  endElapsedMs: number;
  frameCount: number;
  input: BattleCityFrameInput;
};

export type BattleCityReplayEvent =
  | BattleCityReplayAdvanceEvent
  | BattleCityReplayPauseEvent
  | BattleCityReplayResumeEvent
  | BattleCityReplayStartEvent;

export type BattleCityReplayEventInput =
  | BattleCityReplayEventInputFor<BattleCityReplayAdvanceEvent>
  | BattleCityReplayEventInputFor<BattleCityReplayPauseEvent>
  | BattleCityReplayEventInputFor<BattleCityReplayResumeEvent>
  | BattleCityReplayEventInputFor<BattleCityReplayStartEvent>;

export type BattleCityReplayPayload = BaseGameReplayPayload<
  typeof BATTLE_CITY_REPLAY_GAME_ID,
  typeof BATTLE_CITY_REPLAY_SCHEMA_VERSION
> & {
  events: BattleCityReplayEvent[];
  finalBaseAlive: boolean;
  finalCycle: BattleCityCanonicalCycle;
  finalLives: number;
  finalStage: number;
  initialTick: number;
  startingStage: number;
};

export type BattleCityReplayPlaybackState = {
  game: BattleCityGameState;
  random: () => number;
};

export type ParseBattleCityReplayPayloadResult =
  ParseGameReplayPayloadResult<BattleCityReplayPayload>;

export const BATTLE_CITY_REPLAY_SCHEMA_VERSION = 1;
export const BATTLE_CITY_REPLAY_GAME_ID = "battle-city";
export const MAX_BATTLE_CITY_REPLAY_EVENTS = 240_000;
export const MAX_BATTLE_CITY_REPLAY_FRAMES = 5_200_000;

const BATTLE_CITY_REPLAY_EVENT_TYPES = new Set<BattleCityReplayEvent["type"]>([
  "advance",
  "pause",
  "resume",
  "start",
]);
const BATTLE_CITY_REPLAY_DIRECTIONS = new Set<BattleCityDirection>([
  "down",
  "left",
  "right",
  "up",
]);

export const createBattleCityReplayRandom = createGameReplayRandom;

export function createBattleCityReplayLeaderboardKey() {
  return createGameLeaderboardKey(BATTLE_CITY_REPLAY_GAME_ID, [
    { name: "mode", value: "campaign" },
  ]);
}

function isBattleCityStage(value: unknown): value is number {
  return (
    isNonNegativeInteger(value) &&
    value >= 1 &&
    value <= BATTLE_CITY_STAGE_COUNT
  );
}

function isBattleCityCycle(value: unknown): value is BattleCityCanonicalCycle {
  return value === 1 || value === 2;
}

function parseBattleCityReplayInput(value: unknown): BattleCityFrameInput | null {
  if (!isRecord(value) || typeof value.fireRequested !== "boolean") {
    return null;
  }

  const direction = value.direction;

  if (
    direction !== null &&
    (typeof direction !== "string" ||
      !BATTLE_CITY_REPLAY_DIRECTIONS.has(direction as BattleCityDirection))
  ) {
    return null;
  }

  return {
    direction: direction as BattleCityDirection | null,
    fireRequested: value.fireRequested,
  };
}

function parseBattleCityReplayEvent(value: unknown): BattleCityReplayEvent | null {
  const envelope = parseGameReplayEventEnvelope(
    value,
    BATTLE_CITY_REPLAY_EVENT_TYPES,
  );

  if (envelope === null) {
    return null;
  }

  const event = value as Record<string, unknown>;

  if (envelope.type === "advance") {
    const input = parseBattleCityReplayInput(event.input);

    if (
      input === null ||
      !isNonNegativeInteger(event.frameCount) ||
      event.frameCount < 1 ||
      event.frameCount > MAX_BATTLE_CITY_REPLAY_FRAMES ||
      !isNonNegativeInteger(event.endElapsedMs) ||
      event.endElapsedMs < envelope.elapsedMs
    ) {
      return null;
    }

    return {
      ...envelope,
      endElapsedMs: event.endElapsedMs,
      frameCount: event.frameCount,
      input,
    };
  }

  if (envelope.type === "pause") {
    if (
      !isNonNegativeInteger(event.frameCount) ||
      event.frameCount > MAX_BATTLE_CITY_REPLAY_FRAMES
    ) {
      return null;
    }

    return {
      ...envelope,
      frameCount: event.frameCount,
    };
  }

  return envelope;
}

function isBattleCityReplayEventSequenceSupported(
  events: BattleCityReplayEvent[],
  finalTick: number,
) {
  if (
    events.length === 0 ||
    events[0]?.type !== "start" ||
    events.at(-1)?.type !== "advance"
  ) {
    return false;
  }

  let frameTick = 0;
  let isPaused = false;
  let previousEndElapsedMs = 0;

  for (const [index, event] of events.entries()) {
    if (
      event.seq !== index ||
      event.tick !== frameTick ||
      event.elapsedMs < previousEndElapsedMs ||
      (index > 0 && event.type === "start")
    ) {
      return false;
    }

    switch (event.type) {
      case "advance":
        if (
          isPaused ||
          event.frameCount > MAX_BATTLE_CITY_REPLAY_FRAMES - frameTick
        ) {
          return false;
        }
        frameTick += event.frameCount;
        previousEndElapsedMs = event.endElapsedMs;
        break;
      case "pause":
        if (
          isPaused ||
          event.frameCount > MAX_BATTLE_CITY_REPLAY_FRAMES - frameTick
        ) {
          return false;
        }
        isPaused = true;
        frameTick += event.frameCount;
        previousEndElapsedMs = event.elapsedMs;
        break;
      case "resume":
        if (!isPaused) {
          return false;
        }
        isPaused = false;
        previousEndElapsedMs = event.elapsedMs;
        break;
      case "start":
        if (index !== 0) {
          return false;
        }
        previousEndElapsedMs = event.elapsedMs;
        break;
    }
  }

  return !isPaused && frameTick === finalTick;
}

export function parseBattleCityReplayPayload(
  value: unknown,
): ParseBattleCityReplayPayloadResult {
  const baseReplay = parseBaseGameReplayPayload(value, {
    gameId: BATTLE_CITY_REPLAY_GAME_ID,
    replayLabel: "Tank Patrol replay",
    schemaVersion: BATTLE_CITY_REPLAY_SCHEMA_VERSION,
  });

  if (!baseReplay.success) {
    return baseReplay;
  }

  if (!isRecord(value)) {
    return {
      error: "Tank Patrol replay must be a JSON object.",
      success: false,
    };
  }

  if (
    !isBattleCityStage(value.startingStage) ||
    !isNonNegativeInteger(value.initialTick)
  ) {
    return {
      error: "Tank Patrol replay parameters are not supported.",
      success: false,
    };
  }

  if (
    baseReplay.payload.leaderboardKey !==
    createBattleCityReplayLeaderboardKey()
  ) {
    return {
      error: "Tank Patrol replay leaderboard key is not supported.",
      success: false,
    };
  }

  if (
    baseReplay.payload.finalStatus !== "lost" ||
    !isBattleCityStage(value.finalStage) ||
    !isBattleCityCycle(value.finalCycle) ||
    !isNonNegativeInteger(value.finalLives) ||
    typeof value.finalBaseAlive !== "boolean" ||
    (value.finalBaseAlive && value.finalLives > 0)
  ) {
    return {
      error: "Tank Patrol replay final state is not supported.",
      success: false,
    };
  }

  const events = parseGameReplayEvents(value.events, {
    maxEventCount: MAX_BATTLE_CITY_REPLAY_EVENTS,
    parseEvent: parseBattleCityReplayEvent,
    unsupportedEventError: "Tank Patrol replay includes an unsupported event.",
    unsupportedEventsError: "Tank Patrol replay events are not supported.",
  });

  if (!events.success) {
    return events;
  }

  if (
    !isBattleCityReplayEventSequenceSupported(
      events.payload,
      baseReplay.payload.finalTick,
    )
  ) {
    return {
      error: "Tank Patrol replay event sequence is not supported.",
      success: false,
    };
  }

  return {
    payload: {
      ...baseReplay.payload,
      events: events.payload,
      finalBaseAlive: value.finalBaseAlive,
      finalCycle: value.finalCycle,
      finalLives: value.finalLives,
      finalStage: value.finalStage,
      initialTick: value.initialTick,
      startingStage: value.startingStage,
    },
    success: true,
  };
}

export function createInitialBattleCityReplayGame(
  payload: Pick<
    BattleCityReplayPayload,
    "initialTick" | "seed" | "startingStage"
  >,
): BattleCityReplayPlaybackState {
  return {
    game: {
      ...createInitialBattleCityGame({ stage: payload.startingStage }),
      tick: payload.initialTick,
    },
    random: createBattleCityReplayRandom(payload.seed),
  };
}

export function applyBattleCityReplayEvent(
  current: BattleCityReplayPlaybackState,
  event: BattleCityReplayEvent,
): BattleCityReplayPlaybackState {
  switch (event.type) {
    case "advance": {
      let next = current;

      for (let frame = 0; frame < event.frameCount; frame += 1) {
        next = applyBattleCityReplayAdvanceFrame(next, event);
      }

      return next;
    }
    case "pause": {
      const pausedGame = pauseBattleCityGame(current.game);

      return {
        ...current,
        game: advanceBattleCityPausedFrames(pausedGame, event.frameCount),
      };
    }
    case "resume":
      return {
        ...current,
        game: resumeBattleCityGame(current.game),
      };
    case "start":
      return {
        ...current,
        game: startBattleCityGame(current.game),
      };
  }
}

export function applyBattleCityReplayAdvanceFrame(
  current: BattleCityReplayPlaybackState,
  event: BattleCityReplayAdvanceEvent,
): BattleCityReplayPlaybackState {
  return {
    ...current,
    game: advanceBattleCityGame(
      current.game,
      BATTLE_CITY_TICK_MS,
      current.random,
      event.input,
    ),
  };
}

export function getBattleCityReplayAdvanceFrameElapsedMs(
  event: BattleCityReplayAdvanceEvent,
  frameIndex: number,
) {
  if (frameIndex <= 0 || event.frameCount === 1) {
    return event.elapsedMs;
  }
  if (frameIndex >= event.frameCount - 1) {
    return event.endElapsedMs;
  }

  const progress = frameIndex / (event.frameCount - 1);

  return Math.round(
    event.elapsedMs + (event.endElapsedMs - event.elapsedMs) * progress,
  );
}

const BATTLE_CITY_REPLAY_MAX_SAME_TIME_FRAMES_PER_STEP = 128;

export function getBattleCityReplayAdvanceFrameBatchSize(
  event: BattleCityReplayAdvanceEvent,
  frameIndex: number,
) {
  if (frameIndex < 0 || frameIndex >= event.frameCount) {
    return 0;
  }

  const elapsedMs = getBattleCityReplayAdvanceFrameElapsedMs(event, frameIndex);
  const batchEnd = Math.min(
    event.frameCount,
    frameIndex + BATTLE_CITY_REPLAY_MAX_SAME_TIME_FRAMES_PER_STEP,
  );
  let nextFrameIndex = frameIndex + 1;

  // Compact replays may contain many frames at one timestamp. Preserve every
  // engine step without paying for a separate React render for each zero-delay frame.
  while (
    nextFrameIndex < batchEnd &&
    getBattleCityReplayAdvanceFrameElapsedMs(event, nextFrameIndex) === elapsedMs
  ) {
    nextFrameIndex += 1;
  }

  return nextFrameIndex - frameIndex;
}

export async function createBattleCityReplayRun() {
  return createGenericGameReplayRun(BATTLE_CITY_REPLAY_GAME_ID, {
    replayLabel: "Tank Patrol replay",
  });
}

export async function saveBattleCityReplay(payload: BattleCityReplayPayload) {
  return saveGameReplay(BATTLE_CITY_REPLAY_GAME_ID, payload, {
    replayLabel: "Tank Patrol replay",
  });
}

export async function fetchBattleCityReplay() {
  return fetchGameReplay(
    BATTLE_CITY_REPLAY_GAME_ID,
    parseBattleCityReplayPayload,
    {
      replayLabel: "Tank Patrol replay",
    },
  );
}

export function createDefaultBattleCityReplayLeaderboardKey() {
  return createBattleCityReplayLeaderboardKey();
}
