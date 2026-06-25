import { randomBytes, randomUUID } from "node:crypto";

import type {
  MultiplayerRoomSnapshot,
  PrivateRoomLifecycleCommand,
} from "../multiplayer/protocol";
import type {
  PrivateRoom,
  PrivateRoomErrorCode,
  PrivateRoomSeatInput,
  PrivateRoomSettingValue,
  PrivateRoomSettings,
} from "../multiplayer/room";
import {
  addPrivateRoomGuestParticipantAsObserver,
  claimPrivateRoomSeat,
  createPrivateRoom,
  finishPrivateRoom,
  normalizePrivateRoomCode,
  pausePrivateRoom,
  releasePrivateRoomSeat,
  restartPrivateRoom,
  resumePrivateRoom,
  startPrivateRoom,
  updatePrivateRoomSettings,
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

export type MultiplayerRoomStoreCommand =
  | {
      displayName: unknown;
      type: "room.joinObserver";
      userId?: unknown;
    }
  | {
      participantId: unknown;
      seatId: unknown;
      type: "room.claimSeat";
    }
  | {
      participantId: unknown;
      seatId: unknown;
      type: "room.releaseSeat";
    }
  | {
      command: PrivateRoomLifecycleCommand;
      participantId: unknown;
      type: "room.lifecycle";
    }
  | {
      participantId: unknown;
      settings: PrivateRoomSettings;
      type: "room.updateSettings";
    }
  | {
      input: PongMultiplayerInput;
      participantId: unknown;
      type: "game.input";
    };

export type MultiplayerRoomParticipantIdFactoryContext = {
  role: "host" | "observer";
  roomCode: string;
};

export type CreateMultiplayerRoomOptions = {
  host: MultiplayerRoomHostUser;
  seats?: readonly PrivateRoomSeatInput[];
  settings?: PrivateRoomSettings;
};

export type MultiplayerRoomHostUser = {
  displayName: string;
  id: string;
};

export type {
  MultiplayerRoomGameSnapshot,
  MultiplayerRoomSnapshot,
} from "../multiplayer/protocol";

export type MultiplayerRoomStoreErrorCode =
  | PrivateRoomErrorCode
  | "duplicate-room"
  | "invalid-command"
  | "room-service-invalid-response"
  | "room-service-unavailable"
  | "room-not-found";

export type MultiplayerRoomStoreResult =
  | {
      snapshot: MultiplayerRoomSnapshot;
      success: true;
    }
  | {
      code: MultiplayerRoomStoreErrorCode;
      error: string;
      success: false;
    };

export type MultiplayerRoomStoreOperationResult =
  | MultiplayerRoomStoreResult
  | Promise<MultiplayerRoomStoreResult>;

type MultiplayerRoomStoreFailure = Extract<
  MultiplayerRoomStoreResult,
  { success: false }
>;

export type MultiplayerRoomStore = {
  applyCommand: (
    roomCode: unknown,
    command: MultiplayerRoomStoreCommand,
  ) => MultiplayerRoomStoreOperationResult;
  createRoom: (options: CreateMultiplayerRoomOptions) => MultiplayerRoomStoreOperationResult;
  getRoom: (roomCode: unknown) => MultiplayerRoomStoreOperationResult;
};

type CreateInProcessMultiplayerRoomStoreOptions = {
  createParticipantId?: (
    context: MultiplayerRoomParticipantIdFactoryContext,
  ) => string;
  createRoomCode?: () => string;
  getNowMs?: () => number;
};

type StoredMultiplayerRoom = {
  game?: StoredPongMultiplayerRuntime;
  room: PrivateRoom;
  seq: number;
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

const DEFAULT_PRIVATE_ROOM_SETTINGS = {
  gameId: "pong",
} as const satisfies PrivateRoomSettings;

const INITIAL_ROOM_SEQUENCE = 1;
const INITIAL_GAME_SEQUENCE = 1;
export const PONG_RUNTIME_CATCH_UP_TICK_LIMIT = 60;

function createDefaultRoomCode() {
  return randomBytes(4).toString("hex").toLocaleUpperCase("en-US");
}

function createDefaultParticipantId() {
  return randomUUID();
}

function createDefaultNowMs() {
  return Date.now();
}

function clonePrivateRoomSettingValue(
  value: PrivateRoomSettingValue,
): PrivateRoomSettingValue {
  if (Array.isArray(value)) {
    return value.map((entry) => clonePrivateRoomSettingValue(entry));
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        clonePrivateRoomSettingValue(entry as PrivateRoomSettingValue),
      ]),
    );
  }

  return value;
}

