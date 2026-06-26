import type { GameId } from "../game-catalog";
import type { PrivateRoomLifecycleCommand } from "../multiplayer/protocol";
import type {
  PrivateRoom,
  PrivateRoomErrorCode,
  PrivateRoomSeatInput,
  PrivateRoomSettingValue,
  PrivateRoomSettings,
} from "../multiplayer/room";
import {
  decrementPongRemainingScore,
  getPongScoreTickDelay,
  getPongTickDelay,
  type PongGameState,
  type PongSide,
} from "../pong-game-engine";
import {
  advancePongMultiplayerTick,
  createInitialPongMultiplayerGame,
  getPongMultiplayerParticipantSide,
  pausePongMultiplayerGame,
  restartPongMultiplayerGame,
  resumePongMultiplayerGame,
  startPongMultiplayerGame,
  type PongMultiplayerError,
  type PongMultiplayerGameSnapshot,
  type PongMultiplayerHeldInput,
  type PongMultiplayerHeldInputs,
} from "../pong-multiplayer";
import { getSpaceInvadersTickDelay } from "../space-invaders-game-engine";
import {
  advanceSpaceInvadersMultiplayerGameTick,
  cloneSpaceInvadersMultiplayerGame,
  createInitialSpaceInvadersMultiplayerGame,
  fireSpaceInvadersMultiplayerShipShot,
  isSpaceInvadersShipSeat,
  SPACE_INVADERS_MULTIPLAYER_ROOM_SEATS,
  SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS,
  type CreateSpaceInvadersMultiplayerGameOptions,
  type SpaceInvadersMultiplayerGameSnapshot,
  type SpaceInvadersMultiplayerGameState,
  type SpaceInvadersMultiplayerHeldInput,
  type SpaceInvadersMultiplayerHeldInputs,
  type SpaceInvadersShipSeat,
} from "../space-invaders-multiplayer";

export type PongMultiplayerInput =
  | {
      direction: unknown;
      type: "pong.setPaddleDirection";
    }
  | {
      type: "pong.serve";
    };

export type SpaceInvadersMultiplayerInput =
  | {
      direction: unknown;
      type: "space-invaders.setShipDirection";
    }
  | {
      type: "space-invaders.fire";
    };

export type MultiplayerServerGameInputCommand<Input = unknown> = {
  gameId?: unknown;
  input: Input;
  participantId: unknown;
  type: "game.input";
};

export type MultiplayerServerGameLifecycleCommand = {
  command: PrivateRoomLifecycleCommand;
  participantId: unknown;
  type: "room.lifecycle";
};

export type MultiplayerServerGameReleaseSeatCommand = {
  participantId: unknown;
  seatId: unknown;
  type: "room.releaseSeat";
};

export type SpaceInvadersMultiplayerServerGameSnapshot =
  SpaceInvadersMultiplayerGameSnapshot & {
    heldInputs: SpaceInvadersMultiplayerHeldInputs;
  };

export type MultiplayerServerGameSnapshot =
  | PongMultiplayerGameSnapshot
  | SpaceInvadersMultiplayerServerGameSnapshot;

export type MultiplayerServerGameRuntimeErrorCode =
  | PrivateRoomErrorCode
  | "invalid-command";

export type MultiplayerServerGameRuntimeFailure = {
  code: MultiplayerServerGameRuntimeErrorCode;
  error: string;
  success: false;
};

export type MultiplayerServerGameRuntimeCreateResult =
  | {
      runtime: unknown;
      success: true;
    }
  | MultiplayerServerGameRuntimeFailure;

export type MultiplayerServerGameRuntimeLifecycleResult =
  | {
      runtime?: unknown;
      success: true;
    }
  | MultiplayerServerGameRuntimeFailure;

export type MultiplayerServerGameRuntimeInputResult =
  | {
      participantId?: string;
      success: true;
    }
  | MultiplayerServerGameRuntimeFailure;

