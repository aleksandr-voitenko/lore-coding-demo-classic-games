import { describe, expect, it, vi } from "vitest";

import type { MultiplayerRoomSnapshot } from "@/lib/multiplayer/protocol";
import type { AuthenticatedUser } from "@/lib/user-profile";

import { MultiplayerRoomServiceClient } from "./multiplayer-room-service-client";

const HOST_USER = {
  displayName: "Ada Host",
  id: "user-1",
} satisfies AuthenticatedUser;

const GUEST_USER = {
  displayName: "Grace Guest",
  id: "user-2",
} satisfies AuthenticatedUser;

const ROOM_SNAPSHOT = {
  participant: {
    displayName: "Ada Host",
    id: "host-1",
    role: "host",
    userId: "user-1",
  },
  room: {
    code: "ROOM1",
    hostParticipantId: "host-1",
    matchId: 1,
    nextMatchParticipantIds: [],
    observerLimit: 8,
    participants: [
      {
        displayName: "Ada Host",
        id: "host-1",
        role: "host",
        userId: "user-1",
      },
    ],
    seats: [
      {
        id: "left",
        label: "Left Paddle",
        occupiedByParticipantId: "host-1",
        required: true,
      },
      {
        id: "right",
        label: "Right Paddle",
        occupiedByParticipantId: null,
        required: true,
      },
    ],
    settings: {
      gameId: "pong",
    },
    status: "lobby",
  },
  seq: 1,
} satisfies MultiplayerRoomSnapshot;

const ADMISSION_SNAPSHOT = {
  ...ROOM_SNAPSHOT,
  participant: {
    displayName: GUEST_USER.displayName,
    id: "guest-1",
    role: "player",
    userId: GUEST_USER.id,
  },
  room: {
    ...ROOM_SNAPSHOT.room,
    participants: [
      ...ROOM_SNAPSHOT.room.participants,
      {
        displayName: GUEST_USER.displayName,
        id: "guest-1",
        role: "player",
        userId: GUEST_USER.id,
      },
    ],
    seats: ROOM_SNAPSHOT.room.seats.map((seat) =>
      seat.id === "right"
        ? { ...seat, occupiedByParticipantId: "guest-1" }
        : seat,
    ),
  },
  seq: 2,
} satisfies MultiplayerRoomSnapshot;

const COMPENSATED_SNAPSHOT = {
  ...ROOM_SNAPSHOT,
  participant: undefined,
  seq: 3,
} satisfies MultiplayerRoomSnapshot;

function getRequestBody(init: RequestInit | undefined) {
  return JSON.parse(String(init?.body));
}

