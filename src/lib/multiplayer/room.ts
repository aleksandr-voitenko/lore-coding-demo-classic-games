import { isGameId, type GameId } from "../game-catalog";
import { normalizeUserDisplayName } from "../user-profile";

export type PrivateRoomStatus = "finished" | "lobby" | "paused" | "running";

export type PrivateRoomParticipantRole = "host" | "observer" | "player";

export type PrivateRoomSettingValue =
  | boolean
  | null
  | number
  | string
  | readonly PrivateRoomSettingValue[]
  | {
      readonly [key: string]: PrivateRoomSettingValue;
    };

export type PrivateRoomSettings = {
  gameId: GameId;
  parameters?: Readonly<Record<string, PrivateRoomSettingValue>>;
};

export type PrivateRoomParticipant = {
  displayName: string;
  id: string;
  role: PrivateRoomParticipantRole;
  userId: string | null;
};

export type PrivateRoomSeat = {
  id: string;
  label: string;
  occupiedByParticipantId: string | null;
  required: boolean;
};

type PrivateRoomMatchState = {
  matchId: number;
  seats: PrivateRoomSeat[];
  settings: PrivateRoomSettings;
  status: PrivateRoomStatus;
};

export type PrivateRoom = PrivateRoomMatchState & {
  code: string;
  hostParticipantId: string;
  participants: PrivateRoomParticipant[];
};

export type PrivateRoomSeatInput = {
  id: unknown;
  label: unknown;
  required?: boolean;
};

export type PrivateRoomHostInput = {
  displayName: unknown;
  participantId: unknown;
  userId: unknown;
};

export type CreatePrivateRoomOptions = {
  code: unknown;
  host: PrivateRoomHostInput;
  seats: readonly PrivateRoomSeatInput[];
  settings: PrivateRoomSettings;
};

export type AddPrivateRoomGuestParticipantOptions = {
  displayName: unknown;
  participantId: unknown;
  userId?: unknown;
};

export type PrivateRoomParticipantSeatOptions = {
  participantId: unknown;
  seatId: unknown;
};

export type PrivateRoomActorOptions = {
  participantId: unknown;
};

export type UpdatePrivateRoomSettingsOptions = PrivateRoomActorOptions & {
  settings: PrivateRoomSettings;
};

export type PrivateRoomErrorCode =
  | "duplicate-participant"
  | "duplicate-seat"
  | "invalid-display-name"
  | "invalid-host"
  | "invalid-participant"
  | "invalid-room-code"
  | "invalid-room-settings"
  | "invalid-seat"
  | "invalid-status"
  | "not-host"
  | "participant-already-seated"
  | "participant-not-found"
  | "participant-not-seated"
  | "required-seats-empty"
  | "seat-not-found"
  | "seat-occupied";

export type PrivateRoomOperationResult =
  | {
      room: PrivateRoom;
      success: true;
    }
  | {
      code: PrivateRoomErrorCode;
      error: string;
      success: false;
    };

const PRIVATE_ROOM_CODE_PATTERN = /^[A-Z0-9-]{1,80}$/;
const PRIVATE_ROOM_ENTITY_ID_PATTERN = /^[a-zA-Z0-9-]{1,80}$/;

export const INITIAL_PRIVATE_ROOM_MATCH_ID = 1;

export function isPrivateRoomMatchId(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === "number" && value > 0;
}

export function getNextPrivateRoomMatchId(matchId: number) {
  if (!isPrivateRoomMatchId(matchId) || matchId === Number.MAX_SAFE_INTEGER) {
    throw new Error("Private room match id cannot be advanced.");
  }

  return matchId + 1;
}

function createPrivateRoomError(
  code: PrivateRoomErrorCode,
  error: string,
): PrivateRoomOperationResult {
  return {
    code,
    error,
    success: false,
  };
}

function createPrivateRoomSuccess(room: PrivateRoom): PrivateRoomOperationResult {
  return {
    room,
    success: true,
  };
}

function normalizeRequiredString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length === 0 ? null : normalizedValue;
}

function normalizePrivateRoomEntityId(value: unknown) {
  const entityId = normalizeRequiredString(value);

  return entityId !== null && PRIVATE_ROOM_ENTITY_ID_PATTERN.test(entityId)
    ? entityId
    : null;
}

function normalizePrivateRoomSeatLabel(value: unknown) {
  const label = normalizeRequiredString(value);

  return label === null ? null : label;
}