export type MultiplayerServerGameRuntimeAdapter = {
  advanceRuntimeTo: (options: {
    nowMs: number;
    room: PrivateRoom;
    runtime: unknown;
  }) => boolean;
  applyInputCommand: (options: {
    command: MultiplayerServerGameInputCommand;
    nowMs: number;
    room: PrivateRoom;
    runtime: unknown | undefined;
  }) => MultiplayerServerGameRuntimeInputResult;
  applyLifecycleCommand: (options: {
    command: MultiplayerServerGameLifecycleCommand;
    nowMs: number;
    room: PrivateRoom;
    runtime: unknown | undefined;
  }) => MultiplayerServerGameRuntimeLifecycleResult;
  clearInputForReleasedSeat: (options: {
    command: MultiplayerServerGameReleaseSeatCommand;
    runtime: unknown;
  }) => void;
  createRuntime: (options: {
    nowMs: number;
    room: PrivateRoom;
  }) => MultiplayerServerGameRuntimeCreateResult;
  createSnapshot: (options: {
    runtime: unknown;
    serverTimeMs: number;
  }) => MultiplayerServerGameSnapshot;
  defaultSeats: readonly PrivateRoomSeatInput[];
  defaultSettings: PrivateRoomSettings;
  gameId: GameId;
  isActive: (options: {
    room: PrivateRoom;
    runtime: unknown;
  }) => boolean;
  shouldAdvanceSnapshot: (options: {
    room: PrivateRoom;
    snapshot: MultiplayerServerGameSnapshot;
  }) => boolean;
};

type StoredPongMultiplayerRuntime = {
  game: PongGameState;
  heldInputs: WritablePongMultiplayerHeldInputs;
  lastMovementTickMs: number;
  lastScoreTickMs: number;
  seq: number;
};

type WritablePongMultiplayerHeldInputs = Partial<
  Record<PongSide, PongMultiplayerHeldInput>
>;

type StoredSpaceInvadersMultiplayerRuntime = {
  game: SpaceInvadersMultiplayerGameState;
  heldInputs: WritableSpaceInvadersMultiplayerHeldInputs;
  lastTickMs: number;
  seq: number;
};

type WritableSpaceInvadersMultiplayerHeldInputs = Partial<
  Record<SpaceInvadersShipSeat, SpaceInvadersMultiplayerHeldInput>
>;

type SpaceInvadersMultiplayerRoomSeats = Record<
  SpaceInvadersShipSeat,
  PrivateRoom["seats"][number]
>;

type SpaceInvadersMultiplayerRoomValidationResult =
  | {
      seats: SpaceInvadersMultiplayerRoomSeats;
      success: true;
    }
  | MultiplayerServerGameRuntimeFailure;

type SpaceInvadersMultiplayerParticipantSeatResult =
  | {
      seat: SpaceInvadersShipSeat;
      success: true;
    }
  | MultiplayerServerGameRuntimeFailure;

export const DEFAULT_PONG_PRIVATE_ROOM_SEATS = [
  {
    id: "left",
    label: "Left",
    required: true,
  },
  {
    id: "right",
    label: "Right",
    required: true,
  },
] as const satisfies readonly PrivateRoomSeatInput[];

const DEFAULT_PONG_PRIVATE_ROOM_SETTINGS = {
  gameId: "pong",
} as const satisfies PrivateRoomSettings;

export const DEFAULT_SPACE_INVADERS_PRIVATE_ROOM_SEATS =
  SPACE_INVADERS_MULTIPLAYER_ROOM_SEATS;

const DEFAULT_SPACE_INVADERS_PRIVATE_ROOM_SETTINGS = {
  gameId: "space-invaders",
} as const satisfies PrivateRoomSettings;

const INITIAL_GAME_SEQUENCE = 1;
export const PONG_RUNTIME_CATCH_UP_TICK_LIMIT = 60;
const SPACE_INVADERS_RUNTIME_CATCH_UP_TICK_LIMIT = 60;

const pongMultiplayerRuntimeAdapter: MultiplayerServerGameRuntimeAdapter = {
  advanceRuntimeTo({ nowMs, room, runtime }) {
    return advancePongRuntimeTo(getPongRuntime(runtime), room, nowMs);
  },
  applyInputCommand({ command, nowMs, room, runtime }) {
    return applyPongInputCommand(room, runtime, command, nowMs);
  },
  applyLifecycleCommand({ command, nowMs, room, runtime }) {
    return applyPongLifecycleCommand(room, runtime, command, nowMs);
  },
  clearInputForReleasedSeat({ command, runtime }) {
    clearReleasedPongSeatHeldInput(getPongRuntime(runtime), command);
  },
  createRuntime({ nowMs, room }) {
    return createPongRuntime(room, nowMs);
  },
  createSnapshot({ runtime, serverTimeMs }) {
    return createPongRuntimeSnapshot(getPongRuntime(runtime), serverTimeMs);
  },
  defaultSeats: DEFAULT_PONG_PRIVATE_ROOM_SEATS,
  defaultSettings: DEFAULT_PONG_PRIVATE_ROOM_SETTINGS,
  gameId: "pong",
  isActive({ room, runtime }) {
    return isPongRuntimeActive(getPongRuntime(runtime), room);
  },
  shouldAdvanceSnapshot({ room, snapshot }) {
    return snapshot.gameId === "pong" && shouldAdvancePongSnapshot(room, snapshot);
  },
};

