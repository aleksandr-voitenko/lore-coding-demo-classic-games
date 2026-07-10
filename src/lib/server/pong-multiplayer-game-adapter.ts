import type {
  PrivateRoom,
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
  type PongMultiplayerTerminalSummary,
} from "../pong-multiplayer";
import type {
  MultiplayerServerGameInputCommand,
  MultiplayerServerGameLifecycleCommand,
  MultiplayerServerGameReleaseSeatCommand,
  MultiplayerServerGameRuntimeAdapter,
  MultiplayerServerGameRuntimeCreateResult,
  MultiplayerServerGameRuntimeFailure,
  MultiplayerServerGameRuntimeInputResult,
  MultiplayerServerGameRuntimeLifecycleResult,
} from "./multiplayer-game-adapter-contract";
import {
  INITIAL_GAME_SEQUENCE,
  createGameRuntimeFailure,
  getCappedElapsedTicks,
  isObjectRecord,
} from "./multiplayer-game-adapter-shared";
import {
  createMultiplayerTerminalSummarySeats,
  getSeatParticipantId,
} from "./multiplayer-game-adapter-summary";

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

export const PONG_RUNTIME_CATCH_UP_TICK_LIMIT = 60;

export const pongMultiplayerRuntimeAdapter: MultiplayerServerGameRuntimeAdapter = {
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
  createSnapshot({ room, runtime, serverTimeMs }) {
    return createPongRuntimeSnapshot(getPongRuntime(runtime), room, serverTimeMs);
  },
  defaultSeats: DEFAULT_PONG_PRIVATE_ROOM_SEATS,
  defaultSettings: DEFAULT_PONG_PRIVATE_ROOM_SETTINGS,
  gameId: "pong",
  isActive({ room, runtime }) {
    return isPongRuntimeActive(getPongRuntime(runtime), room);
  },
  isTerminal({ runtime }) {
    const status = getPongRuntime(runtime).game.status;

    return status === "won" || status === "lost";
  },
  shouldAdvanceSnapshot({ room, snapshot }) {
    return snapshot.gameId === "pong" && shouldAdvancePongSnapshot(room, snapshot);
  },
};

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
    PONG_RUNTIME_CATCH_UP_TICK_LIMIT,
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
      PONG_RUNTIME_CATCH_UP_TICK_LIMIT,
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
  room: PrivateRoom,
  serverTimeMs: number,
): PongMultiplayerGameSnapshot {
  const summary = createPongTerminalSummary(room, runtime.game);

  return {
    gameId: "pong",
    heldInputs: clonePongHeldInputs(runtime.heldInputs),
    seq: runtime.seq,
    serverTimeMs,
    ...(summary === undefined ? {} : { summary }),
    snapshot: clonePongGameState(runtime.game),
  };
}

function createPongTerminalSummary(
  room: PrivateRoom,
  game: PongGameState,
): PongMultiplayerTerminalSummary | undefined {
  if (game.status !== "won" && game.status !== "lost") {
    return undefined;
  }

  const winnerSeatId = game.status === "won" ? "left" : "right";

  return {
    key: `pong|mode=private-room|board=${game.boardWidth}x${game.boardHeight}|target=${game.targetScore}`,
    mode: "private-room",
    outcome: {
      leftScore: game.score.player,
      rightScore: game.score.cpu,
      targetScore: game.targetScore,
      winnerParticipantId: getSeatParticipantId(room, winnerSeatId),
      winnerSeatId,
    },
    seats: createMultiplayerTerminalSummarySeats(room),
    settings: room.settings,
    status: game.status,
  };
}

function getPongRuntime(runtime: unknown) {
  return runtime as StoredPongMultiplayerRuntime;
}
