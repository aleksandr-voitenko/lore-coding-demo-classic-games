import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CurrentUserProvider } from "@/hooks/use-current-user";
import type {
  SocialAvailability,
  SocialFriend,
  SocialOverview,
  SocialPartyInvitation,
} from "@/lib/social";
import {
  SocialClientError,
  type SocialPartyInvitationCreation,
} from "@/lib/social-client";
import type { PrivateRoom } from "@/lib/multiplayer/room";

import { SocialProvider } from "./social-provider";
import {
  SocialPartyInviteControls,
  areSocialPartyInviteControlPropsEqual,
  formatSocialPartyInviteError,
  getSocialPartyInvitationFeedback,
  getSocialPartyInviteRows,
  reconcileCurrentPartyInvitations,
} from "./social-party-invite-controls";

const ROOM: PrivateRoom = {
  code: "PRIVATE-ROOM-1",
  hostParticipantId: "host-participant",
  matchId: 1,
  nextMatchParticipantIds: [],
  observerLimit: 2,
  participants: [
    {
      displayName: "Host",
      id: "host-participant",
      role: "host",
      userId: "user-host",
    },
    {
      displayName: "Member",
      id: "member-participant",
      role: "observer",
      userId: "user-member",
    },
  ],
  seats: [
    {
      id: "player-1",
      label: "Player 1",
      occupiedByParticipantId: "host-participant",
      required: true,
    },
    {
      id: "player-2",
      label: "Player 2",
      occupiedByParticipantId: null,
      required: true,
    },
  ],
  settings: { gameId: "pong" },
  status: "lobby",
};

function createFriend(
  userId: string,
  availability: SocialAvailability = "available",
): SocialFriend {
  return {
    availability,
    friendsSince: "2026-08-03T00:00:00.000Z",
    user: {
      displayName: userId.replace("user-", "Friend "),
      id: userId,
    },
  };
}

function createInvitation(
  recipient: SocialFriend,
  intent: "play" | "watch" = "play",
): SocialPartyInvitation {
  return {
    createdAt: "2026-08-03T00:00:00.000Z",
    expiresAt: "2026-08-03T00:05:00.000Z",
    id: `invite-${recipient.user.id}`,
    intent,
    inviter: { displayName: "Host", id: "user-host" },
    recipient: recipient.user,
    resolvedAt: null,
    status: "pending",
    updatedAt: "2026-08-03T00:00:00.000Z",
  };
}

function getRow(
  rows: ReturnType<typeof getSocialPartyInviteRows>,
  userId: string,
) {
  const row = rows.find((candidate) => candidate.friend.user.id === userId);

  if (row === undefined) {
    throw new Error(`Expected a row for ${userId}.`);
  }

  return row;
}

function createOverview(
  outgoingPartyInvitations: SocialPartyInvitation[],
): SocialOverview {
  return {
    blockedUsers: [],
    friends: [],
    incomingFriendRequests: [],
    incomingPartyInvitations: [],
    outgoingFriendRequests: [],
    outgoingPartyInvitations,
  };
}

