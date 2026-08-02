import type { MultiplayerRoomSnapshot } from "@/lib/multiplayer/protocol";
import { isMultiplayerRoomSnapshot } from "@/lib/multiplayer/protocol-validation";
import {
  PARTY_INVITATION_INTENTS,
  PARTY_INVITATION_ID_PATTERN,
  PARTY_INVITATION_STATUSES,
  SOCIAL_USER_ID_PATTERN,
  type PartyInvitationIntent,
  type SocialAvailability,
  type SocialBlock,
  type SocialFriend,
  type SocialFriendRequest,
  type SocialOverview,
  type SocialPartyInvitation,
  type SocialRelationship,
  type SocialUserDiscovery,
} from "@/lib/social";
import {
  MAX_USER_DISPLAY_NAME_LENGTH,
  type AuthenticatedUser,
} from "@/lib/user-profile";

export const SOCIAL_API_PATH = "/api/social";
export const SOCIAL_DISCOVERY_API_PATH = `${SOCIAL_API_PATH}/discovery`;
export const SOCIAL_PRESENCE_API_PATH = `${SOCIAL_API_PATH}/presence`;
export const SOCIAL_FRIEND_REQUESTS_API_PATH =
  `${SOCIAL_API_PATH}/friend-requests`;
export const SOCIAL_FRIENDS_API_PATH = `${SOCIAL_API_PATH}/friends`;
export const SOCIAL_BLOCKS_API_PATH = `${SOCIAL_API_PATH}/blocks`;
export const SOCIAL_PARTY_INVITATIONS_API_PATH =
  `${SOCIAL_API_PATH}/party-invitations`;

export type SocialFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type SocialMutationSuccess = {
  success: true;
};

export type SocialFriendRequestCreation = SocialMutationSuccess & {
  created: boolean;
  request: SocialFriendRequest;
};

export type SocialFriendAcceptance = SocialMutationSuccess & {
  friend: SocialFriend;
};

export type SocialBlockCreation = SocialMutationSuccess & {
  block: SocialBlock;
  created: boolean;
};

export type SocialPartyInvitationCreation = {
  admissionRole: "observer" | "player";
  created: boolean;
  invitation: SocialPartyInvitation;
};

export type SocialPartyInvitationAcceptance = {
  admission: "admitted" | "reacquired";
  invitation: SocialPartyInvitation;
  participantCapability: string;
  participantId: string;
  snapshot: MultiplayerRoomSnapshot;
};

export type SocialPresenceState = "available" | "busy";

export type SocialPresenceUpdate = {
  availability: Exclude<SocialAvailability, "unknown">;
  changed: boolean;
};

type SocialClientErrorOptions = {
  cause?: unknown;
  code: string;
  message: string;
  retryAfterSeconds?: number | null;
  status: number;
};

export class SocialClientError extends Error {
  readonly code: string;
  readonly retryAfterSeconds: number | null;
  readonly status: number;

  constructor({
    cause,
    code,
    message,
    retryAfterSeconds = null,
    status,
  }: SocialClientErrorOptions) {
    super(message, { cause });
    this.name = "SocialClientError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
    this.status = status;
  }
}

type JsonRecord = Record<string, unknown>;
type PayloadParser<T> = (value: unknown) => T | null;

const SOCIAL_AVAILABILITIES = [
  "available",
  "busy",
  "in-party",
  "offline",
  "unknown",
] as const satisfies readonly SocialAvailability[];
const SOCIAL_RELATIONSHIPS = [
  "friends",
  "incoming-request",
  "none",
  "outgoing-request",
] as const satisfies readonly SocialRelationship[];
const HTTP_ERROR_CODE_PATTERN = /^[a-z0-9-]{1,80}$/;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const timestamp = Date.parse(value);

  return (
    Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
  );
}

function isMember<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && values.some((item) => item === value);
}

function parseArray<T>(value: unknown, parseItem: PayloadParser<T>) {
  if (!Array.isArray(value)) {
    return null;
  }

  const items: T[] = [];

  for (const item of value) {
    const parsedItem = parseItem(item);

    if (parsedItem === null) {
      return null;
    }

    items.push(parsedItem);
  }

  return items;
}