function clonePrivateRoomSettingValue(
  value: PrivateRoomSettingValue,
): PrivateRoomSettingValue {
  if (Array.isArray(value)) {
    return value.map((item) => clonePrivateRoomSettingValue(item));
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

function normalizePrivateRoomSettings(
  settings: PrivateRoomSettings,
): PrivateRoomSettings | null {
  const gameId = typeof settings.gameId === "string" ? settings.gameId.trim() : "";

  if (!isGameId(gameId)) {
    return null;
  }

  if (settings.parameters === undefined) {
    return { gameId };
  }

  return {
    gameId,
    parameters: clonePrivateRoomSettingValue(settings.parameters) as Readonly<
      Record<string, PrivateRoomSettingValue>
    >,
  };
}

function normalizePrivateRoomSeats(
  seats: readonly PrivateRoomSeatInput[],
): PrivateRoomSeat[] | PrivateRoomOperationResult {
  const usedSeatIds = new Set<string>();
  const normalizedSeats: PrivateRoomSeat[] = [];

  for (const seat of seats) {
    const id = normalizePrivateRoomEntityId(seat.id);
    const label = normalizePrivateRoomSeatLabel(seat.label);

    if (id === null || label === null) {
      return createPrivateRoomError(
        "invalid-seat",
        "Room seats require supported identifiers and labels.",
      );
    }

    if (usedSeatIds.has(id)) {
      return createPrivateRoomError("duplicate-seat", `Room seat '${id}' is duplicated.`);
    }

    usedSeatIds.add(id);
    normalizedSeats.push({
      id,
      label,
      occupiedByParticipantId: null,
      required: seat.required === true,
    });
  }

  return normalizedSeats;
}

function findParticipant(room: PrivateRoom, participantId: string) {
  return room.participants.find((participant) => participant.id === participantId) ?? null;
}

function findSeat(room: PrivateRoom, seatId: string) {
  return room.seats.find((seat) => seat.id === seatId) ?? null;
}

function findSeatOccupiedByParticipant(room: PrivateRoom, participantId: string) {
  return (
    room.seats.find((seat) => seat.occupiedByParticipantId === participantId) ?? null
  );
}

function getHostGuard(room: PrivateRoom, participantId: unknown) {
  const normalizedParticipantId = normalizePrivateRoomEntityId(participantId);

  if (normalizedParticipantId === null) {
    return {
      error: createPrivateRoomError(
        "participant-not-found",
        "Participant is not in the room.",
      ),
      participantId: null,
    };
  }

  const participant = findParticipant(room, normalizedParticipantId);

  if (participant === null) {
    return {
      error: createPrivateRoomError(
        "participant-not-found",
        "Participant is not in the room.",
      ),
      participantId: null,
    };
  }

  if (
    normalizedParticipantId !== room.hostParticipantId ||
    participant.role !== "host" ||
    participant.userId === null
  ) {
    return {
      error: createPrivateRoomError(
        "not-host",
        "Only the signed-in room host can perform this action.",
      ),
      participantId: null,
    };
  }

  return {
    error: null,
    participantId: normalizedParticipantId,
  };
}

function getUnoccupiedRequiredSeatLabels(room: PrivateRoom) {
  return room.seats
    .filter((seat) => seat.required && seat.occupiedByParticipantId === null)
    .map((seat) => seat.label);
}

function createRequiredSeatsError(action: "restarting" | "starting", labels: string[]) {
  return createPrivateRoomError(
    "required-seats-empty",
    `Required seats must be occupied before ${action} the room: ${labels.join(", ")}.`,
  );
}

function updatePrivateRoomStatus(room: PrivateRoom, status: PrivateRoomStatus) {
  return createPrivateRoomSuccess({
    ...room,
    status,
  });
}

export function normalizePrivateRoomCode(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const roomCode = value.trim().toLocaleUpperCase("en-US");

  return PRIVATE_ROOM_CODE_PATTERN.test(roomCode) ? roomCode : null;
}

export function getPrivateRoomInvitePath(roomCode: unknown) {
  const normalizedRoomCode = normalizePrivateRoomCode(roomCode);

  return normalizedRoomCode === null
    ? null
    : `/?room=${encodeURIComponent(normalizedRoomCode)}`;
}

export function normalizePrivateRoomDisplayName(value: unknown) {
  return normalizeUserDisplayName(value);
}

export function createPrivateRoom({
  code,
  host,
  seats,
  settings,
}: CreatePrivateRoomOptions): PrivateRoomOperationResult {
  const normalizedCode = normalizePrivateRoomCode(code);

  if (normalizedCode === null) {
    return createPrivateRoomError(
      "invalid-room-code",
      "Room code is not supported.",
    );
  }

  const hostParticipantId = normalizePrivateRoomEntityId(host.participantId);
  const hostUserId = normalizePrivateRoomEntityId(host.userId);
  const hostDisplayName = normalizePrivateRoomDisplayName(host.displayName);

  if (hostParticipantId === null || hostUserId === null || hostDisplayName.length === 0) {
    return createPrivateRoomError(
      "invalid-host",
      "Private rooms require a signed-in host.",
    );
  }

  const normalizedSeats = normalizePrivateRoomSeats(seats);

  if (!Array.isArray(normalizedSeats)) {
    return normalizedSeats;
  }

  const normalizedSettings = normalizePrivateRoomSettings(settings);

  if (normalizedSettings === null) {
    return createPrivateRoomError(
      "invalid-room-settings",
      "Room settings require a supported game id.",
    );
  }

  return createPrivateRoomSuccess({
    code: normalizedCode,
    hostParticipantId,
    matchId: INITIAL_PRIVATE_ROOM_MATCH_ID,
    participants: [
      {
        displayName: hostDisplayName,
        id: hostParticipantId,
        role: "host",
        userId: hostUserId,
      },
    ],
    seats: normalizedSeats,
    settings: normalizedSettings,
    status: "lobby",
  });
}

export function addPrivateRoomGuestParticipantAsObserver(
  room: PrivateRoom,
  { displayName, participantId, userId = null }: AddPrivateRoomGuestParticipantOptions,
): PrivateRoomOperationResult {
  const normalizedParticipantId = normalizePrivateRoomEntityId(participantId);

  if (normalizedParticipantId === null) {
    return createPrivateRoomError(
      "invalid-participant",
      "Room participant id is not supported.",
    );
  }

  if (findParticipant(room, normalizedParticipantId) !== null) {
    return createPrivateRoomError(
      "duplicate-participant",
      "Participant is already in the room.",
    );
  }

  const normalizedDisplayName = normalizePrivateRoomDisplayName(displayName);

  if (normalizedDisplayName.length === 0) {
    return createPrivateRoomError(
      "invalid-display-name",
      "Guest display name is required.",
    );
  }

  const normalizedUserId =
    userId === null || userId === undefined ? null : normalizePrivateRoomEntityId(userId);

  if (userId !== null && userId !== undefined && normalizedUserId === null) {
    return createPrivateRoomError(
      "invalid-participant",
      "Room participant user id is not supported.",
    );
  }

  return createPrivateRoomSuccess({
    ...room,
    participants: [
      ...room.participants,
      {
        displayName: normalizedDisplayName,
        id: normalizedParticipantId,
        role: "observer",
        userId: normalizedUserId,
      },
    ],
  });
}

export function updatePrivateRoomSettings(
  room: PrivateRoom,
  { participantId, settings }: UpdatePrivateRoomSettingsOptions,
): PrivateRoomOperationResult {
  const hostGuard = getHostGuard(room, participantId);

  if (hostGuard.error !== null) {
    return hostGuard.error;
  }

  if (room.status !== "lobby") {
    return createPrivateRoomError(
      "invalid-status",
      "Only lobby rooms can update settings.",
    );
  }

  const normalizedSettings = normalizePrivateRoomSettings(settings);

  if (normalizedSettings === null) {
    return createPrivateRoomError(
      "invalid-room-settings",
      "Room settings require a supported game id.",
    );
  }

  if (normalizedSettings.gameId !== room.settings.gameId) {
    return createPrivateRoomError(
      "invalid-room-settings",
      "Changing games requires replacing the current match.",
    );
  }

  return createPrivateRoomSuccess({
    ...room,
    settings: normalizedSettings,
  });
}

export function claimPrivateRoomSeat(
  room: PrivateRoom,
  { participantId, seatId }: PrivateRoomParticipantSeatOptions,
): PrivateRoomOperationResult {
  const normalizedParticipantId = normalizePrivateRoomEntityId(participantId);
  const normalizedSeatId = normalizePrivateRoomEntityId(seatId);

  if (normalizedParticipantId === null || findParticipant(room, normalizedParticipantId) === null) {
    return createPrivateRoomError(
      "participant-not-found",
      "Participant is not in the room.",
    );
  }

  if (normalizedSeatId === null) {
    return createPrivateRoomError("seat-not-found", "Seat is not in the room.");
  }

  const requestedSeat = findSeat(room, normalizedSeatId);

  if (requestedSeat === null) {
    return createPrivateRoomError("seat-not-found", "Seat is not in the room.");
  }

  if (requestedSeat.occupiedByParticipantId === normalizedParticipantId) {
    return createPrivateRoomSuccess(room);
  }

  if (requestedSeat.occupiedByParticipantId !== null) {
    return createPrivateRoomError("seat-occupied", "Seat is already occupied.");
  }

  const existingSeat = findSeatOccupiedByParticipant(room, normalizedParticipantId);

  if (existingSeat !== null) {
    return createPrivateRoomError(
      "participant-already-seated",
      "Participant already occupies a seat.",
    );
  }

  return createPrivateRoomSuccess({
    ...room,
    participants: room.participants.map((participant) =>
      participant.id === normalizedParticipantId && participant.role !== "host"
        ? {
            ...participant,
            role: "player",
          }
        : participant,
    ),
    seats: room.seats.map((seat) =>
      seat.id === normalizedSeatId
        ? {
            ...seat,
            occupiedByParticipantId: normalizedParticipantId,
          }
        : seat,
    ),
  });
}

export function releasePrivateRoomSeat(
  room: PrivateRoom,
  { participantId, seatId }: PrivateRoomParticipantSeatOptions,
): PrivateRoomOperationResult {
  const normalizedParticipantId = normalizePrivateRoomEntityId(participantId);
  const normalizedSeatId = normalizePrivateRoomEntityId(seatId);

  if (normalizedParticipantId === null || findParticipant(room, normalizedParticipantId) === null) {
    return createPrivateRoomError(
      "participant-not-found",
      "Participant is not in the room.",
    );
  }

  if (normalizedSeatId === null) {
    return createPrivateRoomError("seat-not-found", "Seat is not in the room.");
  }

  const requestedSeat = findSeat(room, normalizedSeatId);

  if (requestedSeat === null) {
    return createPrivateRoomError("seat-not-found", "Seat is not in the room.");
  }

  if (requestedSeat.occupiedByParticipantId !== normalizedParticipantId) {
    return createPrivateRoomError(
      "participant-not-seated",
      "Participant does not occupy that seat.",
    );
  }

  return createPrivateRoomSuccess({
    ...room,
    participants: room.participants.map((participant) =>
      participant.id === normalizedParticipantId && participant.role === "player"
        ? {
            ...participant,
            role: "observer",
          }
        : participant,
    ),
    seats: room.seats.map((seat) =>
      seat.id === normalizedSeatId
        ? {
            ...seat,
            occupiedByParticipantId: null,
          }
        : seat,
    ),
  });
}

export function startPrivateRoom(
  room: PrivateRoom,
  { participantId }: PrivateRoomActorOptions,
): PrivateRoomOperationResult {
  const hostGuard = getHostGuard(room, participantId);

  if (hostGuard.error !== null) {
    return hostGuard.error;
  }

  if (room.status !== "lobby") {
    return createPrivateRoomError(
      "invalid-status",
      "Only lobby rooms can be started.",
    );
  }

  const requiredSeatLabels = getUnoccupiedRequiredSeatLabels(room);

  if (requiredSeatLabels.length > 0) {
    return createRequiredSeatsError("starting", requiredSeatLabels);
  }

  return updatePrivateRoomStatus(room, "running");
}

export function pausePrivateRoom(
  room: PrivateRoom,
  { participantId }: PrivateRoomActorOptions,
): PrivateRoomOperationResult {
  const hostGuard = getHostGuard(room, participantId);

  if (hostGuard.error !== null) {
    return hostGuard.error;
  }

  if (room.status !== "running") {
    return createPrivateRoomError(
      "invalid-status",
      "Only running rooms can be paused.",
    );
  }

  return updatePrivateRoomStatus(room, "paused");
}

export function resumePrivateRoom(
  room: PrivateRoom,
  { participantId }: PrivateRoomActorOptions,
): PrivateRoomOperationResult {
  const hostGuard = getHostGuard(room, participantId);

  if (hostGuard.error !== null) {
    return hostGuard.error;
  }

  if (room.status !== "paused") {
    return createPrivateRoomError(
      "invalid-status",
      "Only paused rooms can be resumed.",
    );
  }

  return updatePrivateRoomStatus(room, "running");
}

export function restartPrivateRoom(
  room: PrivateRoom,
  { participantId }: PrivateRoomActorOptions,
): PrivateRoomOperationResult {
  const hostGuard = getHostGuard(room, participantId);

  if (hostGuard.error !== null) {
    return hostGuard.error;
  }

  if (room.status === "lobby") {
    return createPrivateRoomError(
      "invalid-status",
      "Only active or finished rooms can be restarted.",
    );
  }

  const requiredSeatLabels = getUnoccupiedRequiredSeatLabels(room);

  if (requiredSeatLabels.length > 0) {
    return createRequiredSeatsError("restarting", requiredSeatLabels);
  }

  return createPrivateRoomSuccess({
    ...room,
    matchId: getNextPrivateRoomMatchId(room.matchId),
    status: "running",
  });
}

export function finishPrivateRoom(
  room: PrivateRoom,
  { participantId }: PrivateRoomActorOptions,
): PrivateRoomOperationResult {
  const hostGuard = getHostGuard(room, participantId);

  if (hostGuard.error !== null) {
    return hostGuard.error;
  }

  if (room.status !== "running" && room.status !== "paused") {
    return createPrivateRoomError(
      "invalid-status",
      "Only running or paused rooms can be finished.",
    );
  }

  return updatePrivateRoomStatus(room, "finished");
}
