import { isGameId } from "../game-catalog";
import { MULTIPLAYER_ROOM_PROTOCOL_VERSION } from "./protocol";
import type {
  MultiplayerRealtimeGameSnapshot,
  MultiplayerRealtimeRejectionCode,
  MultiplayerRealtimeRoomEvent,
  MultiplayerRealtimeServerMessage,
  MultiplayerRoomSnapshot,
} from "./protocol";
import {
  isPrivateRoomMatchId,
  normalizePrivateRoomCode,
  type PrivateRoom,
  type PrivateRoomParticipant,
  type PrivateRoomSettingValue,
  type PrivateRoomSettings,
} from "./room";

/**
 * Validates the transport-neutral room envelope and room-model invariants.
 * Game-specific state stays opaque, but must be an object inside a valid game
 * envelope whose game id matches the room settings. Malformed or reflective
 * inputs return false instead of leaking validation errors.
 */
export function isMultiplayerRoomSnapshot(
  value: unknown,
): value is MultiplayerRoomSnapshot {
  try {
    return isMultiplayerRoomSnapshotUnchecked(value);
  } catch {
    return false;
  }
}

function isMultiplayerRoomSnapshotUnchecked(
  value: unknown,
): value is MultiplayerRoomSnapshot {
  if (
    !isRecord(value) ||
    !isPrivateRoom(value.room) ||
    !isSequence(value.seq)
  ) {
    return false;
  }

  if (
    value.participant !== undefined &&
    (!isPrivateRoomParticipant(value.participant) ||
      !isSnapshotParticipant(value.participant, value.room))
  ) {
    return false;
  }

  return (
    value.game === undefined ||
    isMultiplayerGameSnapshot(
      value.game,
      value.room.settings.gameId,
      value.room.matchId,
    )
  );
}

/** Validates a known server envelope, optionally scoped to one expected room. */
export function isMultiplayerRealtimeServerMessage(
  value: unknown,
  expectedRoomCode?: string,
): value is MultiplayerRealtimeServerMessage {
  try {
    return isMultiplayerRealtimeServerMessageUnchecked(
      value,
      expectedRoomCode,
    );
  } catch {
    return false;
  }
}

function isMultiplayerRealtimeServerMessageUnchecked(
  value: unknown,
  expectedRoomCode: string | undefined,
): value is MultiplayerRealtimeServerMessage {
  if (!isRecord(value)) {
    return false;
  }

  switch (value.type) {
    case "connection.bootstrap":
      return (
        isRoomCode(value.roomCode, expectedRoomCode) &&
        isOptionalString(value.displayName) &&
        isOptionalEntityId(value.participantId) &&
        value.protocolVersion === MULTIPLAYER_ROOM_PROTOCOL_VERSION &&
        isOptionalString(value.requestId) &&
        isMultiplayerRoomSnapshot(value.snapshot) &&
        value.snapshot.room.code === value.roomCode
      );
    case "room.snapshot":
      return (
        isRoomCode(value.roomCode, expectedRoomCode) &&
        isOptionalString(value.requestId) &&
        isMultiplayerRoomSnapshot(value.snapshot) &&
        value.snapshot.room.code === value.roomCode
      );
    case "room.event":
      return (
        isRoomCode(value.roomCode, expectedRoomCode) &&
        isMultiplayerRoomEvent(value.event)
      );
    case "room.commandAck":
      return (
        isRoomCode(value.roomCode, expectedRoomCode) &&
        isOptionalSequence(value.gameSeq) &&
        isPrivateRoomMatchId(value.matchId) &&
        isOptionalParticipantCapability(value.participantCapability) &&
        isOptionalEntityId(value.participantId) &&
        (value.participantCapability === undefined ||
          value.participantId !== undefined) &&
        isOptionalString(value.requestId) &&
        isSequence(value.seq)
      );
    case "room.commandRejected":
      return (
        isMultiplayerRealtimeRejectionCode(value.code) &&
        typeof value.error === "string" &&
        isOptionalString(value.requestId) &&
        isOptionalRoomCode(value.roomCode, expectedRoomCode)
      );
    case "party.closed":
      return (
        isRoomCode(value.roomCode, expectedRoomCode) &&
        isPrivateRoomMatchId(value.matchId) &&
        isTrimmedString(value.reason) &&
        isSequence(value.seq)
      );
    case "room.membershipEnded":
      return (
        isRoomCode(value.roomCode, expectedRoomCode) &&
        isEntityId(value.participantId) &&
        value.reason === "left"
      );
    case "connection.ping":
      return (
        isOptionalString(value.nonce) &&
        isTimestamp(value.serverTimeMs)
      );
    case "connection.pong":
      return (
        isTimestamp(value.clientTimeMs) &&
        isOptionalString(value.requestId) &&
        isOptionalRoomCode(value.roomCode, expectedRoomCode) &&
        isTimestamp(value.serverTimeMs)
      );
    default:
      return false;
  }
}

