import { describe, expect, it, vi } from "vitest";

import type { MultiplayerAccountPartyAuthority } from "@/lib/server/multiplayer-account-party";
import type {
  SocialPartyInvitationRecord,
  SqliteSocialStore,
} from "@/lib/server/sqlite-social-store";

import { createPartyInvitationRouteHandlers } from "./[invitationId]/route-handlers";
import { createPartyInvitationsRouteHandlers } from "./route-handlers";

const user = { displayName: "Ada Host", id: "user-ada" };
const recipient = { displayName: "Grace Guest", id: "user-grace" };

function createInvitation(
  overrides: Partial<SocialPartyInvitationRecord> = {},
): SocialPartyInvitationRecord {
  return {
    createdAt: "2026-08-03T10:00:00.000Z",
    expiresAt: "2026-08-03T10:05:00.000Z",
    id: "invitation-1",
    intent: "play",
    inviter: user,
    partyCode: "ROOM1",
    recipient,
    resolvedAt: null,
    status: "pending",
    updatedAt: "2026-08-03T10:00:00.000Z",
    ...overrides,
  };
}

function createJsonRequest(
  path: string,
  method: "PATCH" | "POST",
  body: unknown,
  options: { authenticated?: boolean; origin?: string } = {},
) {
  const headers = new Headers({ "content-type": "application/json" });

  if (options.authenticated !== false) {
    headers.set("cookie", "game_user_session=session-token");
  }

  if (options.origin !== undefined) {
    headers.set("origin", options.origin);
  }

  return new Request(`http://localhost${path}`, {
    body: JSON.stringify(body),
    headers,
    method,
  });
}

function createDeleteRequest(authenticated = true) {
  return new Request(
    "http://localhost/api/social/party-invitations/invitation-1",
    {
      headers: authenticated
        ? { cookie: "game_user_session=session-token" }
        : undefined,
      method: "DELETE",
    },
  );
}

function createUserStore(
  authenticatedUser: typeof user | null = user,
) {
  return {
    getUserBySessionToken: vi.fn(async () => authenticatedUser),
  };
}

function createAuthority(
  applyAccountCommand: ReturnType<typeof vi.fn>,
) {
  return { applyAccountCommand } as unknown as MultiplayerAccountPartyAuthority;
}

function createSocialStore(methods: Record<string, unknown>) {
  return {
    claimPartyInvitationForAcceptance: vi.fn(async () => ({
      claimExpiresAt: "2026-08-03T10:00:30.000Z",
      claimToken: "claim-token",
      invitation: createInvitation(),
      success: true,
    })),
    consumeSocialApiRateLimit: vi.fn(async () => ({
      allowed: true,
      remaining: 19,
      resetAt: "2026-08-03T10:01:00.000Z",
      retryAfterSeconds: 0,
      success: true,
    })),
    getOverview: vi.fn(async () => ({
      overview: {
        blockedUsers: [],
        friends: [
          {
            availability: "unknown",
            friendsSince: "2026-08-03T09:00:00.000Z",
            user: recipient,
          },
        ],
        incomingFriendRequests: [],
        incomingPartyInvitations: [],
        outgoingFriendRequests: [],
        outgoingPartyInvitations: [],
      },
      success: true,
    })),
    getAcceptedPartyInvitationForReacquisition: vi.fn(async () => ({
      reason: "party-invitation-not-pending",
      success: false,
    })),
    releasePartyInvitationAcceptanceClaim: vi.fn(async () => ({
      released: true,
      success: true,
    })),
    validatePartyInvitationRelationship: vi.fn(async () => ({
      success: true,
    })),
    revokePartyInvitationsForParty: vi.fn(async () => ({
      revokedCount: 0,
      success: true,
    })),
    ...methods,
  } as unknown as SqliteSocialStore;
}

function expectRedactedInvitation(value: unknown) {
  expect(value).toEqual(
    expect.objectContaining({
      id: "invitation-1",
      intent: "play",
      inviter: user,
      recipient,
    }),
  );
  expect(value).not.toHaveProperty("partyCode");
}

