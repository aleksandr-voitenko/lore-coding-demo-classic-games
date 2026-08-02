import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSocialRelationshipRouteHandlers } from "./relationship-route-handlers";

type SocialStore = Parameters<
  typeof createSocialRelationshipRouteHandlers
>[0];
type UserStore = Parameters<typeof createSocialRelationshipRouteHandlers>[1];

const ACTOR = {
  displayName: "Ada",
  id: "actor-1",
};
const TARGET = {
  displayName: "Grace",
  id: "target-1",
};
const FRIEND_REQUEST = {
  createdAt: "2026-08-03T01:00:00.000Z",
  direction: "outgoing" as const,
  user: TARGET,
};
const FRIEND = {
  availability: "unknown" as const,
  friendsSince: "2026-08-03T01:05:00.000Z",
  user: TARGET,
};
const BLOCK = {
  blockedAt: "2026-08-03T01:10:00.000Z",
  user: TARGET,
};

function createHarness() {
  const socialStore: SocialStore = {
    acceptFriendRequest: vi.fn(),
    blockUser: vi.fn(),
    cancelFriendRequest: vi.fn(),
    consumeSocialApiRateLimit: vi.fn(async () => ({
      allowed: true,
      remaining: 9,
      resetAt: "2026-08-03T01:01:00.000Z",
      retryAfterSeconds: 0,
      success: true as const,
    })),
    createFriendRequest: vi.fn(),
    declineFriendRequest: vi.fn(),
    removeFriend: vi.fn(),
    unblockUser: vi.fn(),
  };
  const userStore: UserStore = {
    getUserBySessionToken: vi.fn(),
  };

  return {
    handlers: createSocialRelationshipRouteHandlers(socialStore, userStore),
    socialStore,
    userStore,
  };
}

function createJsonRequest(
  path: string,
  body: unknown,
  options?: {
    contentType?: string;
    method?: "PATCH" | "POST";
    origin?: string;
  },
) {
  return new Request(`https://games.example${path}`, {
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: {
      ...(options?.contentType === undefined
        ? { "content-type": "application/json; charset=utf-8" }
        : options.contentType.length > 0
          ? { "content-type": options.contentType }
          : {}),
      cookie: "game_user_session=session-token",
      ...(options?.origin === undefined ? {} : { origin: options.origin }),
    },
    method: options?.method ?? "POST",
  });
}

function createDeleteRequest(path: string, origin?: string) {
  return new Request(`https://games.example${path}`, {
    headers: {
      cookie: "game_user_session=session-token",
      ...(origin === undefined ? {} : { origin }),
    },
    method: "DELETE",
  });
}

async function expectJsonResponse(
  response: Response,
  status: number,
  body: unknown,
) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("no-store");
  await expect(response.json()).resolves.toEqual(body);
}