const spaceInvadersMultiplayerRuntimeAdapter: MultiplayerServerGameRuntimeAdapter = {
  advanceRuntimeTo({ nowMs, room, runtime }) {
    return advanceSpaceInvadersRuntimeTo(
      getSpaceInvadersRuntime(runtime),
      room,
      nowMs,
    );
  },
  applyInputCommand({ command, nowMs, room, runtime }) {
    return applySpaceInvadersInputCommand(room, runtime, command, nowMs);
  },
  applyLifecycleCommand({ command, nowMs, room, runtime }) {
    return applySpaceInvadersLifecycleCommand(room, runtime, command, nowMs);
  },
  clearInputForReleasedSeat({ command, runtime }) {
    clearReleasedSpaceInvadersSeatHeldInput(
      getSpaceInvadersRuntime(runtime),
      command,
    );
  },
  createRuntime({ nowMs, room }) {
    return createSpaceInvadersRuntime(room, nowMs);
  },
  createSnapshot({ runtime, serverTimeMs }) {
    return createSpaceInvadersRuntimeSnapshot(
      getSpaceInvadersRuntime(runtime),
      serverTimeMs,
    );
  },
  defaultSeats: DEFAULT_SPACE_INVADERS_PRIVATE_ROOM_SEATS,
  defaultSettings: DEFAULT_SPACE_INVADERS_PRIVATE_ROOM_SETTINGS,
  gameId: "space-invaders",
  isActive({ room, runtime }) {
    return isSpaceInvadersRuntimeActive(getSpaceInvadersRuntime(runtime), room);
  },
  shouldAdvanceSnapshot({ room, snapshot }) {
    return shouldAdvanceSpaceInvadersSnapshot(room, snapshot);
  },
};

const defaultMultiplayerServerGameAdapter = pongMultiplayerRuntimeAdapter;
const multiplayerServerGameAdapters: Partial<
  Record<GameId, MultiplayerServerGameRuntimeAdapter>
> = {
  pong: pongMultiplayerRuntimeAdapter,
  "space-invaders": spaceInvadersMultiplayerRuntimeAdapter,
};

export function getDefaultMultiplayerServerGameAdapter() {
  return defaultMultiplayerServerGameAdapter;
}

export function getMultiplayerServerGameAdapter(gameId: GameId) {
  return multiplayerServerGameAdapters[gameId] ?? null;
}

function createGameRuntimeFailure(
  code: MultiplayerServerGameRuntimeErrorCode,
  error: string,
): MultiplayerServerGameRuntimeFailure {
  return {
    code,
    error,
    success: false,
  };
}

function clonePongGameState(game: PongGameState): PongGameState {
  return {
    ball: {
      position: { ...game.ball.position },
      velocity: { ...game.ball.velocity },
    },
    boardHeight: game.boardHeight,
    boardWidth: game.boardWidth,
    cpuPaddle: { ...game.cpuPaddle },
    playerPaddle: { ...game.playerPaddle },
    remainingScore: game.remainingScore,
    score: { ...game.score },
    serveSide: game.serveSide,
    status: game.status,
    targetScore: game.targetScore,
  };
}

function clonePongHeldInputs(
  inputs: WritablePongMultiplayerHeldInputs,
): PongMultiplayerHeldInputs {
  const heldInputs: WritablePongMultiplayerHeldInputs = {};

  if (inputs.left !== undefined) {
    heldInputs.left = { ...inputs.left };
  }

  if (inputs.right !== undefined) {
    heldInputs.right = { ...inputs.right };
  }

  return heldInputs;
}

function createPongRuntime(
  room: PrivateRoom,
  nowMs: number,
): MultiplayerServerGameRuntimeCreateResult {
  const result = createInitialPongMultiplayerGame(room);

  if (!result.success) {
    return getPongMultiplayerFailure(result);
  }

  return {
    runtime: {
      game: result.game,
      heldInputs: {},
      lastMovementTickMs: nowMs,
      lastScoreTickMs: nowMs,
      seq: INITIAL_GAME_SEQUENCE,
    } satisfies StoredPongMultiplayerRuntime,
    success: true,
  };
}

function getPongMultiplayerFailure(
  result: PongMultiplayerError,
): MultiplayerServerGameRuntimeFailure {
  if (result.code === "missing-required-seats") {
    return createGameRuntimeFailure("invalid-status", result.error);
  }

  if (result.code === "unsupported-room-game") {
    return createGameRuntimeFailure("invalid-command", result.error);
  }

  return createGameRuntimeFailure(result.code, result.error);
}

