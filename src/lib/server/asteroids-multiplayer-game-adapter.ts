import {
  getAsteroidsTickDelay,
  type AsteroidsControlInput,
} from "../asteroids-game-engine";
import {
  advanceAsteroidsMultiplayerGameTick,
  ASTEROIDS_MULTIPLAYER_ROOM_SEATS,
  ASTEROIDS_MULTIPLAYER_SHIP_SEATS,
  cloneAsteroidsMultiplayerGame,
  createInitialAsteroidsMultiplayerGame,
  fireAsteroidsMultiplayerShipBullet,
  isAsteroidsShipSeat,
  pauseAsteroidsMultiplayerGame,
  restartAsteroidsMultiplayerGame,
  startAsteroidsMultiplayerGame,
  type AsteroidsMultiplayerGameSnapshot,
  type AsteroidsMultiplayerGameState,
  type AsteroidsMultiplayerHeldInput,
  type AsteroidsMultiplayerHeldInputs,
  type AsteroidsMultiplayerTerminalSummary,
  type AsteroidsShipSeat,
  type CreateAsteroidsMultiplayerGameOptions,
} from "../asteroids-multiplayer";
import type {
  PrivateRoom,
  PrivateRoomSeatInput,
  PrivateRoomSettings,
} from "../multiplayer/room";
import type {
  MultiplayerServerGameInputCommand,
  MultiplayerServerGameLifecycleCommand,
  MultiplayerServerGameReleaseSeatCommand,
  MultiplayerServerGameRuntimeAdapter,
  MultiplayerServerGameRuntimeCreateResult,
  MultiplayerServerGameRuntimeFailure,
  MultiplayerServerGameRuntimeInputResult,
  MultiplayerServerGameRuntimeLifecycleResult,
  MultiplayerServerGameSnapshot,
} from "./multiplayer-game-adapter-contract";
import {
  INITIAL_GAME_SEQUENCE,
  createGameRuntimeFailure,
  getCappedElapsedTicks,
  isObjectRecord,
} from "./multiplayer-game-adapter-shared";
import { createMultiplayerTerminalSummarySeats } from "./multiplayer-game-adapter-summary";

type StoredAsteroidsMultiplayerRuntime = {
  game: AsteroidsMultiplayerGameState;
  heldInputs: WritableAsteroidsMultiplayerHeldInputs;
  lastTickMs: number;
  seq: number;
};

type WritableAsteroidsMultiplayerHeldInputs = Partial<
  Record<AsteroidsShipSeat, AsteroidsMultiplayerHeldInput>
>;

type AsteroidsMultiplayerRoomSeats = Record<
  AsteroidsShipSeat,
  PrivateRoom["seats"][number]
>;

type AsteroidsMultiplayerRoomValidationResult =
  | {
      seats: AsteroidsMultiplayerRoomSeats;
      success: true;
    }
  | MultiplayerServerGameRuntimeFailure;

type AsteroidsMultiplayerParticipantSeatResult =
  | {
      seat: AsteroidsShipSeat;
      success: true;
    }
  | MultiplayerServerGameRuntimeFailure;

export const DEFAULT_ASTEROIDS_PRIVATE_ROOM_SEATS =
  ASTEROIDS_MULTIPLAYER_ROOM_SEATS satisfies readonly PrivateRoomSeatInput[];

const DEFAULT_ASTEROIDS_PRIVATE_ROOM_SETTINGS = {
  gameId: "asteroids",
} as const satisfies PrivateRoomSettings;

const ASTEROIDS_RUNTIME_CATCH_UP_TICK_LIMIT = 60;

export const asteroidsMultiplayerRuntimeAdapter: MultiplayerServerGameRuntimeAdapter = {
  advanceRuntimeTo({ nowMs, room, runtime }) {
    return advanceAsteroidsRuntimeTo(getAsteroidsRuntime(runtime), room, nowMs);
  },
  applyInputCommand({ command, nowMs, room, runtime }) {
    return applyAsteroidsInputCommand(room, runtime, command, nowMs);
  },
  applyLifecycleCommand({ command, nowMs, room, runtime }) {
    return applyAsteroidsLifecycleCommand(room, runtime, command, nowMs);
  },
  clearInputForReleasedSeat({ command, runtime }) {
    clearReleasedAsteroidsSeatHeldInput(getAsteroidsRuntime(runtime), command);
  },
  createRuntime({ nowMs, room }) {
    return createAsteroidsRuntime(room, nowMs);
  },
  createSnapshot({ room, runtime, serverTimeMs }) {
    return createAsteroidsRuntimeSnapshot(
      getAsteroidsRuntime(runtime),
      room,
      serverTimeMs,
    );
  },
  defaultSeats: DEFAULT_ASTEROIDS_PRIVATE_ROOM_SEATS,
  defaultSettings: DEFAULT_ASTEROIDS_PRIVATE_ROOM_SETTINGS,
  gameId: "asteroids",
  isActive({ room, runtime }) {
    return isAsteroidsRuntimeActive(getAsteroidsRuntime(runtime), room);
  },
  isTerminal({ runtime }) {
    return getAsteroidsRuntime(runtime).game.status === "lost";
  },
  shouldAdvanceSnapshot({ room, snapshot }) {
    return shouldAdvanceAsteroidsSnapshot(room, snapshot);
  },
};

