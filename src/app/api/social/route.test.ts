import { describe, expect, it, vi } from "vitest";

import {
  MAX_MULTIPLAYER_ACCOUNT_AVAILABILITY_USER_IDS,
  type MultiplayerAccountPartyAuthority,
} from "@/lib/server/multiplayer-account-party";
import type { SocialFriend, SocialOverview } from "@/lib/social";

import * as socialRoute from "./route";
import { createSocialOverviewRouteHandlers } from "./route-handlers";
import type { SocialUserSessionLookup } from "./shared";

const USER = { displayName: "Ada", id: "user-ada" };
type SocialOverviewStore = Parameters<
  typeof createSocialOverviewRouteHandlers
>[0];

function createFriend(index: number): SocialFriend {
  return {
    availability: "unknown",
    friendsSince: "2026-08-03T10:00:00.000Z",
    user: {
      displayName: `Friend ${index}`,
      id: `user-${index}`,
    },
  };
}

function createOverview(friends: SocialFriend[] = []): SocialOverview {
  return {
    blockedUsers: [],
    friends,
    incomingFriendRequests: [],
    incomingPartyInvitations: [],
    outgoingFriendRequests: [],
    outgoingPartyInvitations: [],
  };
}

function createSocialStore(
  overrides: Partial<SocialOverviewStore> = {},
): SocialOverviewStore {
  return {
    getOverview: vi.fn(async () => ({
      overview: createOverview(),
      success: true,
    })),
    getPendingPartyInvitationsForReconciliation: vi.fn(async () => ({
      invitations: [],
      success: true,
    })),
    revokePartyInvitationsForParty: vi.fn(),
    ...overrides,
  } as SocialOverviewStore;
}

function createRequest(signedIn = true) {
  return new Request("http://localhost/api/social", {
    headers: signedIn
      ? { cookie: "game_user_session=session-token" }
      : undefined,
  });
}

