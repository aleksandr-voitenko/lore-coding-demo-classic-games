import "server-only";

import {
  MULTIPLAYER_ROOM_PROTOCOL_PATH_SEGMENT,
  MULTIPLAYER_ROOM_PROTOCOL_VERSION,
  MULTIPLAYER_ROOM_PROTOCOL_VERSION_HEADER,
} from "../multiplayer/protocol";
import { isMultiplayerRoomSnapshot } from "../multiplayer/protocol-validation";
import {
  isPrivateRoomMatchId,
  normalizePrivateRoomCode,
} from "../multiplayer/room";
import {
  isPartyInvitationIntent,
  normalizeSocialUserId,
} from "../social";
import { normalizeUserDisplayName } from "../user-profile";

import {
  MAX_MULTIPLAYER_ACCOUNT_AVAILABILITY_USER_IDS,
  getMultiplayerAccountPartyErrorStatus,
  isMultiplayerAccountPartyFailureCode,
  type MultiplayerAccountPartyAuthority,
  type MultiplayerAccountPartyCommand,
  type MultiplayerAccountPartyFailure,
  type MultiplayerAccountPartyResult,
} from "./multiplayer-account-party";
import type { MultiplayerSocialEffectivePresenceState } from "./multiplayer-social-presence";

import type {
  CreateMultiplayerRoomOptions,
  MultiplayerRoomSnapshot,
  MultiplayerRoomStore,
  MultiplayerRoomStoreCommand,
  MultiplayerRoomStoreResult,
  MultiplayerRoomStoreSnapshotResult,
} from "./multiplayer-room-runtime";
import { isMultiplayerRoomStoreErrorCode } from "./multiplayer-room-runtime";

export const MULTIPLAYER_ROOM_SERVICE_URL_ENV = "MULTIPLAYER_ROOM_SERVICE_URL";
export const MULTIPLAYER_ROOM_SERVICE_CLIENT_BEARER_TOKEN_ENV =
  "MULTIPLAYER_ROOM_SERVICE_CLIENT_BEARER_TOKEN";

type MultiplayerRoomServiceClientOptions = {
  baseUrl: string;
  bearerToken?: string;
  fetcher?: typeof fetch;
};

type HttpMethod = "GET" | "POST";

type MultiplayerRoomServiceProtocolFailure = {
  code: "room-service-invalid-response" | "room-service-unavailable";
  error: string;
  success: false;
};

