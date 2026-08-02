import "server-only";

import { NextResponse } from "next/server";

import {
  getMultiplayerAccountPartyErrorStatus,
  type MultiplayerAccountPartyFailure,
} from "@/lib/server/multiplayer-account-party";
import type {
  SocialPartyInvitationRecord,
  SocialStoreFailure,
  SocialStoreFailureReason,
} from "@/lib/server/sqlite-social-store";
import { getSessionTokenFromRequest } from "@/lib/server/user-session-cookie";
import type { SocialPartyInvitation } from "@/lib/social";
import type { AuthenticatedUser } from "@/lib/user-profile";

export type SocialUserSessionLookup = {
  getUserBySessionToken: (
    sessionToken: string | null,
  ) => Promise<AuthenticatedUser | null>;
};

type SocialAuthenticationResult =
  | {
      success: true;
      user: AuthenticatedUser;
    }
  | {
      response: NextResponse;
      success: false;
    };

type SocialJsonMutationResult =
  | {
      payload: unknown;
      success: true;
    }
  | {
      response: NextResponse;
      success: false;
    };

export const MAX_SOCIAL_JSON_BODY_BYTES = 16 * 1024;

export function createSocialJsonResponse(
  payload: unknown,
  init?: ResponseInit,
) {
  const response = NextResponse.json(payload, init);

  response.headers.set("Cache-Control", "no-store");

  return response;
}

export function createSocialErrorResponse(
  code: string,
  error: string,
  status: number,
) {
  return createSocialJsonResponse({ code, error }, { status });
}

export function createSocialRateLimitExceededResponse(
  retryAfterSeconds: number,
) {
  const response = createSocialErrorResponse(
    "rate-limit-reached",
    "Too many social requests. Try again shortly.",
    429,
  );

  response.headers.set("Retry-After", String(retryAfterSeconds));

  return response;
}

export async function authenticateSocialRequest(
  request: Request,
  userStore: SocialUserSessionLookup,
): Promise<SocialAuthenticationResult> {
  const user = await userStore.getUserBySessionToken(
    getSessionTokenFromRequest(request),
  );

  return user === null
    ? {
        response: createSocialErrorResponse(
          "authentication-required",
          "Sign in to use friends and party invitations.",
          401,
        ),
        success: false,
      }
    : { success: true, user };
}

function isSameOriginWhenPresent(request: Request) {
  const origin = request.headers.get("origin");

  if (origin === null) {
    return true;
  }

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);

    if (originUrl.origin === requestUrl.origin) {
      return true;
    }

    const requestHost = request.headers.get("host")?.trim();

    return (
      requestHost !== undefined &&
      requestHost.length > 0 &&
      originUrl.protocol === requestUrl.protocol &&
      originUrl.host === requestHost
    );
  } catch {
    return false;
  }
}

function hasJsonContentType(request: Request) {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();

  return mediaType === "application/json";
}

function hasOversizedDeclaredBody(request: Request) {
  const contentLength = request.headers.get("content-length")?.trim();

  if (contentLength === undefined || !/^\d+$/.test(contentLength)) {
    return false;
  }

  const declaredBytes = Number(contentLength);

  return (
    !Number.isSafeInteger(declaredBytes) ||
    declaredBytes > MAX_SOCIAL_JSON_BODY_BYTES
  );
}

