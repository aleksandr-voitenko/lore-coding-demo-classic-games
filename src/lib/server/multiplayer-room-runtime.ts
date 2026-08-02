import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

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
} from "./multiplayer-game-adapters";

export {
  DEFAULT_ASTEROIDS_PRIVATE_ROOM_SEATS,
  DEFAULT_PONG_PRIVATE_ROOM_SEATS,
  DEFAULT_SPACE_INVADERS_PRIVATE_ROOM_SEATS,
  PONG_RUNTIME_CATCH_UP_TICK_LIMIT,
} from "./multiplayer-game-adapters";

export type MultiplayerRoomStoreCommand =
  | {
      displayName: unknown;
      type: "room.joinObserver";
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
      gameId?: unknown;
      input: unknown;
      participantId: unknown;
      type: "game.input";
    };

export type MultiplayerRoomParticipantIdFactoryContext = {
  role: "host" | "observer";
  roomCode: string;
};

export type MultiplayerRoomParticipantCapabilityFactoryContext =
  MultiplayerRoomParticipantIdFactoryContext & {
    participantId: string;
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
  | "room-capacity-reached"
  | "room-expired"
  | "room-service-invalid-response"
  | "room-service-unavailable"
  | "room-not-found";

export type MultiplayerRoomStoreResult =
  | {
      participantCapability?: string;
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
type MultiplayerRoomStoreSuccess = Extract<
  MultiplayerRoomStoreResult,
  { success: true }
>;

export type MultiplayerRoomStore = {
  applyCommand: (
    roomCode: unknown,
    command: MultiplayerRoomStoreCommand,
  ) => MultiplayerRoomStoreOperationResult;
  createRoom: (options: CreateMultiplayerRoomOptions) => MultiplayerRoomStoreOperationResult;
  getRoom: (roomCode: unknown) => MultiplayerRoomStoreOperationResult;
};

/**
 * Synchronous presence capability for a gateway sharing the same process and
 * room authority. Remote room-service clients intentionally do not implement it.
 */
export type MultiplayerRoomParticipantConnectionStore = {
  resolveParticipantCapability: (
    roomCode: unknown,
    participantCapability: unknown,
  ) => string | null;
  registerParticipantConnection: (
    roomCode: unknown,
    participantId: unknown,
  ) => boolean;
  unregisterParticipantConnection: (
    roomCode: unknown,
    participantId: unknown,
  ) => void;
};

type MultiplayerRoomRetentionPolicy = {
  inProgressIdleTtlMs: number;
  lobbyIdleTtlMs: number;
  sweepIntervalMs: number;
  terminalTtlMs: number;
  tombstoneTtlMs: number;
};

export const DEFAULT_MULTIPLAYER_ROOM_MAX_ROOMS = 256;
export const DEFAULT_MULTIPLAYER_ROOM_RETENTION_POLICY = {
  inProgressIdleTtlMs: 2 * 60 * 60 * 1_000,
  lobbyIdleTtlMs: 60 * 60 * 1_000,
  sweepIntervalMs: 60 * 1_000,
  terminalTtlMs: 30 * 60 * 1_000,
  tombstoneTtlMs: 5 * 60 * 1_000,
} as const satisfies MultiplayerRoomRetentionPolicy;

type CreateInProcessMultiplayerRoomStoreOptions = {
  createParticipantCapability?: (
    context: MultiplayerRoomParticipantCapabilityFactoryContext,
  ) => string;
  createParticipantId?: (
    context: MultiplayerRoomParticipantIdFactoryContext,
  ) => string;
  createRoomCode?: () => string;
  getNowMs?: () => number;
  maxRooms?: number;
  retentionPolicy?: Partial<MultiplayerRoomRetentionPolicy>;
};

type StoredMultiplayerRoom = {
  connectedParticipantCount: number;
  connectionCountsByParticipantId: Map<string, number>;
  game?: StoredMultiplayerGameRuntime;
  lastDisconnectedAtMs?: number;
  lastMeaningfulActivityAtMs: number;
  participantCapabilityHashesByParticipantId: Map<string, Buffer>;
  room: PrivateRoom;
  seq: number;
  terminalAtMs?: number;
};

type StoredMultiplayerGameRuntime = {
  adapter: MultiplayerServerGameRuntimeAdapter;
  runtime: unknown;
};

const INITIAL_ROOM_SEQUENCE = 1;

type MultiplayerRoomTombstone = {
  expiredAtMs: number;
};

function createDefaultRoomCode() {
  return randomBytes(4).toString("hex").toLocaleUpperCase("en-US");
}

function createDefaultParticipantId() {
  return randomUUID();
}

function createDefaultParticipantCapability() {
  return randomBytes(32).toString("base64url");
}

function createDefaultNowMs() {
  return Date.now();
}

export function isMultiplayerRoomParticipantConnectionStore(
  store: MultiplayerRoomStore,
): store is MultiplayerRoomStore & MultiplayerRoomParticipantConnectionStore {
  const candidate = store as MultiplayerRoomStore &
    Partial<MultiplayerRoomParticipantConnectionStore>;

  return (
    typeof candidate.resolveParticipantCapability === "function" &&
    typeof candidate.registerParticipantConnection === "function" &&
    typeof candidate.unregisterParticipantConnection === "function"
  );
}

function normalizePositiveInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
}

function normalizeRetentionPolicy(
  policy: Partial<MultiplayerRoomRetentionPolicy> | undefined,
): MultiplayerRoomRetentionPolicy {
  const resolvedPolicy = {
    ...DEFAULT_MULTIPLAYER_ROOM_RETENTION_POLICY,
    ...policy,
  };

  return {
    inProgressIdleTtlMs: normalizePositiveInteger(
      resolvedPolicy.inProgressIdleTtlMs,
      "In-progress room idle TTL",
    ),
    lobbyIdleTtlMs: normalizePositiveInteger(
      resolvedPolicy.lobbyIdleTtlMs,
      "Lobby room idle TTL",
    ),
    sweepIntervalMs: normalizePositiveInteger(
      resolvedPolicy.sweepIntervalMs,
      "Room sweep interval",
    ),
    terminalTtlMs: normalizePositiveInteger(
      resolvedPolicy.terminalTtlMs,
      "Terminal room TTL",
    ),
    tombstoneTtlMs: normalizePositiveInteger(
      resolvedPolicy.tombstoneTtlMs,
      "Room tombstone TTL",
    ),
  };
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
    case "room-capacity-reached":
    case "room-expired":
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
  if (code === "room-expired") {
    return 410;
  }

  if (code === "room-not-found") {
    return 404;
  }

  if (code === "room-capacity-reached") {
    return 503;
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
  participantCapability?: string,
): MultiplayerRoomStoreSuccess {
  const room = clonePrivateRoom(storedRoom.room);
  const participant =
    participantId === undefined
      ? undefined
      : room.participants.find((entry) => entry.id === participantId);
  const game =
    storedRoom.game === undefined
      ? undefined
      : storedRoom.game.adapter.createSnapshot({
          room,
          runtime: storedRoom.game.runtime,
          serverTimeMs,
        });

  return {
    ...(participantCapability === undefined ? {} : { participantCapability }),
    snapshot: {
      ...(game === undefined ? {} : { game }),
      ...(participant === undefined ? {} : { participant }),
      room,
      seq: storedRoom.seq,
    },
    success: true,
  };
}

function normalizeParticipantCapability(value: unknown) {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) {
    return null;
  }

  return value.trim() === value ? value : null;
}

function hashParticipantCapability(participantCapability: string) {
  return createHash("sha256").update(participantCapability, "utf8").digest();
}

function participantCapabilityHashesMatch(left: Buffer, right: Buffer) {
  return left.byteLength === right.byteLength && timingSafeEqual(left, right);
}

function getCommandParticipantIdValue(
  command: Extract<
    MultiplayerRoomStoreCommand,
    | { type: "game.input" }
    | { type: "room.claimSeat" }
    | { type: "room.lifecycle" }
    | { type: "room.releaseSeat" }
    | { type: "room.updateSettings" }
  >,
) {
  return typeof command.participantId === "string"
    ? command.participantId
    : undefined;
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
    return false;
  }

  return storedRoom.game.adapter.advanceRuntimeTo({
    nowMs,
    room: storedRoom.room,
    runtime: storedRoom.game.runtime,
  });
}