export class MultiplayerRoomServiceClient
  implements MultiplayerRoomStore, MultiplayerAccountPartyAuthority
{
  readonly #baseUrl: string;
  readonly #bearerToken: string | undefined;
  readonly #fetcher: typeof fetch;

  constructor({
    baseUrl,
    bearerToken,
    fetcher = fetch,
  }: MultiplayerRoomServiceClientOptions) {
    this.#baseUrl = normalizeMultiplayerRoomServiceBaseUrl(baseUrl);
    this.#bearerToken = getOptionalServiceString(bearerToken);
    this.#fetcher = fetcher;
  }

  async createRoom(
    options: CreateMultiplayerRoomOptions,
  ): Promise<MultiplayerRoomStoreSnapshotResult> {
    const protocolFailure = await this.#verifyMutationProtocol();

    if (protocolFailure !== null) {
      return protocolFailure;
    }

    return this.#requestSnapshot("POST", undefined, options);
  }

  async getRoom(roomCode: unknown): Promise<MultiplayerRoomStoreSnapshotResult> {
    const normalizedRoomCode = normalizePrivateRoomCode(roomCode);

    if (normalizedRoomCode === null) {
      return createServiceFailure(
        "invalid-room-code",
        "Room code is not supported.",
      );
    }

    return this.#requestSnapshot("GET", normalizedRoomCode);
  }

  async applyCommand(
    roomCode: unknown,
    command: MultiplayerRoomStoreCommand,
  ): Promise<MultiplayerRoomStoreResult> {
    const normalizedRoomCode = normalizePrivateRoomCode(roomCode);

    if (normalizedRoomCode === null) {
      return createServiceFailure(
        "invalid-room-code",
        "Room code is not supported.",
      );
    }

    const protocolFailure = await this.#verifyMutationProtocol();

    if (protocolFailure !== null) {
      return protocolFailure;
    }

    return this.#request("POST", normalizedRoomCode, command);
  }

  async applyAccountCommand(
    command: MultiplayerAccountPartyCommand,
  ): Promise<MultiplayerAccountPartyResult> {
    const protocolFailure = await this.#verifyMutationProtocol();

    if (protocolFailure !== null) {
      return protocolFailure;
    }

    const url = `${this.#baseUrl}/${MULTIPLAYER_ROOM_PROTOCOL_PATH_SEGMENT}/_accounts`;
    let response: Response;

    try {
      response = await this.#fetcher(url, {
        body: JSON.stringify(command),
        headers: this.#getHeaders(true, true),
        method: "POST",
      });
    } catch (error) {
      return createAccountServiceFailure(
        "room-service-unavailable",
        `Room service account request failed for POST ${url}: ${getErrorMessage(
          error,
        )}`,
      );
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      return createAccountServiceFailure(
        "room-service-invalid-response",
        `Room service returned ${response.status} without a valid JSON account result.`,
      );
    }

    const result = parseMultiplayerAccountPartyServiceResult(payload, command);

    const expectedStatus =
      result === null
        ? null
        : result.success
          ? 200
          : getMultiplayerAccountPartyErrorStatus(result.code);

    return result !== null && response.status === expectedStatus
      ? result
      : createAccountServiceFailure(
        "room-service-invalid-response",
        `Room service returned ${response.status} with an invalid account result.`,
      );
  }

  async #verifyMutationProtocol(): Promise<
    MultiplayerRoomServiceProtocolFailure | null
  > {
    let response: Response;

    try {
      response = await this.#fetcher(this.#baseUrl, {
        headers: this.#getHeaders(false, false),
        method: "GET",
      });
    } catch (error) {
      return createProtocolServiceFailure(
        "room-service-unavailable",
        `Room service protocol check failed for GET ${this.#baseUrl}: ${getErrorMessage(
          error,
        )}`,
      );
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      return createProtocolServiceFailure(
        "room-service-invalid-response",
        `Room service protocol check returned ${response.status} without valid JSON.`,
      );
    }

    if (
      !isRecord(payload) ||
      response.status !== 200 ||
      payload.mutationPathSegment !==
        MULTIPLAYER_ROOM_PROTOCOL_PATH_SEGMENT ||
      payload.protocolVersion !== MULTIPLAYER_ROOM_PROTOCOL_VERSION ||
      payload.participantCapabilities !== true ||
      payload.accountPartyMemberships !== true ||
      payload.authenticatedAdmission !== true ||
      payload.membershipOnlyReacquisition !== true ||
      payload.sequencedSocialPresenceOperations !== true ||
      payload.socialPresenceLeases !== true
    ) {
      return createProtocolServiceFailure(
        "room-service-invalid-response",
        `Room service protocol check returned ${response.status} without account authority protocol version ${MULTIPLAYER_ROOM_PROTOCOL_VERSION}.`,
      );
    }

    return null;
  }

  async #request(
    method: HttpMethod,
    roomCode: string | undefined,
    body?: unknown,
  ): Promise<MultiplayerRoomStoreResult> {
    const url = this.#getRequestUrl(roomCode, method === "POST");
    let response: Response;

    try {
      response = await this.#fetcher(url, {
        body: body === undefined ? undefined : JSON.stringify(body),
        headers: this.#getHeaders(body !== undefined, method === "POST"),
        method,
      });
    } catch (error) {
      return createServiceFailure(
        "room-service-unavailable",
        `Room service request failed for ${method} ${url}: ${getErrorMessage(
          error,
        )}`,
      );
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      return createServiceFailure(
        "room-service-invalid-response",
        `Room service returned ${response.status} without a valid JSON room result.`,
      );
    }

    const result = parseMultiplayerRoomServiceResult(payload);

    if (result === null) {
      return createServiceFailure(
        "room-service-invalid-response",
        `Room service returned ${response.status} with an invalid room result.`,
      );
    }

    return result;
  }

  async #requestSnapshot(
    method: HttpMethod,
    roomCode: string | undefined,
    body?: unknown,
  ): Promise<MultiplayerRoomStoreSnapshotResult> {
    const result = await this.#request(method, roomCode, body);

    return result.success && result.outcome === "party-closed"
      ? createServiceFailure(
          "room-service-invalid-response",
          "Room service returned a party-closed outcome for a snapshot request.",
        )
      : result;
  }

  #getRequestUrl(roomCode: string | undefined, mutation: boolean) {
    const baseUrl = mutation
      ? `${this.#baseUrl}/${MULTIPLAYER_ROOM_PROTOCOL_PATH_SEGMENT}`
      : this.#baseUrl;

    return roomCode === undefined
      ? baseUrl
      : `${baseUrl}/${encodeURIComponent(roomCode)}`;
  }

  #getHeaders(hasBody: boolean, includeProtocolVersion: boolean) {
    const headers: Record<string, string> = {
      accept: "application/json",
    };

    if (hasBody) {
      headers["content-type"] = "application/json";
    }

    if (includeProtocolVersion) {
      headers[MULTIPLAYER_ROOM_PROTOCOL_VERSION_HEADER] = String(
        MULTIPLAYER_ROOM_PROTOCOL_VERSION,
      );
    }

    if (this.#bearerToken !== undefined) {
      headers.authorization = `Bearer ${this.#bearerToken}`;
    }

    return headers;
  }
}