function parseAuthenticatedUser(value: unknown): AuthenticatedUser | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !SOCIAL_USER_ID_PATTERN.test(value.id) ||
    typeof value.displayName !== "string" ||
    value.displayName.length === 0 ||
    value.displayName.length > MAX_USER_DISPLAY_NAME_LENGTH ||
    value.displayName.trim() !== value.displayName
  ) {
    return null;
  }

  return {
    displayName: value.displayName,
    id: value.id,
  };
}

function parseSocialFriend(value: unknown): SocialFriend | null {
  if (
    !isRecord(value) ||
    !isMember(SOCIAL_AVAILABILITIES, value.availability) ||
    !isIsoTimestamp(value.friendsSince)
  ) {
    return null;
  }

  const user = parseAuthenticatedUser(value.user);

  return user === null
    ? null
    : {
        availability: value.availability,
        friendsSince: value.friendsSince,
        user,
      };
}

function parseSocialFriendRequest(value: unknown): SocialFriendRequest | null {
  if (
    !isRecord(value) ||
    !isIsoTimestamp(value.createdAt) ||
    (value.direction !== "incoming" && value.direction !== "outgoing")
  ) {
    return null;
  }

  const user = parseAuthenticatedUser(value.user);

  return user === null
    ? null
    : {
        createdAt: value.createdAt,
        direction: value.direction,
        user,
      };
}

function parseSocialBlock(value: unknown): SocialBlock | null {
  if (!isRecord(value) || !isIsoTimestamp(value.blockedAt)) {
    return null;
  }

  const user = parseAuthenticatedUser(value.user);

  return user === null
    ? null
    : {
        blockedAt: value.blockedAt,
        user,
      };
}

function parseSocialPartyInvitation(
  value: unknown,
): SocialPartyInvitation | null {
  if (
    !isRecord(value) ||
    !isIsoTimestamp(value.createdAt) ||
    !isIsoTimestamp(value.expiresAt) ||
    typeof value.id !== "string" ||
    !PARTY_INVITATION_ID_PATTERN.test(value.id) ||
    !isMember(PARTY_INVITATION_INTENTS, value.intent) ||
    !isMember(PARTY_INVITATION_STATUSES, value.status) ||
    !isIsoTimestamp(value.updatedAt) ||
    (value.resolvedAt !== null && !isIsoTimestamp(value.resolvedAt))
  ) {
    return null;
  }

  const inviter = parseAuthenticatedUser(value.inviter);
  const recipient = parseAuthenticatedUser(value.recipient);

  if (inviter === null || recipient === null) {
    return null;
  }

  return {
    createdAt: value.createdAt,
    expiresAt: value.expiresAt,
    id: value.id,
    intent: value.intent,
    inviter,
    recipient,
    resolvedAt: value.resolvedAt,
    status: value.status,
    updatedAt: value.updatedAt,
  };
}

function parsePendingInvitation(value: unknown) {
  const invitation = parseSocialPartyInvitation(value);

  return invitation?.status === "pending" && invitation.resolvedAt === null
    ? invitation
    : null;
}

function parseSocialOverviewPayload(value: unknown): SocialOverview | null {
  if (!isRecord(value) || !isRecord(value.overview)) {
    return null;
  }

  const blockedUsers = parseArray(
    value.overview.blockedUsers,
    parseSocialBlock,
  );
  const friends = parseArray(value.overview.friends, parseSocialFriend);
  const incomingFriendRequests = parseArray(
    value.overview.incomingFriendRequests,
    parseSocialFriendRequest,
  );
  const incomingPartyInvitations = parseArray(
    value.overview.incomingPartyInvitations,
    parsePendingInvitation,
  );
  const outgoingFriendRequests = parseArray(
    value.overview.outgoingFriendRequests,
    parseSocialFriendRequest,
  );
  const outgoingPartyInvitations = parseArray(
    value.overview.outgoingPartyInvitations,
    parsePendingInvitation,
  );

  if (
    blockedUsers === null ||
    friends === null ||
    incomingFriendRequests === null ||
    incomingPartyInvitations === null ||
    outgoingFriendRequests === null ||
    outgoingPartyInvitations === null ||
    incomingFriendRequests.some((request) => request.direction !== "incoming") ||
    outgoingFriendRequests.some((request) => request.direction !== "outgoing")
  ) {
    return null;
  }

  return {
    blockedUsers,
    friends,
    incomingFriendRequests,
    incomingPartyInvitations,
    outgoingFriendRequests,
    outgoingPartyInvitations,
  };
}

