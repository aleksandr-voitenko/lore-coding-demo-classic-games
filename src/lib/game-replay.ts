export type GameReplayRun = {
  id: string;
  seed: number;
};

export type GameReplayFinalStatus = "lost" | "won";

export type BaseGameReplayPayload<
  GameId extends string = string,
  SchemaVersion extends number = number,
> = {
  finalScore: number;
  finalStatus: GameReplayFinalStatus;
  finalTick: number;
  gameId: GameId;
  leaderboardKey: string;
  runId: string;
  schemaVersion: SchemaVersion;
  seed: number;
  startedAt: string;
};

export type ParseGameReplayPayloadResult<Payload> =
  | {
      payload: Payload;
      success: true;
    }
  | {
      error: string;
      success: false;
    };

export type GameReplayPayloadParser<Payload> = (
  value: unknown,
) => ParseGameReplayPayloadResult<Payload>;

export const MAX_GAME_REPLAY_SEED = 2_147_483_646;

const GAME_REPLAY_RUN_ID_PATTERN = /^[a-zA-Z0-9-]{1,80}$/;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function normalizeGameReplayRunId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const runId = value.trim();

  return GAME_REPLAY_RUN_ID_PATTERN.test(runId) ? runId : null;
}

export function normalizeGameReplaySeed(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_GAME_REPLAY_SEED
  ) {
    return null;
  }

  return value;
}

export function createGameReplayRandom(seed: number) {
  let value = seed % 2_147_483_647;

  if (value <= 0) {
    value += 2_147_483_646;
  }

  return () => {
    value = (value * 16_807) % 2_147_483_647;

    return (value - 1) / 2_147_483_646;
  };
}

export function getGameReplayApiPath(gameId: string) {
  return `/api/replays/${encodeURIComponent(gameId)}`;
}

export function getGameReplayRunApiPath(gameId: string) {
  return `${getGameReplayApiPath(gameId)}/run`;
}

export function parseBaseGameReplayPayload<
  const GameId extends string,
  const SchemaVersion extends number,
>(
  value: unknown,
  {
    gameId,
    replayLabel,
    schemaVersion,
  }: {
    gameId: GameId;
    replayLabel: string;
    schemaVersion: SchemaVersion;
  },
): ParseGameReplayPayloadResult<BaseGameReplayPayload<GameId, SchemaVersion>> {
  if (!isRecord(value)) {
    return {
      error: `${replayLabel} must be a JSON object.`,
      success: false,
    };
  }

  if (value.schemaVersion !== schemaVersion || value.gameId !== gameId) {
    return {
      error: `${replayLabel} version is not supported.`,
      success: false,
    };
  }

  const runId = normalizeGameReplayRunId(value.runId);
  const seed = normalizeGameReplaySeed(value.seed);

  if (runId === null || seed === null) {
    return {
      error: `${replayLabel} run is not supported.`,
      success: false,
    };
  }

  if (typeof value.leaderboardKey !== "string" || value.leaderboardKey.length === 0) {
    return {
      error: `${replayLabel} leaderboard key is not supported.`,
      success: false,
    };
  }

  if (typeof value.startedAt !== "string" || Number.isNaN(Date.parse(value.startedAt))) {
    return {
      error: `${replayLabel} start time is not supported.`,
      success: false,
    };
  }

  if (
    !isNonNegativeInteger(value.finalScore) ||
    !isNonNegativeInteger(value.finalTick) ||
    (value.finalStatus !== "lost" && value.finalStatus !== "won")
  ) {
    return {
      error: `${replayLabel} final state is not supported.`,
      success: false,
    };
  }

  return {
    payload: {
      finalScore: value.finalScore,
      finalStatus: value.finalStatus,
      finalTick: value.finalTick,
      gameId,
      leaderboardKey: value.leaderboardKey,
      runId,
      schemaVersion,
      seed,
      startedAt: value.startedAt,
    },
    success: true,
  };
}

function getResponseError(response: Response, context: string) {
  return new Error(`${context} failed with status ${response.status}`);
}

export async function createGameReplayRun(
  gameId: string,
  { replayLabel = "Game replay" }: { replayLabel?: string } = {},
) {
  const response = await fetch(getGameReplayRunApiPath(gameId), {
    method: "POST",
  });

  if (!response.ok) {
    throw getResponseError(response, `${replayLabel} run request`);
  }

  const payload: unknown = await response.json();

  if (!isRecord(payload)) {
    throw new Error(`${replayLabel} run response was not a JSON object.`);
  }

  const id = normalizeGameReplayRunId(payload.id);
  const seed = normalizeGameReplaySeed(payload.seed);

  if (id === null || seed === null) {
    throw new Error(`${replayLabel} run response did not include a valid run.`);
  }

  return {
    id,
    seed,
  };
}

export async function saveGameReplay(
  gameId: string,
  payload: BaseGameReplayPayload,
  { replayLabel = "Game replay" }: { replayLabel?: string } = {},
) {
  const response = await fetch(getGameReplayApiPath(gameId), {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw getResponseError(response, `${replayLabel} save request`);
  }
}

export async function fetchGameReplay<Payload>(
  gameId: string,
  parsePayload: GameReplayPayloadParser<Payload>,
  { replayLabel = "Game replay" }: { replayLabel?: string } = {},
) {
  const response = await fetch(getGameReplayApiPath(gameId), {
    cache: "no-store",
  });

  if (!response.ok) {
    throw getResponseError(response, `${replayLabel} download request`);
  }

  const payload: unknown = await response.json();
  const replayValue = isRecord(payload) ? payload.replay : null;
  const parsedReplay = parsePayload(replayValue);

  if (!parsedReplay.success) {
    throw new Error(parsedReplay.error);
  }

  return parsedReplay.payload;
}
