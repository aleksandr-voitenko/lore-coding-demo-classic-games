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
  nextMatchParticipantIds: string[];
  observerLimit: number;
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
  observerLimit?: unknown;
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

export type LeavePrivateRoomOptions = PrivateRoomActorOptions & {
  successorParticipantId?: unknown;
};

export type UpdatePrivateRoomSettingsOptions = PrivateRoomActorOptions & {
  settings: PrivateRoomSettings;
};

export type ReplacePrivateRoomMatchOptions = PrivateRoomActorOptions & {
  seats: readonly PrivateRoomSeatInput[];
  settings: PrivateRoomSettings;
};

export type PrivateRoomErrorCode =
  | "duplicate-participant"
  | "duplicate-seat"
  | "invalid-display-name"
  | "invalid-host"
  | "invalid-host-successor"
  | "invalid-observer-limit"
  | "invalid-participant"
  | "invalid-room-code"
  | "invalid-room-settings"
  | "invalid-seat"
  | "invalid-status"
  | "not-host"
  | "observer-limit-reached"
  | "participant-already-seated"
  | "participant-not-found"
  | "participant-not-seated"
  | "next-match-queue-full"
  | "required-seats-empty"
  | "seat-not-found"
  | "seat-occupied";

export type PrivateRoomOperationFailure = {
  code: PrivateRoomErrorCode;
  error: string;
  success: false;
};

export type PrivateRoomOperationResult =
  | {
      room: PrivateRoom;
      success: true;
    }
  | PrivateRoomOperationFailure;

export type PrivateRoomLeaveOperationResult =
  | {
      closed: false;
      room: PrivateRoom;
      success: true;
    }
  | {
      closed: true;
      success: true;
    }
  | PrivateRoomOperationFailure;

const PRIVATE_ROOM_CODE_PATTERN = /^[A-Z0-9-]{1,80}$/;
const PRIVATE_ROOM_ENTITY_ID_PATTERN = /^[a-zA-Z0-9-]{1,80}$/;

