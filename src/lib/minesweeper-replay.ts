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
  createInitialMinesweeperGame,
  getMinesweeperCellId,
  revealMinesweeperCell,
  toggleMinesweeperFlag,
  type MinesweeperGameState,
} from "@/lib/minesweeper-game-engine";

export type MinesweeperReplayRun = GameReplayRun;

export type MinesweeperReplayStartEvent = {
  seq: number;
  tick: number;
  type: "start";
};

export type MinesweeperReplayRevealEvent = {
  cellId: string;
  seq: number;
  tick: number;
  type: "reveal";
};

export type MinesweeperReplayToggleFlagEvent = {
  cellId: string;
  seq: number;
  tick: number;
  type: "toggleFlag";
};

export type MinesweeperReplayEvent =
  | MinesweeperReplayRevealEvent
  | MinesweeperReplayStartEvent
  | MinesweeperReplayToggleFlagEvent;

export type MinesweeperReplayEventInput =
  | Omit<MinesweeperReplayRevealEvent, "seq" | "tick">
  | Omit<MinesweeperReplayStartEvent, "seq" | "tick">
  | Omit<MinesweeperReplayToggleFlagEvent, "seq" | "tick">;

export type MinesweeperReplayPayload = BaseGameReplayPayload<
  typeof MINESWEEPER_REPLAY_GAME_ID,
  typeof MINESWEEPER_REPLAY_SCHEMA_VERSION
> & {
  boardHeight: number;
  boardWidth: number;
  events: MinesweeperReplayEvent[];
  finalFlagCount: number;
  finalRevealedSafeCellCount: number;
  mineCount: number;
};

export type ParseMinesweeperReplayPayloadResult =
  ParseGameReplayPayloadResult<MinesweeperReplayPayload>;

export const MINESWEEPER_REPLAY_SCHEMA_VERSION = 1;
export const MINESWEEPER_REPLAY_GAME_ID = "minesweeper";
export const MINESWEEPER_REPLAY_API_PATH = getGameReplayApiPath(
  MINESWEEPER_REPLAY_GAME_ID,
);
export const MINESWEEPER_REPLAY_RUN_API_PATH = getGameReplayRunApiPath(
  MINESWEEPER_REPLAY_GAME_ID,
);
export const MAX_MINESWEEPER_REPLAY_EVENTS = 80_000;

export const normalizeMinesweeperReplayRunId = normalizeGameReplayRunId;
export const normalizeMinesweeperReplaySeed = normalizeGameReplaySeed;
export const createMinesweeperReplayRandom = createGameReplayRandom;

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
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
  boardHeight,
  boardWidth,
  mineCount,
}: Pick<MinesweeperReplayPayload, "boardHeight" | "boardWidth" | "mineCount">) {
  return createGameLeaderboardKey(MINESWEEPER_REPLAY_GAME_ID, [
    { name: "board", value: `${boardWidth}x${boardHeight}` },
    { name: "mines", value: mineCount },
  ]);
}

function parseMinesweeperReplayEvent(
  value: unknown,
  {
    boardHeight,
    boardWidth,
  }: Pick<MinesweeperReplayPayload, "boardHeight" | "boardWidth">,
): MinesweeperReplayEvent | null {
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

  if (value.type === "reveal" || value.type === "toggleFlag") {
    const cellId = parseReplayCellId(value.cellId, {
      boardHeight,
      boardWidth,
    });

    if (cellId === null) {
      return null;
    }

    return {
      cellId,
      seq: value.seq,
      tick: value.tick,
      type: value.type,
    };
  }

  return null;
}

export function parseMinesweeperReplayPayload(
  value: unknown,
): ParseMinesweeperReplayPayloadResult {
  const baseReplay = parseBaseGameReplayPayload(value, {
    gameId: MINESWEEPER_REPLAY_GAME_ID,
    replayLabel: "Minesweeper replay",
    schemaVersion: MINESWEEPER_REPLAY_SCHEMA_VERSION,
  });

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

  const boardHeight = value.boardHeight;
  const boardWidth = value.boardWidth;
  const mineCount = value.mineCount;
  const safeCellCount = boardWidth * boardHeight - mineCount;

  if (
    baseReplay.payload.leaderboardKey !==
    createMinesweeperReplayLeaderboardKey({
      boardHeight,
      boardWidth,
      mineCount,
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

  if (!Array.isArray(value.events) || value.events.length > MAX_MINESWEEPER_REPLAY_EVENTS) {
    return {
      error: "Minesweeper replay events are not supported.",
      success: false,
    };
  }

  const events = value.events.map((event) =>
    parseMinesweeperReplayEvent(event, {
      boardHeight,
      boardWidth,
    }),
  );

  if (events.some((event) => event === null)) {
    return {
      error: "Minesweeper replay includes an unsupported event.",
      success: false,
    };
  }

  return {
    payload: {
      ...baseReplay.payload,
      boardHeight,
      boardWidth,
      events: events as MinesweeperReplayEvent[],
      finalFlagCount: value.finalFlagCount,
      finalRevealedSafeCellCount: value.finalRevealedSafeCellCount,
      mineCount,
    },
    success: true,
  };
}

export function createInitialMinesweeperReplayGame(
  payload: Pick<MinesweeperReplayPayload, "boardHeight" | "boardWidth" | "mineCount" | "seed">,
) {
  const random = createMinesweeperReplayRandom(payload.seed);
  const game = createInitialMinesweeperGame({
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
