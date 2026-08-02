import {
  advanceBattleCityMultiplayerGame,
  BATTLE_CITY_TICK_MS,
  getBattleCityReserveLives,
  type BattleCityDirection,
  type BattleCityMultiplayerFrameInput,
  type BattleCityMultiplayerGameState,
} from "../battle-city-game-engine";
import {
  BATTLE_CITY_MULTIPLAYER_PLAYER_SEATS,
  BATTLE_CITY_MULTIPLAYER_ROOM_SEATS,
  cloneBattleCityMultiplayerGame,
  createStartedBattleCityMultiplayerGame,
  isBattleCityMultiplayerPlayerSeat,
  type BattleCityMultiplayerGameSnapshot,
  type BattleCityMultiplayerHeldInput,
  type BattleCityMultiplayerHeldInputs,
  type BattleCityMultiplayerPlayerSeat,
  type BattleCityMultiplayerTerminalSummary,
} from "../battle-city-multiplayer";
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

type StoredBattleCityMultiplayerRuntime = {
  game: BattleCityMultiplayerGameState;
  heldInputs: WritableBattleCityMultiplayerHeldInputs;
  lastTickMs: number;
  seq: number;
  terminalSummary?: BattleCityMultiplayerTerminalSummary;
};

type WritableBattleCityMultiplayerHeldInputs = Partial<
  Record<BattleCityMultiplayerPlayerSeat, BattleCityMultiplayerHeldInput>
>;

type BattleCityMultiplayerRoomSeats = Record<
  BattleCityMultiplayerPlayerSeat,
  PrivateRoom["seats"][number]
>;

type BattleCityMultiplayerRoomValidationResult =
  | {
      seats: BattleCityMultiplayerRoomSeats;
      success: true;
    }
  | MultiplayerServerGameRuntimeFailure;

type BattleCityMultiplayerParticipantSeatResult =
  | {
      seat: BattleCityMultiplayerPlayerSeat;
      success: true;
    }
  | MultiplayerServerGameRuntimeFailure;

export const DEFAULT_BATTLE_CITY_PRIVATE_ROOM_SEATS =
  BATTLE_CITY_MULTIPLAYER_ROOM_SEATS satisfies readonly PrivateRoomSeatInput[];

const DEFAULT_BATTLE_CITY_PRIVATE_ROOM_SETTINGS = {
  gameId: "battle-city",
} as const satisfies PrivateRoomSettings;

export const BATTLE_CITY_RUNTIME_CATCH_UP_TICK_LIMIT = 60;

export const battleCityMultiplayerRuntimeAdapter: MultiplayerServerGameRuntimeAdapter = {
  advanceRuntimeTo({ nowMs, room, runtime }) {
    return advanceBattleCityRuntimeTo(getBattleCityRuntime(runtime), room, nowMs);
  },
  applyInputCommand({ command, room, runtime }) {
    return applyBattleCityInputCommand(room, runtime, command);
  },
  applyLifecycleCommand({ command, nowMs, room, runtime }) {
    return applyBattleCityLifecycleCommand(room, runtime, command, nowMs);
  },
  clearInputForReleasedSeat({ command, runtime }) {
    clearReleasedBattleCitySeatHeldInput(getBattleCityRuntime(runtime), command);
  },
  createRuntime({ nowMs, room }) {
    return createBattleCityRuntime(room, nowMs);
  },
  createSnapshot({ matchRoom, runtime, serverTimeMs }) {
    return createBattleCityRuntimeSnapshot(
      getBattleCityRuntime(runtime),
      matchRoom,
      serverTimeMs,
    );
  },
  defaultSeats: DEFAULT_BATTLE_CITY_PRIVATE_ROOM_SEATS,
  defaultSettings: DEFAULT_BATTLE_CITY_PRIVATE_ROOM_SETTINGS,
  gameId: "battle-city",
  isActive({ room, runtime }) {
    return isBattleCityRuntimeActive(getBattleCityRuntime(runtime), room);
  },
  isTerminal({ runtime }) {
    return getBattleCityRuntime(runtime).game.status === "lost";
  },
  shouldAdvanceSnapshot({ room, snapshot }) {
    return shouldAdvanceBattleCitySnapshot(room, snapshot);
  },
};