function parseAsteroidsMultiplayerRoomSettings(
  parameters: PrivateRoom["settings"]["parameters"] = {},
): CreateAsteroidsMultiplayerGameOptions {
  const difficulty = parameters["asteroids-difficulty"];

  return typeof difficulty === "string" ? { difficulty } : {};
}

function createAsteroidsRuntime(
  room: PrivateRoom,
  nowMs: number,
): MultiplayerServerGameRuntimeCreateResult {
  const roomValidation = validateAsteroidsMultiplayerRoom(room);

  if (!roomValidation.success) {
    return roomValidation;
  }

  return {
    runtime: {
      game: startAsteroidsMultiplayerGame(
        createInitialAsteroidsMultiplayerGame(
          parseAsteroidsMultiplayerRoomSettings(room.settings.parameters),
        ),
      ),
      heldInputs: {},
      lastTickMs: nowMs,
      seq: INITIAL_GAME_SEQUENCE,
    } satisfies StoredAsteroidsMultiplayerRuntime,
    success: true,
  };
}

function resetAsteroidsRuntimeClock(
  runtime: StoredAsteroidsMultiplayerRuntime,
  nowMs: number,
) {
  runtime.lastTickMs = nowMs;
}

function advanceAsteroidsRuntimeTo(
  runtime: StoredAsteroidsMultiplayerRuntime,
  room: PrivateRoom,
  nowMs: number,
) {
  if (!isAsteroidsRuntimeActive(runtime, room)) {
    return false;
  }

  let changed = false;
  const tickDelayMs = getAsteroidsTickDelay();
  const elapsedTicks = getCappedElapsedTicks(
    runtime.lastTickMs,
    nowMs,
    tickDelayMs,
    ASTEROIDS_RUNTIME_CATCH_UP_TICK_LIMIT,
  );

  for (let tickIndex = 0; tickIndex < elapsedTicks; tickIndex += 1) {
    const nextGame = advanceAsteroidsMultiplayerGameTick(
      runtime.game,
      runtime.heldInputs as AsteroidsMultiplayerHeldInputs,
    );

    if (nextGame !== runtime.game) {
      runtime.game = nextGame;
      changed = true;
    }

    runtime.lastTickMs += tickDelayMs;

    if (runtime.game.status !== "running") {
      resetAsteroidsRuntimeClock(runtime, nowMs);
      break;
    }
  }

  if (changed) {
    runtime.seq += 1;
  }

  return changed;
}

function isAsteroidsRuntimeActive(
  runtime: StoredAsteroidsMultiplayerRuntime,
  room: PrivateRoom,
) {
  return isAsteroidsGameActive(room, runtime.game);
}

function shouldAdvanceAsteroidsSnapshot(
  room: PrivateRoom,
  snapshot: MultiplayerServerGameSnapshot,
) {
  return (
    snapshot.gameId === "asteroids" &&
    isAsteroidsGameActive(room, snapshot.snapshot)
  );
}

function isAsteroidsGameActive(
  room: PrivateRoom,
  game: Pick<AsteroidsMultiplayerGameState, "status">,
) {
  return room.status === "running" && game.status === "running";
}

function applyAsteroidsLifecycleCommand(
  room: PrivateRoom,
  unknownRuntime: unknown | undefined,
  command: MultiplayerServerGameLifecycleCommand,
  nowMs: number,
): MultiplayerServerGameRuntimeLifecycleResult {
  if (command.command === "start") {
    return createAsteroidsRuntime(room, nowMs);
  }

  if (unknownRuntime === undefined) {
    return {
      success: true,
    };
  }

  const runtime = getAsteroidsRuntime(unknownRuntime);

  if (command.command === "pause") {
    const nextGame = pauseAsteroidsMultiplayerGame(runtime.game);

    if (nextGame !== runtime.game) {
      runtime.game = nextGame;
      runtime.seq += 1;
    }

    resetAsteroidsRuntimeClock(runtime, nowMs);
    return {
      success: true,
    };
  }

  if (command.command === "resume") {
    if (resumeAsteroidsRuntimeGame(runtime)) {
      runtime.seq += 1;
    }

    resetAsteroidsRuntimeClock(runtime, nowMs);
    return {
      success: true,
    };
  }

  if (command.command === "restart") {
    runtime.game = restartAsteroidsMultiplayerGame(runtime.game);
    runtime.heldInputs = {};
    runtime.seq += 1;
    resetAsteroidsRuntimeClock(runtime, nowMs);
    return {
      success: true,
    };
  }

  if (command.command === "finish") {
    let changed = false;
    const nextGame = pauseAsteroidsMultiplayerGame(runtime.game);

    if (nextGame !== runtime.game) {
      runtime.game = nextGame;
      changed = true;
    }

    if (Object.keys(runtime.heldInputs).length > 0) {
      runtime.heldInputs = {};
      changed = true;
    }

    if (changed) {
      runtime.seq += 1;
    }

    resetAsteroidsRuntimeClock(runtime, nowMs);
  }

  return {
    success: true,
  };
}