describe("party invitation creation route handlers", () => {
  it("authenticates before reading or mutating invitation state", async () => {
    const applyAccountCommand = vi.fn();
    const createPartyInvitation = vi.fn();
    const userStore = createUserStore(null);
    const handlers = createPartyInvitationsRouteHandlers({
      accountPartyAuthority: createAuthority(applyAccountCommand),
      socialStore: createSocialStore({
        createPartyInvitation,
      }),
      userStore,
    });
    const response = await handlers.POST(
      createJsonRequest(
        "/api/social/party-invitations",
        "POST",
        {
          intent: "play",
          partyCode: "ROOM1",
          recipientUserId: recipient.id,
        },
        { authenticated: false },
      ),
    );

    expect(response.status).toBe(401);
    expect(applyAccountCommand).not.toHaveBeenCalled();
    expect(createPartyInvitation).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("does not publish a pending invitation before authority approves the host", async () => {
    let resolveInspection!: (result: {
      admissionRole: "player";
      eligible: true;
      outcome: "invitation-eligibility";
      reason: null;
      success: true;
    }) => void;
    const inspection = new Promise<{
      admissionRole: "player";
      eligible: true;
      outcome: "invitation-eligibility";
      reason: null;
      success: true;
    }>((resolve) => {
      resolveInspection = resolve;
    });
    const applyAccountCommand = vi.fn(() => inspection);
    const createPartyInvitation = vi.fn(async () => ({
      created: true,
      invitation: createInvitation(),
      success: true,
    }));
    const handlers = createPartyInvitationsRouteHandlers({
      accountPartyAuthority: createAuthority(applyAccountCommand),
      socialStore: createSocialStore({ createPartyInvitation }),
      userStore: createUserStore(),
    });
    const responsePromise = handlers.POST(
      createJsonRequest("/api/social/party-invitations", "POST", {
        intent: "play",
        partyCode: "ROOM1",
        recipientUserId: recipient.id,
      }),
    );

    await vi.waitFor(() => expect(applyAccountCommand).toHaveBeenCalledOnce());
    expect(createPartyInvitation).not.toHaveBeenCalled();
    resolveInspection({
      admissionRole: "player",
      eligible: true,
      outcome: "invitation-eligibility",
      reason: null,
      success: true,
    });
    expect((await responsePromise).status).toBe(201);
    expect(createPartyInvitation).toHaveBeenCalledOnce();
  });

  it("rate-limits invitation creation before authority or persistence", async () => {
    const applyAccountCommand = vi.fn();
    const createPartyInvitation = vi.fn();
    const handlers = createPartyInvitationsRouteHandlers({
      accountPartyAuthority: createAuthority(applyAccountCommand),
      socialStore: createSocialStore({
        consumeSocialApiRateLimit: vi.fn(async () => ({
          allowed: false,
          remaining: 0,
          resetAt: "2026-08-03T10:00:17.000Z",
          retryAfterSeconds: 17,
          success: true,
        })),
        createPartyInvitation,
      }),
      userStore: createUserStore(),
    });
    const response = await handlers.POST(
      createJsonRequest("/api/social/party-invitations", "POST", {
        intent: "play",
        partyCode: "ROOM1",
        recipientUserId: recipient.id,
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("17");
    expect(applyAccountCommand).not.toHaveBeenCalled();
    expect(createPartyInvitation).not.toHaveBeenCalled();
  });

  it("authorizes before durable creation and redacts the party code", async () => {
    const invitation = createInvitation();
    const applyAccountCommand = vi.fn(async () => ({
      admissionRole: "observer",
      eligible: true,
      outcome: "invitation-eligibility" as const,
      reason: null,
      success: true as const,
    }));
    const createPartyInvitation = vi.fn(async () => ({
      created: true,
      invitation,
      success: true,
    }));
    const handlers = createPartyInvitationsRouteHandlers({
      accountPartyAuthority: createAuthority(applyAccountCommand),
      socialStore: createSocialStore({
        createPartyInvitation,
      }),
      userStore: createUserStore(),
    });
    const response = await handlers.POST(
      createJsonRequest("/api/social/party-invitations", "POST", {
        actorUserId: "attacker",
        intent: "play",
        partyCode: "room1",
        recipientUserId: recipient.id,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(applyAccountCommand).toHaveBeenNthCalledWith(1, {
      hostUserId: user.id,
      intent: "play",
      partyCode: "ROOM1",
      recipientUserId: recipient.id,
      type: "party.inspectInvitation",
    });
    expect(createPartyInvitation).toHaveBeenCalledWith({
      intent: "play",
      inviterUserId: user.id,
      partyCode: "ROOM1",
      recipientUserId: recipient.id,
    });
    expect(applyAccountCommand).toHaveBeenCalledTimes(1);
    expect(
      applyAccountCommand.mock.invocationCallOrder[0],
    ).toBeLessThan(createPartyInvitation.mock.invocationCallOrder[0] ?? 0);
    expect(body).toMatchObject({ admissionRole: "observer", created: true });
    expectRedactedInvitation(body.invitation);
  });

  it("returns a conflict without persistence when the recipient is busy", async () => {
    const createPartyInvitation = vi.fn();
    const handlers = createPartyInvitationsRouteHandlers({
      accountPartyAuthority: createAuthority(
        vi.fn(async () => ({
          admissionRole: null,
          eligible: false,
          outcome: "invitation-eligibility",
          reason: "recipient-busy",
          success: true,
        })),
      ),
      socialStore: createSocialStore({
        createPartyInvitation,
      }),
      userStore: createUserStore(),
    });
    const response = await handlers.POST(
      createJsonRequest("/api/social/party-invitations", "POST", {
        intent: "watch",
        partyCode: "ROOM1",
        recipientUserId: recipient.id,
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: "recipient-busy",
      error: "This friend is no longer available to invite.",
    });
    expect(createPartyInvitation).not.toHaveBeenCalled();
  });

  it("proves friendship before querying private recipient availability", async () => {
    const applyAccountCommand = vi.fn();
    const createPartyInvitation = vi.fn();
    const handlers = createPartyInvitationsRouteHandlers({
      accountPartyAuthority: createAuthority(applyAccountCommand),
      socialStore: createSocialStore({
        createPartyInvitation,
        validatePartyInvitationRelationship: vi.fn(async () => ({
          reason: "not-friends",
          success: false,
        })),
      }),
      userStore: createUserStore(),
    });
    const response = await handlers.POST(
      createJsonRequest("/api/social/party-invitations", "POST", {
        intent: "play",
        partyCode: "ROOM1",
        recipientUserId: "guessed-user",
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: "relationship-unavailable",
      error: "This social action is not available.",
    });
    expect(applyAccountCommand).not.toHaveBeenCalled();
    expect(createPartyInvitation).not.toHaveBeenCalled();
  });

  it.each(["blocked", "not-friends", "user-not-found"] as const)(
    "keeps a raced %s relationship change privacy-neutral",
    async (reason) => {
      const applyAccountCommand = vi.fn(async () => ({
        admissionRole: "player",
        eligible: true,
        outcome: "invitation-eligibility",
        reason: null,
        success: true,
      }));
      const createPartyInvitation = vi.fn();
      const validatePartyInvitationRelationship = vi
        .fn()
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ reason, success: false });
      const handlers = createPartyInvitationsRouteHandlers({
        accountPartyAuthority: createAuthority(applyAccountCommand),
        socialStore: createSocialStore({
          createPartyInvitation,
          validatePartyInvitationRelationship,
        }),
        userStore: createUserStore(),
      });
      const response = await handlers.POST(
        createJsonRequest("/api/social/party-invitations", "POST", {
          intent: "play",
          partyCode: "ROOM1",
          recipientUserId: recipient.id,
        }),
      );

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        code: "relationship-unavailable",
        error: "This social action is not available.",
      });
      expect(applyAccountCommand).toHaveBeenCalledTimes(1);
      expect(createPartyInvitation).not.toHaveBeenCalled();
    },
  );

  it("suspends existing invitations while the recipient is in another party", async () => {
    const applyAccountCommand = vi.fn(async () => ({
      admissionRole: null,
      eligible: false,
      outcome: "invitation-eligibility" as const,
      reason: "recipient-in-party" as const,
      success: true as const,
    }));
    const createPartyInvitation = vi.fn();
    const handlers = createPartyInvitationsRouteHandlers({
      accountPartyAuthority: createAuthority(applyAccountCommand),
      socialStore: createSocialStore({
        createPartyInvitation,
      }),
      userStore: createUserStore(),
    });
    const response = await handlers.POST(
      createJsonRequest("/api/social/party-invitations", "POST", {
        intent: "play",
        partyCode: "ROOM1",
        recipientUserId: recipient.id,
      }),
    );

    expect(response.status).toBe(409);
    expect(createPartyInvitation).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      code: "recipient-in-party",
    });
  });

  it("does not publish an invitation when authority is transiently unavailable", async () => {
    const applyAccountCommand = vi.fn(async () => ({
      code: "room-service-unavailable" as const,
      error: "Internal authority connection failed.",
      success: false as const,
    }));
    const createPartyInvitation = vi.fn();
    const revokePartyInvitationsForParty = vi.fn();
    const handlers = createPartyInvitationsRouteHandlers({
      accountPartyAuthority: createAuthority(applyAccountCommand),
      socialStore: createSocialStore({
        createPartyInvitation,
        revokePartyInvitationsForParty,
      }),
      userStore: createUserStore(),
    });
    const response = await handlers.POST(
      createJsonRequest("/api/social/party-invitations", "POST", {
        intent: "play",
        partyCode: "ROOM1",
        recipientUserId: recipient.id,
      }),
    );

    expect(response.status).toBe(502);
    expect(createPartyInvitation).not.toHaveBeenCalled();
    expect(revokePartyInvitationsForParty).not.toHaveBeenCalled();
  });

  it("does not publish an invitation when authority throws", async () => {
    const createPartyInvitation = vi.fn();
    const handlers = createPartyInvitationsRouteHandlers({
      accountPartyAuthority: createAuthority(
        vi.fn(async () => {
          throw new Error("sidecar disconnected");
        }),
      ),
      socialStore: createSocialStore({
        createPartyInvitation,
      }),
      userStore: createUserStore(),
    });
    const response = await handlers.POST(
      createJsonRequest("/api/social/party-invitations", "POST", {
        intent: "play",
        partyCode: "ROOM1",
        recipientUserId: recipient.id,
      }),
    );

    expect(response.status).toBe(502);
    expect(createPartyInvitation).not.toHaveBeenCalled();
  });

  it("revokes every invitation for a terminal party observed during creation", async () => {
    const revokePartyInvitationsForParty = vi.fn(async () => ({
      revokedCount: 3,
      success: true,
    }));
    const handlers = createPartyInvitationsRouteHandlers({
      accountPartyAuthority: createAuthority(
        vi.fn(async () => ({
          code: "room-not-found",
          error: "Room not found.",
          success: false,
        })),
      ),
      socialStore: createSocialStore({
        createPartyInvitation: vi.fn(),
        revokePartyInvitationsForParty,
      }),
      userStore: createUserStore(),
    });
    const response = await handlers.POST(
      createJsonRequest("/api/social/party-invitations", "POST", {
        intent: "watch",
        partyCode: "ROOM1",
        recipientUserId: recipient.id,
      }),
    );

    expect(response.status).toBe(404);
    expect(revokePartyInvitationsForParty).toHaveBeenCalledWith("ROOM1");
  });

  it("rejects malformed, cross-origin, and unsupported invitation payloads", async () => {
    const handlers = createPartyInvitationsRouteHandlers({
      accountPartyAuthority: createAuthority(vi.fn()),
      socialStore: createSocialStore({
        createPartyInvitation: vi.fn(),
      }),
      userStore: createUserStore(),
    });
    const crossOrigin = await handlers.POST(
      createJsonRequest(
        "/api/social/party-invitations",
        "POST",
        { intent: "play", partyCode: "ROOM1", recipientUserId: recipient.id },
        { origin: "https://attacker.example" },
      ),
    );
    const invalid = await handlers.POST(
      createJsonRequest("/api/social/party-invitations", "POST", {
        intent: "interrupt",
        partyCode: "bad room",
        recipientUserId: "",
      }),
    );

    expect(crossOrigin.status).toBe(403);
    expect(invalid.status).toBe(400);
  });
});

describe("party invitation resolution route handlers", () => {
  it("declines and cancels only as the session-derived actor", async () => {
    const declined = createInvitation({
      resolvedAt: "2026-08-03T10:01:00.000Z",
      status: "declined",
    });
    const canceled = createInvitation({
      resolvedAt: "2026-08-03T10:01:00.000Z",
      status: "canceled",
    });
    const declinePartyInvitation = vi.fn(async () => ({
      invitation: declined,
      success: true,
    }));
    const cancelPartyInvitation = vi.fn(async () => ({
      invitation: canceled,
      success: true,
    }));
    const handlers = createPartyInvitationRouteHandlers({
      accountPartyAuthority: createAuthority(vi.fn()),
      socialStore: createSocialStore({
        acceptPartyInvitationAfterAdmission: vi.fn(),
        cancelPartyInvitation,
        declinePartyInvitation,
      }),
      userStore: createUserStore(),
    });
    const declineResponse = await handlers.PATCH(
      createJsonRequest(
        "/api/social/party-invitations/invitation-1",
        "PATCH",
        { actorUserId: "attacker", decision: "decline" },
      ),
      "invitation-1",
    );
    const cancelResponse = await handlers.DELETE(
      createDeleteRequest(),
      "invitation-1",
    );

    expect(declinePartyInvitation).toHaveBeenCalledWith(
      user.id,
      "invitation-1",
    );
    expect(cancelPartyInvitation).toHaveBeenCalledWith(
      user.id,
      "invitation-1",
    );
    expectRedactedInvitation((await declineResponse.json()).invitation);
    expectRedactedInvitation((await cancelResponse.json()).invitation);
  });

  it("rejects cross-origin cancellation before touching invitation state", async () => {
    const cancelPartyInvitation = vi.fn();
    const handlers = createPartyInvitationRouteHandlers({
      accountPartyAuthority: createAuthority(vi.fn()),
      socialStore: createSocialStore({
        acceptPartyInvitationAfterAdmission: vi.fn(),
        cancelPartyInvitation,
        declinePartyInvitation: vi.fn(),
      }),
      userStore: createUserStore(),
    });
    const response = await handlers.DELETE(
      new Request(
        "http://localhost/api/social/party-invitations/invitation-1",
        {
          headers: {
            cookie: "game_user_session=session-token",
            origin: "https://attacker.example",
          },
          method: "DELETE",
        },
      ),
      "invitation-1",
    );

    expect(response.status).toBe(403);
    expect(cancelPartyInvitation).not.toHaveBeenCalled();
  });

  it("admits first, finalizes durably, and only then returns the capability", async () => {
    const invitation = createInvitation();
    const claimPartyInvitationForAcceptance = vi.fn(async () => ({
      claimExpiresAt: "2026-08-03T10:00:30.000Z",
      claimToken: "claim-token",
      invitation,
      success: true,
    }));
    const applyAccountCommand = vi.fn(async () => ({
      admission: "admitted",
      outcome: "admission",
      participantCapability: "capability-secret",
      participantId: "participant-grace",
      snapshot: { room: { code: "ROOM1" }, seq: 2 },
      success: true,
    }));
    const acceptPartyInvitationAfterAdmission = vi.fn(async () => ({
      invitation: createInvitation({
        resolvedAt: "2026-08-03T10:01:00.000Z",
        status: "accepted",
      }),
      success: true,
    }));
    const handlers = createPartyInvitationRouteHandlers({
      accountPartyAuthority: createAuthority(applyAccountCommand),
      socialStore: createSocialStore({
        acceptPartyInvitationAfterAdmission,
        cancelPartyInvitation: vi.fn(),
        claimPartyInvitationForAcceptance,
        declinePartyInvitation: vi.fn(),
      }),
      userStore: createUserStore(recipient),
    });
    const response = await handlers.PATCH(
      createJsonRequest(
        "/api/social/party-invitations/invitation-1",
        "PATCH",
        { decision: "accept" },
      ),
      "invitation-1",
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(claimPartyInvitationForAcceptance).toHaveBeenCalledWith(
      recipient.id,
      invitation.id,
    );
    expect(applyAccountCommand).toHaveBeenCalledWith({
      intent: "play",
      partyCode: "ROOM1",
      type: "party.admitAuthenticated",
      user: recipient,
    });
    expect(acceptPartyInvitationAfterAdmission).toHaveBeenCalledWith(
      recipient.id,
      invitation.id,
      "claim-token",
    );
    expect(applyAccountCommand.mock.invocationCallOrder[0]).toBeLessThan(
      acceptPartyInvitationAfterAdmission.mock.invocationCallOrder[0],
    );
    expect(body).toMatchObject({
      admission: "admitted",
      participantCapability: "capability-secret",
      participantId: "participant-grace",
      snapshot: { room: { code: "ROOM1" }, seq: 2 },
    });
    expectRedactedInvitation(body.invitation);
  });

  it("does not enter authority while another acceptance claim is live", async () => {
    const applyAccountCommand = vi.fn();
    const acceptPartyInvitationAfterAdmission = vi.fn();
    const handlers = createPartyInvitationRouteHandlers({
      accountPartyAuthority: createAuthority(applyAccountCommand),
      socialStore: createSocialStore({
        acceptPartyInvitationAfterAdmission,
        cancelPartyInvitation: vi.fn(),
        claimPartyInvitationForAcceptance: vi.fn(async () => ({
          reason: "party-invitation-acceptance-in-progress",
          success: false,
        })),
        declinePartyInvitation: vi.fn(),
      }),
      userStore: createUserStore(recipient),
    });
    const response = await handlers.PATCH(
      createJsonRequest(
        "/api/social/party-invitations/invitation-1",
        "PATCH",
        { decision: "accept" },
      ),
      "invitation-1",
    );

    expect(response.status).toBe(409);
    expect(applyAccountCommand).not.toHaveBeenCalled();
    expect(acceptPartyInvitationAfterAdmission).not.toHaveBeenCalled();
  });

  it("releases the claim and redacts an admission authority exception", async () => {
    const releasePartyInvitationAcceptanceClaim = vi.fn(async () => ({
      released: true,
      success: true,
    }));
    const handlers = createPartyInvitationRouteHandlers({
      accountPartyAuthority: createAuthority(
        vi.fn(async () => {
          throw new Error("sidecar at http://internal:3001 disconnected");
        }),
      ),
      socialStore: createSocialStore({
        acceptPartyInvitationAfterAdmission: vi.fn(),
        cancelPartyInvitation: vi.fn(),
        declinePartyInvitation: vi.fn(),
        releasePartyInvitationAcceptanceClaim,
      }),
      userStore: createUserStore(recipient),
    });
    const response = await handlers.PATCH(
      createJsonRequest(
        "/api/social/party-invitations/invitation-1",
        "PATCH",
        { decision: "accept" },
      ),
      "invitation-1",
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      code: "room-service-unavailable",
      error: "The multiplayer service is temporarily unavailable.",
    });
    expect(releasePartyInvitationAcceptanceClaim).toHaveBeenCalledWith(
      recipient.id,
      "invitation-1",
      "claim-token",
    );
  });

  it("reacquires a capability after an accepted response is lost while membership remains", async () => {
    const acceptedInvitation = createInvitation({
      resolvedAt: "2026-08-03T10:01:00.000Z",
      status: "accepted",
    });
    const applyAccountCommand = vi.fn(async () => ({
        admission: "reacquired",
        outcome: "admission",
        participantCapability: "recovered-capability",
        participantId: "participant-grace",
        snapshot: { room: { code: "ROOM1" }, seq: 4 },
        success: true,
      }));
    const acceptPartyInvitationAfterAdmission = vi.fn();
    const handlers = createPartyInvitationRouteHandlers({
      accountPartyAuthority: createAuthority(applyAccountCommand),
      socialStore: createSocialStore({
        acceptPartyInvitationAfterAdmission,
        cancelPartyInvitation: vi.fn(),
        declinePartyInvitation: vi.fn(),
        getAcceptedPartyInvitationForReacquisition: vi.fn(async () => ({
          invitation: acceptedInvitation,
          success: true,
        })),
        claimPartyInvitationForAcceptance: vi.fn(async () => ({
          reason: "party-invitation-not-pending",
          success: false,
        })),
      }),
      userStore: createUserStore(recipient),
    });
    const response = await handlers.PATCH(
      createJsonRequest(
        "/api/social/party-invitations/invitation-1",
        "PATCH",
        { decision: "accept" },
      ),
      acceptedInvitation.id,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(applyAccountCommand).toHaveBeenCalledWith({
      partyCode: acceptedInvitation.partyCode,
      type: "party.reacquireAuthenticated",
      user: recipient,
    });
    expect(acceptPartyInvitationAfterAdmission).not.toHaveBeenCalled();
    expect(body).toMatchObject({
      admission: "reacquired",
      participantCapability: "recovered-capability",
      participantId: "participant-grace",
    });
    expectRedactedInvitation(body.invitation);
  });

  it("redacts an accepted-invitation reacquisition authority exception", async () => {
    const acceptedInvitation = createInvitation({
      resolvedAt: "2026-08-03T10:01:00.000Z",
      status: "accepted",
    });
    const handlers = createPartyInvitationRouteHandlers({
      accountPartyAuthority: createAuthority(
        vi.fn(async () => {
          throw new Error("sidecar bearer secret and URL must stay private");
        }),
      ),
      socialStore: createSocialStore({
        acceptPartyInvitationAfterAdmission: vi.fn(),
        cancelPartyInvitation: vi.fn(),
        declinePartyInvitation: vi.fn(),
        getAcceptedPartyInvitationForReacquisition: vi.fn(async () => ({
          invitation: acceptedInvitation,
          success: true,
        })),
        claimPartyInvitationForAcceptance: vi.fn(async () => ({
          reason: "party-invitation-not-pending",
          success: false,
        })),
      }),
      userStore: createUserStore(recipient),
    });
    const response = await handlers.PATCH(
      createJsonRequest(
        "/api/social/party-invitations/invitation-1",
        "PATCH",
        { decision: "accept" },
      ),
      acceptedInvitation.id,
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      code: "room-service-unavailable",
      error: "The multiplayer service is temporarily unavailable.",
    });
  });

  it("does not turn an accepted invitation into a rejoin grant after membership clears", async () => {
    const acceptedInvitation = createInvitation({
      resolvedAt: "2026-08-03T10:01:00.000Z",
      status: "accepted",
    });
    const applyAccountCommand = vi.fn(async () => ({
      code: "participant-not-found",
      error: "This account no longer belongs to the party.",
      success: false,
    }));
    const handlers = createPartyInvitationRouteHandlers({
      accountPartyAuthority: createAuthority(applyAccountCommand),
      socialStore: createSocialStore({
        acceptPartyInvitationAfterAdmission: vi.fn(),
        cancelPartyInvitation: vi.fn(),
        declinePartyInvitation: vi.fn(),
        getAcceptedPartyInvitationForReacquisition: vi.fn(async () => ({
          invitation: acceptedInvitation,
          success: true,
        })),
        claimPartyInvitationForAcceptance: vi.fn(async () => ({
          reason: "party-invitation-not-pending",
          success: false,
        })),
      }),
      userStore: createUserStore(recipient),
    });
    const response = await handlers.PATCH(
      createJsonRequest(
        "/api/social/party-invitations/invitation-1",
        "PATCH",
        { decision: "accept" },
      ),
      acceptedInvitation.id,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      code: "participant-not-found",
    });
    expect(applyAccountCommand).toHaveBeenCalledTimes(1);
  });

  it("compensates a raced re-admission instead of reviving an accepted invitation", async () => {
    const acceptedInvitation = createInvitation({
      resolvedAt: "2026-08-03T10:01:00.000Z",
      status: "accepted",
    });
    const applyAccountCommand = vi
      .fn()
      .mockResolvedValueOnce({
        admission: "admitted",
        outcome: "admission",
        participantCapability: "raced-capability",
        participantId: "participant-grace-new",
        snapshot: { room: { code: "ROOM1" }, seq: 5 },
        success: true,
      })
      .mockResolvedValueOnce({
        departed: true,
        departedParticipantId: "participant-grace-new",
        outcome: "departure",
        snapshot: { room: { code: "ROOM1" }, seq: 6 },
        success: true,
      });
    const handlers = createPartyInvitationRouteHandlers({
      accountPartyAuthority: createAuthority(applyAccountCommand),
      socialStore: createSocialStore({
        acceptPartyInvitationAfterAdmission: vi.fn(),
        cancelPartyInvitation: vi.fn(),
        declinePartyInvitation: vi.fn(),
        getAcceptedPartyInvitationForReacquisition: vi.fn(async () => ({
          invitation: acceptedInvitation,
          success: true,
        })),
        claimPartyInvitationForAcceptance: vi.fn(async () => ({
          reason: "party-invitation-not-pending",
          success: false,
        })),
      }),
      userStore: createUserStore(recipient),
    });
    const response = await handlers.PATCH(
      createJsonRequest(
        "/api/social/party-invitations/invitation-1",
        "PATCH",
        { decision: "accept" },
      ),
      acceptedInvitation.id,
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      code: "party-membership-not-reacquirable",
      error: "Party access could not be restored safely.",
    });
    expect(body).not.toHaveProperty("participantCapability");
    expect(applyAccountCommand).toHaveBeenNthCalledWith(2, {
      participantCapability: "raced-capability",
      participantId: "participant-grace-new",
      partyCode: acceptedInvitation.partyCode,
      type: "party.compensateAdmission",
      userId: recipient.id,
    });
  });

  it("compensates an admitted participant when durable acceptance fails", async () => {
    const invitation = createInvitation();
    const releasePartyInvitationAcceptanceClaim = vi.fn(async () => ({
      released: true,
      success: true,
    }));
    const applyAccountCommand = vi
      .fn()
      .mockResolvedValueOnce({
        admission: "admitted",
        outcome: "admission",
        participantCapability: "capability-secret",
        participantId: "participant-grace",
        snapshot: { room: { code: "ROOM1" }, seq: 2 },
        success: true,
      })
      .mockResolvedValueOnce({
        departed: true,
        departedParticipantId: "participant-grace",
        outcome: "departure",
        snapshot: { room: { code: "ROOM1" }, seq: 3 },
        success: true,
      });
    const handlers = createPartyInvitationRouteHandlers({
      accountPartyAuthority: createAuthority(applyAccountCommand),
      socialStore: createSocialStore({
        acceptPartyInvitationAfterAdmission: vi.fn(async () => ({
          reason: "party-invitation-expired",
          success: false,
        })),
        cancelPartyInvitation: vi.fn(),
        declinePartyInvitation: vi.fn(),
        releasePartyInvitationAcceptanceClaim,
      }),
      userStore: createUserStore(recipient),
    });
    const response = await handlers.PATCH(
      createJsonRequest(
        "/api/social/party-invitations/invitation-1",
        "PATCH",
        { decision: "accept" },
      ),
      invitation.id,
    );

    expect(response.status).toBe(410);
    expect(applyAccountCommand).toHaveBeenNthCalledWith(2, {
      participantCapability: "capability-secret",
      participantId: "participant-grace",
      partyCode: "ROOM1",
      type: "party.compensateAdmission",
      userId: recipient.id,
    });
    expect(releasePartyInvitationAcceptanceClaim).toHaveBeenCalledWith(
      recipient.id,
      invitation.id,
      "claim-token",
    );
    expect(applyAccountCommand.mock.invocationCallOrder[1]).toBeLessThan(
      releasePartyInvitationAcceptanceClaim.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("never compensates a reacquired membership after durable failure", async () => {
    const invitation = createInvitation();
    const releasePartyInvitationAcceptanceClaim = vi.fn(async () => ({
      released: true,
      success: true,
    }));
    const applyAccountCommand = vi.fn(async () => ({
      admission: "reacquired",
      outcome: "admission",
      participantCapability: "new-tab-capability",
      participantId: "participant-grace",
      snapshot: { room: { code: "ROOM1" }, seq: 2 },
      success: true,
    }));
    const handlers = createPartyInvitationRouteHandlers({
      accountPartyAuthority: createAuthority(applyAccountCommand),
      socialStore: createSocialStore({
        acceptPartyInvitationAfterAdmission: vi.fn(async () => ({
          reason: "party-invitation-not-pending",
          success: false,
        })),
        cancelPartyInvitation: vi.fn(),
        declinePartyInvitation: vi.fn(),
        releasePartyInvitationAcceptanceClaim,
      }),
      userStore: createUserStore(recipient),
    });
    const response = await handlers.PATCH(
      createJsonRequest(
        "/api/social/party-invitations/invitation-1",
        "PATCH",
        { decision: "accept" },
      ),
      invitation.id,
    );

    expect(response.status).toBe(409);
    expect(applyAccountCommand).toHaveBeenCalledTimes(1);
    expect(releasePartyInvitationAcceptanceClaim).toHaveBeenCalledWith(
      recipient.id,
      invitation.id,
      "claim-token",
    );
  });

  it("revokes terminal parties but suspends invitations for transient or recipient state", async () => {
    const invitation = createInvitation();
    const releasePartyInvitationAcceptanceClaim = vi.fn(async () => ({
      released: true,
      success: true,
    }));
    const revokePartyInvitationsForParty = vi.fn(async () => ({
      revokedCount: 2,
      success: true,
    }));
    const socialStore = createSocialStore({
      acceptPartyInvitationAfterAdmission: vi.fn(),
      cancelPartyInvitation: vi.fn(),
      declinePartyInvitation: vi.fn(),
      releasePartyInvitationAcceptanceClaim,
      revokePartyInvitationsForParty,
    });
    const closedHandlers = createPartyInvitationRouteHandlers({
      accountPartyAuthority: createAuthority(
        vi.fn(async () => ({
          code: "party-closed",
          error: "Party is closed.",
          success: false,
        })),
      ),
      socialStore,
      userStore: createUserStore(recipient),
    });
    const unavailableHandlers = createPartyInvitationRouteHandlers({
      accountPartyAuthority: createAuthority(
        vi.fn(async () => ({
          code: "room-service-unavailable",
          error: "Room service is unavailable.",
          success: false,
        })),
      ),
      socialStore,
      userStore: createUserStore(recipient),
    });
    const otherPartyHandlers = createPartyInvitationRouteHandlers({
      accountPartyAuthority: createAuthority(
        vi.fn(async () => ({
          code: "in-other-party",
          error: "This account already belongs to another party.",
          success: false,
        })),
      ),
      socialStore,
      userStore: createUserStore(recipient),
    });
    const request = () =>
      createJsonRequest(
        "/api/social/party-invitations/invitation-1",
        "PATCH",
        { decision: "accept" },
      );

    expect((await closedHandlers.PATCH(request(), invitation.id)).status).toBe(
      410,
    );
    expect(revokePartyInvitationsForParty).toHaveBeenCalledWith("ROOM1");
    expect(
      (await unavailableHandlers.PATCH(request(), invitation.id)).status,
    ).toBe(502);
    expect((await otherPartyHandlers.PATCH(request(), invitation.id)).status).toBe(
      409,
    );
    expect(releasePartyInvitationAcceptanceClaim).toHaveBeenCalledTimes(3);
    expect(releasePartyInvitationAcceptanceClaim).toHaveBeenCalledWith(
      recipient.id,
      invitation.id,
      "claim-token",
    );
  });

  it("returns a safe error when exact compensation cannot be confirmed", async () => {
    const invitation = createInvitation();
    const releasePartyInvitationAcceptanceClaim = vi.fn();
    const applyAccountCommand = vi
      .fn()
      .mockResolvedValueOnce({
        admission: "admitted",
        outcome: "admission",
        participantCapability: "capability-secret",
        participantId: "participant-grace",
        snapshot: { room: { code: "ROOM1" }, seq: 2 },
        success: true,
      })
      .mockResolvedValueOnce({
        code: "participant-conflict",
        error: "Participant is already connected.",
        success: false,
      });
    const handlers = createPartyInvitationRouteHandlers({
      accountPartyAuthority: createAuthority(applyAccountCommand),
      socialStore: createSocialStore({
        acceptPartyInvitationAfterAdmission: vi.fn(async () => {
          throw new Error("database unavailable");
        }),
        cancelPartyInvitation: vi.fn(),
        declinePartyInvitation: vi.fn(),
        releasePartyInvitationAcceptanceClaim,
      }),
      userStore: createUserStore(recipient),
    });
    const response = await handlers.PATCH(
      createJsonRequest(
        "/api/social/party-invitations/invitation-1",
        "PATCH",
        { decision: "accept" },
      ),
      invitation.id,
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      code: "admission-compensation-failed",
      error: "The party admission could not be rolled back safely.",
    });
    expect(releasePartyInvitationAcceptanceClaim).not.toHaveBeenCalled();
  });
});