function createBattleCityRuntime(
  room: PrivateRoom,
  nowMs: number,
): MultiplayerServerGameRuntimeCreateResult {
  const roomValidation = validateBattleCityMultiplayerRoom(room);

  if (!roomValidation.success) {
    return roomValidation;
  }

  return {
    runtime: {
      game: createStartedBattleCityMultiplayerGame(),
      heldInputs: {},
      lastTickMs: nowMs,
      seq: INITIAL_GAME_SEQUENCE,
    } satisfies StoredBattleCityMultiplayerRuntime,
    success: true,
  };
}

function advanceBattleCityRuntimeTo(
  runtime: StoredBattleCityMultiplayerRuntime,
  room: PrivateRoom,
  nowMs: number,
) {
  if (!isBattleCityRuntimeActive(runtime, room)) {
    return false;
  }

  let changed = false;
  const elapsedTicks = getCappedElapsedTicks(
    runtime.lastTickMs,
    nowMs,
    BATTLE_CITY_TICK_MS,
    BATTLE_CITY_RUNTIME_CATCH_UP_TICK_LIMIT,
  );

  for (let tickIndex = 0; tickIndex < elapsedTicks; tickIndex += 1) {
    const nextGame = advanceBattleCityMultiplayerGame(
      runtime.game,
      BATTLE_CITY_TICK_MS,
      Math.random,
      createBattleCityFrameInput(runtime.heldInputs),
    );

    if (nextGame !== runtime.game) {
      runtime.game = nextGame;
      changed = true;
    }

    if (consumeBattleCityFireRequests(runtime.heldInputs)) {
      changed = true;
    }

    runtime.lastTickMs += BATTLE_CITY_TICK_MS;

    if (runtime.game.status === "lost") {
      resetBattleCityRuntimeClock(runtime, nowMs);
      break;
    }
  }

  if (changed) {
    runtime.seq += 1;
  }

  return changed;
}

function createBattleCityFrameInput(
  heldInputs: WritableBattleCityMultiplayerHeldInputs,
): BattleCityMultiplayerFrameInput {
  const playerInput = (seat: BattleCityMultiplayerPlayerSeat) => ({
    direction: heldInputs[seat]?.direction ?? null,
    fireRequested: heldInputs[seat]?.fireRequested === true,
  });

  return {
    player1: playerInput("player-1"),
    player2: playerInput("player-2"),
  };
}

function consumeBattleCityFireRequests(
  heldInputs: WritableBattleCityMultiplayerHeldInputs,
) {
  let changed = false;

  for (const seat of BATTLE_CITY_MULTIPLAYER_PLAYER_SEATS) {
    const input = heldInputs[seat];

    if (input?.fireRequested !== true) {
      continue;
    }

    if (input.direction === null) {
      delete heldInputs[seat];
    } else {
      heldInputs[seat] = { direction: input.direction };
    }
    changed = true;
  }

  return changed;
}

function resetBattleCityRuntimeClock(
  runtime: StoredBattleCityMultiplayerRuntime,
  nowMs: number,
) {
  runtime.lastTickMs = nowMs;
}

function isBattleCityRuntimeActive(
  runtime: StoredBattleCityMultiplayerRuntime,
  room: PrivateRoom,
) {
  return isBattleCityGameActive(room, runtime.game);
}

function shouldAdvanceBattleCitySnapshot(
  room: PrivateRoom,
  snapshot: MultiplayerServerGameSnapshot,
) {
  return (
    snapshot.gameId === "battle-city" &&
    isBattleCityGameActive(room, snapshot.snapshot)
  );
}

function isBattleCityGameActive(
  room: PrivateRoom,
  game: Pick<BattleCityMultiplayerGameState, "status">,
) {
  return room.status === "running" && game.status !== "lost";
}

function applyBattleCityLifecycleCommand(
  room: PrivateRoom,
  unknownRuntime: unknown | undefined,
  command: MultiplayerServerGameLifecycleCommand,
  nowMs: number,
): MultiplayerServerGameRuntimeLifecycleResult {
  if (command.command === "start") {
    return createBattleCityRuntime(room, nowMs);
  }

  if (unknownRuntime === undefined) {
    return { success: true };
  }

  const runtime = getBattleCityRuntime(unknownRuntime);

  if (command.command === "restart") {
    runtime.game = createStartedBattleCityMultiplayerGame();
    runtime.heldInputs = {};
    runtime.terminalSummary = undefined;
    runtime.seq += 1;
    resetBattleCityRuntimeClock(runtime, nowMs);
    return { success: true };
  }

  if (command.command === "finish") {
    if (Object.keys(runtime.heldInputs).length > 0) {
      runtime.heldInputs = {};
      runtime.seq += 1;
    }
  }

  // Room state owns pause and finish. Preserving the internal state lets stage
  // introductions, score tallies, and ending tails resume at the exact frame.
  resetBattleCityRuntimeClock(runtime, nowMs);
  return { success: true };
}