function isPrivateRoom(value: unknown): value is PrivateRoom {
  if (
    !isRecord(value) ||
    normalizePrivateRoomCode(value.code) !== value.code ||
    !isEntityId(value.hostParticipantId) ||
    !isPrivateRoomMatchId(value.matchId) ||
    !Array.isArray(value.nextMatchParticipantIds) ||
    !isSequence(value.observerLimit) ||
    !Array.isArray(value.participants) ||
    !value.participants.every(isPrivateRoomParticipant) ||
    !Array.isArray(value.seats) ||
    value.seats.length !== 2 ||
    !value.seats.every(isPrivateRoomSeat) ||
    !value.seats.every((seat) => seat.required === true) ||
    !isPrivateRoomSettings(value.settings) ||
    !isPrivateRoomStatus(value.status)
  ) {
    return false;
  }

  const participantIds = new Set<string>();
  let hostCount = 0;

  for (const participant of value.participants) {
    if (participantIds.has(participant.id)) {
      return false;
    }

    participantIds.add(participant.id);

    if (participant.role === "host") {
      hostCount += 1;
    }
  }

  const host = value.participants.find(
    (participant) => participant.id === value.hostParticipantId,
  );

  if (hostCount !== 1 || host?.role !== "host" || host.userId === null) {
    return false;
  }

  const seatIds = new Set<string>();
  const seatedParticipantIds = new Set<string>();

  for (const seat of value.seats) {
    if (seatIds.has(seat.id)) {
      return false;
    }

    seatIds.add(seat.id);

    if (seat.occupiedByParticipantId === null) {
      continue;
    }

    if (
      !participantIds.has(seat.occupiedByParticipantId) ||
      seatedParticipantIds.has(seat.occupiedByParticipantId)
    ) {
      return false;
    }

    seatedParticipantIds.add(seat.occupiedByParticipantId);
  }

  const nextMatchParticipantIds = new Set<string>();

  for (const participantId of value.nextMatchParticipantIds) {
    if (
      !isEntityId(participantId) ||
      !participantIds.has(participantId) ||
      seatedParticipantIds.has(participantId) ||
      nextMatchParticipantIds.has(participantId)
    ) {
      return false;
    }

    nextMatchParticipantIds.add(participantId);
  }

  if (
    nextMatchParticipantIds.size > value.observerLimit ||
    value.participants.filter(
      (participant) => !seatedParticipantIds.has(participant.id),
    ).length > value.observerLimit
  ) {
    return false;
  }

  return value.participants.every((participant) => {
    if (participant.role === "player") {
      return seatedParticipantIds.has(participant.id);
    }

    if (participant.role === "observer") {
      return !seatedParticipantIds.has(participant.id);
    }

    return true;
  });
}

function isPrivateRoomParticipant(
  value: unknown,
): value is PrivateRoomParticipant {
  return (
    isRecord(value) &&
    isTrimmedString(value.displayName) &&
    isEntityId(value.id) &&
    isPrivateRoomParticipantRole(value.role) &&
    (value.userId === null || isEntityId(value.userId))
  );
}

function isPrivateRoomSeat(value: unknown) {
  return (
    isRecord(value) &&
    isEntityId(value.id) &&
    isTrimmedString(value.label) &&
    (value.occupiedByParticipantId === null ||
      isEntityId(value.occupiedByParticipantId)) &&
    typeof value.required === "boolean"
  );
}

function isPrivateRoomSettings(value: unknown): value is PrivateRoomSettings {
  return (
    isRecord(value) &&
    typeof value.gameId === "string" &&
    isGameId(value.gameId) &&
    (value.parameters === undefined ||
      (isRecord(value.parameters) &&
        isPrivateRoomSettingValue(value.parameters)))
  );
}

function isPrivateRoomSettingValue(
  value: unknown,
): value is PrivateRoomSettingValue {
  const pendingValues: unknown[] = [value];
  const visitedObjects = new WeakSet<object>();

  while (pendingValues.length > 0) {
    const currentValue = pendingValues.pop();

    if (
      currentValue === null ||
      typeof currentValue === "boolean" ||
      typeof currentValue === "string"
    ) {
      continue;
    }

    if (typeof currentValue === "number") {
      if (!Number.isFinite(currentValue)) {
        return false;
      }

      continue;
    }

    if (typeof currentValue !== "object") {
      return false;
    }

    // Parsed JSON is a tree, so a repeated object means the input is cyclic or
    // contains shared references that could not have crossed the wire.
    if (visitedObjects.has(currentValue)) {
      return false;
    }

    visitedObjects.add(currentValue);

    if (Array.isArray(currentValue)) {
      for (const entry of currentValue) {
        pendingValues.push(entry);
      }

      continue;
    }

    if (!isRecord(currentValue)) {
      return false;
    }

    for (const key of Object.keys(currentValue)) {
      pendingValues.push(currentValue[key]);
    }
  }

  return true;
}