function resetPongRuntimeClocks(
  runtime: StoredPongMultiplayerRuntime,
  nowMs: number,
) {
  runtime.lastMovementTickMs = nowMs;
  runtime.lastScoreTickMs = nowMs;
}

function advancePongRuntimeTo(
  runtime: StoredPongMultiplayerRuntime,
  room: PrivateRoom,
  nowMs: number,
) {
  if (!isPongRuntimeActive(runtime, room)) {
    return false;
  }

  let changed = false;
  const movementTicks = getCappedElapsedTicks(
    runtime.lastMovementTickMs,
    nowMs,
    getPongTickDelay(),
  );

  for (let tickIndex = 0; tickIndex < movementTicks; tickIndex += 1) {
    const nextGame = advancePongMultiplayerTick(
      runtime.game,
      runtime.heldInputs as PongMultiplayerHeldInputs,
    );

    if (nextGame !== runtime.game) {
      runtime.game = nextGame;
      changed = true;
    }

    runtime.lastMovementTickMs += getPongTickDelay();

    if (runtime.game.status !== "running") {
      resetPongRuntimeClocks(runtime, nowMs);
      break;
    }
  }

  if (runtime.game.status === "running") {
    const scoreTicks = getCappedElapsedTicks(
      runtime.lastScoreTickMs,
      nowMs,
      getPongScoreTickDelay(),
    );

    for (let tickIndex = 0; tickIndex < scoreTicks; tickIndex += 1) {
      const nextGame = decrementPongRemainingScore(runtime.game);

      if (nextGame !== runtime.game) {
        runtime.game = nextGame;
        changed = true;
      }

      runtime.lastScoreTickMs += getPongScoreTickDelay();
    }
  }

  if (changed) {
    runtime.seq += 1;
  }

  return changed;
}

function isPongRuntimeActive(runtime: StoredPongMultiplayerRuntime, room: PrivateRoom) {
  return isPongGameActive(room, runtime.game);
}

function shouldAdvancePongSnapshot(
  room: PrivateRoom,
  snapshot: PongMultiplayerGameSnapshot,
) {
  return snapshot.gameId === "pong" && isPongGameActive(room, snapshot.snapshot);
}

function isPongGameActive(
  room: PrivateRoom,
  game: Pick<PongGameState, "status">,
) {
  return (
    room.status === "running" &&
    game.status !== "paused" &&
    game.status !== "won" &&
    game.status !== "lost"
  );
}

function getCappedElapsedTicks(
  lastTickMs: number,
  nowMs: number,
  tickDelayMs: number,
  tickLimit = PONG_RUNTIME_CATCH_UP_TICK_LIMIT,
) {
  if (tickDelayMs <= 0 || nowMs <= lastTickMs) {
    return 0;
  }

  return Math.min(Math.floor((nowMs - lastTickMs) / tickDelayMs), tickLimit);
}

function applyPongLifecycleCommand(
  room: PrivateRoom,
  unknownRuntime: unknown | undefined,
  command: MultiplayerServerGameLifecycleCommand,
  nowMs: number,
): MultiplayerServerGameRuntimeLifecycleResult {
  if (command.command === "start") {
    return createPongRuntime(room, nowMs);
  }

  if (unknownRuntime === undefined) {
    return {
      success: true,
    };
  }

  const runtime = getPongRuntime(unknownRuntime);

  if (command.command === "pause") {
    const nextGame = pausePongMultiplayerGame(runtime.game);

    if (nextGame !== runtime.game) {
      runtime.game = nextGame;
      runtime.seq += 1;
    }

    resetPongRuntimeClocks(runtime, nowMs);
    return {
      success: true,
    };
  }

  if (command.command === "resume") {
    const nextGame = resumePongMultiplayerGame(runtime.game);

    if (nextGame !== runtime.game) {
      runtime.game = nextGame;
      runtime.seq += 1;
    }

    resetPongRuntimeClocks(runtime, nowMs);
    return {
      success: true,
    };
  }

  if (command.command === "restart") {
    runtime.game = restartPongMultiplayerGame(runtime.game);
    runtime.heldInputs = {};
    runtime.seq += 1;
    resetPongRuntimeClocks(runtime, nowMs);
    return {
      success: true,
    };
  }

  if (command.command === "finish") {
    const nextGame = pausePongMultiplayerGame(runtime.game);

    if (nextGame !== runtime.game) {
      runtime.game = nextGame;
      runtime.seq += 1;
    }

    runtime.heldInputs = {};
    resetPongRuntimeClocks(runtime, nowMs);
  }

  return {
    success: true,
  };
}