describe("multiplayer room service client", () => {
  it("keeps a split-version preflight and legacy mutation target from changing room state", async () => {
    const requests: Array<{ method: string; url: string }> = [];
    let legacyMutationCount = 0;
    const baseUrl = "http://service.local/_internal/multiplayer/rooms";
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const method = init?.method ?? "GET";
      const url = String(input);

      requests.push({ method, url });

      if (method === "GET" && url === baseUrl) {
        return Response.json({
          mutationPathSegment: "v2",
          participantCapabilities: true,
          protocolVersion: 2,
        });
      }

      // A legacy sidecar recognizes only the unversioned collection POST.
      if (method === "POST" && url === baseUrl) {
        legacyMutationCount += 1;
        return Response.json(
          {
            participantCapability: "host-capability",
            snapshot: ROOM_SNAPSHOT,
            success: true,
          },
          { status: 201 },
        );
      }

      return Response.json({ error: "Not found." }, { status: 404 });
    });
    const client = new MultiplayerRoomServiceClient({ baseUrl, fetcher });

    await expect(client.createRoom({ host: HOST_USER })).resolves.toMatchObject({
      code: "room-service-invalid-response",
      success: false,
    });
    expect(legacyMutationCount).toBe(0);
    expect(requests).toEqual([
      { method: "GET", url: baseUrl },
    ]);
  });

  it("does not mutate rooms when the service lacks the capability protocol handshake", async () => {
    const methods: string[] = [];
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      methods.push(init?.method ?? "GET");

      if (init?.method === "GET") {
        return Response.json(
          { error: "Method not allowed." },
          { status: 405 },
        );
      }

      return Response.json(
        {
          participantCapability: "host-capability",
          snapshot: ROOM_SNAPSHOT,
          success: true,
        },
        { status: 201 },
      );
    });
    const client = new MultiplayerRoomServiceClient({
      baseUrl: "http://service.local/_internal/multiplayer/rooms",
      fetcher,
    });

    await expect(client.createRoom({ host: HOST_USER })).resolves.toMatchObject({
      code: "room-service-invalid-response",
      success: false,
    });
    expect(methods).toEqual(["GET"]);
  });

  it("does not send account commands unless every protocol-v6 authority capability is advertised", async () => {
    const methods: string[] = [];
    const client = new MultiplayerRoomServiceClient({
      baseUrl: "http://service.local/_internal/multiplayer/rooms",
      fetcher: vi.fn<typeof fetch>(async (_input, init) => {
        methods.push(init?.method ?? "GET");

        return Response.json({
          accountPartyMemberships: true,
          authenticatedAdmission: true,
          membershipOnlyReacquisition: true,
          mutationPathSegment: "v6",
          participantCapabilities: true,
          protocolVersion: 6,
          // Deliberately omit socialPresenceLeases.
        });
      }),
    });

    await expect(
      client.applyAccountCommand({
        type: "presence.resolve",
        userIds: [GUEST_USER.id],
      }),
    ).resolves.toMatchObject({
      code: "room-service-invalid-response",
      success: false,
    });
    expect(methods).toEqual(["GET"]);
  });

  it("does not send membership-only reacquisition to a v6 sidecar that does not advertise it", async () => {
    const methods: string[] = [];
    const client = new MultiplayerRoomServiceClient({
      baseUrl: "http://service.local/_internal/multiplayer/rooms",
      fetcher: vi.fn<typeof fetch>(async (_input, init) => {
        methods.push(init?.method ?? "GET");

        return Response.json({
          accountPartyMemberships: true,
          authenticatedAdmission: true,
          mutationPathSegment: "v6",
          participantCapabilities: true,
          protocolVersion: 6,
          socialPresenceLeases: true,
          // Deliberately omit membershipOnlyReacquisition to model an older v6 sidecar.
        });
      }),
    });

    await expect(
      client.applyAccountCommand({
        partyCode: "ROOM1",
        type: "party.reacquireAuthenticated",
        user: GUEST_USER,
      }),
    ).resolves.toMatchObject({
      code: "room-service-invalid-response",
      success: false,
    });
    expect(methods).toEqual(["GET"]);
  });

  it("does not trust a capability-shaped protocol preflight returned with an error status", async () => {
    const methods: string[] = [];
    const client = new MultiplayerRoomServiceClient({
      baseUrl: "http://service.local/_internal/multiplayer/rooms",
      fetcher: vi.fn<typeof fetch>(async (_input, init) => {
        methods.push(init?.method ?? "GET");

        return Response.json(
          {
            accountPartyMemberships: true,
            authenticatedAdmission: true,
            membershipOnlyReacquisition: true,
            mutationPathSegment: "v6",
            participantCapabilities: true,
            protocolVersion: 6,
            socialPresenceLeases: true,
          },
          { status: 503 },
        );
      }),
    });

    await expect(
      client.applyAccountCommand({
        type: "presence.resolve",
        userIds: [GUEST_USER.id],
      }),
    ).resolves.toMatchObject({
      code: "room-service-invalid-response",
      success: false,
    });
    expect(methods).toEqual(["GET"]);
  });

  it("creates, reads, and commands rooms through the configured HTTP base", async () => {
    const requests: Array<{
      init: RequestInit | undefined;
      url: string;
    }> = [];
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      requests.push({ init, url });

      if (
        url.endsWith("/_internal/multiplayer/rooms") &&
        init?.method === "GET"
      ) {
        return Response.json({
          accountPartyMemberships: true,
          authenticatedAdmission: true,
          membershipOnlyReacquisition: true,
          mutationPathSegment: "v6",
          participantCapabilities: true,
          protocolVersion: 6,
          socialPresenceLeases: true,
        });
      }

      if (
        url.endsWith("/_internal/multiplayer/rooms/v6") &&
        init?.method === "POST"
      ) {
        return Response.json(
          {
            outcome: "snapshot",
            participantCapability: "host-capability",
            snapshot: ROOM_SNAPSHOT,
            success: true,
          },
          { status: 201 },
        );
      }

      if (
        url.endsWith("/_internal/multiplayer/rooms/ROOM1") &&
        init?.method === "GET"
      ) {
        return Response.json({
          outcome: "snapshot",
          snapshot: {
            ...ROOM_SNAPSHOT,
            seq: 2,
          },
          success: true,
        });
      }

      if (
        url.endsWith("/_internal/multiplayer/rooms/v6/ROOM1") &&
        init?.method === "POST"
      ) {
        return Response.json({
          outcome: "snapshot",
          snapshot: {
            ...ROOM_SNAPSHOT,
            seq: 3,
          },
          success: true,
        });
      }

      return Response.json(
        {
          code: "room-not-found",
          error: "Room was not found.",
          success: false,
        },
        { status: 404 },
      );
    });
    const client = new MultiplayerRoomServiceClient({
      baseUrl: " http://service.local/_internal/multiplayer/rooms/ ",
      bearerToken: " service-secret ",
      fetcher,
    });

    await expect(
      client.createRoom({
        host: HOST_USER,
        settings: {
          gameId: "pong",
        },
      }),
    ).resolves.toEqual({
      outcome: "snapshot",
      participantCapability: "host-capability",
      snapshot: ROOM_SNAPSHOT,
      success: true,
    });
    await expect(client.getRoom("room1")).resolves.toEqual({
      outcome: "snapshot",
      snapshot: {
        ...ROOM_SNAPSHOT,
        seq: 2,
      },
      success: true,
    });
    await expect(
      client.applyCommand("room1", {
        displayName: "Guest Hero",
        type: "room.joinObserver",
      }),
    ).resolves.toEqual({
      outcome: "snapshot",
      snapshot: {
        ...ROOM_SNAPSHOT,
        seq: 3,
      },
      success: true,
    });

    expect(requests.map((request) => request.url)).toEqual([
      "http://service.local/_internal/multiplayer/rooms",
      "http://service.local/_internal/multiplayer/rooms/v6",
      "http://service.local/_internal/multiplayer/rooms/ROOM1",
      "http://service.local/_internal/multiplayer/rooms",
      "http://service.local/_internal/multiplayer/rooms/v6/ROOM1",
    ]);
    expect(requests.map((request) => request.init?.method)).toEqual([
      "GET",
      "POST",
      "GET",
      "GET",
      "POST",
    ]);
    expect(requests.map((request) => request.init?.headers)).toEqual([
      {
        accept: "application/json",
        authorization: "Bearer service-secret",
      },
      {
        accept: "application/json",
        authorization: "Bearer service-secret",
        "content-type": "application/json",
        "x-multiplayer-room-protocol-version": "6",
      },
      {
        accept: "application/json",
        authorization: "Bearer service-secret",
      },
      {
        accept: "application/json",
        authorization: "Bearer service-secret",
      },
      {
        accept: "application/json",
        authorization: "Bearer service-secret",
        "content-type": "application/json",
        "x-multiplayer-room-protocol-version": "6",
      },
    ]);
    expect(getRequestBody(requests[1]?.init)).toEqual({
      host: HOST_USER,
      settings: {
        gameId: "pong",
      },
    });
    expect(getRequestBody(requests[4]?.init)).toEqual({
      displayName: "Guest Hero",
      type: "room.joinObserver",
    });
  });

  it("renews presence and performs authenticated party operations through the protected account authority", async () => {
    const requests: Array<{
      init: RequestInit | undefined;
      url: string;
    }> = [];
    const baseUrl = "http://service.local/_internal/multiplayer/rooms";
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      requests.push({ init, url });

      if (url === baseUrl && init?.method === "GET") {
        return Response.json({
          accountPartyMemberships: true,
          authenticatedAdmission: true,
          membershipOnlyReacquisition: true,
          mutationPathSegment: "v6",
          participantCapabilities: true,
          protocolVersion: 6,
          socialPresenceLeases: true,
        });
      }

      const command = getRequestBody(init);

      switch (command.type) {
        case "presence.renew":
          return Response.json({
            availability: "available",
            changed: true,
            outcome: "presence",
            success: true,
          });
        case "presence.resolve":
          return Response.json({
            availabilities: [
              { availability: "available", userId: GUEST_USER.id },
              { availability: "offline", userId: "user-3" },
            ],
            outcome: "availability",
            success: true,
          });
        case "party.inspectInvitation":
          return Response.json({
            admissionRole: "player",
            eligible: true,
            outcome: "invitation-eligibility",
            reason: null,
            success: true,
          });
        case "party.admitAuthenticated":
          return Response.json({
            admission: "admitted",
            outcome: "admission",
            participantCapability: "guest-capability",
            participantId: "guest-1",
            snapshot: ADMISSION_SNAPSHOT,
            success: true,
          });
        case "party.reacquireAuthenticated":
          return Response.json({
            admission: "reacquired",
            outcome: "admission",
            participantCapability: "reacquired-capability",
            participantId: "guest-1",
            snapshot: ADMISSION_SNAPSHOT,
            success: true,
          });
        case "party.compensateAdmission":
          return Response.json({
            departed: true,
            departedParticipantId: "guest-1",
            outcome: "departure",
            snapshot: COMPENSATED_SNAPSHOT,
            success: true,
          });
        default:
          return Response.json({ error: "Unsupported test command." }, { status: 400 });
      }
    });
    const client = new MultiplayerRoomServiceClient({
      baseUrl,
      bearerToken: "service-secret",
      fetcher,
    });

    await expect(
      client.applyAccountCommand({
        clientId: "browser-client-0001",
        state: "available",
        type: "presence.renew",
        userId: GUEST_USER.id,
      }),
    ).resolves.toEqual({
      availability: "available",
      changed: true,
      outcome: "presence",
      success: true,
    });
    await expect(
      client.applyAccountCommand({
        type: "presence.resolve",
        userIds: [GUEST_USER.id, "user-3"],
      }),
    ).resolves.toEqual({
      availabilities: [
        { availability: "available", userId: GUEST_USER.id },
        { availability: "offline", userId: "user-3" },
      ],
      outcome: "availability",
      success: true,
    });
    await expect(
      client.applyAccountCommand({
        hostUserId: HOST_USER.id,
        intent: "play",
        partyCode: "ROOM1",
        recipientUserId: GUEST_USER.id,
        type: "party.inspectInvitation",
      }),
    ).resolves.toMatchObject({
      admissionRole: "player",
      eligible: true,
      outcome: "invitation-eligibility",
      success: true,
    });
    await expect(
      client.applyAccountCommand({
        intent: "play",
        partyCode: "ROOM1",
        type: "party.admitAuthenticated",
        user: GUEST_USER,
      }),
    ).resolves.toMatchObject({
      admission: "admitted",
      outcome: "admission",
      participantCapability: "guest-capability",
      participantId: "guest-1",
      success: true,
    });
    await expect(
      client.applyAccountCommand({
        partyCode: "ROOM1",
        type: "party.reacquireAuthenticated",
        user: GUEST_USER,
      }),
    ).resolves.toMatchObject({
      admission: "reacquired",
      outcome: "admission",
      participantCapability: "reacquired-capability",
      participantId: "guest-1",
      success: true,
    });
    await expect(
      client.applyAccountCommand({
        participantCapability: "guest-capability",
        participantId: "guest-1",
        partyCode: "ROOM1",
        type: "party.compensateAdmission",
        userId: GUEST_USER.id,
      }),
    ).resolves.toMatchObject({
      departed: true,
      departedParticipantId: "guest-1",
      outcome: "departure",
      success: true,
    });

    expect(requests.map(({ url }) => url)).toEqual(
      Array.from({ length: 6 }).flatMap(() => [
        baseUrl,
        `${baseUrl}/v6/_accounts`,
      ]),
    );
    expect(requests[1]?.init?.headers).toEqual({
      accept: "application/json",
      authorization: "Bearer service-secret",
      "content-type": "application/json",
      "x-multiplayer-room-protocol-version": "6",
    });
  });

  it.each([
    {
      command: {
        type: "presence.resolve" as const,
        userIds: [GUEST_USER.id],
      },
      name: "duplicate account availability entries",
      payload: {
        availabilities: [
          { availability: "available", userId: GUEST_USER.id },
          { availability: "busy", userId: GUEST_USER.id },
        ],
        outcome: "availability",
        success: true,
      },
    },
    {
      command: {
        type: "presence.resolve" as const,
        userIds: [GUEST_USER.id, "user-3"],
      },
      name: "a missing requested account availability",
      payload: {
        availabilities: [
          { availability: "available", userId: GUEST_USER.id },
        ],
        outcome: "availability",
        success: true,
      },
    },
    {
      command: {
        type: "presence.resolve" as const,
        userIds: [GUEST_USER.id, "user-3"],
      },
      name: "reordered requested account availabilities",
      payload: {
        availabilities: [
          { availability: "offline", userId: "user-3" },
          { availability: "available", userId: GUEST_USER.id },
        ],
        outcome: "availability",
        success: true,
      },
    },
    {
      command: {
        type: "presence.resolve" as const,
        userIds: [GUEST_USER.id],
      },
      name: "an unrelated extra account availability",
      payload: {
        availabilities: [
          { availability: "available", userId: GUEST_USER.id },
          { availability: "offline", userId: "user-3" },
        ],
        outcome: "availability",
        success: true,
      },
    },
    {
      command: {
        hostUserId: HOST_USER.id,
        intent: "play",
        partyCode: "ROOM1",
        recipientUserId: GUEST_USER.id,
        type: "party.inspectInvitation" as const,
      },
      name: "inconsistent invitation eligibility",
      payload: {
        admissionRole: null,
        eligible: true,
        outcome: "invitation-eligibility",
        reason: null,
        success: true,
      },
    },
    {
      command: {
        intent: "play",
        partyCode: "ROOM1",
        type: "party.admitAuthenticated" as const,
        user: GUEST_USER,
      },
      name: "an admission snapshot for another participant",
      payload: {
        admission: "admitted",
        outcome: "admission",
        participantCapability: "guest-capability",
        participantId: "guest-2",
        snapshot: ADMISSION_SNAPSHOT,
        success: true,
      },
    },
    {
      command: {
        partyCode: "ROOM1",
        type: "party.reacquireAuthenticated" as const,
        user: GUEST_USER,
      },
      name: "a new admission returned for a membership-only reacquisition",
      payload: {
        admission: "admitted",
        outcome: "admission",
        participantCapability: "guest-capability",
        participantId: "guest-1",
        snapshot: ADMISSION_SNAPSHOT,
        success: true,
      },
    },
    {
      command: {
        intent: "play",
        partyCode: "ROOM1",
        type: "party.admitAuthenticated" as const,
        user: GUEST_USER,
      },
      name: "an admission snapshot with another display name",
      payload: {
        admission: "admitted",
        outcome: "admission",
        participantCapability: "guest-capability",
        participantId: "guest-1",
        snapshot: {
          ...ADMISSION_SNAPSHOT,
          participant: {
            ...ADMISSION_SNAPSHOT.participant,
            displayName: "Another Guest",
          },
          room: {
            ...ADMISSION_SNAPSHOT.room,
            participants: ADMISSION_SNAPSHOT.room.participants.map(
              (participant) =>
                participant.id === "guest-1"
                  ? { ...participant, displayName: "Another Guest" }
                  : participant,
            ),
          },
        },
        success: true,
      },
    },
    {
      command: {
        intent: "spectate",
        partyCode: "ROOM1",
        type: "party.admitAuthenticated" as const,
        user: GUEST_USER,
      },
      name: "an admission for an unsupported invitation intent",
      payload: {
        admission: "admitted",
        outcome: "admission",
        participantCapability: "guest-capability",
        participantId: "guest-1",
        snapshot: ADMISSION_SNAPSHOT,
        success: true,
      },
    },
    {
      command: {
        intent: "play",
        partyCode: "ROOM1",
        type: "party.admitAuthenticated" as const,
        user: HOST_USER,
      },
      name: "a newly admitted participant with the host role",
      payload: {
        admission: "admitted",
        outcome: "admission",
        participantCapability: "host-capability",
        participantId: "host-1",
        snapshot: ROOM_SNAPSHOT,
        success: true,
      },
    },
    {
      command: {
        participantCapability: "guest-capability",
        participantId: "guest-1",
        partyCode: "ROOM1",
        type: "party.compensateAdmission" as const,
        userId: GUEST_USER.id,
      },
      name: "a compensated participant still present in the snapshot",
      payload: {
        departed: true,
        departedParticipantId: "guest-1",
        outcome: "departure",
        snapshot: ADMISSION_SNAPSHOT,
        success: true,
      },
    },
    {
      command: {
        participantCapability: "guest-capability",
        participantId: "guest-1",
        partyCode: "ROOM1",
        type: "party.compensateAdmission" as const,
        userId: GUEST_USER.id,
      },
      name: "an impossible party-closing compensation",
      payload: {
        departed: true,
        departedParticipantId: "guest-1",
        outcome: "departure",
        partyClosed: true,
        success: true,
      },
    },
    {
      command: {
        participantCapability: " ",
        participantId: "guest-1",
        partyCode: "ROOM1",
        type: "party.compensateAdmission" as const,
        userId: GUEST_USER.id,
      },
      name: "an already-absent compensation for an invalid capability",
      payload: {
        departed: false,
        outcome: "departure",
        success: true,
      },
    },
    {
      command: {
        participantCapability: "guest-capability",
        participantId: "guest-1",
        partyCode: "ROOM1",
        type: "party.compensateAdmission" as const,
        userId: "bad_user",
      },
      name: "an already-absent compensation for an invalid account",
      payload: {
        departed: false,
        outcome: "departure",
        success: true,
      },
    },
  ])("rejects $name from the account authority", async ({ command, payload }) => {
    const baseUrl = "http://service.local/_internal/multiplayer/rooms";
    const client = new MultiplayerRoomServiceClient({
      baseUrl,
      fetcher: vi.fn<typeof fetch>(async (_input, init) =>
        init?.method === "GET"
          ? Response.json({
              accountPartyMemberships: true,
              authenticatedAdmission: true,
              membershipOnlyReacquisition: true,
              mutationPathSegment: "v6",
              participantCapabilities: true,
              protocolVersion: 6,
              socialPresenceLeases: true,
            })
          : Response.json(payload),
      ),
    });

    await expect(client.applyAccountCommand(command)).resolves.toEqual({
      code: "room-service-invalid-response",
      error: "Room service returned 200 with an invalid account result.",
      success: false,
    });
  });

  it("accepts a host role only when reacquiring that existing account participant", async () => {
    const client = new MultiplayerRoomServiceClient({
      baseUrl: "http://service.local/_internal/multiplayer/rooms",
      fetcher: vi.fn<typeof fetch>(async (_input, init) =>
        init?.method === "GET"
          ? Response.json({
              accountPartyMemberships: true,
              authenticatedAdmission: true,
              membershipOnlyReacquisition: true,
              mutationPathSegment: "v6",
              participantCapabilities: true,
              protocolVersion: 6,
              socialPresenceLeases: true,
            })
          : Response.json({
              admission: "reacquired",
              outcome: "admission",
              participantCapability: "host-reacquired-capability",
              participantId: "host-1",
              snapshot: ROOM_SNAPSHOT,
              success: true,
            }),
      ),
    });

    await expect(
      client.applyAccountCommand({
        intent: "play",
        partyCode: "ROOM1",
        type: "party.admitAuthenticated",
        user: HOST_USER,
      }),
    ).resolves.toMatchObject({
      admission: "reacquired",
      participantId: "host-1",
      snapshot: { participant: { role: "host", userId: HOST_USER.id } },
      success: true,
    });
  });

  it("preserves account failures only at their contract HTTP status", async () => {
    const client = new MultiplayerRoomServiceClient({
      baseUrl: "http://service.local/_internal/multiplayer/rooms",
      fetcher: vi.fn<typeof fetch>(async (_input, init) =>
        init?.method === "GET"
          ? Response.json({
              accountPartyMemberships: true,
              authenticatedAdmission: true,
              membershipOnlyReacquisition: true,
              mutationPathSegment: "v6",
              participantCapabilities: true,
              protocolVersion: 6,
              socialPresenceLeases: true,
            })
          : Response.json(
              {
                code: "recipient-unavailable",
                error: "The recipient is not available.",
                success: false,
              },
              { status: 409 },
            ),
      ),
    });

    await expect(
      client.applyAccountCommand({
        intent: "play",
        partyCode: "ROOM1",
        type: "party.admitAuthenticated",
        user: GUEST_USER,
      }),
    ).resolves.toEqual({
      code: "recipient-unavailable",
      error: "The recipient is not available.",
      success: false,
    });
  });

  it.each([
    {
      name: "a success result returned with HTTP 500",
      payload: {
        availability: "available",
        changed: true,
        outcome: "presence",
        success: true,
      },
      status: 500,
    },
    {
      name: "a failure result returned with HTTP 200",
      payload: {
        code: "recipient-unavailable",
        error: "The recipient is not available.",
        success: false,
      },
      status: 200,
    },
    {
      name: "a domain failure returned with an infrastructure status",
      payload: {
        code: "recipient-unavailable",
        error: "The recipient is not available.",
        success: false,
      },
      status: 503,
    },
  ])("rejects $name from the account authority", async ({ payload, status }) => {
    const client = new MultiplayerRoomServiceClient({
      baseUrl: "http://service.local/_internal/multiplayer/rooms",
      fetcher: vi.fn<typeof fetch>(async (_input, init) =>
        init?.method === "GET"
          ? Response.json({
              accountPartyMemberships: true,
              authenticatedAdmission: true,
              membershipOnlyReacquisition: true,
              mutationPathSegment: "v6",
              participantCapabilities: true,
              protocolVersion: 6,
              socialPresenceLeases: true,
            })
          : Response.json(payload, { status }),
      ),
    });

    await expect(
      client.applyAccountCommand({
        clientId: "browser-client-0001",
        state: "available",
        type: "presence.renew",
        userId: GUEST_USER.id,
      }),
    ).resolves.toEqual({
      code: "room-service-invalid-response",
      error: `Room service returned ${status} with an invalid account result.`,
      success: false,
    });
  });

  it("maps store failures, invalid room codes, invalid responses, and fetch errors", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);

      if (url.endsWith("/_internal/multiplayer/rooms/MISSING")) {
        return Response.json(
          {
            code: "room-not-found",
            error: "Room was not found.",
            success: false,
          },
          { status: 404 },
        );
      }

      return new Response("bad gateway", { status: 502 });
    });
    const client = new MultiplayerRoomServiceClient({
      baseUrl: "http://service.local/_internal/multiplayer/rooms",
      fetcher,
    });

    await expect(client.getRoom("missing")).resolves.toEqual({
      code: "room-not-found",
      error: "Room was not found.",
      success: false,
    });
    await expect(client.getRoom("bad room")).resolves.toEqual({
      code: "invalid-room-code",
      error: "Room code is not supported.",
      success: false,
    });
    await expect(client.getRoom("broken")).resolves.toEqual({
      code: "room-service-invalid-response",
      error: "Room service returned 502 without a valid JSON room result.",
      success: false,
    });

    const failingClient = new MultiplayerRoomServiceClient({
      baseUrl: "http://service.local/_internal/multiplayer/rooms",
      fetcher: vi.fn<typeof fetch>(async () => {
        throw new Error("connect ECONNREFUSED");
      }),
    });

    await expect(
      failingClient.createRoom({
        host: HOST_USER,
      }),
    ).resolves.toEqual({
      code: "room-service-unavailable",
      error:
        "Room service protocol check failed for GET http://service.local/_internal/multiplayer/rooms: connect ECONNREFUSED",
      success: false,
    });
  });

  it("rejects malformed capability-bearing room service results", async () => {
    const client = new MultiplayerRoomServiceClient({
      baseUrl: "http://service.local/_internal/multiplayer/rooms",
      fetcher: vi.fn<typeof fetch>(async () =>
        Response.json({
          participantCapability: "host-capability",
          snapshot: {
            ...ROOM_SNAPSHOT,
            participant: undefined,
          },
          success: true,
        }),
      ),
    });

    await expect(client.getRoom("ROOM1")).resolves.toEqual({
      code: "room-service-invalid-response",
      error: "Room service returned 200 with an invalid room result.",
      success: false,
    });
  });

  it.each([
    {
      code: "room-expired" as const,
      error: "Room has expired. Create or join a new room.",
      operation: "get" as const,
      status: 410,
    },
    {
      code: "room-capacity-reached" as const,
      error: "Room capacity is currently full. Try creating a room again shortly.",
      operation: "create" as const,
      status: 503,
    },
  ])("preserves $code failures from the room authority", async (testCase) => {
    const client = new MultiplayerRoomServiceClient({
      baseUrl: "http://service.local/_internal/multiplayer/rooms",
      fetcher: vi.fn<typeof fetch>(async (input, init) => {
        if (
          String(input).endsWith("/_internal/multiplayer/rooms") &&
          init?.method === "GET"
        ) {
          return Response.json({
            accountPartyMemberships: true,
            authenticatedAdmission: true,
            membershipOnlyReacquisition: true,
            mutationPathSegment: "v6",
            participantCapabilities: true,
            protocolVersion: 6,
            socialPresenceLeases: true,
          });
        }

        return Response.json(
          {
            code: testCase.code,
            error: testCase.error,
            success: false,
          },
          { status: testCase.status },
        );
      }),
    });
    const result =
      testCase.operation === "get"
        ? await client.getRoom("ROOM1")
        : await client.createRoom({ host: HOST_USER });

    expect(result).toEqual({
      code: testCase.code,
      error: testCase.error,
      success: false,
    });
  });

  it.each([
    {
      name: "invalid room sequence",
      snapshot: {
        ...ROOM_SNAPSHOT,
        seq: -1,
      },
    },
    {
      name: "malformed room participants",
      snapshot: {
        ...ROOM_SNAPSHOT,
        room: {
          ...ROOM_SNAPSHOT.room,
          participants: "not-a-participant-list",
        },
      },
    },
    {
      name: "game snapshot for a different room game",
      snapshot: {
        ...ROOM_SNAPSHOT,
        game: {
          gameId: "asteroids",
          seq: 1,
          serverTimeMs: 1_000,
          snapshot: {},
        },
      },
    },
  ])("maps a successful service response with $name to an invalid response", async ({ snapshot }) => {
    const client = new MultiplayerRoomServiceClient({
      baseUrl: "http://service.local/_internal/multiplayer/rooms",
      fetcher: vi.fn<typeof fetch>(async () =>
        Response.json({
          snapshot,
          success: true,
        }),
      ),
    });

    await expect(client.getRoom("ROOM1")).resolves.toEqual({
      code: "room-service-invalid-response",
      error: "Room service returned 200 with an invalid room result.",
      success: false,
    });
  });

  it.each([
    {
      name: "a deeply nested invalid setting",
      value: createDeepSettingValue(undefined, 20_000),
    },
    {
      name: "a cyclic setting",
      value: createCyclicSettingValue(),
    },
  ])("maps a successful service response with $name to an invalid response", async ({ value }) => {
    const snapshot = {
      ...ROOM_SNAPSHOT,
      room: {
        ...ROOM_SNAPSHOT.room,
        settings: {
          gameId: "pong",
          parameters: {
            value,
          },
        },
      },
    };
    const client = new MultiplayerRoomServiceClient({
      baseUrl: "http://service.local/_internal/multiplayer/rooms",
      fetcher: vi.fn<typeof fetch>(async () =>
        ({
          json: async () => ({ snapshot, success: true }),
          status: 200,
        }) as Response,
      ),
    });

    await expect(client.getRoom("ROOM1")).resolves.toEqual({
      code: "room-service-invalid-response",
      error: "Room service returned 200 with an invalid room result.",
      success: false,
    });
  });
});

function createDeepSettingValue(leaf: unknown, depth: number) {
  let value = leaf;

  for (let index = 0; index < depth; index += 1) {
    value = { nested: value };
  }

  return value;
}

function createCyclicSettingValue() {
  const value: Record<string, unknown> = {};

  value.self = value;

  return value;
}