function parseSocialDiscoveryPayload(
  value: unknown,
): SocialUserDiscovery | null | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (value.discovery === null) {
    return null;
  }

  if (
    !isRecord(value.discovery) ||
    !isMember(SOCIAL_RELATIONSHIPS, value.discovery.relationship)
  ) {
    return undefined;
  }

  const user = parseAuthenticatedUser(value.discovery.user);

  return user === null
    ? undefined
    : {
        relationship: value.discovery.relationship,
        user,
      };
}

function parseSocialFriendRequestCreation(
  value: unknown,
): SocialFriendRequestCreation | null {
  if (
    !isRecord(value) ||
    value.success !== true ||
    typeof value.created !== "boolean"
  ) {
    return null;
  }

  const request = parseSocialFriendRequest(value.request);

  return request?.direction === "outgoing"
    ? { created: value.created, request, success: true }
    : null;
}

function parseSocialFriendAcceptance(
  value: unknown,
): SocialFriendAcceptance | null {
  if (!isRecord(value) || value.success !== true) {
    return null;
  }

  const friend = parseSocialFriend(value.friend);

  return friend === null ? null : { friend, success: true };
}

function parseSocialBlockCreation(value: unknown): SocialBlockCreation | null {
  if (
    !isRecord(value) ||
    value.success !== true ||
    typeof value.created !== "boolean"
  ) {
    return null;
  }

  const block = parseSocialBlock(value.block);

  return block === null
    ? null
    : { block, created: value.created, success: true };
}

function parseSocialMutationSuccess(
  value: unknown,
): SocialMutationSuccess | null {
  return isRecord(value) && value.success === true ? { success: true } : null;
}

function parseSocialPartyInvitationCreation(
  value: unknown,
): SocialPartyInvitationCreation | null {
  if (
    !isRecord(value) ||
    (value.admissionRole !== "observer" && value.admissionRole !== "player") ||
    typeof value.created !== "boolean"
  ) {
    return null;
  }

  const invitation = parsePendingInvitation(value.invitation);

  return invitation === null
    ? null
    : {
        admissionRole: value.admissionRole,
        created: value.created,
        invitation,
      };
}

function parseInvitationWithStatus(
  value: unknown,
  status: "canceled" | "declined",
) {
  if (!isRecord(value)) {
    return null;
  }

  const invitation = parseSocialPartyInvitation(value.invitation);

  return invitation?.status === status && invitation.resolvedAt !== null
    ? invitation
    : null;
}

function isCredential(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    value.trim() === value
  );
}

function parseSocialPartyInvitationAcceptance(
  value: unknown,
  expectedInvitationId: string,
): SocialPartyInvitationAcceptance | null {
  if (
    !isRecord(value) ||
    (value.admission !== "admitted" && value.admission !== "reacquired") ||
    !isCredential(value.participantCapability) ||
    !isCredential(value.participantId) ||
    !isMultiplayerRoomSnapshot(value.snapshot) ||
    value.snapshot.participant?.id !== value.participantId
  ) {
    return null;
  }

  const invitation = parseSocialPartyInvitation(value.invitation);

  return invitation?.id === expectedInvitationId &&
    invitation.status === "accepted" &&
    invitation.resolvedAt !== null &&
    value.snapshot.participant?.userId === invitation.recipient.id
    ? {
        admission: value.admission,
        invitation,
        participantCapability: value.participantCapability,
        participantId: value.participantId,
        snapshot: value.snapshot,
      }
    : null;
}