function resumeAsteroidsRuntimeGame(runtime: StoredAsteroidsMultiplayerRuntime) {
  if (runtime.game.status !== "paused" && runtime.game.status !== "ready") {
    return false;
  }

  runtime.game = startAsteroidsMultiplayerGame(runtime.game);
  return true;
}

function applyAsteroidsInputCommand(
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
      "Asteroids input must be a JSON object.",
    );
  }

  if (unknownRuntime === undefined) {
    return createGameRuntimeFailure(
      "invalid-status",
      "Asteroids input is only accepted after the room has started.",
    );
  }

  if (room.status === "finished") {
    return createGameRuntimeFailure(
      "invalid-status",
      "Finished rooms cannot accept Asteroids input.",
    );
  }

  const runtime = getAsteroidsRuntime(unknownRuntime);
  const seatResult = getAsteroidsMultiplayerParticipantSeat(
    room,
    command.participantId,
  );

  if (!seatResult.success) {
    return seatResult;
  }

  if (input.type === "asteroids.setShipControls") {
    const controls = parseAsteroidsShipControls(input.controls);

    if (!controls.success) {
      return controls;
    }

    if (setAsteroidsHeldControls(runtime, seatResult.seat, controls.controls)) {
      runtime.seq += 1;
    }

    return {
      participantId,
      success: true,
    };
  }

  if (input.type === "asteroids.fire") {
    if (runtime.game.status !== "running" || room.status !== "running") {
      return createGameRuntimeFailure(
        "invalid-status",
        "Asteroids fire is only available while the game is running.",
      );
    }

    const nextGame = fireAsteroidsMultiplayerShipBullet(
      runtime.game,
      seatResult.seat,
    );

    if (nextGame !== runtime.game) {
      runtime.game = nextGame;
      runtime.seq += 1;
      resetAsteroidsRuntimeClock(runtime, nowMs);
    }

    return {
      participantId,
      success: true,
    };
  }

  return createGameRuntimeFailure(
    "invalid-command",
    "Asteroids input type is not supported.",
  );
}

function parseAsteroidsShipControls(
  controls: unknown,
): MultiplayerServerGameRuntimeFailure | {
  controls: AsteroidsControlInput;
  success: true;
} {
  if (!isObjectRecord(controls)) {
    return createGameRuntimeFailure(
      "invalid-command",
      "Asteroids ship controls must be a JSON object.",
    );
  }

  const rotateLeft = parseAsteroidsControlFlag(controls.rotateLeft);
  const rotateRight = parseAsteroidsControlFlag(controls.rotateRight);
  const thrust = parseAsteroidsControlFlag(controls.thrust);

  if (rotateLeft === null || rotateRight === null || thrust === null) {
    return createGameRuntimeFailure(
      "invalid-command",
      "Asteroids ship control values must be booleans when provided.",
    );
  }

  return {
    controls: {
      ...(rotateLeft === true ? { rotateLeft } : {}),
      ...(rotateRight === true ? { rotateRight } : {}),
      ...(thrust === true ? { thrust } : {}),
    },
    success: true,
  };
}

function parseAsteroidsControlFlag(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  return typeof value === "boolean" ? value : null;
}

function setAsteroidsHeldControls(
  runtime: StoredAsteroidsMultiplayerRuntime,
  seat: AsteroidsShipSeat,
  controls: AsteroidsControlInput,
) {
  const currentInput = runtime.heldInputs[seat];
  const nextInput = getAsteroidsHeldInputForControls(controls);

  if (isSameAsteroidsHeldInput(currentInput, nextInput)) {
    return false;
  }

  if (nextInput === undefined) {
    delete runtime.heldInputs[seat];
  } else {
    runtime.heldInputs[seat] = nextInput;
  }

  return true;
}

function getAsteroidsHeldInputForControls(
  controls: AsteroidsControlInput,
): AsteroidsMultiplayerHeldInput | undefined {
  const heldInput = {
    ...(controls.rotateLeft === true ? { rotateLeft: true } : {}),
    ...(controls.rotateRight === true ? { rotateRight: true } : {}),
    ...(controls.thrust === true ? { thrust: true } : {}),
  } satisfies AsteroidsMultiplayerHeldInput;

  return Object.keys(heldInput).length === 0 ? undefined : heldInput;
}