function applyBattleCityInputCommand(
  room: PrivateRoom,
  unknownRuntime: unknown | undefined,
  command: MultiplayerServerGameInputCommand,
): MultiplayerServerGameRuntimeInputResult {
  const participantId =
    typeof command.participantId === "string" ? command.participantId : undefined;
  const input = command.input;

  if (!isObjectRecord(input)) {
    return createGameRuntimeFailure(
      "invalid-command",
      "Tank Patrol input must be a JSON object.",
    );
  }

  if (unknownRuntime === undefined) {
    return createGameRuntimeFailure(
      "invalid-status",
      "Tank Patrol input is only accepted after the room has started.",
    );
  }

  if (room.status === "finished") {
    return createGameRuntimeFailure(
      "invalid-status",
      "Finished rooms cannot accept Tank Patrol input.",
    );
  }

  const runtime = getBattleCityRuntime(unknownRuntime);
  const seatResult = getBattleCityMultiplayerParticipantSeat(
    room,
    command.participantId,
  );

  if (!seatResult.success) {
    return seatResult;
  }

  if (input.type === "battle-city.setDirection") {
    const direction = parseBattleCityDirection(input.direction);

    if (!direction.success) {
      return direction;
    }

    if (setBattleCityHeldDirection(runtime, seatResult.seat, direction.direction)) {
      runtime.seq += 1;
    }

    return { participantId, success: true };
  }

  if (input.type === "battle-city.fire") {
    if (
      room.status !== "running" ||
      (runtime.game.status !== "running" &&
        runtime.game.status !== "stage-clear")
    ) {
      return createGameRuntimeFailure(
        "invalid-status",
        "Tank Patrol fire is only available during active battle play.",
      );
    }

    if (latchBattleCityFire(runtime, seatResult.seat)) {
      runtime.seq += 1;
    }

    return { participantId, success: true };
  }

  return createGameRuntimeFailure(
    "invalid-command",
    "Tank Patrol input type is not supported.",
  );
}

function parseBattleCityDirection(
  direction: unknown,
):
  | MultiplayerServerGameRuntimeFailure
  | { direction: BattleCityDirection | null; success: true } {
  if (
    direction === "up" ||
    direction === "right" ||
    direction === "down" ||
    direction === "left" ||
    direction === null
  ) {
    return { direction, success: true };
  }

  return createGameRuntimeFailure(
    "invalid-command",
    "Tank Patrol direction must be up, right, down, left, or null.",
  );
}

function setBattleCityHeldDirection(
  runtime: StoredBattleCityMultiplayerRuntime,
  seat: BattleCityMultiplayerPlayerSeat,
  direction: BattleCityDirection | null,
) {
  const currentInput = runtime.heldInputs[seat];

  if ((currentInput?.direction ?? null) === direction) {
    return false;
  }

  if (direction === null && currentInput?.fireRequested !== true) {
    delete runtime.heldInputs[seat];
  } else {
    runtime.heldInputs[seat] = {
      direction,
      ...(currentInput?.fireRequested === true ? { fireRequested: true } : {}),
    };
  }

  return true;
}

function latchBattleCityFire(
  runtime: StoredBattleCityMultiplayerRuntime,
  seat: BattleCityMultiplayerPlayerSeat,
) {
  const currentInput = runtime.heldInputs[seat];

  if (currentInput?.fireRequested === true) {
    return false;
  }

  runtime.heldInputs[seat] = {
    direction: currentInput?.direction ?? null,
    fireRequested: true,
  };
  return true;
}

function clearReleasedBattleCitySeatHeldInput(
  runtime: StoredBattleCityMultiplayerRuntime,
  command: MultiplayerServerGameReleaseSeatCommand,
) {
  if (!isBattleCityMultiplayerPlayerSeat(command.seatId)) {
    return;
  }

  if (runtime.heldInputs[command.seatId] !== undefined) {
    delete runtime.heldInputs[command.seatId];
    runtime.seq += 1;
  }
}