function parseSocialPresenceUpdate(value: unknown): SocialPresenceUpdate | null {
  if (
    !isRecord(value) ||
    (value.availability !== "available" &&
      value.availability !== "busy" &&
      value.availability !== "in-party" &&
      value.availability !== "offline") ||
    typeof value.changed !== "boolean"
  ) {
    return null;
  }

  return {
    availability: value.availability,
    changed: value.changed,
  };
}

function getRetryAfterSeconds(response: Response) {
  const value = response.headers.get("retry-after")?.trim();

  if (value === undefined || !/^\d+$/.test(value)) {
    return null;
  }

  const seconds = Number(value);

  return Number.isSafeInteger(seconds) ? seconds : null;
}

function createHttpError(response: Response, payload: unknown) {
  const code =
    isRecord(payload) &&
    typeof payload.code === "string" &&
    HTTP_ERROR_CODE_PATTERN.test(payload.code)
      ? payload.code
      : "http-error";
  const message =
    isRecord(payload) &&
    typeof payload.error === "string" &&
    payload.error.trim().length > 0
      ? payload.error
      : `Social request failed with status ${response.status}.`;

  return new SocialClientError({
    code,
    message,
    retryAfterSeconds: getRetryAfterSeconds(response),
    status: response.status,
  });
}