async function readBoundedSocialBody(request: Request) {
  if (request.body === null) {
    return { success: true as const, text: "" };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  while (true) {
    const chunk = await reader.read();

    if (chunk.done) {
      break;
    }

    byteLength += chunk.value.byteLength;

    if (byteLength > MAX_SOCIAL_JSON_BODY_BYTES) {
      try {
        await reader.cancel();
      } catch {
        // The response still rejects the oversized payload if stream cleanup fails.
      }

      return { success: false as const };
    }

    chunks.push(chunk.value);
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return {
    success: true as const,
    text: new TextDecoder().decode(bytes),
  };
}

function createSocialPayloadTooLargeResponse() {
  return createSocialErrorResponse(
    "payload-too-large",
    "Social request body is too large.",
    413,
  );
}

export function validateSocialMutationOrigin(request: Request) {
  return isSameOriginWhenPresent(request)
    ? null
    : createSocialErrorResponse(
        "cross-origin-request",
        "Social changes must come from this application.",
        403,
      );
}

export async function readSocialJsonMutation(
  request: Request,
): Promise<SocialJsonMutationResult> {
  const originErrorResponse = validateSocialMutationOrigin(request);

  if (originErrorResponse !== null) {
    return {
      response: originErrorResponse,
      success: false,
    };
  }

  if (!hasJsonContentType(request)) {
    return {
      response: createSocialErrorResponse(
        "unsupported-media-type",
        "Request body must use application/json.",
        415,
      ),
      success: false,
    };
  }

  if (hasOversizedDeclaredBody(request)) {
    return {
      response: createSocialPayloadTooLargeResponse(),
      success: false,
    };
  }

  try {
    const body = await readBoundedSocialBody(request);

    return body.success
      ? { payload: JSON.parse(body.text) as unknown, success: true }
      : {
          response: createSocialPayloadTooLargeResponse(),
          success: false,
        };
  } catch {
    return {
      response: createSocialErrorResponse(
        "invalid-json",
        "Request body must be valid JSON.",
        400,
      ),
      success: false,
    };
  }
}

export function getSocialStoreFailureStatus(
  reason: SocialStoreFailureReason,
) {
  switch (reason) {
    case "invalid-display-name":
    case "invalid-invitation-id":
    case "invalid-invitation-intent":
    case "invalid-party-code":
    case "invalid-rate-limit-action":
    case "invalid-user-id":
      return 400;
    case "blocked":
    case "friend-request-not-found":
    case "party-invitation-not-found":
    case "user-not-found":
      return 404;
    case "party-invitation-expired":
      return 410;
    case "party-invitation-id-conflict":
    case "party-invitation-claim-conflict":
      return 500;
    case "friend-request-limit-reached":
    case "party-invitation-limit-reached":
      return 429;
    default:
      return 409;
  }
}

function getSocialStoreFailureMessage(reason: SocialStoreFailureReason) {
  switch (reason) {
    case "already-friends":
      return "You are already friends with this player.";
    case "blocked":
      return "This social action is not available.";
    case "duplicate-party-invitation":
      return "This player already has a pending invitation to the party.";
    case "friend-request-not-incoming":
      return "This friend request is not waiting for your response.";
    case "friend-request-not-outgoing":
      return "This friend request was not sent by you.";
    case "friend-request-not-found":
      return "Friend request was not found.";
    case "friend-request-limit-reached":
      return "Too many friend requests are pending. Resolve some and try again.";
    case "incoming-request-exists":
      return "This player has already sent you a friend request.";
    case "invalid-display-name":
      return "Enter a supported user name.";
    case "invalid-invitation-id":
      return "Party invitation id is not supported.";
    case "invalid-invitation-intent":
      return "Party invitation must be for playing or watching.";
    case "invalid-party-code":
      return "Party code is not supported.";
    case "invalid-rate-limit-action":
      return "Social rate-limit action is not supported.";
    case "invalid-user-id":
      return "Player id is not supported.";
    case "not-friends":
      return "Party invitations can only be sent to friends.";
    case "party-invitation-expired":
      return "This party invitation has expired.";
    case "party-invitation-acceptance-in-progress":
      return "This party invitation is already being accepted. Try again shortly.";
    case "party-invitation-claim-conflict":
      return "Party invitation acceptance could not be started. Try again.";
    case "party-invitation-id-conflict":
      return "Party invitation could not be created. Try again.";
    case "party-invitation-limit-reached":
      return "Too many party invitations are pending. Resolve some and try again.";
    case "party-invitation-not-found":
      return "Party invitation was not found.";
    case "party-invitation-not-pending":
      return "This party invitation has already been resolved.";
    case "user-not-found":
      return "Player was not found.";
  }
}

export function createSocialStoreFailureResponse(
  failure: SocialStoreFailure,
) {
  if (failure.reason === "blocked") {
    return createSocialErrorResponse(
      "user-not-found",
      "Player was not found.",
      getSocialStoreFailureStatus(failure.reason),
    );
  }

  return createSocialErrorResponse(
    failure.reason,
    getSocialStoreFailureMessage(failure.reason),
    getSocialStoreFailureStatus(failure.reason),
  );
}

export function createMultiplayerAccountPartyFailureResponse(
  failure: MultiplayerAccountPartyFailure,
) {
  const error =
    failure.code === "room-service-invalid-response"
      ? "The multiplayer service returned an invalid response."
      : failure.code === "room-service-unavailable"
        ? "The multiplayer service is temporarily unavailable."
        : failure.error;

  return createSocialErrorResponse(
    failure.code,
    error,
    getMultiplayerAccountPartyErrorStatus(failure.code),
  );
}

export function redactSocialPartyInvitation(
  invitation: SocialPartyInvitationRecord,
): SocialPartyInvitation {
  return {
    createdAt: invitation.createdAt,
    expiresAt: invitation.expiresAt,
    id: invitation.id,
    intent: invitation.intent,
    inviter: { ...invitation.inviter },
    recipient: { ...invitation.recipient },
    resolvedAt: invitation.resolvedAt,
    status: invitation.status,
    updatedAt: invitation.updatedAt,
  };
}