function createBattleCityRuntimeSnapshot(
  runtime: StoredBattleCityMultiplayerRuntime,
  matchRoom: PrivateRoom,
  serverTimeMs: number,
): Omit<BattleCityMultiplayerGameSnapshot, "matchId"> {
  runtime.terminalSummary ??= createBattleCityTerminalSummary(
    matchRoom,
    runtime.game,
  );
  const summary = runtime.terminalSummary;

  return {
    gameId: "battle-city",
    heldInputs: cloneBattleCityHeldInputs(runtime.heldInputs),
    seq: runtime.seq,
    serverTimeMs,
    ...(summary === undefined
      ? {}
      : { summary: cloneBattleCityTerminalSummary(summary) }),
    snapshot: cloneBattleCityMultiplayerGame(runtime.game),
  };
}

function cloneBattleCityTerminalSummary(
  summary: BattleCityMultiplayerTerminalSummary,
): BattleCityMultiplayerTerminalSummary {
  return {
    ...summary,
    outcome: { ...summary.outcome },
    seats: summary.seats.map((seat) => ({
      ...seat,
      participant:
        seat.participant === null ? null : { ...seat.participant },
    })),
    settings: { ...summary.settings },
  };
}

function createBattleCityTerminalSummary(
  matchRoom: PrivateRoom,
  game: BattleCityMultiplayerGameState,
): BattleCityMultiplayerTerminalSummary | undefined {
  if (game.status !== "lost") {
    return undefined;
  }

  return {
    key: "battle-city|mode=private-room|start-stage=1",
    mode: "private-room",
    outcome: {
      cycle: game.cycle,
      player1Lives: game.lives,
      player1ReserveLives: getBattleCityReserveLives(
        game.lives,
        game.player.phase,
      ),
      player1Score: game.score,
      player2Lives: game.player2Lives,
      player2ReserveLives: getBattleCityReserveLives(
        game.player2Lives,
        game.player2.phase,
      ),
      player2Score: game.player2Score,
      stage: game.stage,
    },
    seats: createMultiplayerTerminalSummarySeats(matchRoom),
    settings: matchRoom.settings,
    status: "lost",
  };
}

function cloneBattleCityHeldInputs(
  inputs: WritableBattleCityMultiplayerHeldInputs,
): BattleCityMultiplayerHeldInputs {
  const heldInputs: WritableBattleCityMultiplayerHeldInputs = {};

  for (const seat of BATTLE_CITY_MULTIPLAYER_PLAYER_SEATS) {
    if (inputs[seat] !== undefined) {
      heldInputs[seat] = { ...inputs[seat] };
    }
  }

  return heldInputs;
}

function getBattleCityMultiplayerParticipantSeat(
  room: PrivateRoom,
  participantId: unknown,
): BattleCityMultiplayerParticipantSeatResult {
  const roomValidation = validateBattleCityMultiplayerRoom(room);

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
      "Participant is not in the Tank Patrol room.",
    );
  }

  for (const seat of BATTLE_CITY_MULTIPLAYER_PLAYER_SEATS) {
    if (roomValidation.seats[seat].occupiedByParticipantId === participant.id) {
      return { seat, success: true };
    }
  }

  return createGameRuntimeFailure(
    "participant-not-seated",
    "Participant does not occupy a Tank Patrol player seat.",
  );
}

function validateBattleCityMultiplayerRoom(
  room: PrivateRoom,
): BattleCityMultiplayerRoomValidationResult {
  if (room.settings.gameId !== "battle-city") {
    return createGameRuntimeFailure(
      "invalid-command",
      "Tank Patrol multiplayer only supports Tank Patrol rooms.",
    );
  }

  const roomSeats = Object.fromEntries(
    BATTLE_CITY_MULTIPLAYER_PLAYER_SEATS.map((seat) => [
      seat,
      room.seats.find((roomSeat) => roomSeat.id === seat) ?? null,
    ]),
  ) as Record<
    BattleCityMultiplayerPlayerSeat,
    PrivateRoom["seats"][number] | null
  >;

  if (
    BATTLE_CITY_MULTIPLAYER_PLAYER_SEATS.some(
      (seat) =>
        roomSeats[seat] === null ||
        roomSeats[seat]?.required !== true ||
        roomSeats[seat]?.occupiedByParticipantId === null,
    )
  ) {
    return createGameRuntimeFailure(
      "invalid-status",
      "Tank Patrol multiplayer requires occupied required Player 1 and Player 2 seats.",
    );
  }

  return {
    seats: roomSeats as BattleCityMultiplayerRoomSeats,
    success: true,
  };
}

function getBattleCityRuntime(runtime: unknown) {
  return runtime as StoredBattleCityMultiplayerRuntime;
}