async function readResponsePayload(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

async function requestSocialPayload<T>(
  path: string,
  init: RequestInit,
  parsePayload: PayloadParser<T>,
  fetcher: SocialFetch,
) {
  let response: Response;

  try {
    response = await fetcher(path, {
      cache: "no-store",
      ...init,
      headers: {
        Accept: "application/json",
        ...init.headers,
      },
    });
  } catch (cause) {
    if (cause instanceof SocialClientError) {
      throw cause;
    }

    throw new SocialClientError({
      cause,
      code: "network-error",
      message: "The social service could not be reached.",
      status: 0,
    });
  }

  const payload = await readResponsePayload(response);

  if (!response.ok) {
    throw createHttpError(response, payload);
  }

  const parsedPayload = parsePayload(payload);

  if (parsedPayload === null) {
    throw new SocialClientError({
      code: "invalid-response",
      message: "The social service returned an invalid response.",
      status: response.status,
    });
  }

  return parsedPayload;
}

function jsonMutation(method: "DELETE" | "PATCH" | "POST", body: unknown) {
  return {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method,
  } satisfies RequestInit;
}

function pathWithId(path: string, id: string) {
  return `${path}/${encodeURIComponent(id)}`;
}

export function fetchSocialOverview(fetcher: SocialFetch = fetch) {
  return requestSocialPayload(
    SOCIAL_API_PATH,
    { method: "GET" },
    parseSocialOverviewPayload,
    fetcher,
  );
}

export async function discoverSocialUser(
  displayName: string,
  fetcher: SocialFetch = fetch,
): Promise<SocialUserDiscovery | null> {
  const query = new URLSearchParams({ displayName });
  const result = await requestSocialPayload(
    `${SOCIAL_DISCOVERY_API_PATH}?${query.toString()}`,
    { method: "GET" },
    (value) => {
      const discovery = parseSocialDiscoveryPayload(value);

      return discovery === undefined ? null : { discovery };
    },
    fetcher,
  );

  return result.discovery;
}

export function createSocialFriendRequest(
  userId: string,
  fetcher: SocialFetch = fetch,
) {
  return requestSocialPayload(
    SOCIAL_FRIEND_REQUESTS_API_PATH,
    jsonMutation("POST", { userId }),
    parseSocialFriendRequestCreation,
    fetcher,
  );
}

export function acceptSocialFriendRequest(
  userId: string,
  fetcher: SocialFetch = fetch,
) {
  return requestSocialPayload(
    pathWithId(SOCIAL_FRIEND_REQUESTS_API_PATH, userId),
    jsonMutation("PATCH", { decision: "accept" }),
    parseSocialFriendAcceptance,
    fetcher,
  );
}

export function declineSocialFriendRequest(
  userId: string,
  fetcher: SocialFetch = fetch,
) {
  return requestSocialPayload(
    pathWithId(SOCIAL_FRIEND_REQUESTS_API_PATH, userId),
    jsonMutation("PATCH", { decision: "decline" }),
    parseSocialMutationSuccess,
    fetcher,
  );
}

export function cancelSocialFriendRequest(
  userId: string,
  fetcher: SocialFetch = fetch,
) {
  return requestSocialPayload(
    pathWithId(SOCIAL_FRIEND_REQUESTS_API_PATH, userId),
    { method: "DELETE" },
    parseSocialMutationSuccess,
    fetcher,
  );
}

export function removeSocialFriend(
  userId: string,
  fetcher: SocialFetch = fetch,
) {
  return requestSocialPayload(
    pathWithId(SOCIAL_FRIENDS_API_PATH, userId),
    { method: "DELETE" },
    parseSocialMutationSuccess,
    fetcher,
  );
}

export function blockSocialUser(
  userId: string,
  fetcher: SocialFetch = fetch,
) {
  return requestSocialPayload(
    SOCIAL_BLOCKS_API_PATH,
    jsonMutation("POST", { userId }),
    parseSocialBlockCreation,
    fetcher,
  );
}

export function unblockSocialUser(
  userId: string,
  fetcher: SocialFetch = fetch,
) {
  return requestSocialPayload(
    pathWithId(SOCIAL_BLOCKS_API_PATH, userId),
    { method: "DELETE" },
    parseSocialMutationSuccess,
    fetcher,
  );
}

export function createSocialPartyInvitation(
  invitation: {
    intent: PartyInvitationIntent;
    partyCode: string;
    recipientUserId: string;
  },
  fetcher: SocialFetch = fetch,
) {
  return requestSocialPayload(
    SOCIAL_PARTY_INVITATIONS_API_PATH,
    jsonMutation("POST", invitation),
    parseSocialPartyInvitationCreation,
    fetcher,
  );
}

export function acceptSocialPartyInvitation(
  invitationId: string,
  fetcher: SocialFetch = fetch,
) {
  return requestSocialPayload(
    pathWithId(SOCIAL_PARTY_INVITATIONS_API_PATH, invitationId),
    jsonMutation("PATCH", { decision: "accept" }),
    (value) => parseSocialPartyInvitationAcceptance(value, invitationId),
    fetcher,
  );
}

export function declineSocialPartyInvitation(
  invitationId: string,
  fetcher: SocialFetch = fetch,
) {
  return requestSocialPayload(
    pathWithId(SOCIAL_PARTY_INVITATIONS_API_PATH, invitationId),
    jsonMutation("PATCH", { decision: "decline" }),
    (value) => parseInvitationWithStatus(value, "declined"),
    fetcher,
  );
}

export function cancelSocialPartyInvitation(
  invitationId: string,
  fetcher: SocialFetch = fetch,
) {
  return requestSocialPayload(
    pathWithId(SOCIAL_PARTY_INVITATIONS_API_PATH, invitationId),
    { method: "DELETE" },
    (value) => parseInvitationWithStatus(value, "canceled"),
    fetcher,
  );
}

export function renewSocialPresence(
  presence: {
    clientId: string;
    operationGeneration: number;
    state: SocialPresenceState;
  },
  fetcher: SocialFetch = fetch,
) {
  return requestSocialPayload(
    SOCIAL_PRESENCE_API_PATH,
    jsonMutation("POST", presence),
    parseSocialPresenceUpdate,
    fetcher,
  );
}

export function releaseSocialPresence(
  clientId: string,
  operationGeneration: number,
  fetcher: SocialFetch = fetch,
  options: { keepalive?: boolean } = {},
) {
  return requestSocialPayload(
    SOCIAL_PRESENCE_API_PATH,
    {
      ...jsonMutation("DELETE", { clientId, operationGeneration }),
      keepalive: options.keepalive,
    },
    parseSocialPresenceUpdate,
    fetcher,
  );
}
