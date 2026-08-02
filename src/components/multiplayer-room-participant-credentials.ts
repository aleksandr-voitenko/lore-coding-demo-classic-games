import { normalizePrivateRoomCode } from "@/lib/multiplayer/room";

export type MultiplayerRoomParticipantCredentials = {
  participantCapability: string;
  participantId: string;
  userId: string | null;
};

const PARTICIPANT_CREDENTIAL_STORAGE_PREFIX =
  "classic-games.multiplayer-participant.v1";

export function readMultiplayerRoomParticipantCredentials(
  roomCode: string,
  userId: string | null,
  storage = getSessionStorage(),
) {
  const storageKey = getParticipantCredentialStorageKey(roomCode);

  if (storage === null || storageKey === null) {
    return null;
  }

  try {
    const serializedCredentials = storage.getItem(storageKey);

    if (serializedCredentials === null) {
      return null;
    }

    const credentials = parseParticipantCredentials(
      JSON.parse(serializedCredentials) as unknown,
    );

    if (credentials === null || credentials.userId !== userId) {
      storage.removeItem(storageKey);
      return null;
    }

    return credentials;
  } catch {
    try {
      storage.removeItem(storageKey);
    } catch {
      // Storage cleanup is best-effort when browser privacy policy denies access.
    }
    return null;
  }
}

export function writeMultiplayerRoomParticipantCredentials(
  roomCode: string,
  credentials: MultiplayerRoomParticipantCredentials,
  storage = getSessionStorage(),
) {
  const storageKey = getParticipantCredentialStorageKey(roomCode);

  if (
    storage === null ||
    storageKey === null ||
    parseParticipantCredentials(credentials) === null
  ) {
    return false;
  }

  try {
    storage.setItem(storageKey, JSON.stringify(credentials));
    return true;
  } catch {
    return false;
  }
}

export function removeMultiplayerRoomParticipantCredentials(
  roomCode: string,
  storage = getSessionStorage(),
) {
  const storageKey = getParticipantCredentialStorageKey(roomCode);

  if (storage === null || storageKey === null) {
    return;
  }

  try {
    storage.removeItem(storageKey);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

function getParticipantCredentialStorageKey(roomCode: string) {
  const normalizedRoomCode = normalizePrivateRoomCode(roomCode);

  return normalizedRoomCode === null
    ? null
    : `${PARTICIPANT_CREDENTIAL_STORAGE_PREFIX}:${normalizedRoomCode}`;
}

function parseParticipantCredentials(
  value: unknown,
): MultiplayerRoomParticipantCredentials | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const credentials = value as Record<string, unknown>;
  const participantCapability = normalizeCredentialString(
    credentials.participantCapability,
    512,
  );
  const participantId = normalizeCredentialString(credentials.participantId, 512);
  let userId: string | null;

  if (credentials.userId === null) {
    userId = null;
  } else {
    const normalizedUserId = normalizeCredentialString(credentials.userId, 512);

    if (normalizedUserId === null) {
      return null;
    }

    userId = normalizedUserId;
  }

  if (
    participantCapability === null ||
    participantId === null
  ) {
    return null;
  }

  return {
    participantCapability,
    participantId,
    userId,
  };
}

function normalizeCredentialString(value: unknown, maxLength: number) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxLength ||
    value.trim() !== value
  ) {
    return null;
  }

  return value;
}

function getSessionStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}