export function normalizeMultiplayerRoomServiceBaseUrl(value: string) {
  const trimmedValue = getOptionalServiceString(value);

  if (trimmedValue === undefined) {
    throw new Error(`${MULTIPLAYER_ROOM_SERVICE_URL_ENV} must not be empty.`);
  }

  let url: URL;

  try {
    url = new URL(trimmedValue);
  } catch {
    throw new Error(`${MULTIPLAYER_ROOM_SERVICE_URL_ENV} must be an absolute URL.`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(
      `${MULTIPLAYER_ROOM_SERVICE_URL_ENV} must use http or https.`,
    );
  }

  if (url.username !== "" || url.password !== "") {
    throw new Error(
      `${MULTIPLAYER_ROOM_SERVICE_URL_ENV} must not include credentials.`,
    );
  }

  if (url.search !== "" || url.hash !== "") {
    throw new Error(
      `${MULTIPLAYER_ROOM_SERVICE_URL_ENV} must not include query or fragment.`,
    );
  }

  const pathname = url.pathname.replace(/\/+$/, "");

  return `${url.origin}${pathname === "" ? "" : pathname}`;
}

export function getOptionalServiceString(value: string | undefined) {
  const trimmedValue = value?.trim();

  return trimmedValue === undefined || trimmedValue.length === 0
    ? undefined
    : trimmedValue;
}

function parseMultiplayerRoomServiceResult(
  value: unknown,
): MultiplayerRoomStoreResult | null {
  if (!isRecord(value) || typeof value.success !== "boolean") {
    return null;
  }

  if (value.success) {
    if (value.outcome === "party-closed") {
      const reason = value.reason;
      const roomCode = value.roomCode;

      if (
        !isEntityId(value.departedParticipantId) ||
        !isPrivateRoomMatchId(value.matchId) ||
        typeof reason !== "string" ||
        typeof roomCode !== "string" ||
        normalizePrivateRoomCode(roomCode) !== roomCode ||
        !isSequence(value.seq)
      ) {
        return null;
      }

      return {
        departedParticipantId: value.departedParticipantId,
        matchId: value.matchId,
        outcome: "party-closed",
        reason,
        roomCode,
        seq: value.seq,
        success: true,
      };
    }

    if (
      value.outcome !== "snapshot" ||
      !isMultiplayerRoomSnapshot(value.snapshot) ||
      !isOptionalEntityId(value.departedParticipantId) ||
      !isOptionalParticipantCapability(value.participantCapability) ||
      (value.participantCapability !== undefined &&
        value.snapshot.participant === undefined)
    ) {
      return null;
    }

    return {
      ...(value.departedParticipantId === undefined
        ? {}
        : { departedParticipantId: value.departedParticipantId }),
      outcome: "snapshot",
      ...(value.participantCapability === undefined
        ? {}
        : { participantCapability: value.participantCapability }),
      snapshot: value.snapshot as MultiplayerRoomSnapshot,
      success: true,
    };
  }

  if (
    isMultiplayerRoomStoreErrorCode(value.code) &&
    typeof value.error === "string"
  ) {
    return {
      code: value.code,
      error: value.error,
      success: false,
    };
  }

  return null;
}

function parseMultiplayerAccountPartyServiceResult(
  value: unknown,
  command: MultiplayerAccountPartyCommand,
): MultiplayerAccountPartyResult | null {
  if (!isRecord(value) || typeof value.success !== "boolean") {
    return null;
  }

  if (!value.success) {
    return isMultiplayerAccountPartyFailureCode(value.code) &&
      typeof value.error === "string"
      ? {
          code: value.code,
          error: value.error,
          success: false,
        }
      : null;
  }

  if (value.outcome === "presence") {
    return (command.type === "presence.renew" ||
      command.type === "presence.release") &&
      isMultiplayerSocialEffectivePresenceState(value.availability) &&
      typeof value.changed === "boolean"
      ? {
          availability: value.availability,
          changed: value.changed,
          outcome: "presence",
          success: true,
        }
      : null;
  }

  if (value.outcome === "availability") {
    const availabilities = parseMultiplayerAccountAvailabilities(
      value.availabilities,
    );
    const requestedUserIds =
      command.type === "presence.resolve"
        ? parseRequestedMultiplayerAccountUserIds(command.userIds)
        : null;

    return command.type === "presence.resolve" &&
      availabilities !== null &&
      requestedUserIds !== null &&
      requestedUserIds.length === availabilities.length &&
      requestedUserIds.every(
        (userId, index) => availabilities[index]?.userId === userId,
      )
      ? {
          availabilities,
          outcome: "availability",
          success: true,
        }
      : null;
  }

  if (value.outcome === "invitation-eligibility") {
    if (
      command.type !== "party.inspectInvitation" ||
      typeof value.eligible !== "boolean" ||
      !isOptionalAdmissionRole(value.admissionRole) ||
      !isOptionalInvitationIneligibilityReason(value.reason)
    ) {
      return null;
    }

    const hasEligibleShape =
      value.eligible && value.admissionRole !== null && value.reason === null;
    const hasIneligibleShape =
      !value.eligible && value.admissionRole === null && value.reason !== null;

    return hasEligibleShape || hasIneligibleShape
      ? {
          admissionRole: value.admissionRole,
          eligible: value.eligible,
          outcome: "invitation-eligibility",
          reason: value.reason,
          success: true,
        }
      : null;
  }

  if (value.outcome === "admission") {
    const isAdmissionCommand = command.type === "party.admitAuthenticated";
    const isReacquisitionCommand =
      command.type === "party.reacquireAuthenticated";

    if (
      (!isAdmissionCommand && !isReacquisitionCommand) ||
      (isAdmissionCommand && !isPartyInvitationIntent(command.intent)) ||
      (value.admission !== "admitted" && value.admission !== "reacquired") ||
      (isReacquisitionCommand && value.admission !== "reacquired") ||
      !isEntityId(value.participantId) ||
      !isParticipantCapability(value.participantCapability) ||
      !isMultiplayerRoomSnapshot(value.snapshot)
    ) {
      return null;
    }

    const partyCode = normalizePrivateRoomCode(command.partyCode);
    const user = normalizeAuthenticatedAccountUser(command.user);
    const participant = value.snapshot.participant;

    if (
      partyCode === null ||
      user === null ||
      value.snapshot.room.code !== partyCode ||
      participant?.id !== value.participantId ||
      participant.userId !== user.id ||
      participant.displayName !== user.displayName ||
      (isAdmissionCommand &&
        value.admission === "admitted" &&
        participant.role !== "observer" &&
        (command.intent !== "play" || participant.role !== "player"))
    ) {
      return null;
    }

    return {
      admission: value.admission,
      outcome: "admission",
      participantCapability: value.participantCapability,
      participantId: value.participantId,
      snapshot: value.snapshot as MultiplayerRoomSnapshot,
      success: true,
    };
  }

  if (value.outcome === "departure") {
    if (
      command.type !== "party.compensateAdmission" ||
      typeof value.departed !== "boolean" ||
      value.partyClosed !== undefined ||
      !isOptionalEntityId(value.departedParticipantId) ||
      (value.snapshot !== undefined &&
        !isMultiplayerRoomSnapshot(value.snapshot))
    ) {
      return null;
    }

    const userId = normalizeSocialUserId(command.userId);
    const participantId = normalizeAccountParticipantId(command.participantId);
    const partyCode = normalizePrivateRoomCode(command.partyCode);
    const participantCapability = isParticipantCapability(
      command.participantCapability,
    )
      ? command.participantCapability
      : null;
    const hasDepartureShape =
      value.departed &&
      value.departedParticipantId === participantId &&
      value.snapshot !== undefined &&
      value.snapshot.room.code === partyCode &&
      !value.snapshot.room.participants.some(
        (participant) => participant.id === participantId,
      );
    const hasAlreadyAbsentShape =
      !value.departed &&
      value.departedParticipantId === undefined &&
      value.snapshot === undefined;

    if (
      userId === null ||
      participantId === null ||
      partyCode === null ||
      participantCapability === null ||
      (!hasDepartureShape && !hasAlreadyAbsentShape)
    ) {
      return null;
    }

    return {
      departed: value.departed,
      ...(value.departedParticipantId === undefined
        ? {}
        : { departedParticipantId: value.departedParticipantId }),
      outcome: "departure",
      ...(value.snapshot === undefined
        ? {}
        : { snapshot: value.snapshot as MultiplayerRoomSnapshot }),
      success: true,
    };
  }

  return null;
}

function parseMultiplayerAccountAvailabilities(
  value: unknown,
): Array<{
  availability: MultiplayerSocialEffectivePresenceState;
  userId: string;
}> | null {
  if (
    !Array.isArray(value) ||
    value.length > MAX_MULTIPLAYER_ACCOUNT_AVAILABILITY_USER_IDS
  ) {
    return null;
  }

  const seenUserIds = new Set<string>();
  const availabilities: Array<{
    availability: MultiplayerSocialEffectivePresenceState;
    userId: string;
  }> = [];

  for (const entry of value) {
    if (!isRecord(entry)) {
      return null;
    }

    const userId = normalizeSocialUserId(entry.userId);

    if (
      userId === null ||
      userId !== entry.userId ||
      seenUserIds.has(userId) ||
      !isMultiplayerSocialEffectivePresenceState(entry.availability)
    ) {
      return null;
    }

    seenUserIds.add(userId);
    availabilities.push({
      availability: entry.availability,
      userId,
    });
  }

  return availabilities;
}

function parseRequestedMultiplayerAccountUserIds(value: unknown) {
  if (
    !Array.isArray(value) ||
    value.length > MAX_MULTIPLAYER_ACCOUNT_AVAILABILITY_USER_IDS
  ) {
    return null;
  }

  const userIds: string[] = [];
  const seenUserIds = new Set<string>();

  for (const userIdValue of value) {
    const userId = normalizeSocialUserId(userIdValue);

    if (userId === null) {
      return null;
    }

    if (!seenUserIds.has(userId)) {
      seenUserIds.add(userId);
      userIds.push(userId);
    }
  }

  return userIds;
}

function normalizeAuthenticatedAccountUser(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const id = normalizeSocialUserId(value.id);
  const displayName = normalizeUserDisplayName(value.displayName);

  return id === null || displayName.length === 0 ? null : { displayName, id };
}

function normalizeAccountParticipantId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const participantId = value.trim();

  return /^[a-zA-Z0-9-]{1,80}$/.test(participantId)
    ? participantId
    : null;
}

