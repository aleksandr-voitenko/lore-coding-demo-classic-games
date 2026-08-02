import "server-only";

import { normalizePartyInvitationId } from "@/lib/social";
import type {
  MultiplayerAccountPartyAuthority,
  MultiplayerAccountPartyResult,
} from "@/lib/server/multiplayer-account-party";
import type { SqliteSocialStore } from "@/lib/server/sqlite-social-store";

import {
  authenticateSocialRequest,
  createMultiplayerAccountPartyFailureResponse,
  createSocialErrorResponse,
  createSocialJsonResponse,
  createSocialStoreFailureResponse,
  readSocialJsonMutation,
  redactSocialPartyInvitation,
  type SocialUserSessionLookup,
  validateSocialMutationOrigin,
} from "../../shared";

type PartyInvitationResolutionStore = Pick<
  SqliteSocialStore,
  | "acceptPartyInvitationAfterAdmission"
  | "cancelPartyInvitation"
  | "claimPartyInvitationForAcceptance"
  | "declinePartyInvitation"
  | "getAcceptedPartyInvitationForReacquisition"
  | "releasePartyInvitationAcceptanceClaim"
  | "revokePartyInvitationsForParty"
>;

type PartyInvitationResolutionDependencies = {
  accountPartyAuthority: MultiplayerAccountPartyAuthority;
  socialStore: PartyInvitationResolutionStore;
  userStore: SocialUserSessionLookup;
};

type PartyInvitationDecision = "accept" | "decline";

