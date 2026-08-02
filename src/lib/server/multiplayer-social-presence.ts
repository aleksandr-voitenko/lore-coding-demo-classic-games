import { normalizePrivateRoomCode } from "../multiplayer/room";
import { normalizeSocialUserId } from "../social";

export const DEFAULT_MULTIPLAYER_SOCIAL_PRESENCE_LEASE_TTL_MS = 45_000;
export const DEFAULT_MULTIPLAYER_SOCIAL_PRESENCE_MAX_LEASES_PER_ACCOUNT = 16;

export const MULTIPLAYER_SOCIAL_BROWSER_PRESENCE_STATES = [
  "available",
  "busy",
] as const;

export type MultiplayerSocialBrowserPresenceState =
  (typeof MULTIPLAYER_SOCIAL_BROWSER_PRESENCE_STATES)[number];

export type MultiplayerSocialEffectivePresenceState =
  | "available"
  | "busy"
  | "in-party"
  | "offline";

export type MultiplayerSocialPresenceLease = {
  clientId: string;
  expiresAtMs: number;
  state: MultiplayerSocialBrowserPresenceState;
  userId: string;
};

export type MultiplayerSocialPartyMembership = {
  participantId: string;
  roomCode: string;
  userId: string;
};

export type MultiplayerSocialPresenceSnapshot = {
  activeLeaseCount: number;
  membership: MultiplayerSocialPartyMembership | null;
  state: MultiplayerSocialEffectivePresenceState;
  userId: string;
};

export type MultiplayerSocialPresenceFailureCode =
  | "in-other-party"
  | "invalid-client-id"
  | "invalid-participant-id"
  | "invalid-presence-state"
  | "invalid-room-code"
  | "invalid-user-id"
  | "lease-capacity-reached"
  | "participant-conflict";

export type MultiplayerSocialPresenceFailure = {
  code: MultiplayerSocialPresenceFailureCode;
  error: string;
  success: false;
};

export type MultiplayerSocialPresenceLeaseResult =
  | {
      created: boolean;
      lease: MultiplayerSocialPresenceLease;
      success: true;
    }
  | MultiplayerSocialPresenceFailure;

export type MultiplayerSocialPresenceLeaseReleaseResult =
  | {
      released: boolean;
      success: true;
    }
  | MultiplayerSocialPresenceFailure;

export type MultiplayerSocialPartyMembershipSetResult =
  | {
      changed: boolean;
      membership: MultiplayerSocialPartyMembership;
      success: true;
    }
  | MultiplayerSocialPresenceFailure;

export type MultiplayerSocialPartyMembershipClearResult =
  | {
      cleared: boolean;
      success: true;
    }
  | MultiplayerSocialPresenceFailure;

export type MultiplayerSocialRoomMembershipsClearResult =
  | {
      clearedMemberships: MultiplayerSocialPartyMembership[];
      success: true;
    }
  | MultiplayerSocialPresenceFailure;

export type MultiplayerSocialPresenceRegistryOptions = {
  getNowMs?: () => number;
  leaseTtlMs?: number;
  maxLeasesPerAccount?: number;
};

export type RenewMultiplayerSocialPresenceLeaseOptions = {
  clientId: unknown;
  state: unknown;
  userId: unknown;
};

export type ReleaseMultiplayerSocialPresenceLeaseOptions = {
  clientId: unknown;
  userId: unknown;
};

export type SetMultiplayerSocialPartyMembershipOptions = {
  participantId: unknown;
  roomCode: unknown;
  userId: unknown;
};

const MULTIPLAYER_SOCIAL_PRESENCE_CLIENT_ID_PATTERN =
  /^[a-zA-Z0-9_-]{16,128}$/;
const MULTIPLAYER_SOCIAL_PARTICIPANT_ID_PATTERN = /^[a-zA-Z0-9-]{1,80}$/;

type StoredPresenceLease = Omit<MultiplayerSocialPresenceLease, "userId">;

function createPresenceFailure(
  code: MultiplayerSocialPresenceFailureCode,
  error: string,
): MultiplayerSocialPresenceFailure {
  return { code, error, success: false };
}