function isMultiplayerSocialEffectivePresenceState(
  value: unknown,
): value is MultiplayerSocialEffectivePresenceState {
  return (
    value === "available" ||
    value === "busy" ||
    value === "in-party" ||
    value === "offline"
  );
}

function isOptionalAdmissionRole(
  value: unknown,
): value is "observer" | "player" | null {
  return value === null || value === "observer" || value === "player";
}

function isOptionalInvitationIneligibilityReason(
  value: unknown,
): value is
  | "party-full"
  | "recipient-busy"
  | "recipient-in-party"
  | "recipient-offline"
  | null {
  return (
    value === null ||
    value === "party-full" ||
    value === "recipient-busy" ||
    value === "recipient-in-party" ||
    value === "recipient-offline"
  );
}

function isEntityId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

function isOptionalEntityId(value: unknown): value is string | undefined {
  return value === undefined || isEntityId(value);
}

function isSequence(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isOptionalParticipantCapability(
  value: unknown,
): value is string | undefined {
  return (
    value === undefined ||
    (typeof value === "string" &&
      value.length > 0 &&
      value.length <= 512 &&
      value.trim() === value)
  );
}

function isParticipantCapability(value: unknown): value is string {
  return isOptionalParticipantCapability(value) && value !== undefined;
}

function createServiceFailure(
  code: Extract<MultiplayerRoomStoreResult, { success: false }>["code"],
  error: string,
): Extract<MultiplayerRoomStoreResult, { success: false }> {
  return {
    code,
    error,
    success: false,
  };
}

function createAccountServiceFailure(
  code: MultiplayerAccountPartyFailure["code"],
  error: string,
): MultiplayerAccountPartyFailure {
  return {
    code,
    error,
    success: false,
  };
}

function createProtocolServiceFailure(
  code: MultiplayerRoomServiceProtocolFailure["code"],
  error: string,
): MultiplayerRoomServiceProtocolFailure {
  return {
    code,
    error,
    success: false,
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
