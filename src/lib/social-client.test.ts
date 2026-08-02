import { describe, expect, it, vi } from "vitest";

import type { MultiplayerRoomSnapshot } from "@/lib/multiplayer/protocol";
import type { PrivateRoom } from "@/lib/multiplayer/room";
import type {
  SocialOverview,
  SocialPartyInvitation,
} from "@/lib/social";

import {
  SOCIAL_API_PATH,
  SOCIAL_BLOCKS_API_PATH,
  SOCIAL_DISCOVERY_API_PATH,
  SOCIAL_FRIEND_REQUESTS_API_PATH,
  SOCIAL_FRIENDS_API_PATH,
  SOCIAL_PARTY_INVITATIONS_API_PATH,
  SOCIAL_PRESENCE_API_PATH,
  SocialClientError,
  acceptSocialFriendRequest,
  acceptSocialPartyInvitation,
  blockSocialUser,
  cancelSocialFriendRequest,
  cancelSocialPartyInvitation,
  createSocialFriendRequest,
  createSocialPartyInvitation,
  declineSocialFriendRequest,
  declineSocialPartyInvitation,
  discoverSocialUser,
  fetchSocialOverview,
  releaseSocialPresence,
  removeSocialFriend,
  renewSocialPresence,
  unblockSocialUser,
  type SocialFetch,
} from "./social-client";

const CREATED_AT = "2026-08-03T10:00:00.000Z";
const UPDATED_AT = "2026-08-03T10:01:00.000Z";
const EXPIRES_AT = "2026-08-03T10:05:00.000Z";
const HOST = { displayName: "Ada Host", id: "user-ada" };
const GUEST = { displayName: "Grace Guest", id: "user-grace" };
const HOST_PARTICIPANT = {
  displayName: HOST.displayName,
  id: "participant-ada",
  role: "host" as const,
  userId: HOST.id,
};
const GUEST_PARTICIPANT = {
  displayName: GUEST.displayName,
  id: "participant-grace",
  role: "observer" as const,
  userId: GUEST.id,
};
const ROOM = {
  code: "ROOM1",
  hostParticipantId: HOST_PARTICIPANT.id,
  matchId: 1,
  nextMatchParticipantIds: [],
  observerLimit: 4,
  participants: [HOST_PARTICIPANT, GUEST_PARTICIPANT],
  seats: [
    {
      id: "left",
      label: "Left Paddle",
      occupiedByParticipantId: HOST_PARTICIPANT.id,
      required: true,
    },
    {
      id: "right",
      label: "Right Paddle",
      occupiedByParticipantId: null,
      required: true,
    },
  ],
  settings: { gameId: "pong" },
  status: "lobby",
} satisfies PrivateRoom;
const SNAPSHOT = {
  participant: GUEST_PARTICIPANT,
  room: ROOM,
  seq: 3,
} satisfies MultiplayerRoomSnapshot;

function createInvitation(
  overrides: Partial<SocialPartyInvitation> = {},
): SocialPartyInvitation {
  return {
    createdAt: CREATED_AT,
    expiresAt: EXPIRES_AT,
    id: "invitation-1",
    intent: "play",
    inviter: HOST,
    recipient: GUEST,
    resolvedAt: null,
    status: "pending",
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

function createOverview(): SocialOverview {
  return {
    blockedUsers: [{ blockedAt: CREATED_AT, user: GUEST }],
    friends: [
      {
        availability: "available",
        friendsSince: CREATED_AT,
        user: GUEST,
      },
    ],
    incomingFriendRequests: [
      { createdAt: CREATED_AT, direction: "incoming", user: GUEST },
    ],
    incomingPartyInvitations: [createInvitation()],
    outgoingFriendRequests: [
      { createdAt: CREATED_AT, direction: "outgoing", user: GUEST },
    ],
    outgoingPartyInvitations: [
      createInvitation({ inviter: GUEST, recipient: HOST }),
    ],
  };
}

function jsonResponse(
  payload: unknown,
  options: { headers?: HeadersInit; status?: number } = {},
) {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json", ...options.headers },
    status: options.status ?? 200,
  });
}

function jsonFetch(...payloads: unknown[]) {
  const fetcher = vi.fn<SocialFetch>();

  for (const payload of payloads) {
    fetcher.mockResolvedValueOnce(jsonResponse(payload));
  }

  return fetcher;
}