function isMultiplayerGameSnapshot(
  value: unknown,
  expectedGameId: string,
  expectedMatchId: number,
): value is MultiplayerRealtimeGameSnapshot {
  return (
    isRecord(value) &&
    typeof value.gameId === "string" &&
    isGameId(value.gameId) &&
    value.gameId === expectedGameId &&
    value.matchId === expectedMatchId &&
    isSequence(value.seq) &&
    isTimestamp(value.serverTimeMs) &&
    Object.hasOwn(value, "snapshot") &&
    isRecord(value.snapshot)
  );
}

function isSnapshotParticipant(
  participant: PrivateRoomParticipant,
  room: PrivateRoom,
) {
  const roomParticipant = room.participants.find(
    (entry) => entry.id === participant.id,
  );

  return (
    roomParticipant !== undefined &&
    roomParticipant.displayName === participant.displayName &&
    roomParticipant.role === participant.role &&
    roomParticipant.userId === participant.userId
  );
}

function isMultiplayerRoomEvent(
  value: unknown,
): value is MultiplayerRealtimeRoomEvent {
  if (!isRecord(value)) {
    return false;
  }

  const hasGameFields =
    value.gameId !== undefined ||
    value.gameSeq !== undefined ||
    value.matchId !== undefined;

  return (
    isOptionalGameId(value.gameId) &&
    (value.matchId === undefined || isPrivateRoomMatchId(value.matchId)) &&
    isOptionalSequence(value.gameSeq) &&
    (!hasGameFields ||
      (value.gameId !== undefined &&
        value.gameSeq !== undefined &&
        value.matchId !== undefined)) &&
    Object.hasOwn(value, "payload") &&
    isSequence(value.seq) &&
    isTrimmedString(value.type)
  );
}

function isMultiplayerRealtimeRejectionCode(
  value: unknown,
): value is MultiplayerRealtimeRejectionCode {
  switch (value) {
    case "duplicate-participant":
    case "duplicate-room":
    case "duplicate-seat":
    case "invalid-command":
    case "invalid-display-name":
    case "invalid-host":
    case "invalid-host-successor":
    case "invalid-message":
    case "invalid-observer-limit":
    case "invalid-participant":
    case "invalid-room-code":
    case "invalid-room-settings":
    case "invalid-seat":
    case "invalid-status":
    case "not-host":
    case "next-match-queue-full":
    case "observer-limit-reached":
    case "party-closed":
    case "participant-already-seated":
    case "participant-not-found":
    case "participant-not-seated":
    case "participant-unauthorized":
    case "protocol-version-mismatch":
    case "required-seats-empty":
    case "room-expired":
    case "room-not-found":
    case "seat-not-found":
    case "seat-occupied":
    case "stale-match":
    case "unsupported-game":
      return true;
    default:
      return false;
  }
}

function isPrivateRoomParticipantRole(value: unknown) {
  return value === "host" || value === "observer" || value === "player";
}

function isPrivateRoomStatus(value: unknown) {
  return (
    value === "finished" ||
    value === "lobby" ||
    value === "paused" ||
    value === "running"
  );
}

function isRoomCode(value: unknown, expectedRoomCode: string | undefined) {
  return (
    typeof value === "string" &&
    normalizePrivateRoomCode(value) === value &&
    (expectedRoomCode === undefined || value === expectedRoomCode)
  );
}

function isOptionalRoomCode(
  value: unknown,
  expectedRoomCode: string | undefined,
) {
  return value === undefined || isRoomCode(value, expectedRoomCode);
}

function isOptionalGameId(value: unknown) {
  return value === undefined || (typeof value === "string" && isGameId(value));
}

function isOptionalString(value: unknown) {
  return value === undefined || typeof value === "string";
}

function isOptionalEntityId(value: unknown) {
  return value === undefined || isEntityId(value);
}

function isOptionalParticipantCapability(value: unknown) {
  return (
    value === undefined ||
    (isTrimmedString(value) && value.length <= 512)
  );
}

function isEntityId(value: unknown) {
  return isTrimmedString(value);
}

function isTrimmedString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value
  );
}

function isOptionalSequence(value: unknown) {
  return value === undefined || isSequence(value);
}

function isSequence(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function isTimestamp(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
