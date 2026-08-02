import { beforeEach, describe, expect, it, vi } from "vitest";

const stores = vi.hoisted(() => ({
  social: {
    acceptFriendRequest: vi.fn(),
    blockUser: vi.fn(),
    cancelFriendRequest: vi.fn(),
    consumeSocialApiRateLimit: vi.fn(),
    createFriendRequest: vi.fn(),
    declineFriendRequest: vi.fn(),
    removeFriend: vi.fn(),
    unblockUser: vi.fn(),
  },
  user: {
    getUserBySessionToken: vi.fn(),
  },
}));

vi.mock("@/lib/server/sqlite-social-store", () => ({
  getSocialStore: () => stores.social,
}));
vi.mock("@/lib/server/sqlite-user-profile-store", () => ({
  getUserProfileStore: () => stores.user,
}));

import * as blockRoute from "./blocks/[userId]/route";
import * as blocksRoute from "./blocks/route";
import * as friendRequestRoute from "./friend-requests/[userId]/route";
import * as friendRequestsRoute from "./friend-requests/route";
import * as friendRoute from "./friends/[userId]/route";

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

function createJsonRequest(path: string, method: "PATCH" | "POST", body: unknown) {
  return new Request(`https://games.example${path}`, {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      cookie: "game_user_session=session-token",
      origin: "https://games.example",
    },
    method,
  });
}

function createDeleteRequest(path: string) {
  return new Request(`https://games.example${path}`, {
    headers: {
      cookie: "game_user_session=session-token",
      origin: "https://games.example",
    },
    method: "DELETE",
  });
}

function createUserContext(userId: string) {
  return { params: Promise.resolve({ userId }) };
}

describe("social relationship route entries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stores.user.getUserBySessionToken.mockResolvedValue(ACTOR);
    stores.social.consumeSocialApiRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetAt: "2026-08-03T01:01:00.000Z",
      retryAfterSeconds: 0,
      success: true,
    });
    stores.social.createFriendRequest.mockResolvedValue({
      created: true,
      request: FRIEND_REQUEST,
      success: true,
    });
    stores.social.acceptFriendRequest.mockResolvedValue({
      friend: FRIEND,
      success: true,
    });
    stores.social.cancelFriendRequest.mockResolvedValue({ success: true });
    stores.social.removeFriend.mockResolvedValue({ success: true });
    stores.social.blockUser.mockResolvedValue({
      block: BLOCK,
      created: true,
      success: true,
    });
    stores.social.unblockUser.mockResolvedValue({ success: true });
  });

  it("exports only supported Next.js route fields", () => {
    expect(Object.keys(friendRequestsRoute).sort()).toEqual([
      "POST",
      "dynamic",
      "runtime",
    ]);
    expect(Object.keys(friendRequestRoute).sort()).toEqual([
      "DELETE",
      "PATCH",
      "dynamic",
      "runtime",
    ]);
    expect(Object.keys(friendRoute).sort()).toEqual([
      "DELETE",
      "dynamic",
      "runtime",
    ]);
    expect(Object.keys(blocksRoute).sort()).toEqual([
      "POST",
      "dynamic",
      "runtime",
    ]);
    expect(Object.keys(blockRoute).sort()).toEqual([
      "DELETE",
      "dynamic",
      "runtime",
    ]);
  });

  it("connects every relationship route to the session-owned store mutation", async () => {
    const createResponse = await friendRequestsRoute.POST(
      createJsonRequest("/api/social/friend-requests", "POST", {
        actorUserId: "forged-actor",
        userId: TARGET.id,
      }),
    );
    const acceptResponse = await friendRequestRoute.PATCH(
      createJsonRequest(
        `/api/social/friend-requests/${TARGET.id}`,
        "PATCH",
        { decision: "accept" },
      ),
      createUserContext(TARGET.id),
    );
    const cancelResponse = await friendRequestRoute.DELETE(
      createDeleteRequest(`/api/social/friend-requests/${TARGET.id}`),
      createUserContext(TARGET.id),
    );
    const removeResponse = await friendRoute.DELETE(
      createDeleteRequest(`/api/social/friends/${TARGET.id}`),
      createUserContext(TARGET.id),
    );
    const blockResponse = await blocksRoute.POST(
      createJsonRequest("/api/social/blocks", "POST", {
        actorUserId: "forged-actor",
        userId: TARGET.id,
      }),
    );
    const unblockResponse = await blockRoute.DELETE(
      createDeleteRequest(`/api/social/blocks/${TARGET.id}`),
      createUserContext(TARGET.id),
    );

    expect([
      createResponse.status,
      acceptResponse.status,
      cancelResponse.status,
      removeResponse.status,
      blockResponse.status,
      unblockResponse.status,
    ]).toEqual([201, 200, 200, 200, 201, 200]);
    expect(stores.user.getUserBySessionToken).toHaveBeenCalledTimes(6);
    expect(stores.user.getUserBySessionToken).toHaveBeenCalledWith(
      "session-token",
    );
    expect(stores.social.createFriendRequest).toHaveBeenCalledWith(
      ACTOR.id,
      TARGET.id,
    );
    expect(stores.social.acceptFriendRequest).toHaveBeenCalledWith(
      ACTOR.id,
      TARGET.id,
    );
    expect(stores.social.cancelFriendRequest).toHaveBeenCalledWith(
      ACTOR.id,
      TARGET.id,
    );
    expect(stores.social.removeFriend).toHaveBeenCalledWith(
      ACTOR.id,
      TARGET.id,
    );
    expect(stores.social.blockUser).toHaveBeenCalledWith(
      ACTOR.id,
      TARGET.id,
    );
    expect(stores.social.unblockUser).toHaveBeenCalledWith(
      ACTOR.id,
      TARGET.id,
    );
  });
});
