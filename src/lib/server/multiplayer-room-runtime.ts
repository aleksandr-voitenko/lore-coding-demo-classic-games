import { randomBytes, randomUUID } from "node:crypto";

import type { PrivateRoomLifecycleCommand } from "../multiplayer/protocol";
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
  getDefaultMultiplayerServerGameAdapter,
  getMultiplayerServerGameAdapter,
  type MultiplayerServerGameRuntimeAdapter,
  type MultiplayerServerGameRuntimeFailure,
  type MultiplayerServerGameSnapshot,
  type PongMultiplayerInput,
} from "./multiplayer-game-adapters";

export {
  DEFAULT_PONG_PRIVATE_ROOM_SEATS,
  PONG_RUNTIME_CATCH_UP_TICK_LIMIT,
} from "./multiplayer-game-adapters";
export type { PongMultiplayerInput } from "./multiplayer-game-adapters";

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

export type MultiplayerRoomGameSnapshot = MultiplayerServerGameSnapshot;
export type MultiplayerRoomSnapshot = {
  game?: MultiplayerRoomGameSnapshot;
  participant?: PrivateRoom["participants"][number];
  room: PrivateRoom;
  seq: number;
};

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
  game?: StoredMultiplayerGameRuntime;
  room: PrivateRoom;
  seq: number;
};

type StoredMultiplayerGameRuntime = {
  adapter: MultiplayerServerGameRuntimeAdapter;
  runtime: unknown;
};

const INITIAL_ROOM_SEQUENCE = 1;

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

export function shouldAdvanceRoomGameSnapshot(snapshot: MultiplayerRoomSnapshot) {
  if (snapshot.game === undefined) {
    return false;
  }

  if (snapshot.game.gameId !== snapshot.room.settings.gameId) {
    return false;
  }

  const adapter = getMultiplayerServerGameAdapter(snapshot.game.gameId);

  return (
    adapter?.shouldAdvanceSnapshot({
      room: snapshot.room,
      snapshot: snapshot.game,
    }) ?? false
  );
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
      : storedRoom.game.adapter.createSnapshot({
          runtime: storedRoom.game.runtime,
          serverTimeMs,
        });

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

function getGameRuntimeStoreFailure(
  result: MultiplayerServerGameRuntimeFailure,
): MultiplayerRoomStoreFailure {
  return createStoreFailure(result.code, result.error);
}

function advanceGameRuntimeTo(storedRoom: StoredMultiplayerRoom, nowMs: number) {
  if (storedRoom.game === undefined) {
    return;
  }

  storedRoom.game.adapter.advanceRuntimeTo({
    nowMs,
    room: storedRoom.room,
    runtime: storedRoom.game.runtime,
  });
}

function applyGameLifecycleCommand(
  storedRoom: StoredMultiplayerRoom,
  command: Extract<MultiplayerRoomStoreCommand, { type: "room.lifecycle" }>,
  nowMs: number,
): MultiplayerRoomStoreFailure | null {
  const adapter = getMultiplayerServerGameAdapter(storedRoom.room.settings.gameId);

  if (adapter === null) {
    return null;
  }

  const result = adapter.applyLifecycleCommand({
    command,
    nowMs,
    room: storedRoom.room,
    runtime: storedRoom.game?.runtime,
  });

  if (!result.success) {
    return getGameRuntimeStoreFailure(result);
  }

  if (result.runtime !== undefined) {
    storedRoom.game = {
      adapter,
      runtime: result.runtime,
    };
  }

  return null;
}

function applyGameInputCommand(
  storedRoom: StoredMultiplayerRoom,
  command: Extract<MultiplayerRoomStoreCommand, { type: "game.input" }>,
  nowMs: number,
): MultiplayerRoomStoreFailure | { participantId?: string; success: true } {
  const adapter = getMultiplayerServerGameAdapter(storedRoom.room.settings.gameId);

  if (adapter === null) {
    return createStoreFailure(
      "invalid-command",
      "Game input is only supported for Pong rooms.",
    );
  }

  const result = adapter.applyInputCommand({
    command,
    nowMs,
    room: storedRoom.room,
    runtime: storedRoom.game?.runtime,
  });

  return result.success ? result : getGameRuntimeStoreFailure(result);
}

function clearReleasedSeatGameInput(
  storedRoom: StoredMultiplayerRoom,
  command: Extract<MultiplayerRoomStoreCommand, { type: "room.releaseSeat" }>,
) {
  if (storedRoom.game === undefined) {
    return;
  }

  storedRoom.game.adapter.clearInputForReleasedSeat({
    command,
    runtime: storedRoom.game.runtime,
  });
}

function getCreateRoomSeats(
  settings: PrivateRoomSettings,
  seats: readonly PrivateRoomSeatInput[] | undefined,
) {
  const adapter = getMultiplayerServerGameAdapter(settings.gameId);

  return adapter?.defaultSeats ?? seats ?? getDefaultMultiplayerServerGameAdapter().defaultSeats;
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
    settings = getDefaultMultiplayerServerGameAdapter().defaultSettings,
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
      seats: getCreateRoomSeats(settings, seats),
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
    advanceGameRuntimeTo(storedRoom, nowMs);

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
    advanceGameRuntimeTo(storedRoom, nowMs);

    if (command.type === "game.input") {
      const inputResult = applyGameInputCommand(storedRoom, command, nowMs);

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
      const gameLifecycleResult = applyGameLifecycleCommand(storedRoom, command, nowMs);

      if (gameLifecycleResult !== null) {
        return gameLifecycleResult;
      }
    } else if (command.type === "room.releaseSeat") {
      clearReleasedSeatGameInput(storedRoom, command);
    }

    storedRoom.seq += 1;

    return createStoredRoomSnapshot(storedRoom, nowMs, participantId);
  }
}