function createDefaultNowMs() {
  return Date.now();
}

function normalizePositiveInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
}

function normalizeParticipantId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const participantId = value.trim();

  return MULTIPLAYER_SOCIAL_PARTICIPANT_ID_PATTERN.test(participantId)
    ? participantId
    : null;
}

function cloneMembership(
  membership: MultiplayerSocialPartyMembership,
): MultiplayerSocialPartyMembership {
  return { ...membership };
}

function normalizePartyMembership({
  participantId: participantIdValue,
  roomCode: roomCodeValue,
  userId: userIdValue,
}: SetMultiplayerSocialPartyMembershipOptions):
  | { membership: MultiplayerSocialPartyMembership; success: true }
  | MultiplayerSocialPresenceFailure {
  const userId = normalizeSocialUserId(userIdValue);

  if (userId === null) {
    return createPresenceFailure(
      "invalid-user-id",
      "Party membership requires a supported account identifier.",
    );
  }

  const roomCode = normalizePrivateRoomCode(roomCodeValue);

  if (roomCode === null) {
    return createPresenceFailure(
      "invalid-room-code",
      "Party membership requires a supported room code.",
    );
  }

  const participantId = normalizeParticipantId(participantIdValue);

  if (participantId === null) {
    return createPresenceFailure(
      "invalid-participant-id",
      "Party membership requires a supported participant identifier.",
    );
  }

  return {
    membership: { participantId, roomCode, userId },
    success: true,
  };
}

export function normalizeMultiplayerSocialPresenceClientId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const clientId = value.trim();

  return MULTIPLAYER_SOCIAL_PRESENCE_CLIENT_ID_PATTERN.test(clientId)
    ? clientId
    : null;
}

export function isMultiplayerSocialBrowserPresenceState(
  value: unknown,
): value is MultiplayerSocialBrowserPresenceState {
  return MULTIPLAYER_SOCIAL_BROWSER_PRESENCE_STATES.some(
    (state) => state === value,
  );
}

/**
 * Owns process-local browser presence leases and authoritative party membership.
 * No value in this registry is suitable for persistence across sidecar restarts.
 */
export class MultiplayerSocialPresenceRegistry {
  readonly #getCurrentTimeMs: () => number;
  readonly #leaseTtlMs: number;
  readonly #leasesByUserId = new Map<string, Map<string, StoredPresenceLease>>();
  readonly #maxLeasesPerAccount: number;
  readonly #membershipsByUserId = new Map<
    string,
    MultiplayerSocialPartyMembership
  >();

