import type { AuthenticatedUser } from "@/lib/user-profile";

export const SOCIAL_USER_ID_PATTERN = /^[a-zA-Z0-9-]{1,80}$/;
export const PARTY_INVITATION_ID_PATTERN = /^[a-zA-Z0-9-]{1,80}$/;

export const PARTY_INVITATION_INTENTS = ["play", "watch"] as const;
export const PARTY_INVITATION_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "canceled",
  "revoked",
  "expired",
] as const;

export type PartyInvitationIntent =
  (typeof PARTY_INVITATION_INTENTS)[number];
export type PartyInvitationStatus =
  (typeof PARTY_INVITATION_STATUSES)[number];
export type SocialAvailability =
  | "available"
  | "busy"
  | "in-party"
  | "offline"
  | "unknown";
export type SocialRelationship =
  | "friends"
  | "incoming-request"
  | "none"
  | "outgoing-request";

export type SocialFriend = {
  availability: SocialAvailability;
  friendsSince: string;
  user: AuthenticatedUser;
};

export type SocialFriendRequest = {
  createdAt: string;
  direction: "incoming" | "outgoing";
  user: AuthenticatedUser;
};

export type SocialBlock = {
  blockedAt: string;
  user: AuthenticatedUser;
};

export type SocialPartyInvitation = {
  createdAt: string;
  expiresAt: string;
  id: string;
  intent: PartyInvitationIntent;
  inviter: AuthenticatedUser;
  recipient: AuthenticatedUser;
  resolvedAt: string | null;
  status: PartyInvitationStatus;
  updatedAt: string;
};

export type SocialOverview = {
  blockedUsers: SocialBlock[];
  friends: SocialFriend[];
  incomingFriendRequests: SocialFriendRequest[];
  incomingPartyInvitations: SocialPartyInvitation[];
  outgoingFriendRequests: SocialFriendRequest[];
  outgoingPartyInvitations: SocialPartyInvitation[];
};

export type SocialUserDiscovery = {
  relationship: SocialRelationship;
  user: AuthenticatedUser;
};

export type CanonicalSocialUserPair = {
  userAId: string;
  userBId: string;
};

export function normalizeSocialUserId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const userId = value.trim();

  return SOCIAL_USER_ID_PATTERN.test(userId) ? userId : null;
}

export function normalizePartyInvitationId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const invitationId = value.trim();

  return PARTY_INVITATION_ID_PATTERN.test(invitationId) ? invitationId : null;
}

export function getCanonicalSocialUserPair(
  firstUserIdValue: unknown,
  secondUserIdValue: unknown,
): CanonicalSocialUserPair | null {
  const firstUserId = normalizeSocialUserId(firstUserIdValue);
  const secondUserId = normalizeSocialUserId(secondUserIdValue);

  if (
    firstUserId === null ||
    secondUserId === null ||
    firstUserId === secondUserId
  ) {
    return null;
  }

  return firstUserId < secondUserId
    ? { userAId: firstUserId, userBId: secondUserId }
    : { userAId: secondUserId, userBId: firstUserId };
}

export function isPartyInvitationIntent(
  value: unknown,
): value is PartyInvitationIntent {
  return PARTY_INVITATION_INTENTS.some((intent) => intent === value);
}

export function isPartyInvitationStatus(
  value: unknown,
): value is PartyInvitationStatus {
  return PARTY_INVITATION_STATUSES.some((status) => status === value);
}