function isSameAsteroidsHeldInput(
  left: AsteroidsMultiplayerHeldInput | undefined,
  right: AsteroidsMultiplayerHeldInput | undefined,
) {
  return (
    left?.fire === right?.fire &&
    left?.rotateLeft === right?.rotateLeft &&
    left?.rotateRight === right?.rotateRight &&
    left?.thrust === right?.thrust
  );
}

function clearReleasedAsteroidsSeatHeldInput(
  runtime: StoredAsteroidsMultiplayerRuntime,
  command: MultiplayerServerGameReleaseSeatCommand,
) {
  if (!isAsteroidsShipSeat(command.seatId)) {
    return;
  }

  if (runtime.heldInputs[command.seatId] !== undefined) {
    delete runtime.heldInputs[command.seatId];
    runtime.seq += 1;
  }
}

function createAsteroidsRuntimeSnapshot(
  runtime: StoredAsteroidsMultiplayerRuntime,
  room: PrivateRoom,
  serverTimeMs: number,
): AsteroidsMultiplayerGameSnapshot {
  const summary = createAsteroidsTerminalSummary(room, runtime.game);

  return {
    gameId: "asteroids",
    heldInputs: cloneAsteroidsHeldInputs(runtime.heldInputs),
    seq: runtime.seq,
    serverTimeMs,
    ...(summary === undefined ? {} : { summary }),
    snapshot: cloneAsteroidsMultiplayerGame(runtime.game),
  };
}

function createAsteroidsTerminalSummary(
  room: PrivateRoom,
  game: AsteroidsMultiplayerGameState,
): AsteroidsMultiplayerTerminalSummary | undefined {
  if (game.status !== "lost") {
    return undefined;
  }

  return {
    key: `asteroids|mode=private-room|difficulty=${game.difficulty}`,
    mode: "private-room",
    outcome: {
      livesRemaining: game.lives,
      score: game.score,
      wave: game.wave,
    },
    seats: createMultiplayerTerminalSummarySeats(room),
    settings: room.settings,
    status: game.status,
  };
}

function cloneAsteroidsHeldInputs(
  inputs: WritableAsteroidsMultiplayerHeldInputs,
): AsteroidsMultiplayerHeldInputs {
  const heldInputs: WritableAsteroidsMultiplayerHeldInputs = {};

  for (const seat of ASTEROIDS_MULTIPLAYER_SHIP_SEATS) {
    if (inputs[seat] !== undefined) {
      heldInputs[seat] = { ...inputs[seat] };
    }
  }

  return heldInputs;
}

function getAsteroidsMultiplayerParticipantSeat(
  room: PrivateRoom,
  participantId: unknown,
): AsteroidsMultiplayerParticipantSeatResult {
  const roomValidation = validateAsteroidsMultiplayerRoom(room);

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
      "Participant is not in the Asteroids room.",
    );
  }

  for (const seat of ASTEROIDS_MULTIPLAYER_SHIP_SEATS) {
    if (roomValidation.seats[seat].occupiedByParticipantId === participant.id) {
      return {
        seat,
        success: true,
      };
    }
  }

  return createGameRuntimeFailure(
    "participant-not-seated",
    "Participant does not occupy an Asteroids ship seat.",
  );
}

function validateAsteroidsMultiplayerRoom(
  room: PrivateRoom,
): AsteroidsMultiplayerRoomValidationResult {
  if (room.settings.gameId !== "asteroids") {
    return createGameRuntimeFailure(
      "invalid-command",
      "Asteroids multiplayer only supports Asteroids rooms.",
    );
  }

  const roomSeats = Object.fromEntries(
    ASTEROIDS_MULTIPLAYER_SHIP_SEATS.map((seat) => [
      seat,
      room.seats.find((roomSeat) => roomSeat.id === seat) ?? null,
    ]),
  ) as Record<AsteroidsShipSeat, PrivateRoom["seats"][number] | null>;

  if (
    ASTEROIDS_MULTIPLAYER_SHIP_SEATS.some(
      (seat) =>
        roomSeats[seat] === null ||
        roomSeats[seat]?.required !== true ||
        roomSeats[seat]?.occupiedByParticipantId === null,
    )
  ) {
    return createGameRuntimeFailure(
      "invalid-status",
      "Asteroids multiplayer requires occupied required Ship A and Ship B seats.",
    );
  }

  return {
    seats: roomSeats as AsteroidsMultiplayerRoomSeats,
    success: true,
  };
}

function getAsteroidsRuntime(runtime: unknown) {
  return runtime as StoredAsteroidsMultiplayerRuntime;
}
