import type {
  PrivateRoom,
  PrivateRoomSeatInput,
  PrivateRoomSettingValue,
  PrivateRoomSettings,
} from "../multiplayer/room";
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
  type SpaceInvadersMultiplayerGameState,
  type SpaceInvadersMultiplayerHeldInput,
  type SpaceInvadersMultiplayerHeldInputs,
  type SpaceInvadersMultiplayerTerminalSummary,
  type SpaceInvadersShipSeat,
} from "../space-invaders-multiplayer";
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
  SpaceInvadersMultiplayerServerGameSnapshot,
} from "./multiplayer-game-adapter-contract";
import {
  INITIAL_GAME_SEQUENCE,
  createGameRuntimeFailure,
  getCappedElapsedTicks,
  isObjectRecord,
} from "./multiplayer-game-adapter-shared";
import { createMultiplayerTerminalSummarySeats } from "./multiplayer-game-adapter-summary";

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

export const DEFAULT_SPACE_INVADERS_PRIVATE_ROOM_SEATS =
  SPACE_INVADERS_MULTIPLAYER_ROOM_SEATS satisfies readonly PrivateRoomSeatInput[];

const DEFAULT_SPACE_INVADERS_PRIVATE_ROOM_SETTINGS = {
  gameId: "space-invaders",
} as const satisfies PrivateRoomSettings;

const SPACE_INVADERS_RUNTIME_CATCH_UP_TICK_LIMIT = 60;

export const spaceInvadersMultiplayerRuntimeAdapter: MultiplayerServerGameRuntimeAdapter = {
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
  createSnapshot({ room, runtime, serverTimeMs }) {
    return createSpaceInvadersRuntimeSnapshot(
      getSpaceInvadersRuntime(runtime),
      room,
      serverTimeMs,
    );
  },
  defaultSeats: DEFAULT_SPACE_INVADERS_PRIVATE_ROOM_SEATS,
  defaultSettings: DEFAULT_SPACE_INVADERS_PRIVATE_ROOM_SETTINGS,
  gameId: "space-invaders",
  isActive({ room, runtime }) {
    return isSpaceInvadersRuntimeActive(getSpaceInvadersRuntime(runtime), room);
  },
  isTerminal({ runtime }) {
    const status = getSpaceInvadersRuntime(runtime).game.status;

    return status === "won" || status === "lost";
  },
  shouldAdvanceSnapshot({ room, snapshot }) {
    return shouldAdvanceSpaceInvadersSnapshot(room, snapshot);
  },
};

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
  room: PrivateRoom,
  serverTimeMs: number,
): Omit<SpaceInvadersMultiplayerServerGameSnapshot, "matchId"> {
  const summary = createSpaceInvadersTerminalSummary(room, runtime.game);

  return {
    gameId: "space-invaders",
    heldInputs: cloneSpaceInvadersHeldInputs(runtime.heldInputs),
    seq: runtime.seq,
    serverTimeMs,
    ...(summary === undefined ? {} : { summary }),
    snapshot: cloneSpaceInvadersMultiplayerGame(runtime.game),
  };
}

function createSpaceInvadersTerminalSummary(
  room: PrivateRoom,
  game: SpaceInvadersMultiplayerGameState,
): SpaceInvadersMultiplayerTerminalSummary | undefined {
  if (game.status !== "won" && game.status !== "lost") {
    return undefined;
  }

  return {
    key: `space-invaders|mode=private-room|board=${game.boardWidth}x${game.boardHeight}|aliens=${game.alienCount}`,
    mode: "private-room",
    outcome: {
      livesRemaining: game.lives,
      remainingInvaders: getRemainingSpaceInvadersCount(game),
      result: game.status,
      score: game.score,
    },
    seats: createMultiplayerTerminalSummarySeats(room),
    settings: room.settings,
    status: game.status,
  };
}

function getRemainingSpaceInvadersCount(
  game: Pick<SpaceInvadersMultiplayerGameState, "invaders">,
) {
  return game.invaders.filter((invader) => invader.isActive).length;
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