function applyPongInputCommand(
  room: PrivateRoom,
  unknownRuntime: unknown | undefined,
  command: MultiplayerServerGameInputCommand,
  nowMs: number,
): MultiplayerServerGameRuntimeInputResult {
  const participantId =
    typeof command.participantId === "string" ? command.participantId : undefined;
  const input = command.input;

  if (!isObjectRecord(input)) {
    return createGameRuntimeFailure("invalid-command", "Pong input must be a JSON object.");
  }

  if (unknownRuntime === undefined) {
    return createGameRuntimeFailure(
      "invalid-status",
      "Pong input is only accepted after the room has started.",
    );
  }

  if (room.status === "finished") {
    return createGameRuntimeFailure(
      "invalid-status",
      "Finished rooms cannot accept Pong input.",
    );
  }

  const runtime = getPongRuntime(unknownRuntime);
  const sideResult = getPongMultiplayerParticipantSide(room, command.participantId);

  if (!sideResult.success) {
    return getPongMultiplayerFailure(sideResult);
  }

  if (input.type === "pong.setPaddleDirection") {
    const direction = parsePongPaddleDirection(input.direction);

    if (!direction.success) {
      return direction;
    }

    if (setPongHeldDirection(runtime, sideResult.side, direction.direction)) {
      runtime.seq += 1;
    }

    return {
      participantId,
      success: true,
    };
  }

  if (input.type === "pong.serve") {
    if (runtime.game.status !== "ready") {
      return createGameRuntimeFailure(
        "invalid-status",
        "Pong serve is only available between rounds.",
      );
    }

    if (sideResult.side !== runtime.game.serveSide) {
      return createGameRuntimeFailure(
        "invalid-command",
        "Only the serving paddle can serve the ball.",
      );
    }

    runtime.game = startPongMultiplayerGame(runtime.game);
    runtime.seq += 1;
    resetPongRuntimeClocks(runtime, nowMs);

    return {
      participantId,
      success: true,
    };
  }

  return createGameRuntimeFailure("invalid-command", "Pong input type is not supported.");
}

function parsePongPaddleDirection(
  direction: unknown,
): MultiplayerServerGameRuntimeFailure | {
  direction: "down" | "up" | null;
  success: true;
} {
  if (direction === "down" || direction === "up" || direction === null) {
    return {
      direction,
      success: true,
    };
  }

  return createGameRuntimeFailure(
    "invalid-command",
    "Pong paddle direction must be up, down, or null.",
  );
}

function setPongHeldDirection(
  runtime: StoredPongMultiplayerRuntime,
  side: PongSide,
  direction: "down" | "up" | null,
) {
  const currentInput = runtime.heldInputs[side];
  const nextInput = getHeldInputForDirection(direction);

  if (isSameHeldInput(currentInput, nextInput)) {
    return false;
  }

  if (nextInput === undefined) {
    delete runtime.heldInputs[side];
  } else {
    runtime.heldInputs[side] = nextInput;
  }

  return true;
}

function getHeldInputForDirection(direction: "down" | "up" | null) {
  if (direction === "up") {
    return {
      up: true,
    };
  }

  if (direction === "down") {
    return {
      down: true,
    };
  }

  return undefined;
}

function isSameHeldInput(
  left: PongMultiplayerHeldInput | undefined,
  right: PongMultiplayerHeldInput | undefined,
) {
  return left?.up === right?.up && left?.down === right?.down;
}

function clearReleasedPongSeatHeldInput(
  runtime: StoredPongMultiplayerRuntime,
  command: MultiplayerServerGameReleaseSeatCommand,
) {
  if (typeof command.seatId !== "string") {
    return;
  }

  const seatId = command.seatId.trim();

  if (
    (seatId === "left" || seatId === "right") &&
    runtime.heldInputs[seatId] !== undefined
  ) {
    delete runtime.heldInputs[seatId];
    runtime.seq += 1;
  }
}

function createPongRuntimeSnapshot(
  runtime: StoredPongMultiplayerRuntime,
  serverTimeMs: number,
): PongMultiplayerGameSnapshot {
  return {
    gameId: "pong",
    heldInputs: clonePongHeldInputs(runtime.heldInputs),
    seq: runtime.seq,
    serverTimeMs,
    snapshot: clonePongGameState(runtime.game),
  };
}

function getPongRuntime(runtime: unknown) {
  return runtime as StoredPongMultiplayerRuntime;
}

