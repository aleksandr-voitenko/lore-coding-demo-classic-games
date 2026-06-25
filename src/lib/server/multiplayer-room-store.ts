import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import type {
  PrivateRoom,
  PrivateRoomErrorCode,
  PrivateRoomParticipant,
  PrivateRoomSeatInput,
  PrivateRoomSettingValue,
  PrivateRoomSettings,
} from "@/lib/multiplayer/room";
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
} from "@/lib/multiplayer/room";
import type { AuthenticatedUser } from "@/lib/user-profile";

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
      command: "finish" | "pause" | "restart" | "resume" | "start";
      participantId: unknown;
      type: "room.lifecycle";
    }
  | {
      participantId: unknown;
      settings: PrivateRoomSettings;
      type: "room.updateSettings";
    };

export type MultiplayerRoomParticipantIdFactoryContext = {
  role: "host" | "observer";
  roomCode: string;
};

export type CreateMultiplayerRoomOptions = {
  host: AuthenticatedUser;
  seats?: readonly PrivateRoomSeatInput[];
  settings?: PrivateRoomSettings;
};

export type MultiplayerRoomSnapshot = {
  participant?: PrivateRoomParticipant;
  room: PrivateRoom;
  seq: number;
};

export type MultiplayerRoomStoreErrorCode =
  | PrivateRoomErrorCode
  | "duplicate-room"
  | "invalid-command"
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

export type MultiplayerRoomStore = {
  applyCommand: (
    roomCode: unknown,
    command: MultiplayerRoomStoreCommand,
  ) => MultiplayerRoomStoreResult;
  createRoom: (options: CreateMultiplayerRoomOptions) => MultiplayerRoomStoreResult;
  getRoom: (roomCode: unknown) => MultiplayerRoomStoreResult;
};

type CreateInProcessMultiplayerRoomStoreOptions = {
  createParticipantId?: (
    context: MultiplayerRoomParticipantIdFactoryContext,
  ) => string;
  createRoomCode?: () => string;
};

type StoredMultiplayerRoom = {
  room: PrivateRoom;
  seq: number;
};

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

function createDefaultRoomCode() {
  return randomBytes(4).toString("hex").toLocaleUpperCase("en-US");
}

function createDefaultParticipantId() {
  return randomUUID();
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
): MultiplayerRoomStoreResult {
  return {
    code,
    error,
    success: false,
  };
}

function createStoredRoomSnapshot(
  storedRoom: StoredMultiplayerRoom,
  participantId?: string,
): MultiplayerRoomStoreResult {
  const room = clonePrivateRoom(storedRoom.room);
  const participant =
    participantId === undefined
      ? undefined
      : room.participants.find((entry) => entry.id === participantId);

  return {
    snapshot: {
      ...(participant === undefined ? {} : { participant }),
      room,
      seq: storedRoom.seq,
    },
    success: true,
  };
}

function getPrivateRoomOperationFailure(
  result: Extract<ReturnType<typeof createPrivateRoom>, { success: false }>,
): MultiplayerRoomStoreResult {
  return {
    code: result.code,
    error: result.error,
    success: false,
  };
}

function getStoredRoom(
  rooms: ReadonlyMap<string, StoredMultiplayerRoom>,
  roomCode: unknown,
): MultiplayerRoomStoreResult | StoredMultiplayerRoom {
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

export class InProcessMultiplayerRoomStore implements MultiplayerRoomStore {
  readonly #createParticipantId: (
    context: MultiplayerRoomParticipantIdFactoryContext,
  ) => string;
  readonly #createRoomCode: () => string;
  readonly #rooms = new Map<string, StoredMultiplayerRoom>();

  constructor({
    createParticipantId = createDefaultParticipantId,
    createRoomCode = createDefaultRoomCode,
  }: CreateInProcessMultiplayerRoomStoreOptions = {}) {
    this.#createParticipantId = createParticipantId;
    this.#createRoomCode = createRoomCode;
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

    return createStoredRoomSnapshot(storedRoom, result.room.hostParticipantId);
  }

  getRoom(roomCode: unknown): MultiplayerRoomStoreResult {
    const storedRoom = getStoredRoom(this.#rooms, roomCode);

    return "room" in storedRoom ? createStoredRoomSnapshot(storedRoom) : storedRoom;
  }

  applyCommand(
    roomCode: unknown,
    command: MultiplayerRoomStoreCommand,
  ): MultiplayerRoomStoreResult {
    const storedRoom = getStoredRoom(this.#rooms, roomCode);

    if (!("room" in storedRoom)) {
      return storedRoom;
    }

    let participantId: string | undefined;
    let result:
      | ReturnType<typeof addPrivateRoomGuestParticipantAsObserver>
      | ReturnType<typeof claimPrivateRoomSeat>
      | ReturnType<typeof releasePrivateRoomSeat>
      | ReturnType<typeof updatePrivateRoomSettings>;

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
    storedRoom.seq += 1;

    return createStoredRoomSnapshot(storedRoom, participantId);
  }
}

let defaultMultiplayerRoomStore: InProcessMultiplayerRoomStore | null = null;

export function getMultiplayerRoomStore() {
  // MVP adapter: this is process-local state for API-route development and tests,
  // not the durable realtime sidecar or event-log authority planned by the ADR.
  defaultMultiplayerRoomStore ??= new InProcessMultiplayerRoomStore();

  return defaultMultiplayerRoomStore;
}
