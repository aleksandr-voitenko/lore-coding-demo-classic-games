import "server-only";

import type { SqliteSocialStore } from "@/lib/server/sqlite-social-store";

import {
  authenticateSocialRequest,
  createSocialJsonResponse,
  createSocialRateLimitExceededResponse,
  createSocialStoreFailureResponse,
  type SocialUserSessionLookup,
} from "../shared";

type SocialDiscoveryStore = Pick<
  SqliteSocialStore,
  "consumeSocialApiRateLimit" | "discoverUser"
>;

export function createSocialDiscoveryRouteHandlers(
  socialStore: SocialDiscoveryStore,
  userStore: SocialUserSessionLookup,
) {
  return {
    async GET(request: Request) {
      const authentication = await authenticateSocialRequest(
        request,
        userStore,
      );

      if (!authentication.success) {
        return authentication.response;
      }

      const rateLimit = await socialStore.consumeSocialApiRateLimit(
        authentication.user.id,
        "discovery",
      );

      if (!rateLimit.success) {
        return createSocialStoreFailureResponse(rateLimit);
      }

      if (!rateLimit.allowed) {
        return createSocialRateLimitExceededResponse(
          rateLimit.retryAfterSeconds,
        );
      }

      const displayName = new URL(request.url).searchParams.get("displayName");
      const result = await socialStore.discoverUser(
        authentication.user.id,
        displayName,
      );

      return result.success
        ? createSocialJsonResponse({ discovery: result.discovery })
        : createSocialStoreFailureResponse(result);
    },
  };
}