function parseSpaceInvadersMultiplayerRoomSettings(
  parameters: PrivateRoom["settings"]["parameters"] = {},
): CreateSpaceInvadersMultiplayerGameOptions {
  const options: CreateSpaceInvadersMultiplayerGameOptions = {};
  const boardSize = parameters["space-invaders-board-size"];
  const alienCount = parseFiniteSettingNumber(parameters["space-invaders-aliens"]);

  if (typeof boardSize === "string") {
    const match = boardSize.trim().match(/^(\d+)x(\d+)$/u);

    if (match !== null) {
      options.boardWidth = Number(match[1]);
      options.boardHeight = Number(match[2]);
    }
  }

  if (alienCount !== null) {
    options.alienCount = alienCount;
  }

  return options;
}

function parseFiniteSettingNumber(value: PrivateRoomSettingValue | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    return null;
  }

  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function createSpaceInvadersRuntime(
  room: PrivateRoom,
  nowMs: number,
): MultiplayerServerGameRuntimeCreateResult {
  const roomValidation = validateSpaceInvadersMultiplayerRoom(room);

  if (!roomValidation.success) {
    return roomValidation;
  }

  return {
    runtime: {
      game: {
        ...createInitialSpaceInvadersMultiplayerGame(
          parseSpaceInvadersMultiplayerRoomSettings(room.settings.parameters),
        ),
        status: "running" as const,
      },
      heldInputs: {},
      lastTickMs: nowMs,
      seq: INITIAL_GAME_SEQUENCE,
    } satisfies StoredSpaceInvadersMultiplayerRuntime,
    success: true,
  };
}

function resetSpaceInvadersRuntimeClock(
  runtime: StoredSpaceInvadersMultiplayerRuntime,
  nowMs: number,
) {
  runtime.lastTickMs = nowMs;
}

function advanceSpaceInvadersRuntimeTo(
  runtime: StoredSpaceInvadersMultiplayerRuntime,
  room: PrivateRoom,
  nowMs: number,
) {
  if (!isSpaceInvadersRuntimeActive(runtime, room)) {
    return false;
  }

  let changed = false;
  const tickDelayMs = getSpaceInvadersTickDelay();
  const elapsedTicks = getCappedElapsedTicks(
    runtime.lastTickMs,
    nowMs,
    tickDelayMs,
    SPACE_INVADERS_RUNTIME_CATCH_UP_TICK_LIMIT,
  );

  for (let tickIndex = 0; tickIndex < elapsedTicks; tickIndex += 1) {
    const nextGame = advanceSpaceInvadersMultiplayerGameTick(
      runtime.game,
      runtime.heldInputs as SpaceInvadersMultiplayerHeldInputs,
    );

    if (nextGame !== runtime.game) {
      runtime.game = nextGame;
      changed = true;
    }

    runtime.lastTickMs += tickDelayMs;

    if (runtime.game.status !== "running") {
      resetSpaceInvadersRuntimeClock(runtime, nowMs);
      break;
    }
  }

  if (changed) {
    runtime.seq += 1;
  }

  return changed;
}

function isSpaceInvadersRuntimeActive(
  runtime: StoredSpaceInvadersMultiplayerRuntime,
  room: PrivateRoom,
) {
  return isSpaceInvadersGameActive(room, runtime.game);
}

function shouldAdvanceSpaceInvadersSnapshot(
  room: PrivateRoom,
  snapshot: MultiplayerServerGameSnapshot,
) {
  return (
    snapshot.gameId === "space-invaders" &&
    isSpaceInvadersGameActive(room, snapshot.snapshot)
  );
}

function isSpaceInvadersGameActive(
  room: PrivateRoom,
  game: Pick<SpaceInvadersMultiplayerGameState, "status">,
) {
  return room.status === "running" && game.status === "running";
}

