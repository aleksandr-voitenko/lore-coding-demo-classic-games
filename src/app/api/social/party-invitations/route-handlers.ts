import "server-only";

import { normalizePrivateRoomCode } from "@/lib/multiplayer/room";
import {
  isPartyInvitationIntent,
  normalizeSocialUserId,
  type PartyInvitationIntent,
} from "@/lib/social";
import type { MultiplayerAccountPartyAuthority } from "@/lib/server/multiplayer-account-party";
import type { SqliteSocialStore } from "@/lib/server/sqlite-social-store";

import {
  authenticateSocialRequest,
  createMultiplayerAccountPartyFailureResponse,
  createSocialErrorResponse,
  createSocialJsonResponse,
  createSocialRateLimitExceededResponse,
  createSocialStoreFailureResponse,
  readSocialJsonMutation,
  redactSocialPartyInvitation,
  type SocialUserSessionLookup,
} from "../shared";

type PartyInvitationCreationStore = Pick<
  SqliteSocialStore,
  | "consumeSocialApiRateLimit"
  | "createPartyInvitation"
  | "revokePartyInvitationsForParty"
  | "validatePartyInvitationRelationship"
>;

type PartyInvitationCreationDependencies = {
  accountPartyAuthority: MultiplayerAccountPartyAuthority;
  socialStore: PartyInvitationCreationStore;
  userStore: SocialUserSessionLookup;
};

type ParsedPartyInvitationCreation = {
  intent: PartyInvitationIntent;
  partyCode: string;
  recipientUserId: string;
};

const TERMINAL_PARTY_FAILURES = new Set([
  "party-closed",
  "room-expired",
  "room-not-found",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePartyInvitationCreation(
  value: unknown,
): ParsedPartyInvitationCreation | null {
  if (!isRecord(value)) {
    return null;
  }

  const partyCode = normalizePrivateRoomCode(value.partyCode);
  const recipientUserId = normalizeSocialUserId(value.recipientUserId);

  if (
    partyCode === null ||
    recipientUserId === null ||
    !isPartyInvitationIntent(value.intent)
  ) {
    return null;
  }

  return {
    intent: value.intent,
    partyCode,
    recipientUserId,
  };
}

function createInvalidAuthorityResponse() {
  return createSocialErrorResponse(
    "room-service-invalid-response",
    "The multiplayer account authority returned an invalid response.",
    502,
  );
}

async function revokeTerminalPartyInvitations(
  socialStore: PartyInvitationCreationStore,
  partyCode: string,
) {
  const result = await socialStore.revokePartyInvitationsForParty(partyCode);

  return result.success ? null : createSocialStoreFailureResponse(result);
}

export function createPartyInvitationsRouteHandlers({
  accountPartyAuthority,
  socialStore,
  userStore,
}: PartyInvitationCreationDependencies) {
  return {
    async POST(request: Request) {
      const authentication = await authenticateSocialRequest(request, userStore);

      if (!authentication.success) {
        return authentication.response;
      }

      const json = await readSocialJsonMutation(request);

      if (!json.success) {
        return json.response;
      }

      const creation = parsePartyInvitationCreation(json.payload);

      if (creation === null) {
        return createSocialErrorResponse(
          "invalid-party-invitation",
          "Party invitation details are not supported.",
          400,
        );
      }

      const rateLimit = await socialStore.consumeSocialApiRateLimit(
        authentication.user.id,
        "party-invitation",
      );

      if (!rateLimit.success) {
        return createSocialStoreFailureResponse(rateLimit);
      }

      if (!rateLimit.allowed) {
        return createSocialRateLimitExceededResponse(
          rateLimit.retryAfterSeconds,
        );
      }

      const initialRelationship =
        await socialStore.validatePartyInvitationRelationship(
          authentication.user.id,
          creation.recipientUserId,
        );

      if (!initialRelationship.success) {
        return createSocialErrorResponse(
          "relationship-unavailable",
          "This social action is not available.",
          409,
        );
      }

      const inspectInvitation = () =>
        accountPartyAuthority.applyAccountCommand({
          hostUserId: authentication.user.id,
          intent: creation.intent,
          partyCode: creation.partyCode,
          recipientUserId: creation.recipientUserId,
          type: "party.inspectInvitation",
        });

      let confirmedEligibility:
        | Awaited<ReturnType<typeof inspectInvitation>>
        | null = null;

      try {
        confirmedEligibility = await inspectInvitation();
      } catch {
        return createSocialErrorResponse(
          "room-service-unavailable",
          "Party availability could not be checked. Try again.",
          502,
        );
      }

      const confirmedRelationship =
        await socialStore.validatePartyInvitationRelationship(
          authentication.user.id,
          creation.recipientUserId,
        );

      if (!confirmedRelationship.success) {
        return createSocialErrorResponse(
          "relationship-unavailable",
          "This social action is not available.",
          409,
        );
      }

      if (
        !confirmedEligibility.success ||
        confirmedEligibility.outcome !== "invitation-eligibility" ||
        !confirmedEligibility.eligible
      ) {
        const shouldRevokeParty =
          !confirmedEligibility.success &&
          TERMINAL_PARTY_FAILURES.has(confirmedEligibility.code);
        const revocationFailure = shouldRevokeParty
          ? await revokeTerminalPartyInvitations(
              socialStore,
              creation.partyCode,
            )
          : null;

        if (revocationFailure !== null) {
          return revocationFailure;
        }

        if (!confirmedEligibility.success) {
          return createMultiplayerAccountPartyFailureResponse(
            confirmedEligibility,
          );
        }

        if (confirmedEligibility.outcome !== "invitation-eligibility") {
          return createInvalidAuthorityResponse();
        }

        if (confirmedEligibility.reason === null) {
          return createInvalidAuthorityResponse();
        }

        return createSocialErrorResponse(
          confirmedEligibility.reason,
          "This friend is no longer available to invite.",
          409,
        );
      }

      const durableInvitation = await socialStore.createPartyInvitation({
        intent: creation.intent,
        inviterUserId: authentication.user.id,
        partyCode: creation.partyCode,
        recipientUserId: creation.recipientUserId,
      });

      if (!durableInvitation.success) {
        if (
          durableInvitation.reason === "blocked" ||
          durableInvitation.reason === "not-friends" ||
          durableInvitation.reason === "user-not-found"
        ) {
          return createSocialErrorResponse(
            "relationship-unavailable",
            "This social action is not available.",
            409,
          );
        }

        return createSocialStoreFailureResponse(durableInvitation);
      }

      return createSocialJsonResponse(
        {
          admissionRole: confirmedEligibility.admissionRole,
          created: durableInvitation.created,
          invitation: redactSocialPartyInvitation(
            durableInvitation.invitation,
          ),
        },
        { status: durableInvitation.created ? 201 : 200 },
      );
    },
  };
}