function expectJsonMutation(
  fetcher: ReturnType<typeof vi.fn<SocialFetch>>,
  call: number,
  path: string,
  method: string,
  body: unknown,
) {
  expect(fetcher).toHaveBeenNthCalledWith(
    call,
    path,
    expect.objectContaining({
      body: JSON.stringify(body),
      cache: "no-store",
      headers: expect.objectContaining({
        Accept: "application/json",
        "Content-Type": "application/json",
      }),
      method,
    }),
  );
}

describe("social HTTP client", () => {
  it("fetches and defensively reconstructs the complete social overview", async () => {
    const overview = createOverview();
    const transportOverview = {
      ...overview,
      incomingPartyInvitations: [
        { ...overview.incomingPartyInvitations[0], partyCode: "SECRET" },
      ],
    };
    const fetcher = jsonFetch({ overview: transportOverview });

    const result = await fetchSocialOverview(fetcher);

    expect(result).toEqual(overview);
    expect(result.incomingPartyInvitations[0]).not.toHaveProperty("partyCode");
    expect(fetcher).toHaveBeenCalledWith(
      SOCIAL_API_PATH,
      expect.objectContaining({ cache: "no-store", method: "GET" }),
    );
  });

  it.each([
    [
      "request direction",
      {
        ...createOverview(),
        incomingFriendRequests: [
          { createdAt: CREATED_AT, direction: "outgoing", user: GUEST },
        ],
      },
    ],
    [
      "availability",
      {
        ...createOverview(),
        friends: [
          {
            availability: "playing",
            friendsSince: CREATED_AT,
            user: GUEST,
          },
        ],
      },
    ],
    [
      "timestamp",
      {
        ...createOverview(),
        blockedUsers: [{ blockedAt: "yesterday", user: GUEST }],
      },
    ],
    [
      "invitation lifecycle",
      {
        ...createOverview(),
        incomingPartyInvitations: [
          createInvitation({
            resolvedAt: UPDATED_AT,
            status: "accepted",
          }),
        ],
      },
    ],
  ])("rejects an overview with an invalid %s", async (_name, overview) => {
    const fetcher = jsonFetch({ overview });

    await expect(fetchSocialOverview(fetcher)).rejects.toMatchObject({
      code: "invalid-response",
      status: 200,
    });
  });

  it("discovers exact names, encodes the query, and preserves a private empty result", async () => {
    const fetcher = jsonFetch(
      { discovery: { relationship: "none", user: GUEST } },
      { discovery: null },
    );

    await expect(
      discoverSocialUser("Grace Guest +", fetcher),
    ).resolves.toEqual({ relationship: "none", user: GUEST });
    await expect(discoverSocialUser("Hidden User", fetcher)).resolves.toBeNull();
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      `${SOCIAL_DISCOVERY_API_PATH}?displayName=Grace+Guest+%2B`,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("rejects malformed discovery users and relationships", async () => {
    const invalidUserFetch = jsonFetch({
      discovery: {
        relationship: "none",
        user: { displayName: " Grace", id: GUEST.id },
      },
    });
    const invalidRelationshipFetch = jsonFetch({
      discovery: { relationship: "blocked", user: GUEST },
    });

    await expect(
      discoverSocialUser(GUEST.displayName, invalidUserFetch),
    ).rejects.toBeInstanceOf(SocialClientError);
    await expect(
      discoverSocialUser(GUEST.displayName, invalidRelationshipFetch),
    ).rejects.toMatchObject({ code: "invalid-response" });
  });

  it("sends and validates every friendship and block mutation", async () => {
    const outgoingRequest = {
      createdAt: CREATED_AT,
      direction: "outgoing" as const,
      user: GUEST,
    };
    const friend = {
      availability: "unknown" as const,
      friendsSince: UPDATED_AT,
      user: GUEST,
    };
    const block = { blockedAt: UPDATED_AT, user: GUEST };
    const fetcher = jsonFetch(
      { created: true, request: outgoingRequest, success: true },
      { friend, success: true },
      { success: true },
      { success: true },
      { success: true },
      { block, created: true, success: true },
      { success: true },
    );

    await expect(
      createSocialFriendRequest(GUEST.id, fetcher),
    ).resolves.toEqual({
      created: true,
      request: outgoingRequest,
      success: true,
    });
    await expect(
      acceptSocialFriendRequest(GUEST.id, fetcher),
    ).resolves.toEqual({ friend, success: true });
    await expect(
      declineSocialFriendRequest(GUEST.id, fetcher),
    ).resolves.toEqual({ success: true });
    await expect(
      cancelSocialFriendRequest(GUEST.id, fetcher),
    ).resolves.toEqual({ success: true });
    await expect(removeSocialFriend(GUEST.id, fetcher)).resolves.toEqual({
      success: true,
    });
    await expect(blockSocialUser(GUEST.id, fetcher)).resolves.toEqual({
      block,
      created: true,
      success: true,
    });
    await expect(unblockSocialUser(GUEST.id, fetcher)).resolves.toEqual({
      success: true,
    });

    expectJsonMutation(
      fetcher,
      1,
      SOCIAL_FRIEND_REQUESTS_API_PATH,
      "POST",
      { userId: GUEST.id },
    );
    expectJsonMutation(
      fetcher,
      2,
      `${SOCIAL_FRIEND_REQUESTS_API_PATH}/${GUEST.id}`,
      "PATCH",
      { decision: "accept" },
    );
    expectJsonMutation(
      fetcher,
      3,
      `${SOCIAL_FRIEND_REQUESTS_API_PATH}/${GUEST.id}`,
      "PATCH",
      { decision: "decline" },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      4,
      `${SOCIAL_FRIEND_REQUESTS_API_PATH}/${GUEST.id}`,
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      5,
      `${SOCIAL_FRIENDS_API_PATH}/${GUEST.id}`,
      expect.objectContaining({ method: "DELETE" }),
    );
    expectJsonMutation(fetcher, 6, SOCIAL_BLOCKS_API_PATH, "POST", {
      userId: GUEST.id,
    });
    expect(fetcher).toHaveBeenNthCalledWith(
      7,
      `${SOCIAL_BLOCKS_API_PATH}/${GUEST.id}`,
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("rejects malformed success payloads from relationship mutations", async () => {
    const fetcher = jsonFetch(
      {
        created: true,
        request: {
          createdAt: CREATED_AT,
          direction: "incoming",
          user: GUEST,
        },
        success: true,
      },
      { friend: { availability: "online", friendsSince: CREATED_AT, user: GUEST }, success: true },
      { success: false },
    );

    await expect(
      createSocialFriendRequest(GUEST.id, fetcher),
    ).rejects.toMatchObject({ code: "invalid-response" });
    await expect(
      acceptSocialFriendRequest(GUEST.id, fetcher),
    ).rejects.toMatchObject({ code: "invalid-response" });
    await expect(
      cancelSocialFriendRequest(GUEST.id, fetcher),
    ).rejects.toMatchObject({ code: "invalid-response" });
  });

  it("creates, accepts, declines, and cancels play or watch invitations", async () => {
    const pendingWatch = createInvitation({ intent: "watch" });
    const accepted = createInvitation({
      intent: "watch",
      resolvedAt: UPDATED_AT,
      status: "accepted",
      updatedAt: UPDATED_AT,
    });
    const declined = createInvitation({
      resolvedAt: UPDATED_AT,
      status: "declined",
      updatedAt: UPDATED_AT,
    });
    const canceled = createInvitation({
      resolvedAt: UPDATED_AT,
      status: "canceled",
      updatedAt: UPDATED_AT,
    });
    const fetcher = jsonFetch(
      {
        admissionRole: "observer",
        created: true,
        invitation: pendingWatch,
      },
      {
        admission: "admitted",
        invitation: accepted,
        participantCapability: "capability-grace",
        participantId: GUEST_PARTICIPANT.id,
        snapshot: SNAPSHOT,
      },
      { invitation: declined },
      { invitation: canceled },
    );

    await expect(
      createSocialPartyInvitation(
        {
          intent: "watch",
          partyCode: ROOM.code,
          recipientUserId: GUEST.id,
        },
        fetcher,
      ),
    ).resolves.toEqual({
      admissionRole: "observer",
      created: true,
      invitation: pendingWatch,
    });
    await expect(
      acceptSocialPartyInvitation(pendingWatch.id, fetcher),
    ).resolves.toEqual({
      admission: "admitted",
      invitation: accepted,
      participantCapability: "capability-grace",
      participantId: GUEST_PARTICIPANT.id,
      snapshot: SNAPSHOT,
    });
    await expect(
      declineSocialPartyInvitation(pendingWatch.id, fetcher),
    ).resolves.toEqual(declined);
    await expect(
      cancelSocialPartyInvitation(pendingWatch.id, fetcher),
    ).resolves.toEqual(canceled);

    expectJsonMutation(
      fetcher,
      1,
      SOCIAL_PARTY_INVITATIONS_API_PATH,
      "POST",
      {
        intent: "watch",
        partyCode: ROOM.code,
        recipientUserId: GUEST.id,
      },
    );
    expectJsonMutation(
      fetcher,
      2,
      `${SOCIAL_PARTY_INVITATIONS_API_PATH}/${pendingWatch.id}`,
      "PATCH",
      { decision: "accept" },
    );
    expectJsonMutation(
      fetcher,
      3,
      `${SOCIAL_PARTY_INVITATIONS_API_PATH}/${pendingWatch.id}`,
      "PATCH",
      { decision: "decline" },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      4,
      `${SOCIAL_PARTY_INVITATIONS_API_PATH}/${pendingWatch.id}`,
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it.each([
    ["invalid snapshot", { room: { code: ROOM.code }, seq: 3 }, "capability"],
    ["blank capability", SNAPSHOT, " "],
    ["oversized capability", SNAPSHOT, "x".repeat(513)],
  ])(
    "rejects accepted invitation credentials with an %s",
    async (_name, snapshot, participantCapability) => {
      const fetcher = jsonFetch({
        admission: "admitted",
        invitation: createInvitation({
          resolvedAt: UPDATED_AT,
          status: "accepted",
          updatedAt: UPDATED_AT,
        }),
        participantCapability,
        participantId: GUEST_PARTICIPANT.id,
        snapshot,
      });

      await expect(
        acceptSocialPartyInvitation("invitation-1", fetcher),
      ).rejects.toMatchObject({ code: "invalid-response", status: 200 });
    },
  );

  it("rejects credentials for a different participant than the valid snapshot", async () => {
    const fetcher = jsonFetch({
      admission: "admitted",
      invitation: createInvitation({
        resolvedAt: UPDATED_AT,
        status: "accepted",
        updatedAt: UPDATED_AT,
      }),
      participantCapability: "capability-grace",
      participantId: HOST_PARTICIPANT.id,
      snapshot: SNAPSHOT,
    });

    await expect(
      acceptSocialPartyInvitation("invitation-1", fetcher),
    ).rejects.toMatchObject({ code: "invalid-response", status: 200 });
  });

  it("rejects acceptance data for a different invitation or recipient", async () => {
    const acceptedInvitation = createInvitation({
      resolvedAt: UPDATED_AT,
      status: "accepted",
      updatedAt: UPDATED_AT,
    });
    const wrongRecipientParticipant = {
      ...GUEST_PARTICIPANT,
      userId: "user-other",
    };
    const wrongRecipientSnapshot = {
      ...SNAPSHOT,
      participant: wrongRecipientParticipant,
      room: {
        ...ROOM,
        participants: [HOST_PARTICIPANT, wrongRecipientParticipant],
      },
    } satisfies MultiplayerRoomSnapshot;
    const wrongInvitationFetcher = jsonFetch({
      admission: "admitted",
      invitation: { ...acceptedInvitation, id: "invitation-2" },
      participantCapability: "capability-grace",
      participantId: GUEST_PARTICIPANT.id,
      snapshot: SNAPSHOT,
    });
    const wrongRecipientFetcher = jsonFetch({
      admission: "admitted",
      invitation: acceptedInvitation,
      participantCapability: "capability-grace",
      participantId: GUEST_PARTICIPANT.id,
      snapshot: wrongRecipientSnapshot,
    });

    await expect(
      acceptSocialPartyInvitation("invitation-1", wrongInvitationFetcher),
    ).rejects.toMatchObject({ code: "invalid-response", status: 200 });
    await expect(
      acceptSocialPartyInvitation("invitation-1", wrongRecipientFetcher),
    ).rejects.toMatchObject({ code: "invalid-response", status: 200 });
  });

  it("accepts the maximum credential size and strips unknown transport fields", async () => {
    const credential = "x".repeat(512);
    const participant = { ...GUEST_PARTICIPANT, id: credential };
    const snapshot = {
      participant,
      room: {
        ...ROOM,
        participants: [HOST_PARTICIPANT, participant],
      },
      seq: SNAPSHOT.seq,
    } satisfies MultiplayerRoomSnapshot;
    const accepted = createInvitation({
      resolvedAt: UPDATED_AT,
      status: "accepted",
      updatedAt: UPDATED_AT,
    });
    const fetcher = jsonFetch({
      admission: "reacquired",
      invitation: { ...accepted, partyCode: ROOM.code },
      participantCapability: credential,
      participantId: credential,
      secret: "not-public",
      snapshot,
    });

    const result = await acceptSocialPartyInvitation(accepted.id, fetcher);

    expect(result.participantCapability).toHaveLength(512);
    expect(result.participantId).toHaveLength(512);
    expect(result.invitation).not.toHaveProperty("partyCode");
    expect(result).not.toHaveProperty("secret");
  });

  it("renews and releases presence, including a keepalive release", async () => {
    const fetcher = jsonFetch(
      { availability: "in-party", changed: true },
      { availability: "offline", changed: true },
    );

    await expect(
      renewSocialPresence(
        {
          clientId: "presence-client-0001",
          operationGeneration: 7,
          state: "busy",
        },
        fetcher,
      ),
    ).resolves.toEqual({ availability: "in-party", changed: true });
    await expect(
      releaseSocialPresence("presence-client-0001", 8, fetcher, {
        keepalive: true,
      }),
    ).resolves.toEqual({ availability: "offline", changed: true });

    expectJsonMutation(fetcher, 1, SOCIAL_PRESENCE_API_PATH, "POST", {
      clientId: "presence-client-0001",
      operationGeneration: 7,
      state: "busy",
    });
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      SOCIAL_PRESENCE_API_PATH,
      expect.objectContaining({
        body: JSON.stringify({
          clientId: "presence-client-0001",
          operationGeneration: 8,
        }),
        keepalive: true,
        method: "DELETE",
      }),
    );
  });

  it("rejects unknown effective presence values", async () => {
    const fetcher = jsonFetch({ availability: "unknown", changed: true });

    await expect(
      renewSocialPresence(
        {
          clientId: "presence-client-0001",
          operationGeneration: 1,
          state: "available",
        },
        fetcher,
      ),
    ).rejects.toMatchObject({ code: "invalid-response" });
  });

  it("throws a typed HTTP error with the server code and Retry-After seconds", async () => {
    const fetcher = vi.fn<SocialFetch>(async () =>
      jsonResponse(
        {
          code: "rate-limit-reached",
          error: "Too many social requests. Try again shortly.",
        },
        { headers: { "Retry-After": "24" }, status: 429 },
      ),
    );

    const error = await discoverSocialUser("Grace", fetcher).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(SocialClientError);
    expect(error).toMatchObject({
      code: "rate-limit-reached",
      message: "Too many social requests. Try again shortly.",
      retryAfterSeconds: 24,
      status: 429,
    });
  });

  it("uses stable fallbacks for malformed HTTP errors and success bodies", async () => {
    const invalidErrorFetch = vi.fn<SocialFetch>(async () =>
      jsonResponse(
        { code: "NOT STABLE", error: "" },
        { headers: { "Retry-After": "tomorrow" }, status: 502 },
      ),
    );
    const invalidSuccessFetch = vi.fn<SocialFetch>(async () =>
      new Response("not json", { status: 200 }),
    );

    await expect(fetchSocialOverview(invalidErrorFetch)).rejects.toMatchObject({
      code: "http-error",
      message: "Social request failed with status 502.",
      retryAfterSeconds: null,
      status: 502,
    });
    await expect(fetchSocialOverview(invalidSuccessFetch)).rejects.toMatchObject({
      code: "invalid-response",
      status: 200,
    });
  });

  it("wraps transport failures without exposing an untyped fetch error", async () => {
    const cause = new Error("connection reset");
    const fetcher = vi.fn<SocialFetch>(async () => {
      throw cause;
    });

    const error = await fetchSocialOverview(fetcher).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(SocialClientError);
    expect(error).toMatchObject({
      cause,
      code: "network-error",
      retryAfterSeconds: null,
      status: 0,
    });
  });
});