export const INITIAL_PRIVATE_ROOM_MATCH_ID = 1;
export const DEFAULT_PRIVATE_ROOM_OBSERVER_LIMIT = 8;

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
): PrivateRoomOperationFailure {
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

function createPrivateRoomLeaveSuccess(
  room: PrivateRoom,
): PrivateRoomLeaveOperationResult {
  return {
    closed: false,
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

function normalizePrivateRoomObserverLimit(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
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

function getTwoPlayerSeatContractError(
  seats: readonly PrivateRoomSeat[],
): PrivateRoomOperationResult | null {
  return seats.length === 2 && seats.every((seat) => seat.required)
    ? null
    : createPrivateRoomError(
        "invalid-seat",
        "Party games require exactly two required player seats.",
      );
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

function getSeatedParticipantIds(room: PrivateRoom) {
  return new Set(
    room.seats.flatMap((seat) =>
      seat.occupiedByParticipantId === null
        ? []
        : [seat.occupiedByParticipantId],
    ),
  );
}

export function getPrivateRoomWatchingParticipantIds(room: PrivateRoom) {
  const seatedParticipantIds = getSeatedParticipantIds(room);

  return room.participants.flatMap((participant) =>
    seatedParticipantIds.has(participant.id) ? [] : [participant.id],
  );
}

function applyPrivateRoomParticipantRoles(
  room: PrivateRoom,
  seats: readonly PrivateRoomSeat[],
) {
  const seatedParticipantIds = new Set(
    seats.flatMap((seat) =>
      seat.occupiedByParticipantId === null
        ? []
        : [seat.occupiedByParticipantId],
    ),
  );

  return room.participants.map((participant) =>
    participant.id === room.hostParticipantId
      ? {
          ...participant,
          role: "host" as const,
        }
      : {
          ...participant,
          role: seatedParticipantIds.has(participant.id)
            ? ("player" as const)
            : ("observer" as const),
        },
  );
}

function promotePrivateRoomNextMatchQueue(room: PrivateRoom): PrivateRoom {
  const participantIds = new Set(
    room.participants.map((participant) => participant.id),
  );
  const seatedParticipantIds = getSeatedParticipantIds(room);
  const nextMatchParticipantIds = room.nextMatchParticipantIds.filter(
    (participantId) =>
      participantIds.has(participantId) &&
      !seatedParticipantIds.has(participantId),
  );
  let queueIndex = 0;
  const seats = room.seats.map((seat) => {
    if (seat.occupiedByParticipantId !== null) {
      return seat;
    }

    const participantId = nextMatchParticipantIds[queueIndex];

    if (participantId === undefined) {
      return seat;
    }

    queueIndex += 1;
    seatedParticipantIds.add(participantId);

    return {
      ...seat,
      occupiedByParticipantId: participantId,
    };
  });

  return {
    ...room,
    nextMatchParticipantIds: nextMatchParticipantIds.slice(queueIndex),
    participants: applyPrivateRoomParticipantRoles(room, seats),
    seats,
  };
}

function isPrivateRoomBetweenMatches(room: PrivateRoom) {
  return room.status === "lobby" || room.status === "finished";
}

export function getPrivateRoomGuestPlayerAdmissionRole(
  room: PrivateRoom,
): "observer" | "player" {
  return isPrivateRoomBetweenMatches(room) &&
    room.nextMatchParticipantIds.length === 0 &&
    room.seats.some((seat) => seat.occupiedByParticipantId === null)
    ? "player"
    : "observer";
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
  observerLimit = DEFAULT_PRIVATE_ROOM_OBSERVER_LIMIT,
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

  const normalizedObserverLimit = normalizePrivateRoomObserverLimit(observerLimit);

  if (normalizedObserverLimit === null) {
    return createPrivateRoomError(
      "invalid-observer-limit",
      "Party watcher limit must be a non-negative integer.",
    );
  }

  const normalizedSeats = normalizePrivateRoomSeats(seats);

  if (!Array.isArray(normalizedSeats)) {
    return normalizedSeats;
  }

  const seatContractError = getTwoPlayerSeatContractError(normalizedSeats);

  if (seatContractError !== null) {
    return seatContractError;
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
    nextMatchParticipantIds: [],
    observerLimit: normalizedObserverLimit,
    participants: [
      {
        displayName: hostDisplayName,
        id: hostParticipantId,
        role: "host",
        userId: hostUserId,
      },
    ],
    seats: normalizedSeats.map((seat, index) =>
      index === 0
        ? {
            ...seat,
            occupiedByParticipantId: hostParticipantId,
          }
        : seat,
    ),
    settings: normalizedSettings,
    status: "lobby",
  });
}

function addPrivateRoomParticipant(
  room: PrivateRoom,
  { displayName, participantId, userId = null }: AddPrivateRoomGuestParticipantOptions,
  role: "observer" | "player",
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

  if (
    normalizedUserId !== null &&
    room.participants.some(
      (participant) => participant.userId === normalizedUserId,
    )
  ) {
    return createPrivateRoomError(
      "duplicate-participant",
      "This user is already a member of the party.",
    );
  }

  return createPrivateRoomSuccess({
    ...room,
    participants: [
      ...room.participants,
      {
        displayName: normalizedDisplayName,
        id: normalizedParticipantId,
        role,
        userId: normalizedUserId,
      },
    ],
  });
}

export function addPrivateRoomGuestParticipantAsObserver(
  room: PrivateRoom,
  options: AddPrivateRoomGuestParticipantOptions,
): PrivateRoomOperationResult {
  const participantResult = addPrivateRoomParticipant(
    room,
    options,
    "observer",
  );

  if (!participantResult.success) {
    return participantResult;
  }

  if (
    getPrivateRoomWatchingParticipantIds(room).length >= room.observerLimit
  ) {
    return createPrivateRoomError(
      "observer-limit-reached",
      "This party already has the maximum number of watchers.",
    );
  }

  return participantResult;
}

export function addPrivateRoomGuestParticipantAsPlayer(
  room: PrivateRoom,
  options: AddPrivateRoomGuestParticipantOptions,
): PrivateRoomOperationResult {
  const admissionRole = getPrivateRoomGuestPlayerAdmissionRole(room);

  if (admissionRole === "observer") {
    return addPrivateRoomGuestParticipantAsObserver(room, options);
  }

  const playerResult = addPrivateRoomParticipant(room, options, "player");

  if (!playerResult.success) {
    return playerResult;
  }

  const openSeat = playerResult.room.seats.find(
    (seat) => seat.occupiedByParticipantId === null,
  );

  if (openSeat === undefined) {
    return createPrivateRoomError(
      "seat-occupied",
      "Player seats became unavailable while joining the party.",
    );
  }

  return claimPrivateRoomSeat(playerResult.room, {
    participantId: options.participantId,
    seatId: openSeat.id,
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

export function replacePrivateRoomMatch(
  room: PrivateRoom,
  { participantId, seats, settings }: ReplacePrivateRoomMatchOptions,
): PrivateRoomOperationResult {
  const hostGuard = getHostGuard(room, participantId);

  if (hostGuard.error !== null) {
    return hostGuard.error;
  }

  if (!isPrivateRoomBetweenMatches(room)) {
    return createPrivateRoomError(
      "invalid-status",
      "Finish the current match before choosing another game.",
    );
  }

  const normalizedSettings = normalizePrivateRoomSettings(settings);

  if (normalizedSettings === null) {
    return createPrivateRoomError(
      "invalid-room-settings",
      "Room settings require a supported game id.",
    );
  }

  const normalizedSeats = normalizePrivateRoomSeats(seats);

  if (!Array.isArray(normalizedSeats)) {
    return normalizedSeats;
  }

  const seatContractError = getTwoPlayerSeatContractError(normalizedSeats);

  if (seatContractError !== null) {
    return seatContractError;
  }

  const participantIds = new Set(
    room.participants.map((participant) => participant.id),
  );
  const playersBySeatOrdinal = room.seats.map((seat) =>
    seat.occupiedByParticipantId !== null &&
    participantIds.has(seat.occupiedByParticipantId)
      ? seat.occupiedByParticipantId
      : null,
  );
  const nextSeats = normalizedSeats.map((seat, index) => ({
    ...seat,
    occupiedByParticipantId: playersBySeatOrdinal[index] ?? null,
  }));

  const nextRoom: PrivateRoom = {
    ...room,
    matchId: getNextPrivateRoomMatchId(room.matchId),
    participants: applyPrivateRoomParticipantRoles(room, nextSeats),
    seats: nextSeats,
    settings: normalizedSettings,
    status: "lobby",
  };

  return createPrivateRoomSuccess(promotePrivateRoomNextMatchQueue(nextRoom));
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

  if (!isPrivateRoomBetweenMatches(room)) {
    return createPrivateRoomError(
      "invalid-status",
      "Player seats can only change between matches.",
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

  const nextQueuedParticipantId = room.nextMatchParticipantIds[0];

  if (
    nextQueuedParticipantId !== undefined &&
    nextQueuedParticipantId !== normalizedParticipantId
  ) {
    return createPrivateRoomError(
      "seat-occupied",
      "An earlier watcher has priority for the next open seat.",
    );
  }

  return createPrivateRoomSuccess({
    ...room,
    nextMatchParticipantIds: room.nextMatchParticipantIds.filter(
      (participantId) => participantId !== normalizedParticipantId,
    ),
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

  if (!isPrivateRoomBetweenMatches(room)) {
    return createPrivateRoomError(
      "invalid-status",
      "Player seats can only change between matches.",
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

  const seats = room.seats.map((seat) =>
    seat.id === normalizedSeatId
      ? {
          ...seat,
          occupiedByParticipantId: null,
        }
      : seat,
  );
  const releasedRoom: PrivateRoom = {
    ...room,
    participants: applyPrivateRoomParticipantRoles(room, seats),
    seats,
  };
  const nextRoom =
    room.status === "lobby"
      ? promotePrivateRoomNextMatchQueue(releasedRoom)
      : releasedRoom;

  if (
    getPrivateRoomWatchingParticipantIds(nextRoom).length > room.observerLimit
  ) {
    return createPrivateRoomError(
      "observer-limit-reached",
      "This party already has the maximum number of watchers.",
    );
  }

  return createPrivateRoomSuccess(nextRoom);
}

export function queuePrivateRoomParticipantForNextMatch(
  room: PrivateRoom,
  { participantId }: PrivateRoomActorOptions,
): PrivateRoomOperationResult {
  const normalizedParticipantId = normalizePrivateRoomEntityId(participantId);

  if (
    normalizedParticipantId === null ||
    findParticipant(room, normalizedParticipantId) === null
  ) {
    return createPrivateRoomError(
      "participant-not-found",
      "Participant is not in the room.",
    );
  }

  if (findSeatOccupiedByParticipant(room, normalizedParticipantId) !== null) {
    return createPrivateRoomError(
      "participant-already-seated",
      "Only watchers can wait for the next match.",
    );
  }

  if (room.nextMatchParticipantIds.includes(normalizedParticipantId)) {
    return createPrivateRoomSuccess(room);
  }

  if (room.nextMatchParticipantIds.length >= room.observerLimit) {
    return createPrivateRoomError(
      "next-match-queue-full",
      "The next-match queue is full.",
    );
  }

  const queuedRoom: PrivateRoom = {
    ...room,
    nextMatchParticipantIds: [
      ...room.nextMatchParticipantIds,
      normalizedParticipantId,
    ],
  };

  return createPrivateRoomSuccess(
    room.status === "lobby"
      ? promotePrivateRoomNextMatchQueue(queuedRoom)
      : queuedRoom,
  );
}

export function cancelPrivateRoomNextMatchRequest(
  room: PrivateRoom,
  { participantId }: PrivateRoomActorOptions,
): PrivateRoomOperationResult {
  const normalizedParticipantId = normalizePrivateRoomEntityId(participantId);

  if (
    normalizedParticipantId === null ||
    findParticipant(room, normalizedParticipantId) === null
  ) {
    return createPrivateRoomError(
      "participant-not-found",
      "Participant is not in the room.",
    );
  }

  if (!room.nextMatchParticipantIds.includes(normalizedParticipantId)) {
    return createPrivateRoomSuccess(room);
  }

  return createPrivateRoomSuccess({
    ...room,
    nextMatchParticipantIds: room.nextMatchParticipantIds.filter(
      (queuedParticipantId) =>
        queuedParticipantId !== normalizedParticipantId,
    ),
  });
}

export function leavePrivateRoom(
  room: PrivateRoom,
  { participantId, successorParticipantId }: LeavePrivateRoomOptions,
): PrivateRoomLeaveOperationResult {
  const normalizedParticipantId = normalizePrivateRoomEntityId(participantId);
  const participant =
    normalizedParticipantId === null
      ? null
      : findParticipant(room, normalizedParticipantId);

  if (participant === null || normalizedParticipantId === null) {
    return createPrivateRoomError(
      "participant-not-found",
      "Participant is not in the room.",
    );
  }

  const leavingHost = normalizedParticipantId === room.hostParticipantId;

  if (
    leavingHost &&
    (successorParticipantId === undefined || successorParticipantId === null)
  ) {
    return { closed: true, success: true };
  }

  const normalizedSuccessorParticipantId =
    successorParticipantId === undefined || successorParticipantId === null
      ? null
      : normalizePrivateRoomEntityId(successorParticipantId);

  if (!leavingHost && normalizedSuccessorParticipantId !== null) {
    return createPrivateRoomError(
      "invalid-host-successor",
      "Only a leaving host can transfer party ownership.",
    );
  }

  if (leavingHost) {
    const successor =
      normalizedSuccessorParticipantId === null
        ? null
        : findParticipant(room, normalizedSuccessorParticipantId);

    if (
      successor === null ||
      successor.id === normalizedParticipantId ||
      successor.userId === null
    ) {
      return createPrivateRoomError(
        "invalid-host-successor",
        "Party ownership can only transfer to a signed-in member.",
      );
    }
  }

  const hostParticipantId =
    normalizedSuccessorParticipantId ?? room.hostParticipantId;
  const participants = room.participants
    .filter((entry) => entry.id !== normalizedParticipantId)
    .map((entry) =>
      entry.id === hostParticipantId
        ? {
            ...entry,
            role: "host" as const,
          }
        : entry,
    );
  const seats = room.seats.map((seat) =>
    seat.occupiedByParticipantId === normalizedParticipantId
      ? {
          ...seat,
          occupiedByParticipantId: null,
        }
      : seat,
  );
  const departedRoom: PrivateRoom = {
    ...room,
    hostParticipantId,
    nextMatchParticipantIds: room.nextMatchParticipantIds.filter(
      (queuedParticipantId) =>
        queuedParticipantId !== normalizedParticipantId,
    ),
    participants,
    seats,
  };
  const roleAdjustedRoom: PrivateRoom = {
    ...departedRoom,
    participants: applyPrivateRoomParticipantRoles(departedRoom, seats),
  };

  return createPrivateRoomLeaveSuccess(
    room.status === "lobby"
      ? promotePrivateRoomNextMatchQueue(roleAdjustedRoom)
      : roleAdjustedRoom,
  );
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

  const readyRoom = promotePrivateRoomNextMatchQueue(room);
  const requiredSeatLabels = getUnoccupiedRequiredSeatLabels(readyRoom);

  if (requiredSeatLabels.length > 0) {
    return createRequiredSeatsError("starting", requiredSeatLabels);
  }

  return updatePrivateRoomStatus(readyRoom, "running");
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

  const readyRoom = promotePrivateRoomNextMatchQueue(room);
  const requiredSeatLabels = getUnoccupiedRequiredSeatLabels(readyRoom);

  if (requiredSeatLabels.length > 0) {
    return createRequiredSeatsError("restarting", requiredSeatLabels);
  }

  return createPrivateRoomSuccess({
    ...readyRoom,
    matchId: getNextPrivateRoomMatchId(readyRoom.matchId),
    status: "running",
  });
}

export function finishPrivateRoomAfterGameTerminal(room: PrivateRoom) {
  return room.status === "running" || room.status === "paused"
    ? {
        ...room,
        status: "finished" as const,
      }
    : room;
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

  return createPrivateRoomSuccess(finishPrivateRoomAfterGameTerminal(room));
}
