import type {
  MultiplayerRoomSnapshot as MultiplayerProtocolRoomSnapshot,
} from "../multiplayer/protocol";
import type { MultiplayerSocialEffectivePresenceState } from "./multiplayer-social-presence";

export const MAX_MULTIPLAYER_ACCOUNT_AVAILABILITY_USER_IDS = 256;

export type MultiplayerAccountPartyCommand =
  | {
      clientId: unknown;
      state: unknown;
      type: "presence.renew";
      userId: unknown;
    }
  | {
      clientId: unknown;
      type: "presence.release";
      userId: unknown;
    }
  | {
      type: "presence.resolve";
      userIds: unknown;
    }
  | {
      hostUserId: unknown;
      intent: unknown;
      partyCode: unknown;
      recipientUserId: unknown;
      type: "party.inspectInvitation";
    }
  | {
      intent: unknown;
      partyCode: unknown;
      type: "party.admitAuthenticated";
      user: unknown;
    }
  | {
      partyCode: unknown;
      type: "party.reacquireAuthenticated";
      user: unknown;
    }
  | {
      participantCapability: unknown;
      participantId: unknown;
      partyCode: unknown;
      type: "party.compensateAdmission";
      userId: unknown;
    };

export type MultiplayerAccountPartyFailureCode =
  | "in-other-party"
  | "invalid-account-command"
  | "invalid-client-id"
  | "invalid-invitation-intent"
  | "invalid-participant-id"
  | "invalid-presence-state"
  | "invalid-room-code"
  | "invalid-user-id"
  | "lease-capacity-reached"
  | "not-host"
  | "observer-limit-reached"
  | "participant-capability-limit-reached"
  | "participant-conflict"
  | "participant-not-found"
  | "party-closed"
  | "recipient-unavailable"
  | "presence-resolution-limit-reached"
  | "room-expired"
  | "room-not-found"
  | "room-service-invalid-response"
  | "room-service-unavailable";

export type MultiplayerAccountPartyFailure = {
  code: MultiplayerAccountPartyFailureCode;
  error: string;
  success: false;
};

export type MultiplayerAccountAvailability = {
  availability: MultiplayerSocialEffectivePresenceState;
  userId: string;
};

export type MultiplayerPartyInvitationIneligibilityReason =
  | "party-full"
  | "recipient-busy"
  | "recipient-in-party"
  | "recipient-offline";

export type MultiplayerAccountPartySuccess<
  TSnapshot extends MultiplayerProtocolRoomSnapshot = MultiplayerProtocolRoomSnapshot,
> =
  | {
      availability: MultiplayerSocialEffectivePresenceState;
      changed: boolean;
      outcome: "presence";
      success: true;
    }
  | {
      availabilities: MultiplayerAccountAvailability[];
      outcome: "availability";
      success: true;
    }
  | {
      admissionRole: "observer" | "player" | null;
      eligible: boolean;
      outcome: "invitation-eligibility";
      reason: MultiplayerPartyInvitationIneligibilityReason | null;
      success: true;
    }
  | {
      admission: "admitted" | "reacquired";
      outcome: "admission";
      participantCapability: string;
      participantId: string;
      snapshot: TSnapshot;
      success: true;
    }
  | {
      departed: boolean;
      departedParticipantId?: string;
      outcome: "departure";
      snapshot?: TSnapshot;
      success: true;
    };

export type MultiplayerAccountPartyResult<
  TSnapshot extends MultiplayerProtocolRoomSnapshot = MultiplayerProtocolRoomSnapshot,
> =
  | MultiplayerAccountPartyFailure
  | MultiplayerAccountPartySuccess<TSnapshot>;

export type MultiplayerAccountPartyOperationResult<
  TSnapshot extends MultiplayerProtocolRoomSnapshot = MultiplayerProtocolRoomSnapshot,
> =
  | MultiplayerAccountPartyResult<TSnapshot>
  | Promise<MultiplayerAccountPartyResult<TSnapshot>>;

export type MultiplayerAccountPartyAuthority<
  TSnapshot extends MultiplayerProtocolRoomSnapshot = MultiplayerProtocolRoomSnapshot,
> = {
  applyAccountCommand: (
    command: MultiplayerAccountPartyCommand,
  ) => MultiplayerAccountPartyOperationResult<TSnapshot>;
};

export function getMultiplayerAccountPartyErrorStatus(
  code: MultiplayerAccountPartyFailureCode,
) {
  if (code === "room-expired" || code === "party-closed") {
    return 410;
  }

  if (code === "room-not-found" || code === "participant-not-found") {
    return 404;
  }

  if (code === "not-host") {
    return 403;
  }

  if (
    code === "room-service-invalid-response" ||
    code === "room-service-unavailable"
  ) {
    return 502;
  }

  if (
    code === "lease-capacity-reached" ||
    code === "participant-capability-limit-reached"
  ) {
    return 429;
  }

  if (code === "presence-resolution-limit-reached") {
    return 413;
  }

  if (
    code === "in-other-party" ||
    code === "observer-limit-reached" ||
    code === "participant-conflict" ||
    code === "recipient-unavailable"
  ) {
    return 409;
  }

  return 400;
}

export function isMultiplayerAccountPartyFailureCode(
  value: unknown,
): value is MultiplayerAccountPartyFailureCode {
  switch (value) {
    case "in-other-party":
    case "invalid-account-command":
    case "invalid-client-id":
    case "invalid-invitation-intent":
    case "invalid-participant-id":
    case "invalid-presence-state":
    case "invalid-room-code":
    case "invalid-user-id":
    case "lease-capacity-reached":
    case "not-host":
    case "observer-limit-reached":
    case "participant-capability-limit-reached":
    case "participant-conflict":
    case "participant-not-found":
    case "party-closed":
    case "recipient-unavailable":
    case "presence-resolution-limit-reached":
    case "room-expired":
    case "room-not-found":
    case "room-service-invalid-response":
    case "room-service-unavailable":
      return true;
  }

  return false;
}