describe("social overview route", () => {
  it("exports only the supported Next.js route fields", () => {
    expect(Object.keys(socialRoute).sort()).toEqual([
      "GET",
      "dynamic",
      "runtime",
    ]);
  });

  it("requires authentication before reading social state", async () => {
    const socialStore = createSocialStore({
      getOverview: vi.fn(),
    });
    const authority = {
      applyAccountCommand: vi.fn(),
    } as unknown as Pick<
      MultiplayerAccountPartyAuthority,
      "applyAccountCommand"
    >;
    const handlers = createSocialOverviewRouteHandlers(
      socialStore,
      { getUserBySessionToken: vi.fn(async () => null) },
      authority,
    );
    const response = await handlers.GET(createRequest(false));

    expect(response.status).toBe(401);
    expect(socialStore.getOverview).not.toHaveBeenCalled();
    expect(authority.applyAccountCommand).not.toHaveBeenCalled();
  });

  it("reconciles terminal parties with private codes before returning invitations", async () => {
    const privateInvitation = {
      createdAt: "2026-08-03T10:00:00.000Z",
      expiresAt: "2026-08-03T10:05:00.000Z",
      id: "invitation-1",
      intent: "play" as const,
      inviter: USER,
      partyCode: "ROOM1",
      recipient: { displayName: "Grace", id: "user-grace" },
      resolvedAt: null,
      status: "pending" as const,
      updatedAt: "2026-08-03T10:00:00.000Z",
    };
    const getOverview = vi.fn(async () => ({
      overview: createOverview(),
      success: true as const,
    }));
    const revokePartyInvitationsForParty = vi.fn(async () => ({
      revokedCount: 1,
      success: true as const,
    }));
    const socialStore = createSocialStore({
      getOverview,
      getPendingPartyInvitationsForReconciliation: vi.fn(async () => ({
        invitations: [
          privateInvitation,
          { ...privateInvitation, id: "invitation-2" },
        ],
        success: true as const,
      })),
      revokePartyInvitationsForParty,
    });
    const authority = {
      applyAccountCommand: vi.fn(async () => ({
        code: "room-not-found" as const,
        error: "Room was not found.",
        success: false as const,
      })),
    };
    const handlers = createSocialOverviewRouteHandlers(
      socialStore,
      { getUserBySessionToken: vi.fn(async () => USER) },
      authority,
    );
    const response = await handlers.GET(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(authority.applyAccountCommand).toHaveBeenCalledTimes(2);
    expect(authority.applyAccountCommand).toHaveBeenCalledWith({
      hostUserId: USER.id,
      intent: "play",
      partyCode: "ROOM1",
      recipientUserId: "user-grace",
      type: "party.inspectInvitation",
    });
    expect(revokePartyInvitationsForParty).toHaveBeenCalledTimes(1);
    expect(revokePartyInvitationsForParty).toHaveBeenCalledWith("ROOM1");
    expect(
      revokePartyInvitationsForParty.mock.invocationCallOrder[0],
    ).toBeLessThan(getOverview.mock.invocationCallOrder[0]);
    expect(JSON.stringify(body)).not.toContain("ROOM1");
  });

  it("preserves invitations when reconciliation authority is transiently unavailable", async () => {
    const publicInvitation = {
      createdAt: "2026-08-03T10:00:00.000Z",
      expiresAt: "2026-08-03T10:05:00.000Z",
      id: "invitation-1",
      intent: "watch" as const,
      inviter: USER,
      recipient: { displayName: "Grace", id: "user-grace" },
      resolvedAt: null,
      status: "pending" as const,
      updatedAt: "2026-08-03T10:00:00.000Z",
    };
    const socialStore = createSocialStore({
      getOverview: vi.fn(async () => ({
        overview: {
          ...createOverview(),
          outgoingPartyInvitations: [publicInvitation],
        },
        success: true as const,
      })),
      getPendingPartyInvitationsForReconciliation: vi.fn(async () => ({
        invitations: [{ ...publicInvitation, partyCode: "ROOM1" }],
        success: true as const,
      })),
    });
    const handlers = createSocialOverviewRouteHandlers(
      socialStore,
      { getUserBySessionToken: vi.fn(async () => USER) },
      {
        applyAccountCommand: vi.fn(async () => ({
          code: "room-service-unavailable" as const,
          error: "Unavailable.",
          success: false as const,
        })),
      },
    );
    const response = await handlers.GET(createRequest());
    const body = (await response.json()) as { overview: SocialOverview };

    expect(response.status).toBe(200);
    expect(body.overview.outgoingPartyInvitations).toEqual([publicInvitation]);
    expect(socialStore.revokePartyInvitationsForParty).not.toHaveBeenCalled();
  });

  it("keeps a pending invitation suspended while its recipient is busy", async () => {
    const publicInvitation = {
      createdAt: "2026-08-03T10:00:00.000Z",
      expiresAt: "2026-08-03T10:05:00.000Z",
      id: "invitation-busy",
      intent: "play" as const,
      inviter: USER,
      recipient: { displayName: "Grace", id: "user-grace" },
      resolvedAt: null,
      status: "pending" as const,
      updatedAt: "2026-08-03T10:00:00.000Z",
    };
    const socialStore = createSocialStore({
      getOverview: vi.fn(async () => ({
        overview: {
          ...createOverview(),
          outgoingPartyInvitations: [publicInvitation],
        },
        success: true as const,
      })),
      getPendingPartyInvitationsForReconciliation: vi.fn(async () => ({
        invitations: [{ ...publicInvitation, partyCode: "ROOM1" }],
        success: true as const,
      })),
    });
    const handlers = createSocialOverviewRouteHandlers(
      socialStore,
      { getUserBySessionToken: vi.fn(async () => USER) },
      {
        applyAccountCommand: vi.fn(async () => ({
          admissionRole: null,
          eligible: false,
          outcome: "invitation-eligibility" as const,
          reason: "recipient-busy" as const,
          success: true as const,
        })),
      },
    );
    const response = await handlers.GET(createRequest());
    const body = (await response.json()) as { overview: SocialOverview };

    expect(response.status).toBe(200);
    expect(body.overview.outgoingPartyInvitations).toEqual([publicInvitation]);
    expect(socialStore.revokePartyInvitationsForParty).not.toHaveBeenCalled();
  });

  it("preserves party-targeted invitations across host transfer", async () => {
    const publicInvitation = {
      createdAt: "2026-08-03T10:00:00.000Z",
      expiresAt: "2026-08-03T10:05:00.000Z",
      id: "invitation-1",
      intent: "play" as const,
      inviter: USER,
      recipient: { displayName: "Grace", id: "user-grace" },
      resolvedAt: null,
      status: "pending" as const,
      updatedAt: "2026-08-03T10:00:00.000Z",
    };
    const socialStore = createSocialStore({
      getOverview: vi.fn(async () => ({
        overview: {
          ...createOverview(),
          outgoingPartyInvitations: [publicInvitation],
        },
        success: true as const,
      })),
      getPendingPartyInvitationsForReconciliation: vi.fn(async () => ({
        invitations: [{ ...publicInvitation, partyCode: "ROOM1" }],
        success: true as const,
      })),
    });
    const handlers = createSocialOverviewRouteHandlers(
      socialStore,
      { getUserBySessionToken: vi.fn(async () => USER) },
      {
        applyAccountCommand: vi.fn(async () => ({
          code: "not-host" as const,
          error: "The inviter is no longer host.",
          success: false as const,
        })),
      },
    );
    const response = await handlers.GET(createRequest());
    const body = (await response.json()) as { overview: SocialOverview };

    expect(response.status).toBe(200);
    expect(body.overview.outgoingPartyInvitations).toEqual([publicInvitation]);
    expect(socialStore.revokePartyInvitationsForParty).not.toHaveBeenCalled();
  });

  it("bounds concurrent invitation reconciliation work", async () => {
    const invitations = Array.from({ length: 9 }, (_, index) => ({
      createdAt: "2026-08-03T10:00:00.000Z",
      expiresAt: "2026-08-03T10:05:00.000Z",
      id: `invitation-${index}`,
      intent: "watch" as const,
      inviter: USER,
      partyCode: `ROOM${index}`,
      recipient: {
        displayName: `Recipient ${index}`,
        id: `recipient-${index}`,
      },
      resolvedAt: null,
      status: "pending" as const,
      updatedAt: "2026-08-03T10:00:00.000Z",
    }));
    let activeInspections = 0;
    let maximumActiveInspections = 0;
    const applyAccountCommand = vi.fn(async () => {
      activeInspections += 1;
      maximumActiveInspections = Math.max(
        maximumActiveInspections,
        activeInspections,
      );
      await Promise.resolve();
      activeInspections -= 1;

      return {
        code: "room-service-unavailable" as const,
        error: "Unavailable.",
        success: false as const,
      };
    });
    const handlers = createSocialOverviewRouteHandlers(
      createSocialStore({
        getPendingPartyInvitationsForReconciliation: vi.fn(async () => ({
          invitations,
          success: true as const,
        })),
      }),
      { getUserBySessionToken: vi.fn(async () => USER) },
      { applyAccountCommand },
    );

    expect((await handlers.GET(createRequest())).status).toBe(200);
    expect(applyAccountCommand).toHaveBeenCalledTimes(invitations.length);
    expect(maximumActiveInspections).toBe(4);
  });

  it("merges resolved availability without changing friend order", async () => {
    const overview = createOverview([createFriend(2), createFriend(1)]);
    const socialStore = createSocialStore({
      getOverview: vi.fn(async () => ({ overview, success: true as const })),
    });
    const userStore = {
      getUserBySessionToken: vi.fn(async () => USER),
    } satisfies SocialUserSessionLookup;
    const authority = {
      applyAccountCommand: vi.fn(async () => ({
        availabilities: [
          { availability: "busy" as const, userId: "user-2" },
          { availability: "available" as const, userId: "user-1" },
        ],
        outcome: "availability" as const,
        success: true as const,
      })),
    } satisfies Pick<
      MultiplayerAccountPartyAuthority,
      "applyAccountCommand"
    >;
    const handlers = createSocialOverviewRouteHandlers(
      socialStore,
      userStore,
      authority,
    );
    const response = await handlers.GET(createRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(socialStore.getOverview).toHaveBeenCalledWith(USER.id);
    expect(authority.applyAccountCommand).toHaveBeenCalledWith({
      type: "presence.resolve",
      userIds: ["user-2", "user-1"],
    });
    await expect(response.json()).resolves.toMatchObject({
      overview: {
        friends: [
          { availability: "busy", user: { id: "user-2" } },
          { availability: "available", user: { id: "user-1" } },
        ],
      },
    });
  });

  it("bounds concurrent friend availability resolution work", async () => {
    const friendCount =
      MAX_MULTIPLAYER_ACCOUNT_AVAILABILITY_USER_IDS * 9;
    const overview = createOverview(
      Array.from({ length: friendCount }, (_, index) => createFriend(index)),
    );
    let activeResolutions = 0;
    let maximumActiveResolutions = 0;
    const applyAccountCommand = vi.fn(async (command) => {
      if (command.type !== "presence.resolve") {
        throw new Error("Unexpected authority command.");
      }

      activeResolutions += 1;
      maximumActiveResolutions = Math.max(
        maximumActiveResolutions,
        activeResolutions,
      );
      await Promise.resolve();
      activeResolutions -= 1;

      return {
        availabilities: command.userIds.map((userId: string) => ({
          availability: "available" as const,
          userId,
        })),
        outcome: "availability" as const,
        success: true as const,
      };
    });
    const handlers = createSocialOverviewRouteHandlers(
      createSocialStore({
        getOverview: vi.fn(async () => ({ overview, success: true as const })),
      }),
      { getUserBySessionToken: vi.fn(async () => USER) },
      { applyAccountCommand },
    );

    expect((await handlers.GET(createRequest())).status).toBe(200);
    expect(applyAccountCommand).toHaveBeenCalledTimes(9);
    expect(maximumActiveResolutions).toBe(4);
  });

  it("chunks large friend lists and leaves failed chunks unknown", async () => {
    const friends = Array.from({ length: 257 }, (_, index) =>
      createFriend(index + 1),
    );
    const socialStore = createSocialStore({
      getOverview: vi.fn(async () => ({
        overview: createOverview(friends),
        success: true as const,
      })),
    });
    const applyAccountCommand = vi
      .fn()
      .mockResolvedValueOnce({
        availabilities: friends.slice(0, 256).map((friend) => ({
          availability: "available",
          userId: friend.user.id,
        })),
        outcome: "availability",
        success: true,
      })
      .mockRejectedValueOnce(new Error("Unavailable."));
    const authority = {
      applyAccountCommand,
    } as unknown as Pick<
      MultiplayerAccountPartyAuthority,
      "applyAccountCommand"
    >;
    const handlers = createSocialOverviewRouteHandlers(
      socialStore,
      { getUserBySessionToken: vi.fn(async () => USER) },
      authority,
    );
    const response = await handlers.GET(createRequest());
    const body = (await response.json()) as { overview: SocialOverview };

    expect(authority.applyAccountCommand).toHaveBeenCalledTimes(2);
    expect(
      applyAccountCommand.mock.calls.map(
        ([command]) =>
          command.type === "presence.resolve" && Array.isArray(command.userIds)
            ? command.userIds.length
            : 0,
      ),
    ).toEqual([256, 1]);
    expect(body.overview.friends[0]?.availability).toBe("available");
    expect(body.overview.friends[255]?.availability).toBe("available");
    expect(body.overview.friends[256]?.availability).toBe("unknown");
  });

  it("does not contact presence authority when the user has no friends", async () => {
    const authority = {
      applyAccountCommand: vi.fn(),
    } as unknown as Pick<
      MultiplayerAccountPartyAuthority,
      "applyAccountCommand"
    >;
    const handlers = createSocialOverviewRouteHandlers(
      createSocialStore({
        getOverview: vi.fn(async () => ({
          overview: createOverview(),
          success: true as const,
        })),
      }),
      { getUserBySessionToken: vi.fn(async () => USER) },
      authority,
    );

    expect((await handlers.GET(createRequest())).status).toBe(200);
    expect(authority.applyAccountCommand).not.toHaveBeenCalled();
  });

  it("keeps friend availability unknown for a typed authority failure", async () => {
    const handlers = createSocialOverviewRouteHandlers(
      createSocialStore({
        getOverview: vi.fn(async () => ({
          overview: createOverview([createFriend(1)]),
          success: true as const,
        })),
      }),
      { getUserBySessionToken: vi.fn(async () => USER) },
      {
        applyAccountCommand: vi.fn(async () => ({
          code: "room-service-unavailable" as const,
          error: "Unavailable.",
          success: false as const,
        })),
      },
    );
    const response = await handlers.GET(createRequest());
    const body = (await response.json()) as { overview: SocialOverview };

    expect(response.status).toBe(200);
    expect(body.overview.friends[0]?.availability).toBe("unknown");
  });

  it("maps durable overview failures", async () => {
    const handlers = createSocialOverviewRouteHandlers(
      createSocialStore({
        getOverview: vi.fn(async () => ({
          reason: "user-not-found" as const,
          success: false as const,
        })),
      }),
      { getUserBySessionToken: vi.fn(async () => USER) },
      { applyAccountCommand: vi.fn() },
    );
    const response = await handlers.GET(createRequest());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      code: "user-not-found",
    });
  });
});
