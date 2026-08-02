import { describe, expect, it, vi } from "vitest";

import type { MultiplayerRoomSnapshot } from "@/lib/multiplayer/protocol";
import type { AuthenticatedUser } from "@/lib/user-profile";

import { MultiplayerRoomServiceClient } from "./multiplayer-room-service-client";

const HOST_USER = {
  displayName: "Ada Host",
  id: "user-1",
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
    participants: [
      {
        displayName: "Ada Host",
        id: "host-1",
        role: "host",
        userId: "user-1",
      },
    ],
    seats: [],
    settings: {
      gameId: "pong",
    },
    status: "lobby",
  },
  seq: 1,
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
      { method: "POST", url: `${baseUrl}/v2` },
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
          mutationPathSegment: "v2",
          participantCapabilities: true,
          protocolVersion: 2,
        });
      }

      if (
        url.endsWith("/_internal/multiplayer/rooms/v2") &&
        init?.method === "POST"
      ) {
        return Response.json(
          {
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
          snapshot: {
            ...ROOM_SNAPSHOT,
            seq: 2,
          },
          success: true,
        });
      }

      if (
        url.endsWith("/_internal/multiplayer/rooms/v2/ROOM1") &&
        init?.method === "POST"
      ) {
        return Response.json({
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
      participantCapability: "host-capability",
      snapshot: ROOM_SNAPSHOT,
      success: true,
    });
    await expect(client.getRoom("room1")).resolves.toEqual({
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
      snapshot: {
        ...ROOM_SNAPSHOT,
        seq: 3,
      },
      success: true,
    });

    expect(requests.map((request) => request.url)).toEqual([
      "http://service.local/_internal/multiplayer/rooms",
      "http://service.local/_internal/multiplayer/rooms/v2",
      "http://service.local/_internal/multiplayer/rooms/ROOM1",
      "http://service.local/_internal/multiplayer/rooms",
      "http://service.local/_internal/multiplayer/rooms/v2/ROOM1",
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
        "x-multiplayer-room-protocol-version": "2",
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
        "x-multiplayer-room-protocol-version": "2",
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
            mutationPathSegment: "v2",
            participantCapabilities: true,
            protocolVersion: 2,
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