  constructor({
    getNowMs = createDefaultNowMs,
    leaseTtlMs = DEFAULT_MULTIPLAYER_SOCIAL_PRESENCE_LEASE_TTL_MS,
    maxLeasesPerAccount =
      DEFAULT_MULTIPLAYER_SOCIAL_PRESENCE_MAX_LEASES_PER_ACCOUNT,
  }: MultiplayerSocialPresenceRegistryOptions = {}) {
    this.#getCurrentTimeMs = getNowMs;
    this.#leaseTtlMs = normalizePositiveInteger(
      leaseTtlMs,
      "Social presence lease TTL",
    );
    this.#maxLeasesPerAccount = normalizePositiveInteger(
      maxLeasesPerAccount,
      "Social presence lease capacity",
    );
  }

  renewLease({
    clientId: clientIdValue,
    state: stateValue,
    userId: userIdValue,
  }: RenewMultiplayerSocialPresenceLeaseOptions): MultiplayerSocialPresenceLeaseResult {
    const userId = normalizeSocialUserId(userIdValue);

    if (userId === null) {
      return createPresenceFailure(
        "invalid-user-id",
        "Presence leases require a supported account identifier.",
      );
    }

    const clientId = normalizeMultiplayerSocialPresenceClientId(clientIdValue);

    if (clientId === null) {
      return createPresenceFailure(
        "invalid-client-id",
        "Presence leases require a 16 to 128 character client identifier.",
      );
    }

    if (!isMultiplayerSocialBrowserPresenceState(stateValue)) {
      return createPresenceFailure(
        "invalid-presence-state",
        "Browser presence must be available or busy.",
      );
    }

    const nowMs = this.#getNowMs();

    this.#pruneUserLeases(userId, nowMs);

    let leasesByClientId = this.#leasesByUserId.get(userId);
    const created = leasesByClientId?.has(clientId) !== true;

    if (
      created &&
      (leasesByClientId?.size ?? 0) >= this.#maxLeasesPerAccount
    ) {
      return createPresenceFailure(
        "lease-capacity-reached",
        "This account has reached its active presence lease limit.",
      );
    }

    const expiresAtMs = nowMs + this.#leaseTtlMs;

    if (!Number.isSafeInteger(expiresAtMs)) {
      throw new Error("Social presence lease expiry must be a safe integer.");
    }

    if (leasesByClientId === undefined) {
      leasesByClientId = new Map();
      this.#leasesByUserId.set(userId, leasesByClientId);
    }

    const storedLease = {
      clientId,
      expiresAtMs,
      state: stateValue,
    } satisfies StoredPresenceLease;

    leasesByClientId.set(clientId, storedLease);

    return {
      created,
      lease: { ...storedLease, userId },
      success: true,
    };
  }

  releaseLease({
    clientId: clientIdValue,
    userId: userIdValue,
  }: ReleaseMultiplayerSocialPresenceLeaseOptions): MultiplayerSocialPresenceLeaseReleaseResult {
    const userId = normalizeSocialUserId(userIdValue);

    if (userId === null) {
      return createPresenceFailure(
        "invalid-user-id",
        "Presence leases require a supported account identifier.",
      );
    }

    const clientId = normalizeMultiplayerSocialPresenceClientId(clientIdValue);

    if (clientId === null) {
      return createPresenceFailure(
        "invalid-client-id",
        "Presence leases require a 16 to 128 character client identifier.",
      );
    }

    const leasesByClientId = this.#leasesByUserId.get(userId);

    if (leasesByClientId === undefined) {
      return { released: false, success: true };
    }

    this.#pruneUserLeases(userId, this.#getNowMs());

    const activeLeasesByClientId = this.#leasesByUserId.get(userId);

    if (activeLeasesByClientId === undefined) {
      return { released: false, success: true };
    }

    const released = activeLeasesByClientId.delete(clientId);

    if (activeLeasesByClientId.size === 0) {
      this.#leasesByUserId.delete(userId);
    }

    return { released, success: true };
  }

  setPartyMembership({
    participantId,
    roomCode,
    userId,
  }: SetMultiplayerSocialPartyMembershipOptions): MultiplayerSocialPartyMembershipSetResult {
    const normalizedResult = normalizePartyMembership({
      participantId,
      roomCode,
      userId,
    });

    if (!normalizedResult.success) {
      return normalizedResult;
    }

    const { membership } = normalizedResult;
    const existingMembership = this.#membershipsByUserId.get(membership.userId);

    if (existingMembership !== undefined) {
      if (
        existingMembership.roomCode === membership.roomCode &&
        existingMembership.participantId === membership.participantId
      ) {
        return {
          changed: false,
          membership: cloneMembership(existingMembership),
          success: true,
        };
      }

      if (existingMembership.roomCode !== membership.roomCode) {
        return createPresenceFailure(
          "in-other-party",
          "This account already belongs to another party.",
        );
      }

      return createPresenceFailure(
        "participant-conflict",
        "This account already has another participant in this party.",
      );
    }

    this.#membershipsByUserId.set(membership.userId, membership);

    return {
      changed: true,
      membership: cloneMembership(membership),
      success: true,
    };
  }

  clearPartyMembership({
    participantId,
    roomCode,
    userId,
  }: SetMultiplayerSocialPartyMembershipOptions): MultiplayerSocialPartyMembershipClearResult {
    const normalizedResult = normalizePartyMembership({
      participantId,
      roomCode,
      userId,
    });

    if (!normalizedResult.success) {
      return normalizedResult;
    }

    const { membership } = normalizedResult;
    const existingMembership = this.#membershipsByUserId.get(membership.userId);
    const cleared =
      existingMembership?.roomCode === membership.roomCode &&
      existingMembership.participantId === membership.participantId;

    if (cleared) {
      this.#membershipsByUserId.delete(membership.userId);
    }

    return { cleared, success: true };
  }

  clearPartyMembershipsForRoom(
    roomCodeValue: unknown,
  ): MultiplayerSocialRoomMembershipsClearResult {
    const roomCode = normalizePrivateRoomCode(roomCodeValue);

    if (roomCode === null) {
      return createPresenceFailure(
        "invalid-room-code",
        "Party membership requires a supported room code.",
      );
    }

    const clearedMemberships: MultiplayerSocialPartyMembership[] = [];

    for (const [userId, membership] of this.#membershipsByUserId) {
      if (membership.roomCode === roomCode) {
        this.#membershipsByUserId.delete(userId);
        clearedMemberships.push(cloneMembership(membership));
      }
    }

    return { clearedMemberships, success: true };
  }

  getPresence(userIdValue: unknown): MultiplayerSocialPresenceSnapshot | null {
    const userId = normalizeSocialUserId(userIdValue);

    if (userId === null) {
      return null;
    }

    this.#pruneUserLeases(userId, this.#getNowMs());

    const leasesByClientId = this.#leasesByUserId.get(userId);
    const membership = this.#membershipsByUserId.get(userId) ?? null;
    let state: MultiplayerSocialEffectivePresenceState = "offline";

    if (membership !== null) {
      state = "in-party";
    } else if (
      leasesByClientId !== undefined &&
      [...leasesByClientId.values()].some((lease) => lease.state === "busy")
    ) {
      state = "busy";
    } else if (leasesByClientId !== undefined) {
      state = "available";
    }

    return {
      activeLeaseCount: leasesByClientId?.size ?? 0,
      membership: membership === null ? null : cloneMembership(membership),
      state,
      userId,
    };
  }

  getEffectiveState(
    userIdValue: unknown,
  ): MultiplayerSocialEffectivePresenceState | null {
    return this.getPresence(userIdValue)?.state ?? null;
  }

  getPartyMembership(
    userIdValue: unknown,
  ): MultiplayerSocialPartyMembership | null {
    const userId = normalizeSocialUserId(userIdValue);
    const membership =
      userId === null ? undefined : this.#membershipsByUserId.get(userId);

    return membership === undefined ? null : cloneMembership(membership);
  }

  getPartyMembershipsForRoom(
    roomCodeValue: unknown,
  ): MultiplayerSocialPartyMembership[] | null {
    const roomCode = normalizePrivateRoomCode(roomCodeValue);

    if (roomCode === null) {
      return null;
    }

    return [...this.#membershipsByUserId.values()]
      .filter((membership) => membership.roomCode === roomCode)
      .map((membership) => cloneMembership(membership));
  }

  pruneExpiredLeases() {
    const nowMs = this.#getNowMs();
    let prunedLeaseCount = 0;

    for (const userId of this.#leasesByUserId.keys()) {
      prunedLeaseCount += this.#pruneUserLeases(userId, nowMs);
    }

    return prunedLeaseCount;
  }

  #getNowMs() {
    const nowMs = this.#getCurrentTimeMs();

    if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
      throw new Error(
        "Social presence clock must return a non-negative safe integer.",
      );
    }

    return nowMs;
  }

  #pruneUserLeases(userId: string, nowMs: number) {
    const leasesByClientId = this.#leasesByUserId.get(userId);

    if (leasesByClientId === undefined) {
      return 0;
    }

    let prunedLeaseCount = 0;

    for (const [clientId, lease] of leasesByClientId) {
      if (lease.expiresAtMs <= nowMs) {
        leasesByClientId.delete(clientId);
        prunedLeaseCount += 1;
      }
    }

    if (leasesByClientId.size === 0) {
      this.#leasesByUserId.delete(userId);
    }

    return prunedLeaseCount;
  }
}
