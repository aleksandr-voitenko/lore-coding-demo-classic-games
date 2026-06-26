import type { GameId } from "../game-catalog";
import type { PrivateRoomLifecycleCommand } from "../multiplayer/protocol";
import type {
  PrivateRoom,
  PrivateRoomErrorCode,
  PrivateRoomSeatInput,
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

export type PongMultiplayerInput =
  | {
      direction: unknown;
      type: "pong.setPaddleDirection";
    }
  | {
      type: "pong.serve";
    };

export type MultiplayerServerGameInputCommand<Input = unknown> = {
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

export type MultiplayerServerGameSnapshot = PongMultiplayerGameSnapshot;

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
  }) => void;
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

const INITIAL_GAME_SEQUENCE = 1;
export const PONG_RUNTIME_CATCH_UP_TICK_LIMIT = 60;

const pongMultiplayerRuntimeAdapter: MultiplayerServerGameRuntimeAdapter = {
  advanceRuntimeTo({ nowMs, room, runtime }) {
    advancePongRuntimeTo(getPongRuntime(runtime), room, nowMs);
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
};

const defaultMultiplayerServerGameAdapter = pongMultiplayerRuntimeAdapter;
const multiplayerServerGameAdapters: Partial<
  Record<GameId, MultiplayerServerGameRuntimeAdapter>
> = {
  pong: pongMultiplayerRuntimeAdapter,
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
    return;
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
}

function isPongRuntimeActive(runtime: StoredPongMultiplayerRuntime, room: PrivateRoom) {
  return (
    room.status === "running" &&
    runtime.game.status !== "paused" &&
    runtime.game.status !== "won" &&
    runtime.game.status !== "lost"
  );
}

function getCappedElapsedTicks(lastTickMs: number, nowMs: number, tickDelayMs: number) {
  if (tickDelayMs <= 0 || nowMs <= lastTickMs) {
    return 0;
  }

  return Math.min(
    Math.floor((nowMs - lastTickMs) / tickDelayMs),
    PONG_RUNTIME_CATCH_UP_TICK_LIMIT,
  );
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

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