function isStoredRoomTerminal(storedRoom: StoredMultiplayerRoom) {
  if (storedRoom.room.status === "finished") {
    return true;
  }

  if (storedRoom.game === undefined) {
    return false;
  }

  return storedRoom.game.adapter.isTerminal({
    room: storedRoom.room,
    runtime: storedRoom.game.runtime,
  });
}

function refreshStoredRoomTerminalAt(
  storedRoom: StoredMultiplayerRoom,
  nowMs: number,
) {
  if (isStoredRoomTerminal(storedRoom)) {
    storedRoom.terminalAtMs ??= nowMs;
  } else {
    storedRoom.terminalAtMs = undefined;
  }
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
      `Game input is not supported for ${storedRoom.room.settings.gameId} rooms.`,
    );
  }

  if (command.gameId !== undefined) {
    const commandGameId =
      typeof command.gameId === "string" ? command.gameId.trim() : "";

    if (commandGameId !== storedRoom.room.settings.gameId) {
      return createStoreFailure(
        "invalid-command",
        "Game input game id must match the room game.",
      );
    }
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

export class InProcessMultiplayerRoomStore
  implements MultiplayerRoomStore, MultiplayerRoomParticipantConnectionStore
{
  readonly #createParticipantCapability: (
    context: MultiplayerRoomParticipantCapabilityFactoryContext,
  ) => string;
  readonly #createParticipantId: (
    context: MultiplayerRoomParticipantIdFactoryContext,
  ) => string;
  readonly #createRoomCode: () => string;
  readonly #getNowMs: () => number;
  readonly #maxRooms: number;
  readonly #retentionPolicy: MultiplayerRoomRetentionPolicy;
  readonly #rooms = new Map<string, StoredMultiplayerRoom>();
  readonly #tombstones = new Map<string, MultiplayerRoomTombstone>();
  #lastSweepAtMs: number;

  constructor({
    createParticipantCapability = createDefaultParticipantCapability,
    createParticipantId = createDefaultParticipantId,
    createRoomCode = createDefaultRoomCode,
    getNowMs = createDefaultNowMs,
    maxRooms = DEFAULT_MULTIPLAYER_ROOM_MAX_ROOMS,
    retentionPolicy,
  }: CreateInProcessMultiplayerRoomStoreOptions = {}) {
    this.#createParticipantCapability = createParticipantCapability;
    this.#createParticipantId = createParticipantId;
    this.#createRoomCode = createRoomCode;
    this.#getNowMs = getNowMs;
    this.#maxRooms = normalizePositiveInteger(maxRooms, "Room capacity");
    this.#retentionPolicy = normalizeRetentionPolicy(retentionPolicy);
    this.#lastSweepAtMs = getNowMs();
  }

  createRoom({
    host,
    seats,
    settings = getDefaultMultiplayerServerGameAdapter().defaultSettings,
  }: CreateMultiplayerRoomOptions): MultiplayerRoomStoreResult {
    const nowMs = this.#getNowMs();

    this.#sweepIfDue(nowMs);
    this.#pruneTombstones(nowMs);

    const roomCode = this.#createRoomCode();
    const normalizedRoomCode = normalizePrivateRoomCode(roomCode);

    if (
      normalizedRoomCode !== null &&
      (this.#rooms.has(normalizedRoomCode) ||
        this.#tombstones.has(normalizedRoomCode))
    ) {
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

    if (!this.#makeRoomCapacity(nowMs)) {
      return createStoreFailure(
        "room-capacity-reached",
        "Room capacity is currently full. Try creating a room again shortly.",
      );
    }

    const participantCapabilityHashesByParticipantId = new Map<string, Buffer>();
    const hostParticipantCapability = this.#mintParticipantCapability(
      participantCapabilityHashesByParticipantId,
      {
        participantId: result.room.hostParticipantId,
        role: "host",
        roomCode: result.room.code,
      },
    );

    const storedRoom: StoredMultiplayerRoom = {
      connectedParticipantCount: 0,
      connectionCountsByParticipantId: new Map(),
      lastMeaningfulActivityAtMs: nowMs,
      participantCapabilityHashesByParticipantId,
      room: result.room,
      seq: INITIAL_ROOM_SEQUENCE,
    };

    this.#rooms.set(result.room.code, storedRoom);

    return createStoredRoomSnapshot(
      storedRoom,
      nowMs,
      result.room.hostParticipantId,
      hostParticipantCapability,
    );
  }

  getRoom(roomCode: unknown): MultiplayerRoomStoreResult {
    const nowMs = this.#getNowMs();

    this.#sweepIfDue(nowMs);

    const storedRoom = this.#getStoredRoom(roomCode, nowMs);

    if (!("room" in storedRoom)) {
      return storedRoom;
    }

    advanceGameRuntimeTo(storedRoom, nowMs);
    refreshStoredRoomTerminalAt(storedRoom, nowMs);

    return createStoredRoomSnapshot(storedRoom, nowMs);
  }

  applyCommand(
    roomCode: unknown,
    command: MultiplayerRoomStoreCommand,
  ): MultiplayerRoomStoreResult {
    const nowMs = this.#getNowMs();

    this.#sweepIfDue(nowMs);

    const storedRoom = this.#getStoredRoom(roomCode, nowMs);

    if (!("room" in storedRoom)) {
      return storedRoom;
    }

    advanceGameRuntimeTo(storedRoom, nowMs);
    refreshStoredRoomTerminalAt(storedRoom, nowMs);

    if (command.type === "game.input") {
      const inputResult = applyGameInputCommand(storedRoom, command, nowMs);

      if (!inputResult.success) {
        return inputResult;
      }

      storedRoom.lastMeaningfulActivityAtMs = nowMs;
      refreshStoredRoomTerminalAt(storedRoom, nowMs);

      return createStoredRoomSnapshot(
        storedRoom,
        nowMs,
        inputResult.participantId,
      );
    }

    let participantCapability: string | undefined;
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
      });
    } else if (command.type === "room.claimSeat") {
      participantId = getCommandParticipantIdValue(command);
      result = claimPrivateRoomSeat(storedRoom.room, command);
    } else if (command.type === "room.releaseSeat") {
      participantId = getCommandParticipantIdValue(command);
      result = releasePrivateRoomSeat(storedRoom.room, command);
    } else if (command.type === "room.updateSettings") {
      participantId = getCommandParticipantIdValue(command);
      result = updatePrivateRoomSettings(storedRoom.room, command);
    } else {
      participantId = getCommandParticipantIdValue(command);
      result = applyLifecycleCommand(storedRoom.room, command);
    }

    if (!result.success) {
      return getPrivateRoomOperationFailure(result);
    }

    if (command.type === "room.joinObserver" && participantId !== undefined) {
      participantCapability = this.#mintParticipantCapability(
        storedRoom.participantCapabilityHashesByParticipantId,
        {
          participantId,
          role: "observer",
          roomCode: storedRoom.room.code,
        },
      );
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
    storedRoom.lastMeaningfulActivityAtMs = nowMs;
    refreshStoredRoomTerminalAt(storedRoom, nowMs);

    return createStoredRoomSnapshot(
      storedRoom,
      nowMs,
      participantId,
      participantCapability,
    );
  }

  resolveParticipantCapability(
    roomCode: unknown,
    participantCapability: unknown,
  ) {
    const nowMs = this.#getNowMs();

    this.#sweepIfDue(nowMs);

    const storedRoom = this.#getStoredRoom(roomCode, nowMs);
    const normalizedCapability = normalizeParticipantCapability(
      participantCapability,
    );

    if (!("room" in storedRoom) || normalizedCapability === null) {
      return null;
    }

    const candidateHash = hashParticipantCapability(normalizedCapability);

    for (const [participantId, storedHash] of storedRoom.participantCapabilityHashesByParticipantId) {
      if (
        participantCapabilityHashesMatch(candidateHash, storedHash) &&
        storedRoom.room.participants.some(
          (participant) => participant.id === participantId,
        )
      ) {
        return participantId;
      }
    }

    return null;
  }

  registerParticipantConnection(roomCode: unknown, participantId: unknown) {
    const nowMs = this.#getNowMs();

    this.#sweepIfDue(nowMs);

    const storedRoom = this.#getStoredRoom(roomCode, nowMs);
    const normalizedParticipantId =
      typeof participantId === "string" ? participantId.trim() : "";

    if (
      !("room" in storedRoom) ||
      normalizedParticipantId.length === 0 ||
      !storedRoom.room.participants.some(
        (participant) => participant.id === normalizedParticipantId,
      )
    ) {
      return false;
    }

    const previousCount =
      storedRoom.connectionCountsByParticipantId.get(normalizedParticipantId) ?? 0;

    storedRoom.connectionCountsByParticipantId.set(
      normalizedParticipantId,
      previousCount + 1,
    );
    storedRoom.connectedParticipantCount += 1;

    return true;
  }

  unregisterParticipantConnection(roomCode: unknown, participantId: unknown) {
    const normalizedRoomCode = normalizePrivateRoomCode(roomCode);
    const normalizedParticipantId =
      typeof participantId === "string" ? participantId.trim() : "";

    if (normalizedRoomCode === null || normalizedParticipantId.length === 0) {
      return;
    }

    const storedRoom = this.#rooms.get(normalizedRoomCode);
    const previousCount = storedRoom?.connectionCountsByParticipantId.get(
      normalizedParticipantId,
    );

    if (storedRoom === undefined || previousCount === undefined) {
      return;
    }

    if (previousCount === 1) {
      storedRoom.connectionCountsByParticipantId.delete(normalizedParticipantId);
    } else {
      storedRoom.connectionCountsByParticipantId.set(
        normalizedParticipantId,
        previousCount - 1,
      );
    }

    storedRoom.connectedParticipantCount -= 1;

    if (storedRoom.connectedParticipantCount === 0) {
      storedRoom.lastDisconnectedAtMs = this.#getNowMs();
    }
  }

  sweepExpiredRooms() {
    return this.#sweepExpiredRooms(this.#getNowMs());
  }

  #mintParticipantCapability(
    capabilityHashesByParticipantId: Map<string, Buffer>,
    context: MultiplayerRoomParticipantCapabilityFactoryContext,
  ) {
    const participantCapability = normalizeParticipantCapability(
      this.#createParticipantCapability(context),
    );

    if (participantCapability === null) {
      throw new Error("Participant capability factory must return a non-empty string.");
    }

    const participantCapabilityHash = hashParticipantCapability(
      participantCapability,
    );

    if (
      Array.from(capabilityHashesByParticipantId.values()).some((storedHash) =>
        participantCapabilityHashesMatch(storedHash, participantCapabilityHash),
      )
    ) {
      throw new Error("Participant capability factory must return unique values.");
    }

    capabilityHashesByParticipantId.set(
      context.participantId,
      participantCapabilityHash,
    );

    return participantCapability;
  }

  #getStoredRoom(
    roomCode: unknown,
    nowMs: number,
  ): MultiplayerRoomStoreFailure | StoredMultiplayerRoom {
    const normalizedRoomCode = normalizePrivateRoomCode(roomCode);

    if (normalizedRoomCode === null) {
      return createStoreFailure("invalid-room-code", "Room code is not supported.");
    }

    const storedRoom = this.#rooms.get(normalizedRoomCode);

    if (storedRoom !== undefined) {
      if (this.#isRoomExpired(storedRoom, nowMs)) {
        this.#expireRoom(normalizedRoomCode, nowMs);
      } else {
        return storedRoom;
      }
    }

    this.#pruneTombstones(nowMs);

    return this.#tombstones.has(normalizedRoomCode)
      ? createStoreFailure(
          "room-expired",
          "Room has expired. Create or join a new room.",
        )
      : createStoreFailure("room-not-found", "Room was not found.");
  }

  #makeRoomCapacity(nowMs: number) {
    if (this.#rooms.size < this.#maxRooms) {
      return true;
    }

    this.#sweepExpiredRooms(nowMs);

    if (this.#rooms.size < this.#maxRooms) {
      return true;
    }

    const terminalCandidate = this.#findOldestEvictionCandidate(
      nowMs,
      (storedRoom) => storedRoom.terminalAtMs !== undefined,
    );
    const candidate =
      terminalCandidate ??
      this.#findOldestEvictionCandidate(
        nowMs,
        (storedRoom) =>
          storedRoom.terminalAtMs === undefined &&
          storedRoom.room.status === "lobby",
      );

    if (candidate === null) {
      return false;
    }

    this.#expireRoom(candidate.room.code, nowMs);

    return true;
  }

  #findOldestEvictionCandidate(
    nowMs: number,
    matchesTier: (storedRoom: StoredMultiplayerRoom) => boolean,
  ) {
    let oldest: StoredMultiplayerRoom | null = null;
    let oldestBaselineMs = Number.POSITIVE_INFINITY;

    for (const storedRoom of this.#rooms.values()) {
      refreshStoredRoomTerminalAt(storedRoom, nowMs);

      if (storedRoom.connectedParticipantCount > 0 || !matchesTier(storedRoom)) {
        continue;
      }

      const baselineMs = this.#getRoomExpiryBaselineMs(storedRoom);

      if (baselineMs < oldestBaselineMs) {
        oldest = storedRoom;
        oldestBaselineMs = baselineMs;
      }
    }

    return oldest;
  }

  #sweepIfDue(nowMs: number) {
    if (
      nowMs < this.#lastSweepAtMs ||
      nowMs - this.#lastSweepAtMs >= this.#retentionPolicy.sweepIntervalMs
    ) {
      this.#sweepExpiredRooms(nowMs);
    }
  }

  #sweepExpiredRooms(nowMs: number) {
    let expiredRoomCount = 0;

    for (const [roomCode, storedRoom] of this.#rooms) {
      if (!this.#isRoomExpired(storedRoom, nowMs)) {
        continue;
      }

      this.#expireRoom(roomCode, nowMs);
      expiredRoomCount += 1;
    }

    this.#lastSweepAtMs = nowMs;
    this.#pruneTombstones(nowMs);

    return expiredRoomCount;
  }

  #isRoomExpired(storedRoom: StoredMultiplayerRoom, nowMs: number) {
    refreshStoredRoomTerminalAt(storedRoom, nowMs);

    if (storedRoom.connectedParticipantCount > 0) {
      return false;
    }

    const ttlMs =
      storedRoom.terminalAtMs !== undefined
        ? this.#retentionPolicy.terminalTtlMs
        : storedRoom.room.status === "lobby"
          ? this.#retentionPolicy.lobbyIdleTtlMs
          : this.#retentionPolicy.inProgressIdleTtlMs;

    return nowMs - this.#getRoomExpiryBaselineMs(storedRoom) >= ttlMs;
  }

  #getRoomExpiryBaselineMs(storedRoom: StoredMultiplayerRoom) {
    // A recognized connection defers eviction and the final disconnect grants
    // the full TTL again, including for rooms that finished while connected.
    return Math.max(
      storedRoom.terminalAtMs ?? storedRoom.lastMeaningfulActivityAtMs,
      storedRoom.lastDisconnectedAtMs ?? Number.NEGATIVE_INFINITY,
    );
  }

  #expireRoom(roomCode: string, nowMs: number) {
    this.#rooms.delete(roomCode);
    this.#tombstones.set(roomCode, { expiredAtMs: nowMs });
    this.#pruneTombstones(nowMs);
  }

  #pruneTombstones(nowMs: number) {
    for (const [roomCode, tombstone] of this.#tombstones) {
      if (
        nowMs - tombstone.expiredAtMs >=
        this.#retentionPolicy.tombstoneTtlMs
      ) {
        this.#tombstones.delete(roomCode);
      }
    }

    while (this.#tombstones.size > this.#maxRooms) {
      const oldestRoomCode = this.#tombstones.keys().next().value;

      if (oldestRoomCode === undefined) {
        break;
      }

      this.#tombstones.delete(oldestRoomCode);
    }
  }
}