function clonePrivateRoomSettings(settings: PrivateRoomSettings): PrivateRoomSettings {
  if (settings.parameters === undefined) {
    return {
      gameId: settings.gameId,
    };
  }

  return {
    gameId: settings.gameId,
    parameters: clonePrivateRoomSettingValue(settings.parameters) as Readonly<
      Record<string, PrivateRoomSettingValue>
    >,
  };
}

function clonePrivateRoom(room: PrivateRoom): PrivateRoom {
  return {
    code: room.code,
    hostParticipantId: room.hostParticipantId,
    participants: room.participants.map((participant) => ({ ...participant })),
    seats: room.seats.map((seat) => ({ ...seat })),
    settings: clonePrivateRoomSettings(room.settings),
    status: room.status,
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

function createStoreFailure(
  code: MultiplayerRoomStoreErrorCode,
  error: string,
): MultiplayerRoomStoreFailure {
  return {
    code,
    error,
    success: false,
  };
}

export function isMultiplayerRoomStoreErrorCode(
  value: unknown,
): value is MultiplayerRoomStoreErrorCode {
  switch (value) {
    case "duplicate-participant":
    case "duplicate-room":
    case "invalid-command":
    case "invalid-room-code":
    case "invalid-room-settings":
    case "invalid-status":
    case "not-host":
    case "participant-already-seated":
    case "participant-not-found":
    case "participant-not-seated":
    case "required-seats-empty":
    case "room-not-found":
    case "room-service-invalid-response":
    case "room-service-unavailable":
    case "seat-not-found":
    case "seat-occupied":
      return true;
  }

  return false;
}

export function getMultiplayerRoomStoreErrorStatus(
  code: MultiplayerRoomStoreErrorCode,
) {
  if (code === "room-not-found") {
    return 404;
  }

  if (code === "not-host") {
    return 403;
  }

  if (
    code === "room-service-invalid-response" ||
    code === "room-service-unavailable"
  ) {
    return 502;
  }

  if (
    code === "duplicate-room" ||
    code === "duplicate-participant" ||
    code === "invalid-status" ||
    code === "participant-already-seated" ||
    code === "required-seats-empty" ||
    code === "seat-occupied"
  ) {
    return 409;
  }

  if (
    code === "participant-not-found" ||
    code === "participant-not-seated" ||
    code === "seat-not-found"
  ) {
    return 404;
  }

  return 400;
}

function createStoredRoomSnapshot(
  storedRoom: StoredMultiplayerRoom,
  serverTimeMs: number,
  participantId?: string,
): MultiplayerRoomStoreResult {
  const room = clonePrivateRoom(storedRoom.room);
  const participant =
    participantId === undefined
      ? undefined
      : room.participants.find((entry) => entry.id === participantId);
  const game =
    storedRoom.game === undefined
      ? undefined
      : {
          gameId: "pong" as const,
          heldInputs: clonePongHeldInputs(storedRoom.game.heldInputs),
          seq: storedRoom.game.seq,
          serverTimeMs,
          snapshot: clonePongGameState(storedRoom.game.game),
        };

  return {
    snapshot: {
      ...(game === undefined ? {} : { game }),
      ...(participant === undefined ? {} : { participant }),
      room,
      seq: storedRoom.seq,
    },
    success: true,
  };
}

function getPrivateRoomOperationFailure(
  result: Extract<ReturnType<typeof createPrivateRoom>, { success: false }>,
): MultiplayerRoomStoreFailure {
  return {
    code: result.code,
    error: result.error,
    success: false,
  };
}

function getPongMultiplayerFailure(result: PongMultiplayerError): MultiplayerRoomStoreFailure {
  if (result.code === "missing-required-seats") {
    return createStoreFailure("invalid-status", result.error);
  }

  if (result.code === "unsupported-room-game") {
    return createStoreFailure("invalid-command", result.error);
  }

  return createStoreFailure(result.code, result.error);
}

function getStoredRoom(
  rooms: ReadonlyMap<string, StoredMultiplayerRoom>,
  roomCode: unknown,
): MultiplayerRoomStoreFailure | StoredMultiplayerRoom {
  const normalizedRoomCode = normalizePrivateRoomCode(roomCode);

  if (normalizedRoomCode === null) {
    return createStoreFailure("invalid-room-code", "Room code is not supported.");
  }

  const storedRoom = rooms.get(normalizedRoomCode);

  return storedRoom ?? createStoreFailure("room-not-found", "Room was not found.");
}

function applyLifecycleCommand(
  room: PrivateRoom,
  command: Extract<MultiplayerRoomStoreCommand, { type: "room.lifecycle" }>,
) {
  switch (command.command) {
    case "finish":
      return finishPrivateRoom(room, command);
    case "pause":
      return pausePrivateRoom(room, command);
    case "restart":
      return restartPrivateRoom(room, command);
    case "resume":
      return resumePrivateRoom(room, command);
    case "start":
      return startPrivateRoom(room, command);
  }
}

function createPongRuntime(
  room: PrivateRoom,
  nowMs: number,
): MultiplayerRoomStoreFailure | StoredPongMultiplayerRuntime {
  const result = createInitialPongMultiplayerGame(room);

  if (!result.success) {
    return getPongMultiplayerFailure(result);
  }

  return {
    game: startPongMultiplayerGame(result.game),
    heldInputs: {},
    lastMovementTickMs: nowMs,
    lastScoreTickMs: nowMs,
    seq: INITIAL_GAME_SEQUENCE,
  };
}

function resetPongRuntimeClocks(
  runtime: StoredPongMultiplayerRuntime,
  nowMs: number,
) {
  runtime.lastMovementTickMs = nowMs;
  runtime.lastScoreTickMs = nowMs;
}

function advancePongRuntimeTo(
  storedRoom: StoredMultiplayerRoom,
  nowMs: number,
) {
  const runtime = storedRoom.game;

  if (
    runtime === undefined ||
    storedRoom.room.status !== "running" ||
    runtime.game.status !== "running"
  ) {
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
  storedRoom: StoredMultiplayerRoom,
  command: Extract<MultiplayerRoomStoreCommand, { type: "room.lifecycle" }>,
  nowMs: number,
): MultiplayerRoomStoreFailure | null {
  const runtime = storedRoom.game;

  if (command.command === "start") {
    if (storedRoom.room.settings.gameId !== "pong") {
      return null;
    }

    const nextRuntime = createPongRuntime(storedRoom.room, nowMs);

    if ("success" in nextRuntime) {
      return nextRuntime;
    }

    storedRoom.game = nextRuntime;
    return null;
  }

  if (runtime === undefined) {
    return null;
  }

  if (command.command === "pause") {
    const nextGame = pausePongMultiplayerGame(runtime.game);

    if (nextGame !== runtime.game) {
      runtime.game = nextGame;
      runtime.seq += 1;
    }

    resetPongRuntimeClocks(runtime, nowMs);
    return null;
  }

  if (command.command === "resume") {
    const nextGame = resumePongMultiplayerGame(runtime.game);

    if (nextGame !== runtime.game) {
      runtime.game = nextGame;
      runtime.seq += 1;
    }

    resetPongRuntimeClocks(runtime, nowMs);
    return null;
  }

  if (command.command === "restart") {
    runtime.game = restartPongMultiplayerGame(runtime.game);
    runtime.heldInputs = {};
    runtime.seq += 1;
    resetPongRuntimeClocks(runtime, nowMs);
    return null;
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

  return null;
}

function applyPongInputCommand(
  storedRoom: StoredMultiplayerRoom,
  command: Extract<MultiplayerRoomStoreCommand, { type: "game.input" }>,
  nowMs: number,
): MultiplayerRoomStoreFailure | { participantId?: string; success: true } {
  const participantId =
    typeof command.participantId === "string" ? command.participantId : undefined;
  const input = command.input;

  if (!isObjectRecord(input)) {
    return createStoreFailure("invalid-command", "Pong input must be a JSON object.");
  }

  if (storedRoom.room.settings.gameId !== "pong") {
    return createStoreFailure(
      "invalid-command",
      "Game input is only supported for Pong rooms.",
    );
  }

  const runtime = storedRoom.game;

  if (runtime === undefined) {
    return createStoreFailure(
      "invalid-status",
      "Pong input is only accepted after the room has started.",
    );
  }

  if (storedRoom.room.status === "finished") {
    return createStoreFailure(
      "invalid-status",
      "Finished rooms cannot accept Pong input.",
    );
  }

  const sideResult = getPongMultiplayerParticipantSide(
    storedRoom.room,
    command.participantId,
  );

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
      return createStoreFailure(
        "invalid-status",
        "Pong serve is only available between rounds.",
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

  return createStoreFailure("invalid-command", "Pong input type is not supported.");
}

function parsePongPaddleDirection(
  direction: unknown,
): MultiplayerRoomStoreFailure | {
  direction: "down" | "up" | null;
  success: true;
} {
  if (direction === "down" || direction === "up" || direction === null) {
    return {
      direction,
      success: true,
    };
  }

  return createStoreFailure(
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

function clearReleasedSeatHeldInput(
  storedRoom: StoredMultiplayerRoom,
  command: Extract<MultiplayerRoomStoreCommand, { type: "room.releaseSeat" }>,
) {
  if (storedRoom.game === undefined || typeof command.seatId !== "string") {
    return;
  }

  const seatId = command.seatId.trim();

  if (
    (seatId === "left" || seatId === "right") &&
    storedRoom.game.heldInputs[seatId] !== undefined
  ) {
    delete storedRoom.game.heldInputs[seatId];
    storedRoom.game.seq += 1;
  }
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class InProcessMultiplayerRoomStore implements MultiplayerRoomStore {
  readonly #createParticipantId: (
    context: MultiplayerRoomParticipantIdFactoryContext,
  ) => string;
  readonly #createRoomCode: () => string;
  readonly #getNowMs: () => number;
  readonly #rooms = new Map<string, StoredMultiplayerRoom>();

  constructor({
    createParticipantId = createDefaultParticipantId,
    createRoomCode = createDefaultRoomCode,
    getNowMs = createDefaultNowMs,
  }: CreateInProcessMultiplayerRoomStoreOptions = {}) {
    this.#createParticipantId = createParticipantId;
    this.#createRoomCode = createRoomCode;
    this.#getNowMs = getNowMs;
  }

  createRoom({
    host,
    seats,
    settings = DEFAULT_PRIVATE_ROOM_SETTINGS,
  }: CreateMultiplayerRoomOptions): MultiplayerRoomStoreResult {
    const roomCode = this.#createRoomCode();
    const normalizedRoomCode = normalizePrivateRoomCode(roomCode);

    if (normalizedRoomCode !== null && this.#rooms.has(normalizedRoomCode)) {
      return createStoreFailure("duplicate-room", "Room code is already in use.");
    }

    const hostParticipantId = this.#createParticipantId({
      role: "host",
      roomCode: normalizedRoomCode ?? String(roomCode),
    });
    const result = createPrivateRoom({
      code: roomCode,
      host: {
        displayName: host.displayName,
        participantId: hostParticipantId,
        userId: host.id,
      },
      seats:
        settings.gameId === "pong" || seats === undefined
          ? DEFAULT_PONG_PRIVATE_ROOM_SEATS
          : seats,
      settings,
    });

    if (!result.success) {
      return getPrivateRoomOperationFailure(result);
    }

    const storedRoom = {
      room: result.room,
      seq: INITIAL_ROOM_SEQUENCE,
    };

    this.#rooms.set(result.room.code, storedRoom);

    return createStoredRoomSnapshot(
      storedRoom,
      this.#getNowMs(),
      result.room.hostParticipantId,
    );
  }

  getRoom(roomCode: unknown): MultiplayerRoomStoreResult {
    const storedRoom = getStoredRoom(this.#rooms, roomCode);

    if (!("room" in storedRoom)) {
      return storedRoom;
    }

    const nowMs = this.#getNowMs();
    advancePongRuntimeTo(storedRoom, nowMs);

    return createStoredRoomSnapshot(storedRoom, nowMs);
  }

  applyCommand(
    roomCode: unknown,
    command: MultiplayerRoomStoreCommand,
  ): MultiplayerRoomStoreResult {
    const storedRoom = getStoredRoom(this.#rooms, roomCode);

    if (!("room" in storedRoom)) {
      return storedRoom;
    }

    const nowMs = this.#getNowMs();
    advancePongRuntimeTo(storedRoom, nowMs);

    if (command.type === "game.input") {
      const inputResult = applyPongInputCommand(storedRoom, command, nowMs);

      if (!inputResult.success) {
        return inputResult;
      }

      return createStoredRoomSnapshot(storedRoom, nowMs, inputResult.participantId);
    }

    let participantId: string | undefined;
    let result:
      | ReturnType<typeof addPrivateRoomGuestParticipantAsObserver>
      | ReturnType<typeof claimPrivateRoomSeat>
      | ReturnType<typeof releasePrivateRoomSeat>
      | ReturnType<typeof updatePrivateRoomSettings>
      | ReturnType<typeof applyLifecycleCommand>;

    if (command.type === "room.joinObserver") {
      participantId = this.#createParticipantId({
        role: "observer",
        roomCode: storedRoom.room.code,
      });
      result = addPrivateRoomGuestParticipantAsObserver(storedRoom.room, {
        displayName: command.displayName,
        participantId,
        userId: command.userId,
      });
    } else if (command.type === "room.claimSeat") {
      participantId =
        typeof command.participantId === "string" ? command.participantId : undefined;
      result = claimPrivateRoomSeat(storedRoom.room, command);
    } else if (command.type === "room.releaseSeat") {
      participantId =
        typeof command.participantId === "string" ? command.participantId : undefined;
      result = releasePrivateRoomSeat(storedRoom.room, command);
    } else if (command.type === "room.updateSettings") {
      participantId =
        typeof command.participantId === "string" ? command.participantId : undefined;
      result = updatePrivateRoomSettings(storedRoom.room, command);
    } else {
      participantId =
        typeof command.participantId === "string" ? command.participantId : undefined;
      result = applyLifecycleCommand(storedRoom.room, command);
    }

    if (!result.success) {
      return getPrivateRoomOperationFailure(result);
    }

    storedRoom.room = result.room;
    if (command.type === "room.lifecycle") {
      const pongLifecycleResult = applyPongLifecycleCommand(storedRoom, command, nowMs);

      if (pongLifecycleResult !== null) {
        return pongLifecycleResult;
      }
    } else if (command.type === "room.releaseSeat") {
      clearReleasedSeatHeldInput(storedRoom, command);
    }

    storedRoom.seq += 1;

    return createStoredRoomSnapshot(storedRoom, nowMs, participantId);
  }
}