function applySpaceInvadersLifecycleCommand(
  room: PrivateRoom,
  unknownRuntime: unknown | undefined,
  command: MultiplayerServerGameLifecycleCommand,
  nowMs: number,
): MultiplayerServerGameRuntimeLifecycleResult {
  if (command.command === "start") {
    return createSpaceInvadersRuntime(room, nowMs);
  }

  if (unknownRuntime === undefined) {
    return {
      success: true,
    };
  }

  const runtime = getSpaceInvadersRuntime(unknownRuntime);

  if (command.command === "pause") {
    if (pauseSpaceInvadersRuntimeGame(runtime)) {
      runtime.seq += 1;
    }

    resetSpaceInvadersRuntimeClock(runtime, nowMs);
    return {
      success: true,
    };
  }

  if (command.command === "resume") {
    if (resumeSpaceInvadersRuntimeGame(runtime)) {
      runtime.seq += 1;
    }

    resetSpaceInvadersRuntimeClock(runtime, nowMs);
    return {
      success: true,
    };
  }

  if (command.command === "restart") {
    runtime.game = {
      ...createInitialSpaceInvadersMultiplayerGame(
        parseSpaceInvadersMultiplayerRoomSettings(room.settings.parameters),
      ),
      status: "running" as const,
    };
    runtime.heldInputs = {};
    runtime.seq += 1;
    resetSpaceInvadersRuntimeClock(runtime, nowMs);
    return {
      success: true,
    };
  }

  if (command.command === "finish") {
    let changed = false;

    if (pauseSpaceInvadersRuntimeGame(runtime)) {
      changed = true;
    }

    if (Object.keys(runtime.heldInputs).length > 0) {
      runtime.heldInputs = {};
      changed = true;
    }

    if (changed) {
      runtime.seq += 1;
    }

    resetSpaceInvadersRuntimeClock(runtime, nowMs);
  }

  return {
    success: true,
  };
}

function pauseSpaceInvadersRuntimeGame(
  runtime: StoredSpaceInvadersMultiplayerRuntime,
) {
  if (runtime.game.status !== "running") {
    return false;
  }

  runtime.game = {
    ...runtime.game,
    status: "paused",
  };
  return true;
}

function resumeSpaceInvadersRuntimeGame(
  runtime: StoredSpaceInvadersMultiplayerRuntime,
) {
  if (runtime.game.status !== "paused" && runtime.game.status !== "ready") {
    return false;
  }

  runtime.game = {
    ...runtime.game,
    status: "running",
  };
  return true;
}

function applySpaceInvadersInputCommand(
  room: PrivateRoom,
  unknownRuntime: unknown | undefined,
  command: MultiplayerServerGameInputCommand,
  nowMs: number,
): MultiplayerServerGameRuntimeInputResult {
  const participantId =
    typeof command.participantId === "string" ? command.participantId : undefined;
  const input = command.input;

  if (!isObjectRecord(input)) {
    return createGameRuntimeFailure(
      "invalid-command",
      "Space Invaders input must be a JSON object.",
    );
  }

  if (unknownRuntime === undefined) {
    return createGameRuntimeFailure(
      "invalid-status",
      "Space Invaders input is only accepted after the room has started.",
    );
  }

  if (room.status === "finished") {
    return createGameRuntimeFailure(
      "invalid-status",
      "Finished rooms cannot accept Space Invaders input.",
    );
  }

  const runtime = getSpaceInvadersRuntime(unknownRuntime);
  const seatResult = getSpaceInvadersMultiplayerParticipantSeat(
    room,
    command.participantId,
  );

  if (!seatResult.success) {
    return seatResult;
  }

  if (input.type === "space-invaders.setShipDirection") {
    const direction = parseSpaceInvadersShipDirection(input.direction);

    if (!direction.success) {
      return direction;
    }

    if (
      setSpaceInvadersHeldDirection(runtime, seatResult.seat, direction.direction)
    ) {
      runtime.seq += 1;
    }

    return {
      participantId,
      success: true,
    };
  }

  if (input.type === "space-invaders.fire") {
    if (runtime.game.status !== "running" || room.status !== "running") {
      return createGameRuntimeFailure(
        "invalid-status",
        "Space Invaders fire is only available while the game is running.",
      );
    }

    const nextGame = fireSpaceInvadersMultiplayerShipShot(
      runtime.game,
      seatResult.seat,
    );

    if (nextGame !== runtime.game) {
      runtime.game = nextGame;
      runtime.seq += 1;
      resetSpaceInvadersRuntimeClock(runtime, nowMs);
    }

    return {
      participantId,
      success: true,
    };
  }

  return createGameRuntimeFailure(
    "invalid-command",
    "Space Invaders input type is not supported.",
  );
}

function parseSpaceInvadersShipDirection(
  direction: unknown,
): MultiplayerServerGameRuntimeFailure | {
  direction: "left" | "right" | null;
  success: true;
} {
  if (direction === "left" || direction === "right" || direction === null) {
    return {
      direction,
      success: true,
    };
  }

  return createGameRuntimeFailure(
    "invalid-command",
    "Space Invaders ship direction must be left, right, or null.",
  );
}

