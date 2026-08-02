import "server-only";

import type {
  FriendRequestMutationResult,
  FriendshipMutationResult,
  SocialBlockMutationResult,
  SocialMutationResult,
  SqliteSocialStore,
} from "@/lib/server/sqlite-social-store";
import { normalizeSocialUserId } from "@/lib/social";

import {
  authenticateSocialRequest,
  createSocialErrorResponse,
  createSocialJsonResponse,
  createSocialRateLimitExceededResponse,
  createSocialStoreFailureResponse,
  readSocialJsonMutation,
  type SocialUserSessionLookup,
  validateSocialMutationOrigin,
} from "./shared";

type SocialRelationshipStore = Pick<
  SqliteSocialStore,
  | "acceptFriendRequest"
  | "blockUser"
  | "cancelFriendRequest"
  | "consumeSocialApiRateLimit"
  | "createFriendRequest"
  | "declineFriendRequest"
  | "removeFriend"
  | "unblockUser"
>;

type RelationshipMutationResult =
  | FriendRequestMutationResult
  | FriendshipMutationResult
  | SocialBlockMutationResult
  | SocialMutationResult;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getTargetUserId(value: unknown) {
  return isRecord(value) ? normalizeSocialUserId(value.userId) : null;
}

function createMutationResponse(
  result: RelationshipMutationResult,
  successStatus = 200,
) {
  return result.success
    ? createSocialJsonResponse(result, { status: successStatus })
    : createSocialStoreFailureResponse(result);
}

function createInvalidUserIdResponse() {
  return createSocialErrorResponse(
    "invalid-user-id",
    "Player id is not supported.",
    400,
  );
}

export function createSocialRelationshipRouteHandlers(
  socialStore: SocialRelationshipStore,
  userStore: SocialUserSessionLookup,
) {
  return {
    async acceptOrDeclineFriendRequest(
      request: Request,
      targetUserIdValue: unknown,
    ) {
      const authentication = await authenticateSocialRequest(request, userStore);

      if (!authentication.success) {
        return authentication.response;
      }

      const json = await readSocialJsonMutation(request);

      if (!json.success) {
        return json.response;
      }

      const targetUserId = normalizeSocialUserId(targetUserIdValue);

      if (targetUserId === null) {
        return createInvalidUserIdResponse();
      }

      const decision = isRecord(json.payload) ? json.payload.decision : null;

      if (decision !== "accept" && decision !== "decline") {
        return createSocialErrorResponse(
          "invalid-decision",
          "Friend request decision must be accept or decline.",
          400,
        );
      }

      const result = decision === "accept"
        ? await socialStore.acceptFriendRequest(
            authentication.user.id,
            targetUserId,
          )
        : await socialStore.declineFriendRequest(
            authentication.user.id,
            targetUserId,
          );

      return createMutationResponse(result);
    },

    async blockUser(request: Request) {
      const authentication = await authenticateSocialRequest(request, userStore);

      if (!authentication.success) {
        return authentication.response;
      }

      const json = await readSocialJsonMutation(request);

      if (!json.success) {
        return json.response;
      }

      const targetUserId = getTargetUserId(json.payload);

      if (targetUserId === null) {
        return createInvalidUserIdResponse();
      }

      const result = await socialStore.blockUser(
        authentication.user.id,
        targetUserId,
      );

      return createMutationResponse(
        result,
        result.success && result.created ? 201 : 200,
      );
    },

    async cancelFriendRequest(
      request: Request,
      targetUserIdValue: unknown,
    ) {
      const authentication = await authenticateSocialRequest(request, userStore);

      if (!authentication.success) {
        return authentication.response;
      }

      const crossOriginResponse = validateSocialMutationOrigin(request);

      if (crossOriginResponse !== null) {
        return crossOriginResponse;
      }

      const targetUserId = normalizeSocialUserId(targetUserIdValue);

      if (targetUserId === null) {
        return createInvalidUserIdResponse();
      }

      const result = await socialStore.cancelFriendRequest(
        authentication.user.id,
        targetUserId,
      );

      return createMutationResponse(result);
    },

    async createFriendRequest(request: Request) {
      const authentication = await authenticateSocialRequest(request, userStore);

      if (!authentication.success) {
        return authentication.response;
      }

      const json = await readSocialJsonMutation(request);

      if (!json.success) {
        return json.response;
      }

      const targetUserId = getTargetUserId(json.payload);

      if (targetUserId === null) {
        return createInvalidUserIdResponse();
      }

      const rateLimit = await socialStore.consumeSocialApiRateLimit(
        authentication.user.id,
        "friend-request",
      );

      if (!rateLimit.success) {
        return createSocialStoreFailureResponse(rateLimit);
      }

      if (!rateLimit.allowed) {
        return createSocialRateLimitExceededResponse(
          rateLimit.retryAfterSeconds,
        );
      }

      const result = await socialStore.createFriendRequest(
        authentication.user.id,
        targetUserId,
      );

      return createMutationResponse(
        result,
        result.success && result.created ? 201 : 200,
      );
    },

    async removeFriend(request: Request, targetUserIdValue: unknown) {
      const authentication = await authenticateSocialRequest(request, userStore);

      if (!authentication.success) {
        return authentication.response;
      }

      const crossOriginResponse = validateSocialMutationOrigin(request);

      if (crossOriginResponse !== null) {
        return crossOriginResponse;
      }

      const targetUserId = normalizeSocialUserId(targetUserIdValue);

      if (targetUserId === null) {
        return createInvalidUserIdResponse();
      }

      const result = await socialStore.removeFriend(
        authentication.user.id,
        targetUserId,
      );

      return createMutationResponse(result);
    },

    async unblockUser(request: Request, targetUserIdValue: unknown) {
      const authentication = await authenticateSocialRequest(request, userStore);

      if (!authentication.success) {
        return authentication.response;
      }

      const crossOriginResponse = validateSocialMutationOrigin(request);

      if (crossOriginResponse !== null) {
        return crossOriginResponse;
      }

      const targetUserId = normalizeSocialUserId(targetUserIdValue);

      if (targetUserId === null) {
        return createInvalidUserIdResponse();
      }

      const result = await socialStore.unblockUser(
        authentication.user.id,
        targetUserId,
      );

      return createMutationResponse(result);
    },
  };
}
