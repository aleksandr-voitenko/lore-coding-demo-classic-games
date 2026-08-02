import "server-only";

import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

import { normalizePrivateRoomCode } from "@/lib/multiplayer/room";
import {
  getCanonicalSocialUserPair,
  isPartyInvitationIntent,
  normalizePartyInvitationId,
  normalizeSocialUserId,
  type PartyInvitationIntent,
  type PartyInvitationStatus,
  type SocialBlock,
  type SocialFriend,
  type SocialFriendRequest,
  type SocialOverview,
  type SocialPartyInvitation,
  type SocialRelationship,
  type SocialUserDiscovery,
} from "@/lib/social";
import {
  createUserDisplayNameKey,
  normalizeUserDisplayName,
  type AuthenticatedUser,
} from "@/lib/user-profile";

import {
  initializeAppSchema,
  prepareSqliteDatabasePath,
  type SqliteDatabase,
} from "./sqlite-app-schema";
import { getUserProfileSqlitePath } from "./sqlite-user-profile-store";

type CreateSqliteSocialStoreOptions = {
  acceptanceClaimTtlMs?: number;
  acceptanceRecoveryGraceMs?: number;
  createAcceptanceClaimToken?: () => string;
  createId?: () => string;
  databasePath: string;
  maxIncomingFriendRequestsPerUser?: number;
  maxOutgoingFriendRequestsPerUser?: number;
  maxPendingPartyInvitationsPerInviter?: number;
  maxPendingPartyInvitationsPerRecipient?: number;
  maxResolvedPartyInvitationHistory?: number;
  now?: () => Date;
  partyInvitationTtlMs?: number;
};

export type CreatePartyInvitationOptions = {
  intent: unknown;
  inviterUserId: unknown;
  partyCode: unknown;
  recipientUserId: unknown;
};

export type SocialStoreFailureReason =
  | "already-friends"
  | "blocked"
  | "duplicate-party-invitation"
  | "friend-request-not-incoming"
  | "friend-request-not-outgoing"
  | "friend-request-not-found"
  | "incoming-request-exists"
  | "invalid-display-name"
  | "invalid-invitation-id"
  | "invalid-invitation-intent"
  | "invalid-party-code"
  | "invalid-rate-limit-action"
  | "invalid-user-id"
  | "friend-request-limit-reached"
  | "not-friends"
  | "party-invitation-expired"
  | "party-invitation-acceptance-in-progress"
  | "party-invitation-claim-conflict"
  | "party-invitation-id-conflict"
  | "party-invitation-limit-reached"
  | "party-invitation-not-found"
  | "party-invitation-not-pending"
  | "user-not-found";

export type SocialStoreFailure = {
  reason: SocialStoreFailureReason;
  success: false;
};

export type SocialDiscoveryResult =
  | {
      discovery: SocialUserDiscovery | null;
      success: true;
    }
  | SocialStoreFailure;

export type SocialOverviewResult =
  | {
      overview: SocialOverview;
      success: true;
    }
  | SocialStoreFailure;

export type FriendRequestMutationResult =
  | {
      created: boolean;
      request: SocialFriendRequest;
      success: true;
    }
  | SocialStoreFailure;

export type FriendshipMutationResult =
  | {
      friend: SocialFriend;
      success: true;
    }
  | SocialStoreFailure;

export type SocialBlockMutationResult =
  | {
      block: SocialBlock;
      created: boolean;
      success: true;
    }
  | SocialStoreFailure;

export type SocialMutationResult =
  | {
      success: true;
    }
  | SocialStoreFailure;

export type SocialPartyInvitationRecord = SocialPartyInvitation & {
  // A room code is sufficient for the guest-link join path. Keep it inside the
  // authenticated admission boundary and never serialize this record as an
  // invitation notification or social overview.
  partyCode: string;
};

export type PartyInvitationMutationResult =
  | {
      invitation: SocialPartyInvitationRecord;
      success: true;
    }
  | SocialStoreFailure;

export type PartyInvitationCreationResult =
  | {
      created: boolean;
      invitation: SocialPartyInvitationRecord;
      success: true;
    }
  | SocialStoreFailure;

export type PartyInvitationAcceptanceClaimResult =
  | {
      claimExpiresAt: string;
      claimToken: string;
      invitation: SocialPartyInvitationRecord;
      success: true;
    }
  | SocialStoreFailure;

export type PartyInvitationAcceptanceReleaseResult =
  | {
      released: boolean;
      success: true;
    }
  | SocialStoreFailure;

export type PartyInvitationLookupResult = PartyInvitationMutationResult;

export type PartyInvitationReconciliationLookupResult =
  | {
      invitations: SocialPartyInvitationRecord[];
      success: true;
    }
  | SocialStoreFailure;

export type PartyInvitationPartyRevocationResult =
  | {
      revokedCount: number;
      success: true;
    }
  | SocialStoreFailure;

export type SocialApiRateLimitAction =
  | "discovery"
  | "friend-request"
  | "party-invitation";

export type SocialApiRateLimitResult =
  | {
      allowed: boolean;
      remaining: number;
      resetAt: string;
      retryAfterSeconds: number;
      success: true;
    }
  | SocialStoreFailure;

type UserRow = {
  displayName: string;
  id: string;
};

type DiscoveryRow = UserRow & {
  relationship: SocialRelationship;
};

type FriendRow = UserRow & {
  friendsSince: string;
};

type FriendRequestRow = UserRow & {
  createdAt: string;
  direction: "incoming" | "outgoing";
};

type FriendRequestRecordRow = {
  createdAt: string;
  requesterUserId: string;
};

type BlockRow = UserRow & {
  blockedAt: string;
};

type PartyInvitationRow = {
  createdAt: string;
  expiresAt: string;
  id: string;
  intent: PartyInvitationIntent;
  inviterDisplayName: string;
  inviterUserId: string;
  partyCode: string;
  recipientDisplayName: string;
  recipientUserId: string;
  resolvedAt: string | null;
  status: PartyInvitationStatus;
  updatedAt: string;
};

type PairParameters = {
  userAId: string;
  userBId: string;
};

type ActorTargetParameters = PairParameters & {
  actorUserId: string;
  targetUserId: string;
};

const PARTY_INVITATION_SELECT = `
  SELECT
    party_invitations.id,
    party_invitations.party_code AS partyCode,
    party_invitations.inviter_user_id AS inviterUserId,
    inviter.display_name AS inviterDisplayName,
    party_invitations.recipient_user_id AS recipientUserId,
    recipient.display_name AS recipientDisplayName,
    party_invitations.intent,
    party_invitations.status,
    party_invitations.created_at AS createdAt,
    party_invitations.updated_at AS updatedAt,
    party_invitations.expires_at AS expiresAt,
    party_invitations.resolved_at AS resolvedAt
  FROM party_invitations
  INNER JOIN users AS inviter ON inviter.id = party_invitations.inviter_user_id
  INNER JOIN users AS recipient ON recipient.id = party_invitations.recipient_user_id
`;

export const DEFAULT_PARTY_INVITATION_TTL_MS = 5 * 60 * 1000;
export const DEFAULT_PARTY_INVITATION_ACCEPTANCE_CLAIM_TTL_MS = 30_000;
export const DEFAULT_PARTY_INVITATION_ACCEPTANCE_RECOVERY_GRACE_MS =
  2 * 60 * 1000;
export const DEFAULT_MAX_INCOMING_FRIEND_REQUESTS_PER_USER = 100;
export const DEFAULT_MAX_OUTGOING_FRIEND_REQUESTS_PER_USER = 100;
export const DEFAULT_MAX_PENDING_PARTY_INVITATIONS_PER_INVITER = 20;
export const DEFAULT_MAX_PENDING_PARTY_INVITATIONS_PER_RECIPIENT = 20;
export const DEFAULT_MAX_RESOLVED_PARTY_INVITATION_HISTORY = 1_000;
export const SOCIAL_API_RATE_LIMITS = {
  discovery: { limit: 30, windowMs: 60_000 },
  "friend-request": { limit: 10, windowMs: 60_000 },
  "party-invitation": { limit: 20, windowMs: 60_000 },
} as const satisfies Record<
  SocialApiRateLimitAction,
  { limit: number; windowMs: number }
>;

function createFailure(reason: SocialStoreFailureReason): SocialStoreFailure {
  return { reason, success: false };
}

function normalizePositiveSafeInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer.`);
  }

  return value;
}

function toAuthenticatedUser(row: UserRow): AuthenticatedUser {
  return {
    displayName: row.displayName,
    id: row.id,
  };
}

function toSocialFriend(row: FriendRow): SocialFriend {
  return {
    availability: "unknown",
    friendsSince: row.friendsSince,
    user: toAuthenticatedUser(row),
  };
}

function toSocialFriendRequest(row: FriendRequestRow): SocialFriendRequest {
  return {
    createdAt: row.createdAt,
    direction: row.direction,
    user: toAuthenticatedUser(row),
  };
}

function toSocialBlock(row: BlockRow): SocialBlock {
  return {
    blockedAt: row.blockedAt,
    user: toAuthenticatedUser(row),
  };
}

function toSocialPartyInvitation(row: PartyInvitationRow): SocialPartyInvitation {
  return {
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    id: row.id,
    intent: row.intent,
    inviter: {
      displayName: row.inviterDisplayName,
      id: row.inviterUserId,
    },
    recipient: {
      displayName: row.recipientDisplayName,
      id: row.recipientUserId,
    },
    resolvedAt: row.resolvedAt,
    status: row.status,
    updatedAt: row.updatedAt,
  };
}

function toSocialPartyInvitationRecord(
  row: PartyInvitationRow,
): SocialPartyInvitationRecord {
  return {
    ...toSocialPartyInvitation(row),
    partyCode: row.partyCode,
  };
}

export class SqliteSocialStore {
  readonly #acceptanceClaimTtlMs: number;
  readonly #acceptanceRecoveryGraceMs: number;
  readonly #createAcceptanceClaimToken: () => string;
  readonly #createId: () => string;
  readonly #database: SqliteDatabase;
  readonly #maxIncomingFriendRequestsPerUser: number;
  readonly #maxOutgoingFriendRequestsPerUser: number;
  readonly #maxPendingPartyInvitationsPerInviter: number;
  readonly #maxPendingPartyInvitationsPerRecipient: number;
  readonly #maxResolvedPartyInvitationHistory: number;
  readonly #now: () => Date;
  readonly #partyInvitationTtlMs: number;

  constructor({
    acceptanceClaimTtlMs = DEFAULT_PARTY_INVITATION_ACCEPTANCE_CLAIM_TTL_MS,
    acceptanceRecoveryGraceMs =
      DEFAULT_PARTY_INVITATION_ACCEPTANCE_RECOVERY_GRACE_MS,
    createAcceptanceClaimToken = randomUUID,
    createId = randomUUID,
    databasePath,
    maxIncomingFriendRequestsPerUser =
      DEFAULT_MAX_INCOMING_FRIEND_REQUESTS_PER_USER,
    maxOutgoingFriendRequestsPerUser =
      DEFAULT_MAX_OUTGOING_FRIEND_REQUESTS_PER_USER,
    maxPendingPartyInvitationsPerInviter =
      DEFAULT_MAX_PENDING_PARTY_INVITATIONS_PER_INVITER,
    maxPendingPartyInvitationsPerRecipient =
      DEFAULT_MAX_PENDING_PARTY_INVITATIONS_PER_RECIPIENT,
    maxResolvedPartyInvitationHistory =
      DEFAULT_MAX_RESOLVED_PARTY_INVITATION_HISTORY,
    now = () => new Date(),
    partyInvitationTtlMs = DEFAULT_PARTY_INVITATION_TTL_MS,
  }: CreateSqliteSocialStoreOptions) {
    const normalizedAcceptanceClaimTtlMs = normalizePositiveSafeInteger(
      acceptanceClaimTtlMs,
      "Party invitation acceptance claim TTL",
    );
    const normalizedAcceptanceRecoveryGraceMs = normalizePositiveSafeInteger(
      acceptanceRecoveryGraceMs,
      "Party invitation acceptance recovery grace",
    );
    const normalizedMaxIncomingFriendRequestsPerUser =
      normalizePositiveSafeInteger(
        maxIncomingFriendRequestsPerUser,
        "Incoming friend request limit",
      );
    const normalizedMaxOutgoingFriendRequestsPerUser =
      normalizePositiveSafeInteger(
        maxOutgoingFriendRequestsPerUser,
        "Outgoing friend request limit",
      );
    const normalizedMaxPendingPartyInvitationsPerInviter =
      normalizePositiveSafeInteger(
        maxPendingPartyInvitationsPerInviter,
        "Pending party invitation inviter limit",
      );
    const normalizedMaxPendingPartyInvitationsPerRecipient =
      normalizePositiveSafeInteger(
        maxPendingPartyInvitationsPerRecipient,
        "Pending party invitation recipient limit",
      );
    const normalizedMaxResolvedPartyInvitationHistory =
      normalizePositiveSafeInteger(
        maxResolvedPartyInvitationHistory,
        "Resolved party invitation history limit",
      );
    const normalizedPartyInvitationTtlMs = normalizePositiveSafeInteger(
      partyInvitationTtlMs,
      "Party invitation TTL",
    );

    this.#acceptanceClaimTtlMs = normalizedAcceptanceClaimTtlMs;
    this.#acceptanceRecoveryGraceMs = normalizedAcceptanceRecoveryGraceMs;
    this.#createAcceptanceClaimToken = createAcceptanceClaimToken;
    this.#createId = createId;
    this.#maxIncomingFriendRequestsPerUser =
      normalizedMaxIncomingFriendRequestsPerUser;
    this.#maxOutgoingFriendRequestsPerUser =
      normalizedMaxOutgoingFriendRequestsPerUser;
    this.#maxPendingPartyInvitationsPerInviter =
      normalizedMaxPendingPartyInvitationsPerInviter;
    this.#maxPendingPartyInvitationsPerRecipient =
      normalizedMaxPendingPartyInvitationsPerRecipient;
    this.#maxResolvedPartyInvitationHistory =
      normalizedMaxResolvedPartyInvitationHistory;
    this.#now = now;
    this.#partyInvitationTtlMs = normalizedPartyInvitationTtlMs;
    this.#database = new Database(prepareSqliteDatabasePath(databasePath));

    initializeAppSchema(this.#database);
  }

  close() {
    this.#database.close();
  }

  async consumeSocialApiRateLimit(
    userIdValue: unknown,
    actionValue: unknown,
  ): Promise<SocialApiRateLimitResult> {
    const userId = normalizeSocialUserId(userIdValue);
    const action =
      actionValue === "discovery" ||
      actionValue === "friend-request" ||
      actionValue === "party-invitation"
        ? actionValue
        : null;

    if (userId === null) {
      return createFailure("invalid-user-id");
    }

    if (action === null) {
      return createFailure("invalid-rate-limit-action");
    }

    return this.#database.transaction((): SocialApiRateLimitResult => {
      if (!this.#isCanonicalUser(userId)) {
        return createFailure("user-not-found");
      }

      const configuration = SOCIAL_API_RATE_LIMITS[action];
      const now = this.#now();
      const nowMs = now.getTime();
      const existing = this.#database
        .prepare<{ action: SocialApiRateLimitAction; userId: string }>(`
          SELECT
            window_started_at AS windowStartedAt,
            request_count AS requestCount
          FROM social_api_rate_limits
          WHERE user_id = @userId
            AND action = @action
        `)
        .get({ action, userId }) as
        | { requestCount: number; windowStartedAt: string }
        | undefined;
      const existingStartedAtMs =
        existing === undefined ? 0 : Date.parse(existing.windowStartedAt);
      const shouldReset =
        existing === undefined ||
        !Number.isFinite(existingStartedAtMs) ||
        nowMs >= existingStartedAtMs + configuration.windowMs;

      if (shouldReset) {
        const windowStartedAt = now.toISOString();

        this.#database
          .prepare<{
            action: SocialApiRateLimitAction;
            userId: string;
            windowStartedAt: string;
          }>(`
            INSERT INTO social_api_rate_limits (
              user_id,
              action,
              window_started_at,
              request_count
            )
            VALUES (@userId, @action, @windowStartedAt, 1)
            ON CONFLICT (user_id, action) DO UPDATE SET
              window_started_at = excluded.window_started_at,
              request_count = 1
          `)
          .run({ action, userId, windowStartedAt });

        return {
          allowed: true,
          remaining: configuration.limit - 1,
          resetAt: new Date(nowMs + configuration.windowMs).toISOString(),
          retryAfterSeconds: 0,
          success: true,
        };
      }

      const resetAtMs = existingStartedAtMs + configuration.windowMs;

      if (existing.requestCount >= configuration.limit) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(resetAtMs).toISOString(),
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((resetAtMs - nowMs) / 1000),
          ),
          success: true,
        };
      }

      this.#database
        .prepare<{
          action: SocialApiRateLimitAction;
          userId: string;
        }>(`
          UPDATE social_api_rate_limits
          SET request_count = request_count + 1
          WHERE user_id = @userId
            AND action = @action
        `)
        .run({ action, userId });

      return {
        allowed: true,
        remaining: configuration.limit - existing.requestCount - 1,
        resetAt: new Date(resetAtMs).toISOString(),
        retryAfterSeconds: 0,
        success: true,
      };
    }).immediate();
  }

  async discoverUser(
    actorUserIdValue: unknown,
    displayNameValue: unknown,
  ): Promise<SocialDiscoveryResult> {
    const actorUserId = normalizeSocialUserId(actorUserIdValue);
    const displayName = normalizeUserDisplayName(displayNameValue);

    if (actorUserId === null) {
      return createFailure("invalid-user-id");
    }

    if (displayName.length === 0) {
      return createFailure("invalid-display-name");
    }

    if (!this.#isCanonicalUser(actorUserId)) {
      return createFailure("user-not-found");
    }

    const row = this.#database
      .prepare<{
        actorUserId: string;
        displayNameKey: string;
      }>(`
        SELECT
          target.id,
          target.display_name AS displayName,
          CASE
            WHEN friendships.user_a_id IS NOT NULL THEN 'friends'
            WHEN friend_requests.requester_user_id = @actorUserId THEN 'outgoing-request'
            WHEN friend_requests.requester_user_id = target.id THEN 'incoming-request'
            ELSE 'none'
          END AS relationship
        FROM users AS target
        LEFT JOIN friendships
          ON friendships.user_a_id = MIN(@actorUserId, target.id)
          AND friendships.user_b_id = MAX(@actorUserId, target.id)
        LEFT JOIN friend_requests
          ON friend_requests.user_a_id = MIN(@actorUserId, target.id)
          AND friend_requests.user_b_id = MAX(@actorUserId, target.id)
        WHERE target.display_name_key = @displayNameKey
          AND target.id <> @actorUserId
          AND target.password_hash IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM user_blocks
            WHERE (
              blocker_user_id = @actorUserId
              AND blocked_user_id = target.id
            ) OR (
              blocker_user_id = target.id
              AND blocked_user_id = @actorUserId
            )
          )
      `)
      .get({
        actorUserId,
        displayNameKey: createUserDisplayNameKey(displayName),
      }) as DiscoveryRow | undefined;

    return {
      discovery:
        row === undefined
          ? null
          : {
              relationship: row.relationship,
              user: toAuthenticatedUser(row),
            },
      success: true,
    };
  }

  async getOverview(actorUserIdValue: unknown): Promise<SocialOverviewResult> {
    const actorUserId = normalizeSocialUserId(actorUserIdValue);

    if (actorUserId === null) {
      return createFailure("invalid-user-id");
    }

    return this.#database.transaction((): SocialOverviewResult => {
      if (!this.#isCanonicalUser(actorUserId)) {
        return createFailure("user-not-found");
      }

      const now = this.#now().toISOString();
      this.#expirePendingInvitationsForActor(actorUserId, now);

      const friends = this.#database
        .prepare<{ actorUserId: string }>(`
          SELECT
            other.id,
            other.display_name AS displayName,
            friendships.created_at AS friendsSince
          FROM friendships
          INNER JOIN users AS other
            ON other.id = CASE
              WHEN friendships.user_a_id = @actorUserId THEN friendships.user_b_id
              ELSE friendships.user_a_id
            END
          WHERE friendships.user_a_id = @actorUserId
            OR friendships.user_b_id = @actorUserId
          ORDER BY other.display_name_key ASC, other.id ASC
        `)
        .all({ actorUserId }) as FriendRow[];
      const requests = this.#database
        .prepare<{ actorUserId: string }>(`
          SELECT
            other.id,
            other.display_name AS displayName,
            friend_requests.created_at AS createdAt,
            CASE
              WHEN friend_requests.requester_user_id = @actorUserId THEN 'outgoing'
              ELSE 'incoming'
            END AS direction
          FROM friend_requests
          INNER JOIN users AS other
            ON other.id = CASE
              WHEN friend_requests.user_a_id = @actorUserId THEN friend_requests.user_b_id
              ELSE friend_requests.user_a_id
            END
          WHERE friend_requests.user_a_id = @actorUserId
            OR friend_requests.user_b_id = @actorUserId
          ORDER BY friend_requests.created_at DESC, other.id ASC
        `)
        .all({ actorUserId }) as FriendRequestRow[];
      const blocks = this.#database
        .prepare<{ actorUserId: string }>(`
          SELECT
            blocked.id,
            blocked.display_name AS displayName,
            user_blocks.created_at AS blockedAt
          FROM user_blocks
          INNER JOIN users AS blocked ON blocked.id = user_blocks.blocked_user_id
          WHERE user_blocks.blocker_user_id = @actorUserId
          ORDER BY user_blocks.created_at DESC, blocked.id ASC
        `)
        .all({ actorUserId }) as BlockRow[];
      const invitations = this.#database
        .prepare<{ actorUserId: string }>(`
          ${PARTY_INVITATION_SELECT}
          WHERE party_invitations.status = 'pending'
            AND (
              party_invitations.inviter_user_id = @actorUserId
              OR party_invitations.recipient_user_id = @actorUserId
            )
          ORDER BY party_invitations.created_at DESC, party_invitations.id ASC
        `)
        .all({ actorUserId }) as PartyInvitationRow[];

      this.#pruneResolvedPartyInvitationHistory();

      return {
        overview: {
          blockedUsers: blocks.map(toSocialBlock),
          friends: friends.map(toSocialFriend),
          incomingFriendRequests: requests
            .filter((request) => request.direction === "incoming")
            .map(toSocialFriendRequest),
          incomingPartyInvitations: invitations
            .filter((invitation) => invitation.recipientUserId === actorUserId)
            .map(toSocialPartyInvitation),
          outgoingFriendRequests: requests
            .filter((request) => request.direction === "outgoing")
            .map(toSocialFriendRequest),
          outgoingPartyInvitations: invitations
            .filter((invitation) => invitation.inviterUserId === actorUserId)
            .map(toSocialPartyInvitation),
        },
        success: true,
      };
    }).immediate();
  }

  async getPendingPartyInvitationsForReconciliation(
    actorUserIdValue: unknown,
  ): Promise<PartyInvitationReconciliationLookupResult> {
    const actorUserId = normalizeSocialUserId(actorUserIdValue);

    if (actorUserId === null) {
      return createFailure("invalid-user-id");
    }

    return this.#database.transaction(
      (): PartyInvitationReconciliationLookupResult => {
        if (!this.#isCanonicalUser(actorUserId)) {
          return createFailure("user-not-found");
        }

        const now = this.#now().toISOString();
        this.#expirePendingInvitationsForActor(actorUserId, now);
        const rows = this.#database
          .prepare<{ actorUserId: string }>(`
            ${PARTY_INVITATION_SELECT}
            WHERE party_invitations.status = 'pending'
              AND (
                party_invitations.inviter_user_id = @actorUserId
                OR party_invitations.recipient_user_id = @actorUserId
              )
            ORDER BY party_invitations.created_at DESC, party_invitations.id ASC
          `)
          .all({ actorUserId }) as PartyInvitationRow[];

        this.#pruneResolvedPartyInvitationHistory();

        return {
          invitations: rows.map(toSocialPartyInvitationRecord),
          success: true,
        };
      },
    ).immediate();
  }

  async createFriendRequest(
    actorUserIdValue: unknown,
    targetUserIdValue: unknown,
  ): Promise<FriendRequestMutationResult> {
    const pair = this.#normalizeActorTarget(actorUserIdValue, targetUserIdValue);

    if (!pair.success) {
      return pair.failure;
    }

    const result = this.#database.transaction((): FriendRequestMutationResult => {
      const validationFailure = this.#validateCanonicalUsers(pair.actorUserId, pair.targetUserId);

      if (validationFailure !== null) {
        return validationFailure;
      }

      if (this.#isPairBlocked(pair)) {
        return createFailure("blocked");
      }

      if (this.#friendshipExists(pair)) {
        return createFailure("already-friends");
      }

      const existingRequest = this.#getFriendRequestRecord(pair);

      if (existingRequest !== null) {
        if (existingRequest.requesterUserId !== pair.actorUserId) {
          return createFailure("incoming-request-exists");
        }

        return {
          created: false,
          request: {
            createdAt: existingRequest.createdAt,
            direction: "outgoing",
            user: this.#getCanonicalUser(pair.targetUserId) as AuthenticatedUser,
          },
          success: true,
        };
      }

      if (this.#hasReachedFriendRequestLimit(pair)) {
        return createFailure("friend-request-limit-reached");
      }

      const createdAt = this.#now().toISOString();

      this.#database
        .prepare<ActorTargetParameters & { createdAt: string }>(`
          INSERT INTO friend_requests (
            user_a_id,
            user_b_id,
            requester_user_id,
            created_at
          )
          SELECT
            @userAId,
            @userBId,
            @actorUserId,
            @createdAt
          WHERE EXISTS (
            SELECT 1
            FROM users AS actor
            INNER JOIN users AS target ON target.id = @targetUserId
            WHERE actor.id = @actorUserId
              AND actor.password_hash IS NOT NULL
              AND target.password_hash IS NOT NULL
          )
            AND NOT EXISTS (
              SELECT 1
              FROM user_blocks
              WHERE (
                blocker_user_id = @actorUserId
                AND blocked_user_id = @targetUserId
              ) OR (
                blocker_user_id = @targetUserId
                AND blocked_user_id = @actorUserId
              )
            )
            AND NOT EXISTS (
              SELECT 1
              FROM friendships
              WHERE user_a_id = @userAId
                AND user_b_id = @userBId
            )
        `)
        .run({ ...pair, createdAt });

      const request = this.#getFriendRequestRecord(pair);

      if (request === null || request.requesterUserId !== pair.actorUserId) {
        if (this.#isPairBlocked(pair)) {
          return createFailure("blocked");
        }

        if (this.#friendshipExists(pair)) {
          return createFailure("already-friends");
        }

        return createFailure("incoming-request-exists");
      }

      return {
        created: true,
        request: {
          createdAt: request.createdAt,
          direction: "outgoing",
          user: this.#getCanonicalUser(pair.targetUserId) as AuthenticatedUser,
        },
        success: true,
      };
    }).immediate();

    return result;
  }

  async acceptFriendRequest(
    actorUserIdValue: unknown,
    requesterUserIdValue: unknown,
  ): Promise<FriendshipMutationResult> {
    const pair = this.#normalizeActorTarget(actorUserIdValue, requesterUserIdValue);

    if (!pair.success) {
      return pair.failure;
    }

    return this.#database.transaction((): FriendshipMutationResult => {
      const validationFailure = this.#validateCanonicalUsers(pair.actorUserId, pair.targetUserId);

      if (validationFailure !== null) {
        return validationFailure;
      }

      if (this.#isPairBlocked(pair)) {
        return createFailure("blocked");
      }

      const request = this.#getFriendRequestRecord(pair);

      if (request === null) {
        const existingFriend = this.#getFriendship(pair, pair.targetUserId);

        return existingFriend === null
          ? createFailure("friend-request-not-found")
          : { friend: existingFriend, success: true };
      }

      if (request.requesterUserId !== pair.targetUserId) {
        return createFailure("friend-request-not-incoming");
      }

      const createdAt = this.#now().toISOString();
      const insertResult = this.#database
        .prepare<ActorTargetParameters & { createdAt: string }>(`
          INSERT OR IGNORE INTO friendships (user_a_id, user_b_id, created_at)
          SELECT @userAId, @userBId, @createdAt
          WHERE EXISTS (
            SELECT 1
            FROM friend_requests
            WHERE user_a_id = @userAId
              AND user_b_id = @userBId
              AND requester_user_id = @targetUserId
          )
            AND NOT EXISTS (
              SELECT 1
              FROM user_blocks
              WHERE (
                blocker_user_id = @actorUserId
                AND blocked_user_id = @targetUserId
              ) OR (
                blocker_user_id = @targetUserId
                AND blocked_user_id = @actorUserId
              )
            )
        `)
        .run({ ...pair, createdAt });

      if (insertResult.changes === 0) {
        if (this.#isPairBlocked(pair)) {
          return createFailure("blocked");
        }

        const existingFriend = this.#getFriendship(pair, pair.targetUserId);

        return existingFriend === null
          ? createFailure("friend-request-not-found")
          : { friend: existingFriend, success: true };
      }

      this.#deleteFriendRequest(pair, pair.targetUserId);

      return {
        friend: {
          availability: "unknown",
          friendsSince: createdAt,
          user: this.#getCanonicalUser(pair.targetUserId) as AuthenticatedUser,
        },
        success: true,
      };
    }).immediate();
  }

  async declineFriendRequest(
    actorUserIdValue: unknown,
    requesterUserIdValue: unknown,
  ): Promise<SocialMutationResult> {
    return this.#resolveFriendRequest(
      actorUserIdValue,
      requesterUserIdValue,
      "incoming",
    );
  }

  async cancelFriendRequest(
    actorUserIdValue: unknown,
    recipientUserIdValue: unknown,
  ): Promise<SocialMutationResult> {
    return this.#resolveFriendRequest(
      actorUserIdValue,
      recipientUserIdValue,
      "outgoing",
    );
  }

  async removeFriend(
    actorUserIdValue: unknown,
    friendUserIdValue: unknown,
  ): Promise<SocialMutationResult> {
    const pair = this.#normalizeActorTarget(actorUserIdValue, friendUserIdValue);

    if (!pair.success) {
      return pair.failure;
    }

    return this.#database.transaction((): SocialMutationResult => {
      const validationFailure = this.#validateCanonicalUsers(pair.actorUserId, pair.targetUserId);

      if (validationFailure !== null) {
        return validationFailure;
      }

      this.#database
        .prepare<PairParameters>(`
          DELETE FROM friendships
          WHERE user_a_id = @userAId
            AND user_b_id = @userBId
        `)
        .run(pair);

      this.#revokePendingPairInvitations(
        pair.actorUserId,
        pair.targetUserId,
        this.#now().toISOString(),
      );

      return { success: true };
    }).immediate();
  }

  async blockUser(
    actorUserIdValue: unknown,
    targetUserIdValue: unknown,
  ): Promise<SocialBlockMutationResult> {
    const pair = this.#normalizeActorTarget(actorUserIdValue, targetUserIdValue);

    if (!pair.success) {
      return pair.failure;
    }

    return this.#database.transaction((): SocialBlockMutationResult => {
      const validationFailure = this.#validateCanonicalUsers(pair.actorUserId, pair.targetUserId);

      if (validationFailure !== null) {
        return validationFailure;
      }

      const createdAt = this.#now().toISOString();
      const insertResult = this.#database
        .prepare<{
          actorUserId: string;
          createdAt: string;
          targetUserId: string;
        }>(`
          INSERT OR IGNORE INTO user_blocks (
            blocker_user_id,
            blocked_user_id,
            created_at
          )
          SELECT @actorUserId, @targetUserId, @createdAt
          WHERE EXISTS (
            SELECT 1
            FROM users AS actor
            INNER JOIN users AS target ON target.id = @targetUserId
            WHERE actor.id = @actorUserId
              AND actor.password_hash IS NOT NULL
              AND target.password_hash IS NOT NULL
          )
        `)
        .run({
          actorUserId: pair.actorUserId,
          createdAt,
          targetUserId: pair.targetUserId,
        });

      this.#database
        .prepare<PairParameters>(`
          DELETE FROM friend_requests
          WHERE user_a_id = @userAId
            AND user_b_id = @userBId
        `)
        .run(pair);
      this.#database
        .prepare<PairParameters>(`
          DELETE FROM friendships
          WHERE user_a_id = @userAId
            AND user_b_id = @userBId
        `)
        .run(pair);
      this.#revokePendingPairInvitations(
        pair.actorUserId,
        pair.targetUserId,
        createdAt,
      );

      const blockRow = this.#database
        .prepare<{
          actorUserId: string;
          targetUserId: string;
        }>(`
          SELECT
            blocked.id,
            blocked.display_name AS displayName,
            user_blocks.created_at AS blockedAt
          FROM user_blocks
          INNER JOIN users AS blocked ON blocked.id = user_blocks.blocked_user_id
          WHERE user_blocks.blocker_user_id = @actorUserId
            AND user_blocks.blocked_user_id = @targetUserId
        `)
        .get({
          actorUserId: pair.actorUserId,
          targetUserId: pair.targetUserId,
        }) as BlockRow | undefined;

      if (blockRow === undefined) {
        return createFailure("user-not-found");
      }

      return {
        block: toSocialBlock(blockRow),
        created: insertResult.changes === 1,
        success: true,
      };
    }).immediate();
  }

  async unblockUser(
    actorUserIdValue: unknown,
    targetUserIdValue: unknown,
  ): Promise<SocialMutationResult> {
    const pair = this.#normalizeActorTarget(actorUserIdValue, targetUserIdValue);

    if (!pair.success) {
      return pair.failure;
    }

    return this.#database.transaction((): SocialMutationResult => {
      const validationFailure = this.#validateCanonicalUsers(
        pair.actorUserId,
        pair.targetUserId,
      );

      if (validationFailure !== null) {
        return validationFailure;
      }

      this.#database
        .prepare<{ actorUserId: string; targetUserId: string }>(`
          DELETE FROM user_blocks
          WHERE blocker_user_id = @actorUserId
            AND blocked_user_id = @targetUserId
        `)
        .run({
          actorUserId: pair.actorUserId,
          targetUserId: pair.targetUserId,
        });

      return { success: true };
    }).immediate();
  }

  async createPartyInvitation(
    options: CreatePartyInvitationOptions,
  ): Promise<PartyInvitationCreationResult> {
    const pair = this.#normalizeActorTarget(
      options.inviterUserId,
      options.recipientUserId,
    );
    const partyCode = normalizePrivateRoomCode(options.partyCode);

    if (!pair.success) {
      return pair.failure;
    }

    if (partyCode === null) {
      return createFailure("invalid-party-code");
    }

    if (!isPartyInvitationIntent(options.intent)) {
      return createFailure("invalid-invitation-intent");
    }

    const intent = options.intent;

    return this.#database.transaction((): PartyInvitationCreationResult => {
      const validationFailure = this.#validateCanonicalUsers(pair.actorUserId, pair.targetUserId);

      if (validationFailure !== null) {
        return validationFailure;
      }

      if (this.#isPairBlocked(pair)) {
        return createFailure("blocked");
      }

      if (!this.#friendshipExists(pair)) {
        return createFailure("not-friends");
      }

      const now = this.#now();
      const timestamp = now.toISOString();
      this.#expirePendingInvitationsForActor(pair.actorUserId, timestamp);
      this.#expirePendingInvitationsForActor(pair.targetUserId, timestamp);
      this.#pruneResolvedPartyInvitationHistory();

      const existingInvitation = this.#getPendingPartyInvitationForPartyRecipient(
        partyCode,
        pair.targetUserId,
      );

      if (existingInvitation !== null) {
        return existingInvitation.inviter.id === pair.actorUserId &&
          existingInvitation.intent === intent
          ? { created: false, invitation: existingInvitation, success: true }
          : createFailure("duplicate-party-invitation");
      }

      if (
        this.#hasReachedPartyInvitationLimit(
          pair.actorUserId,
          pair.targetUserId,
        )
      ) {
        return createFailure("party-invitation-limit-reached");
      }

      const invitationId = normalizePartyInvitationId(this.#createId());

      if (invitationId === null) {
        return createFailure("invalid-invitation-id");
      }

      if (this.#partyInvitationIdExists(invitationId)) {
        return createFailure("party-invitation-id-conflict");
      }

      const expiresAt = new Date(
        now.getTime() + this.#partyInvitationTtlMs,
      ).toISOString();
      const insertResult = this.#database
        .prepare<{
          createdAt: string;
          expiresAt: string;
          id: string;
          intent: PartyInvitationIntent;
          inviterUserId: string;
          partyCode: string;
          recipientUserId: string;
          userAId: string;
          userBId: string;
        }>(`
          INSERT OR IGNORE INTO party_invitations (
            id,
            party_code,
            inviter_user_id,
            recipient_user_id,
            intent,
            status,
            created_at,
            updated_at,
            expires_at,
            base_expires_at,
            resolved_at
          )
          SELECT
            @id,
            @partyCode,
            @inviterUserId,
            @recipientUserId,
            @intent,
            'pending',
            @createdAt,
            @createdAt,
            @expiresAt,
            @expiresAt,
            NULL
          WHERE EXISTS (
            SELECT 1
            FROM friendships
            WHERE user_a_id = @userAId
              AND user_b_id = @userBId
          )
            AND NOT EXISTS (
              SELECT 1
              FROM user_blocks
              WHERE (
                blocker_user_id = @inviterUserId
                AND blocked_user_id = @recipientUserId
              ) OR (
                blocker_user_id = @recipientUserId
                AND blocked_user_id = @inviterUserId
              )
            )
            AND NOT EXISTS (
              SELECT 1
              FROM party_invitations
              WHERE party_code = @partyCode
                AND recipient_user_id = @recipientUserId
                AND status = 'pending'
            )
        `)
        .run({
          createdAt: timestamp,
          expiresAt,
          id: invitationId,
          intent,
          inviterUserId: pair.actorUserId,
          partyCode,
          recipientUserId: pair.targetUserId,
          userAId: pair.userAId,
          userBId: pair.userBId,
        });

      if (insertResult.changes !== 1) {
        if (this.#partyInvitationIdExists(invitationId)) {
          return createFailure("party-invitation-id-conflict");
        }

        if (this.#isPairBlocked(pair)) {
          return createFailure("blocked");
        }

        if (!this.#friendshipExists(pair)) {
          return createFailure("not-friends");
        }

        const concurrentInvitation =
          this.#getPendingPartyInvitationForPartyRecipient(
            partyCode,
            pair.targetUserId,
          );

        return concurrentInvitation !== null &&
          concurrentInvitation.inviter.id === pair.actorUserId &&
          concurrentInvitation.intent === intent
          ? { created: false, invitation: concurrentInvitation, success: true }
          : createFailure("duplicate-party-invitation");
      }

      const invitation = this.#getPartyInvitationById(invitationId);

      return invitation === null
        ? createFailure("party-invitation-not-found")
        : { created: true, invitation, success: true };
    }).immediate();
  }

  async validatePartyInvitationRelationship(
    inviterUserIdValue: unknown,
    recipientUserIdValue: unknown,
  ): Promise<SocialMutationResult> {
    const pair = this.#normalizeActorTarget(
      inviterUserIdValue,
      recipientUserIdValue,
    );

    if (!pair.success) {
      return pair.failure;
    }

    return this.#database.transaction((): SocialMutationResult => {
      const validationFailure = this.#validateCanonicalUsers(
        pair.actorUserId,
        pair.targetUserId,
      );

      if (validationFailure !== null) {
        return validationFailure;
      }

      if (this.#isPairBlocked(pair)) {
        return createFailure("blocked");
      }

      return this.#friendshipExists(pair)
        ? { success: true }
        : createFailure("not-friends");
    }).immediate();
  }

  async getPendingPartyInvitation(
    recipientUserIdValue: unknown,
    invitationIdValue: unknown,
  ): Promise<PartyInvitationLookupResult> {
    const recipientUserId = normalizeSocialUserId(recipientUserIdValue);
    const invitationId = normalizePartyInvitationId(invitationIdValue);

    if (recipientUserId === null) {
      return createFailure("invalid-user-id");
    }

    if (invitationId === null) {
      return createFailure("invalid-invitation-id");
    }

    return this.#database.transaction((): PartyInvitationLookupResult => {
      if (!this.#isCanonicalUser(recipientUserId)) {
        return createFailure("user-not-found");
      }

      const now = this.#now().toISOString();
      this.#expirePendingInvitationForRecipient(invitationId, recipientUserId, now);

      const invitation = this.#getOwnedPendingInvitation(
        invitationId,
        recipientUserId,
        "recipient",
      );

      this.#pruneResolvedPartyInvitationHistory();
      return invitation;
    }).immediate();
  }

  async claimPartyInvitationForAcceptance(
    recipientUserIdValue: unknown,
    invitationIdValue: unknown,
  ): Promise<PartyInvitationAcceptanceClaimResult> {
    const recipientUserId = normalizeSocialUserId(recipientUserIdValue);
    const invitationId = normalizePartyInvitationId(invitationIdValue);

    if (recipientUserId === null) {
      return createFailure("invalid-user-id");
    }

    if (invitationId === null) {
      return createFailure("invalid-invitation-id");
    }

    return this.#database.transaction((): PartyInvitationAcceptanceClaimResult => {
      if (!this.#isCanonicalUser(recipientUserId)) {
        return createFailure("user-not-found");
      }

      const now = this.#now();
      const timestamp = now.toISOString();
      this.#deleteInactivePartyInvitationAcceptanceClaims(timestamp);
      this.#expirePendingInvitationForRecipient(
        invitationId,
        recipientUserId,
        timestamp,
      );
      const invitation = this.#getOwnedPendingInvitation(
        invitationId,
        recipientUserId,
        "recipient",
      );

      if (!invitation.success) {
        return invitation;
      }

      const activeRecipientClaim = this.#database
        .prepare<{ recipientUserId: string }>(`
          SELECT invitation_id
          FROM party_invitation_acceptance_claims
          WHERE recipient_user_id = @recipientUserId
        `)
        .get({ recipientUserId });

      if (activeRecipientClaim !== undefined) {
        return createFailure("party-invitation-acceptance-in-progress");
      }

      const claimToken = normalizePartyInvitationId(
        this.#createAcceptanceClaimToken(),
      );

      if (claimToken === null) {
        return createFailure("party-invitation-claim-conflict");
      }

      const claimExpiresAt = new Date(
        now.getTime() + this.#acceptanceClaimTtlMs,
      ).toISOString();
      const recoveryExpiresAt = new Date(
        now.getTime() +
          this.#acceptanceClaimTtlMs +
          this.#acceptanceRecoveryGraceMs,
      ).toISOString();
      const insert = this.#database
        .prepare<{
          claimExpiresAt: string;
          claimToken: string;
          invitationId: string;
          recipientUserId: string;
          timestamp: string;
        }>(`
          INSERT OR IGNORE INTO party_invitation_acceptance_claims (
            invitation_id,
            recipient_user_id,
            claim_token,
            claimed_at,
            expires_at
          )
          VALUES (
            @invitationId,
            @recipientUserId,
            @claimToken,
            @timestamp,
            @claimExpiresAt
          )
        `)
        .run({
          claimExpiresAt,
          claimToken,
          invitationId,
          recipientUserId,
          timestamp,
        });

      if (insert.changes !== 1) {
        const recipientClaimExists = this.#database
          .prepare<{ recipientUserId: string }>(`
            SELECT 1
            FROM party_invitation_acceptance_claims
            WHERE recipient_user_id = @recipientUserId
          `)
          .get({ recipientUserId });

        return createFailure(
          recipientClaimExists === undefined
            ? "party-invitation-claim-conflict"
            : "party-invitation-acceptance-in-progress",
        );
      }

      this.#database
        .prepare<{
          invitationId: string;
          recoveryExpiresAt: string;
          timestamp: string;
        }>(`
          UPDATE party_invitations
          SET
            base_expires_at = COALESCE(base_expires_at, expires_at),
            expires_at = MAX(expires_at, @recoveryExpiresAt),
            updated_at = @timestamp
          WHERE id = @invitationId
            AND status = 'pending'
        `)
        .run({ invitationId, recoveryExpiresAt, timestamp });
      const claimedInvitation = this.#getPartyInvitationById(invitationId);

      if (claimedInvitation === null) {
        return createFailure("party-invitation-not-found");
      }

      return {
        claimExpiresAt,
        claimToken,
        invitation: claimedInvitation,
        success: true,
      };
    }).immediate();
  }

  async getAcceptedPartyInvitationForReacquisition(
    recipientUserIdValue: unknown,
    invitationIdValue: unknown,
  ): Promise<PartyInvitationLookupResult> {
    const recipientUserId = normalizeSocialUserId(recipientUserIdValue);
    const invitationId = normalizePartyInvitationId(invitationIdValue);

    if (recipientUserId === null) {
      return createFailure("invalid-user-id");
    }

    if (invitationId === null) {
      return createFailure("invalid-invitation-id");
    }

    if (!this.#isCanonicalUser(recipientUserId)) {
      return createFailure("user-not-found");
    }

    const invitationRow = this.#getOwnedPartyInvitationRow(
      invitationId,
      recipientUserId,
      "recipient",
    );

    if (invitationRow === undefined) {
      return createFailure("party-invitation-not-found");
    }

    return invitationRow.status === "accepted"
      ? {
          invitation: toSocialPartyInvitationRecord(invitationRow),
          success: true,
        }
      : createFailure("party-invitation-not-pending");
  }

  async acceptPartyInvitationAfterAdmission(
    recipientUserIdValue: unknown,
    invitationIdValue: unknown,
    claimTokenValue: unknown,
  ): Promise<PartyInvitationMutationResult> {
    const recipientUserId = normalizeSocialUserId(recipientUserIdValue);
    const invitationId = normalizePartyInvitationId(invitationIdValue);
    const claimToken = normalizePartyInvitationId(claimTokenValue);

    if (recipientUserId === null) {
      return createFailure("invalid-user-id");
    }

    if (invitationId === null || claimToken === null) {
      return createFailure("invalid-invitation-id");
    }

    return this.#database.transaction((): PartyInvitationMutationResult => {
      if (!this.#isCanonicalUser(recipientUserId)) {
        return createFailure("user-not-found");
      }

      const invitationRow = this.#getOwnedPartyInvitationRow(
        invitationId,
        recipientUserId,
        "recipient",
      );

      if (invitationRow === undefined) {
        return createFailure("party-invitation-not-found");
      }

      const now = this.#now().toISOString();

      if (invitationRow.status === "accepted") {
        this.#database
          .prepare<{ recipientUserId: string }>(`
            DELETE FROM party_invitation_acceptance_claims
            WHERE recipient_user_id = @recipientUserId
          `)
          .run({ recipientUserId });
        this.#revokeLivePartyInvitationsForRecipient(
          recipientUserId,
          now,
          false,
        );

        return {
          invitation: toSocialPartyInvitationRecord(invitationRow),
          success: true,
        };
      }

      if (invitationRow.status !== "pending") {
        return createFailure("party-invitation-not-pending");
      }

      const claim = this.#database
        .prepare<{
          claimToken: string;
          invitationId: string;
          now: string;
          recipientUserId: string;
        }>(`
          SELECT 1
          FROM party_invitation_acceptance_claims
          WHERE invitation_id = @invitationId
            AND recipient_user_id = @recipientUserId
            AND claim_token = @claimToken
            AND expires_at > @now
        `)
        .get({ claimToken, invitationId, now, recipientUserId });

      if (claim === undefined) {
        return createFailure("party-invitation-acceptance-in-progress");
      }

      const update = this.#database
        .prepare<{
          invitationId: string;
          now: string;
          recipientUserId: string;
        }>(`
          UPDATE party_invitations
          SET status = 'accepted', updated_at = @now, resolved_at = @now
          WHERE id = @invitationId
            AND recipient_user_id = @recipientUserId
            AND status = 'pending'
        `)
        .run({ invitationId, now, recipientUserId });

      if (update.changes !== 1) {
        return createFailure("party-invitation-not-pending");
      }

      this.#database
        .prepare<{ invitationId: string; recipientUserId: string }>(`
          DELETE FROM party_invitations
          WHERE recipient_user_id = @recipientUserId
            AND status = 'accepted'
            AND id <> @invitationId
        `)
        .run({ invitationId, recipientUserId });

      this.#database
        .prepare<{ recipientUserId: string }>(`
          DELETE FROM party_invitation_acceptance_claims
          WHERE recipient_user_id = @recipientUserId
        `)
        .run({ recipientUserId });
      this.#revokeLivePartyInvitationsForRecipient(
        recipientUserId,
        now,
        false,
      );
      this.#pruneResolvedPartyInvitationHistory();

      const invitation = this.#getPartyInvitationById(invitationId);

      return invitation === null
        ? createFailure("party-invitation-not-found")
        : { invitation, success: true };
    }).immediate();
  }

  async releasePartyInvitationAcceptanceClaim(
    recipientUserIdValue: unknown,
    invitationIdValue: unknown,
    claimTokenValue: unknown,
  ): Promise<PartyInvitationAcceptanceReleaseResult> {
    const recipientUserId = normalizeSocialUserId(recipientUserIdValue);
    const invitationId = normalizePartyInvitationId(invitationIdValue);
    const claimToken = normalizePartyInvitationId(claimTokenValue);

    if (recipientUserId === null) {
      return createFailure("invalid-user-id");
    }

    if (invitationId === null || claimToken === null) {
      return createFailure("invalid-invitation-id");
    }

    return this.#database.transaction((): PartyInvitationAcceptanceReleaseResult => {
      if (!this.#isCanonicalUser(recipientUserId)) {
        return createFailure("user-not-found");
      }

      const now = this.#now().toISOString();
      const restorableInvitation = this.#database
        .prepare<{
          claimToken: string;
          invitationId: string;
          recipientUserId: string;
        }>(`
          SELECT 1
          FROM party_invitation_acceptance_claims
          WHERE invitation_id = @invitationId
            AND recipient_user_id = @recipientUserId
            AND claim_token = @claimToken
        `)
        .get({ claimToken, invitationId, recipientUserId });

      if (restorableInvitation === undefined) {
        return { released: false, success: true };
      }

      this.#database
        .prepare<{
          invitationId: string;
          now: string;
          recipientUserId: string;
        }>(`
          UPDATE party_invitations
          SET
            expires_at = COALESCE(base_expires_at, expires_at),
            status = CASE
              WHEN COALESCE(base_expires_at, expires_at) <= @now
                THEN 'expired'
              ELSE status
            END,
            updated_at = @now,
            resolved_at = CASE
              WHEN COALESCE(base_expires_at, expires_at) <= @now
                THEN @now
              ELSE resolved_at
            END
          WHERE id = @invitationId
            AND recipient_user_id = @recipientUserId
            AND status = 'pending'
        `)
        .run({ invitationId, now, recipientUserId });

      const released = this.#database
        .prepare<{
          claimToken: string;
          invitationId: string;
          recipientUserId: string;
        }>(`
          DELETE FROM party_invitation_acceptance_claims
          WHERE invitation_id = @invitationId
            AND recipient_user_id = @recipientUserId
            AND claim_token = @claimToken
        `)
        .run({ claimToken, invitationId, recipientUserId }).changes;

      this.#pruneResolvedPartyInvitationHistory();
      return { released: released === 1, success: true };
    }).immediate();
  }

  async declinePartyInvitation(
    recipientUserIdValue: unknown,
    invitationIdValue: unknown,
  ): Promise<PartyInvitationMutationResult> {
    return this.#resolvePartyInvitation(
      recipientUserIdValue,
      invitationIdValue,
      "recipient",
      "declined",
    );
  }

  async cancelPartyInvitation(
    inviterUserIdValue: unknown,
    invitationIdValue: unknown,
  ): Promise<PartyInvitationMutationResult> {
    return this.#resolvePartyInvitation(
      inviterUserIdValue,
      invitationIdValue,
      "inviter",
      "canceled",
    );
  }

  async revokePartyInvitation(
    inviterUserIdValue: unknown,
    invitationIdValue: unknown,
  ): Promise<PartyInvitationMutationResult> {
    return this.#resolvePartyInvitation(
      inviterUserIdValue,
      invitationIdValue,
      "inviter",
      "revoked",
    );
  }

  async revokePendingPartyInvitationsForRecipient(
    recipientUserIdValue: unknown,
  ): Promise<PartyInvitationPartyRevocationResult> {
    const recipientUserId = normalizeSocialUserId(recipientUserIdValue);

    if (recipientUserId === null) {
      return createFailure("invalid-user-id");
    }

    return this.#database.transaction((): PartyInvitationPartyRevocationResult => {
      if (!this.#isCanonicalUser(recipientUserId)) {
        return createFailure("user-not-found");
      }

      const now = this.#now().toISOString();
      const revokedCount = this.#revokeLivePartyInvitationsForRecipient(
        recipientUserId,
        now,
      );

      return {
        revokedCount,
        success: true,
      };
    }).immediate();
  }

  async revokePartyInvitationsForParty(
    partyCodeValue: unknown,
  ): Promise<PartyInvitationPartyRevocationResult> {
    const partyCode = normalizePrivateRoomCode(partyCodeValue);

    if (partyCode === null) {
      return createFailure("invalid-party-code");
    }

    return this.#database.transaction((): PartyInvitationPartyRevocationResult => {
      const now = this.#now().toISOString();
      this.#expirePendingInvitationsForParty(partyCode, now);
      const result = this.#database
        .prepare<{ now: string; partyCode: string }>(`
          UPDATE party_invitations
          SET
            status = 'revoked',
            updated_at = @now,
            resolved_at = @now
          WHERE party_code = @partyCode
            AND status = 'pending'
        `)
        .run({ now, partyCode });

      this.#deleteInactivePartyInvitationAcceptanceClaims(now);
      this.#pruneResolvedPartyInvitationHistory();

      return {
        revokedCount: result.changes,
        success: true,
      };
    }).immediate();
  }

  #normalizeActorTarget(actorUserIdValue: unknown, targetUserIdValue: unknown) {
    const actorUserId = normalizeSocialUserId(actorUserIdValue);
    const targetUserId = normalizeSocialUserId(targetUserIdValue);
    const pair = getCanonicalSocialUserPair(actorUserId, targetUserId);

    if (actorUserId === null || targetUserId === null || pair === null) {
      return {
        failure: createFailure("invalid-user-id"),
        success: false as const,
      };
    }

    return {
      actorUserId,
      success: true as const,
      targetUserId,
      ...pair,
    };
  }

  #isCanonicalUser(userId: string) {
    return this.#getCanonicalUser(userId) !== null;
  }

  #hasReachedFriendRequestLimit(pair: ActorTargetParameters) {
    const outgoing = this.#database
      .prepare<{ actorUserId: string }>(`
        SELECT COUNT(*) AS requestCount
        FROM friend_requests
        WHERE requester_user_id = @actorUserId
      `)
      .get({ actorUserId: pair.actorUserId }) as { requestCount: number };

    if (
      outgoing.requestCount >= this.#maxOutgoingFriendRequestsPerUser
    ) {
      return true;
    }

    const incoming = this.#database
      .prepare<{ targetUserId: string }>(`
        SELECT COUNT(*) AS requestCount
        FROM friend_requests
        WHERE requester_user_id != @targetUserId
          AND (
            user_a_id = @targetUserId
            OR user_b_id = @targetUserId
          )
      `)
      .get({ targetUserId: pair.targetUserId }) as { requestCount: number };

    return (
      incoming.requestCount >= this.#maxIncomingFriendRequestsPerUser
    );
  }

  #hasReachedPartyInvitationLimit(
    inviterUserId: string,
    recipientUserId: string,
  ) {
    const counts = this.#database
      .prepare<{
        inviterUserId: string;
        recipientUserId: string;
      }>(`
        SELECT
          (
            SELECT COUNT(*)
            FROM party_invitations
            WHERE inviter_user_id = @inviterUserId
              AND status = 'pending'
          ) AS outgoingCount,
          (
            SELECT COUNT(*)
            FROM party_invitations
            WHERE recipient_user_id = @recipientUserId
              AND status = 'pending'
          ) AS incomingCount
      `)
      .get({ inviterUserId, recipientUserId }) as {
      incomingCount: number;
      outgoingCount: number;
    };

    return (
      counts.outgoingCount >=
        this.#maxPendingPartyInvitationsPerInviter ||
      counts.incomingCount >=
        this.#maxPendingPartyInvitationsPerRecipient
    );
  }

  #getCanonicalUser(userId: string) {
    return (
      (this.#database
        .prepare<{ userId: string }>(`
          SELECT id, display_name AS displayName
          FROM users
          WHERE id = @userId
            AND password_hash IS NOT NULL
        `)
        .get({ userId }) as UserRow | undefined) ?? null
    );
  }

  #validateCanonicalUsers(actorUserId: string, targetUserId: string) {
    return this.#isCanonicalUser(actorUserId) && this.#isCanonicalUser(targetUserId)
      ? null
      : createFailure("user-not-found");
  }

  #getFriendRequestRecord(pair: PairParameters) {
    return (
      (this.#database
        .prepare<PairParameters>(`
          SELECT
            requester_user_id AS requesterUserId,
            created_at AS createdAt
          FROM friend_requests
          WHERE user_a_id = @userAId
            AND user_b_id = @userBId
        `)
        .get(pair) as FriendRequestRecordRow | undefined) ?? null
    );
  }

  #friendshipExists(pair: PairParameters) {
    return (
      this.#database
        .prepare<PairParameters>(`
          SELECT 1
          FROM friendships
          WHERE user_a_id = @userAId
            AND user_b_id = @userBId
        `)
        .get(pair) !== undefined
    );
  }

  #getFriendship(pair: PairParameters, friendUserId: string) {
    const row = this.#database
      .prepare<PairParameters & { friendUserId: string }>(`
        SELECT
          users.id,
          users.display_name AS displayName,
          friendships.created_at AS friendsSince
        FROM friendships
        INNER JOIN users ON users.id = @friendUserId
        WHERE friendships.user_a_id = @userAId
          AND friendships.user_b_id = @userBId
      `)
      .get({ ...pair, friendUserId }) as FriendRow | undefined;

    return row === undefined ? null : toSocialFriend(row);
  }

  #isPairBlocked(pair: ActorTargetParameters) {
    return (
      this.#database
        .prepare<{ actorUserId: string; targetUserId: string }>(`
          SELECT 1
          FROM user_blocks
          WHERE (
            blocker_user_id = @actorUserId
            AND blocked_user_id = @targetUserId
          ) OR (
            blocker_user_id = @targetUserId
            AND blocked_user_id = @actorUserId
          )
        `)
        .get({
          actorUserId: pair.actorUserId,
          targetUserId: pair.targetUserId,
        }) !== undefined
    );
  }

  #deleteFriendRequest(pair: PairParameters, requesterUserId: string) {
    return this.#database
      .prepare<PairParameters & { requesterUserId: string }>(`
        DELETE FROM friend_requests
        WHERE user_a_id = @userAId
          AND user_b_id = @userBId
          AND requester_user_id = @requesterUserId
      `)
      .run({ ...pair, requesterUserId });
  }

  async #resolveFriendRequest(
    actorUserIdValue: unknown,
    targetUserIdValue: unknown,
    direction: "incoming" | "outgoing",
  ): Promise<SocialMutationResult> {
    const pair = this.#normalizeActorTarget(actorUserIdValue, targetUserIdValue);

    if (!pair.success) {
      return pair.failure;
    }

    return this.#database.transaction((): SocialMutationResult => {
      const validationFailure = this.#validateCanonicalUsers(pair.actorUserId, pair.targetUserId);

      if (validationFailure !== null) {
        return validationFailure;
      }

      const request = this.#getFriendRequestRecord(pair);

      if (request === null) {
        return { success: true };
      }

      const expectedRequesterUserId =
        direction === "incoming" ? pair.targetUserId : pair.actorUserId;

      if (request.requesterUserId !== expectedRequesterUserId) {
        return createFailure(
          direction === "incoming"
            ? "friend-request-not-incoming"
            : "friend-request-not-outgoing",
        );
      }

      this.#deleteFriendRequest(pair, expectedRequesterUserId);

      return { success: true };
    }).immediate();
  }

  #revokePendingPairInvitations(
    firstUserId: string,
    secondUserId: string,
    now: string,
  ) {
    this.#database
      .prepare<{
        firstUserId: string;
        now: string;
        secondUserId: string;
      }>(`
        UPDATE party_invitations
        SET
          status = CASE WHEN expires_at <= @now THEN 'expired' ELSE 'revoked' END,
          updated_at = @now,
          resolved_at = @now
        WHERE status = 'pending'
          AND (
            (
              inviter_user_id = @firstUserId
              AND recipient_user_id = @secondUserId
            ) OR (
              inviter_user_id = @secondUserId
              AND recipient_user_id = @firstUserId
            )
          )
      `)
      .run({ firstUserId, now, secondUserId });

    this.#deleteInactivePartyInvitationAcceptanceClaims(now);
    this.#pruneResolvedPartyInvitationHistory();
  }

  #deleteInactivePartyInvitationAcceptanceClaims(now: string) {
    this.#database
      .prepare<{ now: string }>(`
        DELETE FROM party_invitation_acceptance_claims
        WHERE expires_at <= @now
          OR NOT EXISTS (
            SELECT 1
            FROM party_invitations
            WHERE party_invitations.id = party_invitation_acceptance_claims.invitation_id
              AND party_invitations.status = 'pending'
          )
      `)
      .run({ now });
  }

  #pruneResolvedPartyInvitationHistory() {
    this.#database
      .prepare<{ historyLimit: number }>(`
        DELETE FROM party_invitations
        WHERE status IN ('declined', 'canceled', 'revoked', 'expired')
          AND id NOT IN (
            SELECT id
            FROM party_invitations
            WHERE status IN ('declined', 'canceled', 'revoked', 'expired')
            ORDER BY resolved_at DESC, id DESC
            LIMIT @historyLimit
          )
      `)
      .run({ historyLimit: this.#maxResolvedPartyInvitationHistory });
  }

  #expirePendingInvitationsForActor(actorUserId: string, now: string) {
    this.#deleteInactivePartyInvitationAcceptanceClaims(now);
    this.#database
      .prepare<{ actorUserId: string; now: string }>(`
        UPDATE party_invitations
        SET status = 'expired', updated_at = @now, resolved_at = @now
        WHERE status = 'pending'
          AND expires_at <= @now
          AND (
            inviter_user_id = @actorUserId
            OR recipient_user_id = @actorUserId
          )
          AND NOT EXISTS (
            SELECT 1
            FROM party_invitation_acceptance_claims
            WHERE party_invitation_acceptance_claims.invitation_id = party_invitations.id
              AND party_invitation_acceptance_claims.expires_at > @now
          )
      `)
      .run({ actorUserId, now });
  }

  #expirePendingInvitationForRecipient(
    invitationId: string,
    recipientUserId: string,
    now: string,
  ) {
    this.#deleteInactivePartyInvitationAcceptanceClaims(now);
    this.#database
      .prepare<{
        invitationId: string;
        now: string;
        recipientUserId: string;
      }>(`
        UPDATE party_invitations
        SET status = 'expired', updated_at = @now, resolved_at = @now
        WHERE id = @invitationId
          AND recipient_user_id = @recipientUserId
          AND status = 'pending'
          AND expires_at <= @now
          AND NOT EXISTS (
            SELECT 1
            FROM party_invitation_acceptance_claims
            WHERE party_invitation_acceptance_claims.invitation_id = party_invitations.id
              AND party_invitation_acceptance_claims.expires_at > @now
          )
      `)
      .run({ invitationId, now, recipientUserId });
  }

  #expirePendingInvitationsForRecipient(
    recipientUserId: string,
    now: string,
  ) {
    this.#deleteInactivePartyInvitationAcceptanceClaims(now);
    this.#database
      .prepare<{ now: string; recipientUserId: string }>(`
        UPDATE party_invitations
        SET status = 'expired', updated_at = @now, resolved_at = @now
        WHERE recipient_user_id = @recipientUserId
          AND status = 'pending'
          AND expires_at <= @now
          AND NOT EXISTS (
            SELECT 1
            FROM party_invitation_acceptance_claims
            WHERE party_invitation_acceptance_claims.invitation_id = party_invitations.id
              AND party_invitation_acceptance_claims.expires_at > @now
          )
      `)
      .run({ now, recipientUserId });
  }

  #revokeLivePartyInvitationsForRecipient(
    recipientUserId: string,
    now: string,
    preserveAcceptanceClaims = true,
  ) {
    this.#expirePendingInvitationsForRecipient(recipientUserId, now);

    const revokedCount = this.#database
      .prepare<{
        now: string;
        preserveAcceptanceClaims: number;
        recipientUserId: string;
      }>(`
        UPDATE party_invitations
        SET
          status = 'revoked',
          updated_at = @now,
          resolved_at = @now
        WHERE recipient_user_id = @recipientUserId
          AND status = 'pending'
          AND expires_at > @now
          AND (
            @preserveAcceptanceClaims = 0
            OR NOT EXISTS (
              SELECT 1
              FROM party_invitation_acceptance_claims
              WHERE party_invitation_acceptance_claims.invitation_id = party_invitations.id
                AND party_invitation_acceptance_claims.expires_at > @now
            )
          )
      `)
      .run({
        now,
        preserveAcceptanceClaims: preserveAcceptanceClaims ? 1 : 0,
        recipientUserId,
      }).changes;

    this.#pruneResolvedPartyInvitationHistory();
    return revokedCount;
  }

  #expirePendingInvitationForInviter(
    invitationId: string,
    inviterUserId: string,
    now: string,
  ) {
    this.#deleteInactivePartyInvitationAcceptanceClaims(now);
    this.#database
      .prepare<{
        invitationId: string;
        inviterUserId: string;
        now: string;
      }>(`
        UPDATE party_invitations
        SET status = 'expired', updated_at = @now, resolved_at = @now
        WHERE id = @invitationId
          AND inviter_user_id = @inviterUserId
          AND status = 'pending'
          AND expires_at <= @now
          AND NOT EXISTS (
            SELECT 1
            FROM party_invitation_acceptance_claims
            WHERE party_invitation_acceptance_claims.invitation_id = party_invitations.id
              AND party_invitation_acceptance_claims.expires_at > @now
          )
      `)
      .run({ invitationId, inviterUserId, now });
  }

  #expirePendingInvitationsForParty(partyCode: string, now: string) {
    this.#deleteInactivePartyInvitationAcceptanceClaims(now);
    this.#database
      .prepare<{ now: string; partyCode: string }>(`
        UPDATE party_invitations
        SET status = 'expired', updated_at = @now, resolved_at = @now
        WHERE party_code = @partyCode
          AND status = 'pending'
          AND expires_at <= @now
          AND NOT EXISTS (
            SELECT 1
            FROM party_invitation_acceptance_claims
            WHERE party_invitation_acceptance_claims.invitation_id = party_invitations.id
              AND party_invitation_acceptance_claims.expires_at > @now
          )
      `)
      .run({ now, partyCode });
  }

  #getPendingPartyInvitationForPartyRecipient(
    partyCode: string,
    recipientUserId: string,
  ) {
    const row = this.#database
      .prepare<{ partyCode: string; recipientUserId: string }>(`
        ${PARTY_INVITATION_SELECT}
        WHERE party_invitations.party_code = @partyCode
          AND party_invitations.recipient_user_id = @recipientUserId
          AND party_invitations.status = 'pending'
      `)
      .get({ partyCode, recipientUserId }) as PartyInvitationRow | undefined;

    return row === undefined ? null : toSocialPartyInvitationRecord(row);
  }

  #partyInvitationIdExists(invitationId: string) {
    return (
      this.#database
        .prepare<{ invitationId: string }>(`
          SELECT 1
          FROM party_invitations
          WHERE id = @invitationId
        `)
        .get({ invitationId }) !== undefined
    );
  }

  #getPartyInvitationById(invitationId: string) {
    const row = this.#database
      .prepare<{ invitationId: string }>(`
        ${PARTY_INVITATION_SELECT}
        WHERE party_invitations.id = @invitationId
      `)
      .get({ invitationId }) as PartyInvitationRow | undefined;

    return row === undefined ? null : toSocialPartyInvitationRecord(row);
  }

  #getOwnedPendingInvitation(
    invitationId: string,
    actorUserId: string,
    owner: "inviter" | "recipient",
  ): PartyInvitationLookupResult {
    const row = this.#getOwnedPartyInvitationRow(
      invitationId,
      actorUserId,
      owner,
    );

    if (row === undefined) {
      return createFailure("party-invitation-not-found");
    }

    if (row.status === "expired") {
      return createFailure("party-invitation-expired");
    }

    if (row.status !== "pending") {
      return createFailure("party-invitation-not-pending");
    }

    return {
      invitation: toSocialPartyInvitationRecord(row),
      success: true,
    };
  }

  #getOwnedPartyInvitationRow(
    invitationId: string,
    actorUserId: string,
    owner: "inviter" | "recipient",
  ) {
    const ownershipColumn =
      owner === "recipient" ? "recipient_user_id" : "inviter_user_id";

    return this.#database
      .prepare<{ actorUserId: string; invitationId: string }>(`
        ${PARTY_INVITATION_SELECT}
        WHERE party_invitations.id = @invitationId
          AND party_invitations.${ownershipColumn} = @actorUserId
      `)
      .get({ actorUserId, invitationId }) as PartyInvitationRow | undefined;
  }

  async #resolvePartyInvitation(
    actorUserIdValue: unknown,
    invitationIdValue: unknown,
    owner: "inviter" | "recipient",
    status: Exclude<
      PartyInvitationStatus,
      "accepted" | "expired" | "pending"
    >,
  ): Promise<PartyInvitationMutationResult> {
    const actorUserId = normalizeSocialUserId(actorUserIdValue);
    const invitationId = normalizePartyInvitationId(invitationIdValue);

    if (actorUserId === null) {
      return createFailure("invalid-user-id");
    }

    if (invitationId === null) {
      return createFailure("invalid-invitation-id");
    }

    return this.#database.transaction((): PartyInvitationMutationResult => {
      if (!this.#isCanonicalUser(actorUserId)) {
        return createFailure("user-not-found");
      }

      const now = this.#now().toISOString();

      if (owner === "recipient") {
        this.#expirePendingInvitationForRecipient(invitationId, actorUserId, now);
      } else {
        this.#expirePendingInvitationForInviter(invitationId, actorUserId, now);
      }

      const invitationRow = this.#getOwnedPartyInvitationRow(
        invitationId,
        actorUserId,
        owner,
      );

      if (invitationRow === undefined) {
        return createFailure("party-invitation-not-found");
      }

      if (invitationRow.status === "expired") {
        return createFailure("party-invitation-expired");
      }

      if (invitationRow.status === status) {
        const invitation = toSocialPartyInvitationRecord(invitationRow);
        this.#pruneResolvedPartyInvitationHistory();

        return {
          invitation,
          success: true,
        };
      }

      if (invitationRow.status !== "pending") {
        return createFailure("party-invitation-not-pending");
      }

      const ownershipColumn =
        owner === "recipient" ? "recipient_user_id" : "inviter_user_id";
      const result = this.#database
        .prepare<{
          actorUserId: string;
          invitationId: string;
          now: string;
          status: Exclude<
            PartyInvitationStatus,
            "accepted" | "expired" | "pending"
          >;
        }>(`
          UPDATE party_invitations
          SET status = @status, updated_at = @now, resolved_at = @now
          WHERE id = @invitationId
            AND ${ownershipColumn} = @actorUserId
            AND status = 'pending'
        `)
        .run({ actorUserId, invitationId, now, status });

      if (result.changes !== 1) {
        return createFailure("party-invitation-not-pending");
      }

      this.#deleteInactivePartyInvitationAcceptanceClaims(now);

      const invitation = this.#getPartyInvitationById(invitationId);

      this.#pruneResolvedPartyInvitationHistory();

      return invitation === null
        ? createFailure("party-invitation-not-found")
        : { invitation, success: true };
    }).immediate();
  }
}

let defaultStore: SqliteSocialStore | null = null;

export function getSocialStore() {
  defaultStore ??= new SqliteSocialStore({
    databasePath: getUserProfileSqlitePath(),
  });

  return defaultStore;
}