function setSpaceInvadersHeldDirection(
  runtime: StoredSpaceInvadersMultiplayerRuntime,
  seat: SpaceInvadersShipSeat,
  direction: "left" | "right" | null,
) {
  const currentInput = runtime.heldInputs[seat];
  const nextInput = getSpaceInvadersHeldInputForDirection(direction);

  if (isSameSpaceInvadersHeldInput(currentInput, nextInput)) {
    return false;
  }

  if (nextInput === undefined) {
    delete runtime.heldInputs[seat];
  } else {
    runtime.heldInputs[seat] = nextInput;
  }

  return true;
}

function getSpaceInvadersHeldInputForDirection(
  direction: "left" | "right" | null,
) {
  if (direction === "left") {
    return {
      left: true,
    };
  }

  if (direction === "right") {
    return {
      right: true,
    };
  }

  return undefined;
}

function isSameSpaceInvadersHeldInput(
  left: SpaceInvadersMultiplayerHeldInput | undefined,
  right: SpaceInvadersMultiplayerHeldInput | undefined,
) {
  return left?.left === right?.left && left?.right === right?.right;
}

function clearReleasedSpaceInvadersSeatHeldInput(
  runtime: StoredSpaceInvadersMultiplayerRuntime,
  command: MultiplayerServerGameReleaseSeatCommand,
) {
  if (!isSpaceInvadersShipSeat(command.seatId)) {
    return;
  }

  if (runtime.heldInputs[command.seatId] !== undefined) {
    delete runtime.heldInputs[command.seatId];
    runtime.seq += 1;
  }
}

function createSpaceInvadersRuntimeSnapshot(
  runtime: StoredSpaceInvadersMultiplayerRuntime,
  serverTimeMs: number,
): SpaceInvadersMultiplayerServerGameSnapshot {
  return {
    gameId: "space-invaders",
    heldInputs: cloneSpaceInvadersHeldInputs(runtime.heldInputs),
    seq: runtime.seq,
    serverTimeMs,
    snapshot: cloneSpaceInvadersMultiplayerGame(runtime.game),
  };
}

function cloneSpaceInvadersHeldInputs(
  inputs: WritableSpaceInvadersMultiplayerHeldInputs,
): SpaceInvadersMultiplayerHeldInputs {
  const heldInputs: WritableSpaceInvadersMultiplayerHeldInputs = {};

  for (const seat of SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS) {
    if (inputs[seat] !== undefined) {
      heldInputs[seat] = { ...inputs[seat] };
    }
  }

  return heldInputs;
}

function getSpaceInvadersMultiplayerParticipantSeat(
  room: PrivateRoom,
  participantId: unknown,
): SpaceInvadersMultiplayerParticipantSeatResult {
  const roomValidation = validateSpaceInvadersMultiplayerRoom(room);

  if (!roomValidation.success) {
    return roomValidation;
  }

  const normalizedParticipantId =
    typeof participantId === "string" ? participantId.trim() : "";

  const participant = room.participants.find(
    (entry) => entry.id === normalizedParticipantId,
  );

  if (participant === undefined) {
    return createGameRuntimeFailure(
      "participant-not-found",
      "Participant is not in the Space Invaders room.",
    );
  }

  for (const seat of SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS) {
    if (roomValidation.seats[seat].occupiedByParticipantId === participant.id) {
      return {
        seat,
        success: true,
      };
    }
  }

  return createGameRuntimeFailure(
    "participant-not-seated",
    "Participant does not occupy a Space Invaders ship seat.",
  );
}

function validateSpaceInvadersMultiplayerRoom(
  room: PrivateRoom,
): SpaceInvadersMultiplayerRoomValidationResult {
  if (room.settings.gameId !== "space-invaders") {
    return createGameRuntimeFailure(
      "invalid-command",
      "Space Invaders multiplayer only supports Space Invaders rooms.",
    );
  }

  const roomSeats = Object.fromEntries(
    SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS.map((seat) => [
      seat,
      room.seats.find((roomSeat) => roomSeat.id === seat) ?? null,
    ]),
  ) as Record<SpaceInvadersShipSeat, PrivateRoom["seats"][number] | null>;

  if (
    SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS.some(
      (seat) =>
        roomSeats[seat] === null ||
        roomSeats[seat]?.required !== true ||
        roomSeats[seat]?.occupiedByParticipantId === null,
    )
  ) {
    return createGameRuntimeFailure(
      "invalid-status",
      "Space Invaders multiplayer requires occupied required Ship A and Ship B seats.",
    );
  }

  return {
    seats: roomSeats as SpaceInvadersMultiplayerRoomSeats,
    success: true,
  };
}

function getSpaceInvadersRuntime(runtime: unknown) {
  return runtime as StoredSpaceInvadersMultiplayerRuntime;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