const TERMINAL_ADMISSION_FAILURES = new Set([
  "party-closed",
  "room-expired",
  "room-not-found",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDecision(value: unknown): PartyInvitationDecision | null {
  if (!isRecord(value)) {
    return null;
  }

  return value.decision === "accept" || value.decision === "decline"
    ? value.decision
    : null;
}

function createInvalidAuthorityResponse() {
  return createSocialErrorResponse(
    "room-service-invalid-response",
    "The multiplayer account authority returned an invalid response.",
    502,
  );
}

function createUnavailableAuthorityResponse() {
  return createSocialErrorResponse(
    "room-service-unavailable",
    "The multiplayer service is temporarily unavailable.",
    502,
  );
}

async function releaseAcceptanceClaim(
  socialStore: PartyInvitationResolutionStore,
  recipientUserId: string,
  invitationId: string,
  claimToken: string,
) {
  const result = await socialStore.releasePartyInvitationAcceptanceClaim(
    recipientUserId,
    invitationId,
    claimToken,
  );

  return result.success ? null : createSocialStoreFailureResponse(result);
}

async function revokePartyInvitations(
  socialStore: PartyInvitationResolutionStore,
  partyCode: string,
) {
  const result = await socialStore.revokePartyInvitationsForParty(partyCode);

  return result.success ? null : createSocialStoreFailureResponse(result);
}

async function compensateAdmission(
  accountPartyAuthority: MultiplayerAccountPartyAuthority,
  admission: Extract<
    MultiplayerAccountPartyResult,
    { outcome: "admission"; success: true }
  >,
  invitation: {
    partyCode: string;
    recipient: { id: string };
  },
) {
  if (admission.admission !== "admitted") {
    return null;
  }

  try {
    const compensation = await accountPartyAuthority.applyAccountCommand({
      participantCapability: admission.participantCapability,
      participantId: admission.participantId,
      partyCode: invitation.partyCode,
      type: "party.compensateAdmission",
      userId: invitation.recipient.id,
    });

    return compensation.success && compensation.outcome === "departure"
      ? null
      : createSocialErrorResponse(
          "admission-compensation-failed",
          "The party admission could not be rolled back safely.",
          502,
        );
  } catch {
    return createSocialErrorResponse(
      "admission-compensation-failed",
      "The party admission could not be rolled back safely.",
      502,
    );
  }
}

export function createPartyInvitationRouteHandlers({
  accountPartyAuthority,
  socialStore,
  userStore,
}: PartyInvitationResolutionDependencies) {
  return {
    async DELETE(request: Request, invitationIdValue: string) {
      const authentication = await authenticateSocialRequest(request, userStore);

      if (!authentication.success) {
        return authentication.response;
      }

      const originFailure = validateSocialMutationOrigin(request);

      if (originFailure !== null) {
        return originFailure;
      }

      const invitationId = normalizePartyInvitationId(invitationIdValue);

      if (invitationId === null) {
        return createSocialErrorResponse(
          "invalid-invitation-id",
          "Party invitation id is not supported.",
          400,
        );
      }

      const result = await socialStore.cancelPartyInvitation(
        authentication.user.id,
        invitationId,
      );

      return result.success
        ? createSocialJsonResponse({
            invitation: redactSocialPartyInvitation(result.invitation),
          })
        : createSocialStoreFailureResponse(result);
    },

    async PATCH(request: Request, invitationIdValue: string) {
      const authentication = await authenticateSocialRequest(request, userStore);

      if (!authentication.success) {
        return authentication.response;
      }

      const invitationId = normalizePartyInvitationId(invitationIdValue);

      if (invitationId === null) {
        return createSocialErrorResponse(
          "invalid-invitation-id",
          "Party invitation id is not supported.",
          400,
        );
      }

      const json = await readSocialJsonMutation(request);

      if (!json.success) {
        return json.response;
      }

      const decision = parseDecision(json.payload);

      if (decision === null) {
        return createSocialErrorResponse(
          "invalid-invitation-decision",
          "Party invitation decision is not supported.",
          400,
        );
      }

      if (decision === "decline") {
        const result = await socialStore.declinePartyInvitation(
          authentication.user.id,
          invitationId,
        );

        return result.success
          ? createSocialJsonResponse({
              invitation: redactSocialPartyInvitation(result.invitation),
            })
          : createSocialStoreFailureResponse(result);
      }

      const acceptanceClaim =
        await socialStore.claimPartyInvitationForAcceptance(
          authentication.user.id,
          invitationId,
        );

      if (!acceptanceClaim.success) {
        if (acceptanceClaim.reason !== "party-invitation-not-pending") {
          return createSocialStoreFailureResponse(acceptanceClaim);
        }

        const acceptedInvitation =
          await socialStore.getAcceptedPartyInvitationForReacquisition(
            authentication.user.id,
            invitationId,
          );

        if (!acceptedInvitation.success) {
          return createSocialStoreFailureResponse(acceptanceClaim);
        }

        let reacquisition: Awaited<
          ReturnType<MultiplayerAccountPartyAuthority["applyAccountCommand"]>
        >;

        try {
          reacquisition = await accountPartyAuthority.applyAccountCommand({
            partyCode: acceptedInvitation.invitation.partyCode,
            type: "party.reacquireAuthenticated",
            user: authentication.user,
          });
        } catch {
          return createUnavailableAuthorityResponse();
        }

        if (!reacquisition.success) {
          return createMultiplayerAccountPartyFailureResponse(reacquisition);
        }

        if (reacquisition.outcome !== "admission") {
          return createInvalidAuthorityResponse();
        }

        if (reacquisition.admission !== "reacquired") {
          const compensationFailure = await compensateAdmission(
            accountPartyAuthority,
            reacquisition,
            acceptedInvitation.invitation,
          );

          return (
            compensationFailure ??
            createSocialErrorResponse(
              "party-membership-not-reacquirable",
              "Party access could not be restored safely.",
              409,
            )
          );
        }

        return createSocialJsonResponse({
          admission: reacquisition.admission,
          invitation: redactSocialPartyInvitation(
            acceptedInvitation.invitation,
          ),
          participantCapability: reacquisition.participantCapability,
          participantId: reacquisition.participantId,
          snapshot: reacquisition.snapshot,
        });
      }

      let admission: Awaited<
        ReturnType<MultiplayerAccountPartyAuthority["applyAccountCommand"]>
      >;

      try {
        admission = await accountPartyAuthority.applyAccountCommand({
          intent: acceptanceClaim.invitation.intent,
          partyCode: acceptanceClaim.invitation.partyCode,
          type: "party.admitAuthenticated",
          user: authentication.user,
        });
      } catch {
        const releaseFailure = await releaseAcceptanceClaim(
          socialStore,
          authentication.user.id,
          invitationId,
          acceptanceClaim.claimToken,
        );

        return releaseFailure ?? createUnavailableAuthorityResponse();
      }

      if (!admission.success) {
        const releaseFailure = await releaseAcceptanceClaim(
          socialStore,
          authentication.user.id,
          invitationId,
          acceptanceClaim.claimToken,
        );

        if (releaseFailure !== null) {
          return releaseFailure;
        }

        if (TERMINAL_ADMISSION_FAILURES.has(admission.code)) {
          const revocationFailure = await revokePartyInvitations(
            socialStore,
            acceptanceClaim.invitation.partyCode,
          );

          if (revocationFailure !== null) {
            return revocationFailure;
          }
        }

        return createMultiplayerAccountPartyFailureResponse(admission);
      }

      if (admission.outcome !== "admission") {
        const releaseFailure = await releaseAcceptanceClaim(
          socialStore,
          authentication.user.id,
          invitationId,
          acceptanceClaim.claimToken,
        );

        return releaseFailure ?? createInvalidAuthorityResponse();
      }

      let acceptance:
        | Awaited<
            ReturnType<
              PartyInvitationResolutionStore["acceptPartyInvitationAfterAdmission"]
            >
          >
        | null = null;

      try {
        acceptance = await socialStore.acceptPartyInvitationAfterAdmission(
          authentication.user.id,
          invitationId,
          acceptanceClaim.claimToken,
        );
      } catch {
        const compensationFailure = await compensateAdmission(
          accountPartyAuthority,
          admission,
          acceptanceClaim.invitation,
        );

        if (compensationFailure !== null) {
          return compensationFailure;
        }

        const releaseFailure = await releaseAcceptanceClaim(
          socialStore,
          authentication.user.id,
          invitationId,
          acceptanceClaim.claimToken,
        );

        return (
          releaseFailure ??
          createSocialErrorResponse(
            "invitation-persistence-failed",
            "The accepted invitation could not be saved.",
            500,
          )
        );
      }

      if (!acceptance.success) {
        const compensationFailure = await compensateAdmission(
          accountPartyAuthority,
          admission,
          acceptanceClaim.invitation,
        );

        if (compensationFailure !== null) {
          return compensationFailure;
        }

        const releaseFailure = await releaseAcceptanceClaim(
          socialStore,
          authentication.user.id,
          invitationId,
          acceptanceClaim.claimToken,
        );

        return (
          releaseFailure ?? createSocialStoreFailureResponse(acceptance)
        );
      }

      return createSocialJsonResponse({
        admission: admission.admission,
        invitation: redactSocialPartyInvitation(acceptance.invitation),
        participantCapability: admission.participantCapability,
        participantId: admission.participantId,
        snapshot: admission.snapshot,
      });
    },
  };
}
