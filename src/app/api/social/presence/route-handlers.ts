import "server-only";

import type { MultiplayerAccountPartyAuthority } from "@/lib/server/multiplayer-account-party";

import {
  authenticateSocialRequest,
  createMultiplayerAccountPartyFailureResponse,
  createSocialErrorResponse,
  createSocialJsonResponse,
  readSocialJsonMutation,
  type SocialUserSessionLookup,
} from "../shared";

type SocialPresenceAuthority = Pick<
  MultiplayerAccountPartyAuthority,
  "applyAccountCommand"
>;
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function applyPresenceCommand(
  command: Parameters<SocialPresenceAuthority["applyAccountCommand"]>[0],
  accountAuthority: SocialPresenceAuthority,
) {
  const result = await accountAuthority.applyAccountCommand(command);

  if (!result.success) {
    return createMultiplayerAccountPartyFailureResponse(result);
  }

  if (result.outcome !== "presence") {
    return createSocialErrorResponse(
      "room-service-invalid-response",
      "Presence service returned an unexpected result.",
      502,
    );
  }

  return createSocialJsonResponse({
    availability: result.availability,
    changed: result.changed,
  });
}

export function createSocialPresenceRouteHandlers(
  userStore: SocialUserSessionLookup,
  accountAuthority: SocialPresenceAuthority,
) {
  return {
    async DELETE(request: Request) {
      const authentication = await authenticateSocialRequest(
        request,
        userStore,
      );

      if (!authentication.success) {
        return authentication.response;
      }

      const body = await readSocialJsonMutation(request);

      if (!body.success) {
        return body.response;
      }

      return applyPresenceCommand(
        {
          clientId: isRecord(body.payload)
            ? body.payload.clientId
            : undefined,
          type: "presence.release",
          userId: authentication.user.id,
        },
        accountAuthority,
      );
    },

    async POST(request: Request) {
      const authentication = await authenticateSocialRequest(
        request,
        userStore,
      );

      if (!authentication.success) {
        return authentication.response;
      }

      const body = await readSocialJsonMutation(request);

      if (!body.success) {
        return body.response;
      }

      return applyPresenceCommand(
        {
          clientId: isRecord(body.payload)
            ? body.payload.clientId
            : undefined,
          state: isRecord(body.payload) ? body.payload.state : undefined,
          type: "presence.renew",
          userId: authentication.user.id,
        },
        accountAuthority,
      );
    },
  };
}