describe("social party invite controls", () => {
  it("distinguishes party membership, current-panel invitations, and availability", () => {
    const member = createFriend("user-member");
    const pending = createFriend("user-pending", "busy");
    const friends = [
      member,
      pending,
      createFriend("user-busy", "busy"),
      createFriend("user-party", "in-party"),
      createFriend("user-offline", "offline"),
      createFriend("user-unknown", "unknown"),
      createFriend("user-available"),
    ];
    const rows = getSocialPartyInviteRows({
      currentPartyInvitations: [
        createInvitation(member),
        createInvitation(pending, "watch"),
      ],
      friends,
      room: ROOM,
    });

    expect(getRow(rows, "user-member")).toMatchObject({
      kind: "same-party",
      role: "observer",
      statusLabel: "In this party",
    });
    expect(getRow(rows, "user-pending")).toMatchObject({
      kind: "pending",
      statusLabel: "Watch invitation pending",
    });
    expect(getRow(rows, "user-busy")).toMatchObject({
      kind: "unavailable",
      statusLabel: "Busy",
    });
    expect(getRow(rows, "user-party")).toMatchObject({
      kind: "unavailable",
      statusLabel: "In another party",
    });
    expect(getRow(rows, "user-offline")).toMatchObject({
      kind: "unavailable",
      statusLabel: "Offline",
    });
    expect(getRow(rows, "user-unknown")).toMatchObject({
      kind: "unavailable",
      statusLabel: "Checking status",
    });
    expect(getRow(rows, "user-available")).toMatchObject({
      kind: "available",
      playDisabledReason: null,
      statusLabel: "Available · Player spot open",
      watchDisabledReason: null,
    });
  });

  it("keeps Play available for an open seat when Watching is full", () => {
    const available = createFriend("user-available");
    const room = { ...ROOM, observerLimit: 1 } satisfies PrivateRoom;
    const row = getRow(
      getSocialPartyInviteRows({
        currentPartyInvitations: [],
        friends: [available],
        room,
      }),
      available.user.id,
    );

    expect(row).toMatchObject({
      kind: "available",
      playAdmissionRole: "player",
      playDisabledReason: null,
      statusLabel: "Watching full · Player spot open",
      watchDisabledReason: "Watching full",
    });
  });

  it("explains before sending when Play currently offers Watching", () => {
    const available = createFriend("user-available");
    const room = { ...ROOM, status: "running" } satisfies PrivateRoom;
    const row = getRow(
      getSocialPartyInviteRows({
        currentPartyInvitations: [],
        friends: [available],
        room,
      }),
      available.user.id,
    );

    expect(row).toMatchObject({
      kind: "available",
      playAdmissionRole: "observer",
      playDisabledReason: null,
      statusLabel: "Available · Play offers Watching",
      watchDisabledReason: null,
    });
  });

  it("disables both intents when Play would also watch a full active party", () => {
    const available = createFriend("user-available");
    const room = {
      ...ROOM,
      observerLimit: 1,
      status: "running",
    } satisfies PrivateRoom;
    const row = getRow(
      getSocialPartyInviteRows({
        currentPartyInvitations: [],
        friends: [available],
        room,
      }),
      available.user.id,
    );

    expect(row).toMatchObject({
      kind: "available",
      playAdmissionRole: "observer",
      playDisabledReason: "Party full",
      statusLabel: "Party full",
      watchDisabledReason: "Watching full",
    });
  });

  it("uses the authoritative creation result for honest feedback", () => {
    const friend = createFriend("user-grace");
    const invitation = createInvitation(friend);
    const playerCreation = {
      admissionRole: "player",
      created: true,
      invitation,
    } satisfies SocialPartyInvitationCreation;

    expect(getSocialPartyInvitationFeedback(playerCreation, "Grace")).toContain(
      "currently available",
    );
    expect(
      getSocialPartyInvitationFeedback(
        { ...playerCreation, admissionRole: "observer" },
        "Grace",
      ),
    ).toContain("current offer is Watching");
    expect(
      getSocialPartyInvitationFeedback(
        {
          ...playerCreation,
          admissionRole: "observer",
          invitation: { ...invitation, intent: "watch" },
        },
        "Grace",
      ),
    ).toContain("Watching is currently available");
    expect(
      getSocialPartyInvitationFeedback(
        { ...playerCreation, created: false },
        "Grace",
      ),
    ).toBe(
      "Play invite to Grace is already pending. A player spot is currently available; the party will check again when they accept and may offer Watching if capacity allows.",
    );
    expect(
      getSocialPartyInvitationFeedback(
        {
          ...playerCreation,
          admissionRole: "observer",
          created: false,
        },
        "Grace",
      ),
    ).toContain("current offer is Watching");

    expect(getSocialPartyInvitationFeedback(playerCreation, "Grace")).toContain(
      "may offer Watching if capacity allows",
    );
  });

  it("reconciles only after the tracked post-create request generation", () => {
    const friend = createFriend("user-grace");
    const invitation = createInvitation(friend);
    const unrelatedInvitation = createInvitation(createFriend("user-katherine"));
    const trackedPartyInvitations = [
      { invitation, reconcileAfterRequestGeneration: 5 },
    ];
    const preCreationOverview = createOverview([]);
    const initial = reconcileCurrentPartyInvitations({
      overview: preCreationOverview,
      overviewRequestGeneration: 4,
      trackedPartyInvitations,
    });

    expect(initial).toEqual([invitation]);

    const observedOverview = createOverview([invitation, unrelatedInvitation]);
    expect(
      reconcileCurrentPartyInvitations({
        overview: observedOverview,
        overviewRequestGeneration: 5,
        trackedPartyInvitations,
      }),
    ).toEqual([invitation]);

    const resolvedOverview = createOverview([unrelatedInvitation]);
    const resolved = reconcileCurrentPartyInvitations({
      overview: resolvedOverview,
      overviewRequestGeneration: 6,
      trackedPartyInvitations,
    });

    expect(resolved).toEqual([]);
  });

  it("handles superseded concurrent refreshes and resolution before observation", () => {
    const graceInvitation = createInvitation(createFriend("user-grace"));
    const katherineInvitation = createInvitation(
      createFriend("user-katherine"),
      "watch",
    );
    const tracked = [
      {
        invitation: graceInvitation,
        reconcileAfterRequestGeneration: 7,
      },
      {
        invitation: katherineInvitation,
        reconcileAfterRequestGeneration: 8,
      },
    ];

    expect(
      reconcileCurrentPartyInvitations({
        overview: createOverview([katherineInvitation]),
        overviewRequestGeneration: 8,
        trackedPartyInvitations: tracked,
      }),
    ).toEqual([katherineInvitation]);
  });

  it("skips active-game rerenders until invitation-relevant room state changes", () => {
    const previousProps = { actionsDisabled: false, room: ROOM };
    const gameOnlySnapshot = {
      ...ROOM,
      matchId: ROOM.matchId + 1,
      settings: { ...ROOM.settings, parameters: { speed: "fast" } },
    } satisfies PrivateRoom;

    expect(
      areSocialPartyInviteControlPropsEqual(previousProps, {
        actionsDisabled: false,
        room: gameOnlySnapshot,
      }),
    ).toBe(true);
    expect(
      areSocialPartyInviteControlPropsEqual(previousProps, {
        actionsDisabled: false,
        room: { ...ROOM, observerLimit: ROOM.observerLimit + 1 },
      }),
    ).toBe(false);
  });

  it("adds Retry-After guidance to invitation failures", () => {
    expect(
      formatSocialPartyInviteError(
        new SocialClientError({
          code: "rate-limit-reached",
          message: "Too many invitations.",
          retryAfterSeconds: 9,
          status: 429,
        }),
      ),
    ).toBe("Too many invitations. Try again in 9 seconds.");
  });

  it("renders loading without exposing the private party code", () => {
    const markup = renderToStaticMarkup(
      <CurrentUserProvider
        initialUser={{ displayName: "Host", id: "user-host" }}
      >
        <SocialProvider enabled presenceState="busy">
          <SocialPartyInviteControls room={ROOM} />
        </SocialProvider>
      </CurrentUserProvider>,
    );

    expect(markup).toContain('data-testid="social-party-invite-controls"');
    expect(markup).toContain("Loading friends...");
    expect(markup).not.toContain(ROOM.code);
    expect(markup).not.toContain("participantCapability");
  });
});