describe("social relationship route handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authenticates every relationship mutation before parsing or storing", async () => {
    const { handlers, socialStore, userStore } = createHarness();

    vi.mocked(userStore.getUserBySessionToken).mockResolvedValue(null);

    const malformedRequest = () =>
      new Request("https://games.example/api/social/friend-requests", {
        body: "{",
        headers: {
          "content-type": "text/plain",
          origin: "https://attacker.example",
        },
        method: "POST",
      });
    const responses = [
      await handlers.createFriendRequest(malformedRequest()),
      await handlers.acceptOrDeclineFriendRequest(malformedRequest(), "target-1"),
      await handlers.cancelFriendRequest(malformedRequest(), "target-1"),
      await handlers.removeFriend(malformedRequest(), "target-1"),
      await handlers.blockUser(malformedRequest()),
      await handlers.unblockUser(malformedRequest(), "target-1"),
    ];

    for (const response of responses) {
      await expectJsonResponse(response, 401, {
        code: "authentication-required",
        error: "Sign in to use friends and party invitations.",
      });
    }
    expect(userStore.getUserBySessionToken).toHaveBeenCalledTimes(6);
    expect(userStore.getUserBySessionToken).toHaveBeenCalledWith(null);
    expect(socialStore.createFriendRequest).not.toHaveBeenCalled();
    expect(socialStore.acceptFriendRequest).not.toHaveBeenCalled();
    expect(socialStore.declineFriendRequest).not.toHaveBeenCalled();
    expect(socialStore.cancelFriendRequest).not.toHaveBeenCalled();
    expect(socialStore.removeFriend).not.toHaveBeenCalled();
    expect(socialStore.blockUser).not.toHaveBeenCalled();
    expect(socialStore.unblockUser).not.toHaveBeenCalled();
  });

  it("rejects cross-origin, non-JSON, and malformed JSON bodies", async () => {
    const { handlers, socialStore, userStore } = createHarness();

    vi.mocked(userStore.getUserBySessionToken).mockResolvedValue(ACTOR);

    const crossOriginResponse = await handlers.createFriendRequest(
      createJsonRequest(
        "/api/social/friend-requests",
        { userId: TARGET.id },
        { origin: "https://attacker.example" },
      ),
    );
    const unsupportedMediaResponse = await handlers.createFriendRequest(
      createJsonRequest(
        "/api/social/friend-requests",
        { userId: TARGET.id },
        { contentType: "text/plain" },
      ),
    );
    const invalidJsonResponse = await handlers.acceptOrDeclineFriendRequest(
      createJsonRequest(
        `/api/social/friend-requests/${TARGET.id}`,
        "{",
        { method: "PATCH" },
      ),
      TARGET.id,
    );

    await expectJsonResponse(crossOriginResponse, 403, {
      code: "cross-origin-request",
      error: "Social changes must come from this application.",
    });
    await expectJsonResponse(unsupportedMediaResponse, 415, {
      code: "unsupported-media-type",
      error: "Request body must use application/json.",
    });
    await expectJsonResponse(invalidJsonResponse, 400, {
      code: "invalid-json",
      error: "Request body must be valid JSON.",
    });
    expect(socialStore.createFriendRequest).not.toHaveBeenCalled();
    expect(socialStore.acceptFriendRequest).not.toHaveBeenCalled();
    expect(socialStore.declineFriendRequest).not.toHaveBeenCalled();
  });

  it("creates friend requests for the session actor and preserves retry results", async () => {
    const { handlers, socialStore, userStore } = createHarness();

    vi.mocked(userStore.getUserBySessionToken).mockResolvedValue(ACTOR);
    vi.mocked(socialStore.createFriendRequest)
      .mockResolvedValueOnce({
        created: true,
        request: FRIEND_REQUEST,
        success: true,
      })
      .mockResolvedValueOnce({
        created: false,
        request: FRIEND_REQUEST,
        success: true,
      });

    const requestBody = {
      actorUserId: "forged-actor",
      userId: ` ${TARGET.id} `,
    };
    const createdResponse = await handlers.createFriendRequest(
      createJsonRequest("/api/social/friend-requests", requestBody, {
        origin: "https://games.example",
      }),
    );
    const retryResponse = await handlers.createFriendRequest(
      createJsonRequest("/api/social/friend-requests", requestBody),
    );

    await expectJsonResponse(createdResponse, 201, {
      created: true,
      request: FRIEND_REQUEST,
      success: true,
    });
    await expectJsonResponse(retryResponse, 200, {
      created: false,
      request: FRIEND_REQUEST,
      success: true,
    });
    expect(userStore.getUserBySessionToken).toHaveBeenCalledWith(
      "session-token",
    );
    expect(socialStore.createFriendRequest).toHaveBeenNthCalledWith(
      1,
      ACTOR.id,
      TARGET.id,
    );
    expect(socialStore.createFriendRequest).toHaveBeenNthCalledWith(
      2,
      ACTOR.id,
      TARGET.id,
    );
  });

  it("returns 429 before creating a friend request when the actor exceeds the rate limit", async () => {
    const { handlers, socialStore, userStore } = createHarness();

    vi.mocked(userStore.getUserBySessionToken).mockResolvedValue(ACTOR);
    vi.mocked(socialStore.consumeSocialApiRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: "2026-08-03T01:01:00.000Z",
      retryAfterSeconds: 24,
      success: true,
    });

    const response = await handlers.createFriendRequest(
      createJsonRequest("/api/social/friend-requests", {
        userId: TARGET.id,
      }),
    );

    await expectJsonResponse(response, 429, {
      code: "rate-limit-reached",
      error: "Too many social requests. Try again shortly.",
    });
    expect(response.headers.get("retry-after")).toBe("24");
    expect(socialStore.createFriendRequest).not.toHaveBeenCalled();
  });

  it("routes accept and decline decisions without reversing request direction", async () => {
    const { handlers, socialStore, userStore } = createHarness();

    vi.mocked(userStore.getUserBySessionToken).mockResolvedValue(ACTOR);
    vi.mocked(socialStore.acceptFriendRequest).mockResolvedValue({
      friend: FRIEND,
      success: true,
    });
    vi.mocked(socialStore.declineFriendRequest).mockResolvedValue({
      success: true,
    });

    const acceptResponse = await handlers.acceptOrDeclineFriendRequest(
      createJsonRequest(
        `/api/social/friend-requests/${TARGET.id}`,
        { decision: "accept" },
        { method: "PATCH" },
      ),
      ` ${TARGET.id} `,
    );
    const declineResponse = await handlers.acceptOrDeclineFriendRequest(
      createJsonRequest(
        `/api/social/friend-requests/${TARGET.id}`,
        { decision: "decline" },
        { method: "PATCH" },
      ),
      TARGET.id,
    );

    await expectJsonResponse(acceptResponse, 200, {
      friend: FRIEND,
      success: true,
    });
    await expectJsonResponse(declineResponse, 200, { success: true });
    expect(socialStore.acceptFriendRequest).toHaveBeenCalledWith(
      ACTOR.id,
      TARGET.id,
    );
    expect(socialStore.declineFriendRequest).toHaveBeenCalledWith(
      ACTOR.id,
      TARGET.id,
    );
  });

  it("rejects unsupported friend-request decisions and invalid path ids", async () => {
    const { handlers, socialStore, userStore } = createHarness();

    vi.mocked(userStore.getUserBySessionToken).mockResolvedValue(ACTOR);

    const invalidDecisionResponse = await handlers.acceptOrDeclineFriendRequest(
      createJsonRequest(
        `/api/social/friend-requests/${TARGET.id}`,
        { decision: "later" },
        { method: "PATCH" },
      ),
      TARGET.id,
    );
    const invalidPathResponse = await handlers.cancelFriendRequest(
      createDeleteRequest("/api/social/friend-requests/not%20valid"),
      "not valid",
    );

    await expectJsonResponse(invalidDecisionResponse, 400, {
      code: "invalid-decision",
      error: "Friend request decision must be accept or decline.",
    });
    await expectJsonResponse(invalidPathResponse, 400, {
      code: "invalid-user-id",
      error: "Player id is not supported.",
    });
    expect(socialStore.acceptFriendRequest).not.toHaveBeenCalled();
    expect(socialStore.declineFriendRequest).not.toHaveBeenCalled();
    expect(socialStore.cancelFriendRequest).not.toHaveBeenCalled();
  });

  it("preserves directional conflicts from accept and cancel mutations", async () => {
    const { handlers, socialStore, userStore } = createHarness();

    vi.mocked(userStore.getUserBySessionToken).mockResolvedValue(ACTOR);
    vi.mocked(socialStore.acceptFriendRequest).mockResolvedValue({
      reason: "friend-request-not-incoming",
      success: false,
    });
    vi.mocked(socialStore.cancelFriendRequest).mockResolvedValue({
      reason: "friend-request-not-outgoing",
      success: false,
    });

    const acceptResponse = await handlers.acceptOrDeclineFriendRequest(
      createJsonRequest(
        `/api/social/friend-requests/${TARGET.id}`,
        { decision: "accept" },
        { method: "PATCH" },
      ),
      TARGET.id,
    );
    const cancelResponse = await handlers.cancelFriendRequest(
      createDeleteRequest(`/api/social/friend-requests/${TARGET.id}`),
      TARGET.id,
    );

    await expectJsonResponse(acceptResponse, 409, {
      code: "friend-request-not-incoming",
      error: "This friend request is not waiting for your response.",
    });
    await expectJsonResponse(cancelResponse, 409, {
      code: "friend-request-not-outgoing",
      error: "This friend request was not sent by you.",
    });
  });

  it("rejects cross-origin DELETE mutations without requiring a request body", async () => {
    const { handlers, socialStore, userStore } = createHarness();

    vi.mocked(userStore.getUserBySessionToken).mockResolvedValue(ACTOR);

    const responses = [
      await handlers.cancelFriendRequest(
        createDeleteRequest(
          `/api/social/friend-requests/${TARGET.id}`,
          "https://attacker.example",
        ),
        TARGET.id,
      ),
      await handlers.removeFriend(
        createDeleteRequest(
          `/api/social/friends/${TARGET.id}`,
          "https://attacker.example",
        ),
        TARGET.id,
      ),
      await handlers.unblockUser(
        createDeleteRequest(
          `/api/social/blocks/${TARGET.id}`,
          "https://attacker.example",
        ),
        TARGET.id,
      ),
    ];

    for (const response of responses) {
      await expectJsonResponse(response, 403, {
        code: "cross-origin-request",
        error: "Social changes must come from this application.",
      });
    }
    expect(socialStore.cancelFriendRequest).not.toHaveBeenCalled();
    expect(socialStore.removeFriend).not.toHaveBeenCalled();
    expect(socialStore.unblockUser).not.toHaveBeenCalled();
  });

  it("keeps cancellation, removal, and unblocking retry-safe", async () => {
    const { handlers, socialStore, userStore } = createHarness();

    vi.mocked(userStore.getUserBySessionToken).mockResolvedValue(ACTOR);
    vi.mocked(socialStore.cancelFriendRequest).mockResolvedValue({
      success: true,
    });
    vi.mocked(socialStore.removeFriend).mockResolvedValue({ success: true });
    vi.mocked(socialStore.unblockUser).mockResolvedValue({ success: true });

    const cancelResponse = await handlers.cancelFriendRequest(
      createDeleteRequest(`/api/social/friend-requests/${TARGET.id}`),
      ` ${TARGET.id} `,
    );
    const removeResponse = await handlers.removeFriend(
      createDeleteRequest(`/api/social/friends/${TARGET.id}`),
      TARGET.id,
    );
    const unblockResponse = await handlers.unblockUser(
      createDeleteRequest(`/api/social/blocks/${TARGET.id}`),
      TARGET.id,
    );

    await expectJsonResponse(cancelResponse, 200, { success: true });
    await expectJsonResponse(removeResponse, 200, { success: true });
    await expectJsonResponse(unblockResponse, 200, { success: true });
    expect(socialStore.cancelFriendRequest).toHaveBeenCalledWith(
      ACTOR.id,
      TARGET.id,
    );
    expect(socialStore.removeFriend).toHaveBeenCalledWith(
      ACTOR.id,
      TARGET.id,
    );
    expect(socialStore.unblockUser).toHaveBeenCalledWith(
      ACTOR.id,
      TARGET.id,
    );
  });

  it("creates blocks for the session actor and preserves block retries", async () => {
    const { handlers, socialStore, userStore } = createHarness();

    vi.mocked(userStore.getUserBySessionToken).mockResolvedValue(ACTOR);
    vi.mocked(socialStore.blockUser)
      .mockResolvedValueOnce({
        block: BLOCK,
        created: true,
        success: true,
      })
      .mockResolvedValueOnce({
        block: BLOCK,
        created: false,
        success: true,
      });

    const createdResponse = await handlers.blockUser(
      createJsonRequest("/api/social/blocks", {
        actorUserId: "forged-actor",
        userId: TARGET.id,
      }),
    );
    const retryResponse = await handlers.blockUser(
      createJsonRequest("/api/social/blocks", { userId: TARGET.id }),
    );

    await expectJsonResponse(createdResponse, 201, {
      block: BLOCK,
      created: true,
      success: true,
    });
    await expectJsonResponse(retryResponse, 200, {
      block: BLOCK,
      created: false,
      success: true,
    });
    expect(socialStore.blockUser).toHaveBeenNthCalledWith(
      1,
      ACTOR.id,
      TARGET.id,
    );
    expect(socialStore.blockUser).toHaveBeenNthCalledWith(
      2,
      ACTOR.id,
      TARGET.id,
    );
  });

  it.each([
    [
      "invalid-user-id" as const,
      400,
      "Player id is not supported.",
    ],
    ["user-not-found" as const, 404, "Player was not found."],
    [
      "friend-request-limit-reached" as const,
      429,
      "Too many friend requests are pending. Resolve some and try again.",
    ],
    [
      "already-friends" as const,
      409,
      "You are already friends with this player.",
    ],
  ])(
    "maps %s store failures to stable errors",
    async (reason, expectedStatus, expectedError) => {
      const { handlers, socialStore, userStore } = createHarness();

      vi.mocked(userStore.getUserBySessionToken).mockResolvedValue(ACTOR);
      vi.mocked(socialStore.createFriendRequest).mockResolvedValue({
        reason,
        success: false,
      });

      const response = await handlers.createFriendRequest(
        createJsonRequest("/api/social/friend-requests", {
          userId: TARGET.id,
        }),
      );

      await expectJsonResponse(response, expectedStatus, {
        code: reason,
        error: expectedError,
      });
    },
  );

  it("makes a reciprocal block indistinguishable from a missing target", async () => {
    const { handlers, socialStore, userStore } = createHarness();

    vi.mocked(userStore.getUserBySessionToken).mockResolvedValue(ACTOR);
    vi.mocked(socialStore.createFriendRequest).mockResolvedValue({
      reason: "blocked",
      success: false,
    });

    const response = await handlers.createFriendRequest(
      createJsonRequest("/api/social/friend-requests", {
        userId: TARGET.id,
      }),
    );

    await expectJsonResponse(response, 404, {
      code: "user-not-found",
      error: "Player was not found.",
    });
  });
});
