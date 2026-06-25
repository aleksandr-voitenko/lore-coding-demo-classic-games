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
  it("creates, reads, and commands rooms through the configured HTTP base", async () => {
    const requests: Array<{
      init: RequestInit | undefined;
      url: string;
    }> = [];
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      requests.push({ init, url });

      if (url.endsWith("/_internal/multiplayer/rooms") && init?.method === "POST") {
        return Response.json(
          {
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
        url.endsWith("/_internal/multiplayer/rooms/ROOM1") &&
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
      "http://service.local/_internal/multiplayer/rooms/ROOM1",
      "http://service.local/_internal/multiplayer/rooms/ROOM1",
    ]);
    expect(requests.map((request) => request.init?.method)).toEqual([
      "POST",
      "GET",
      "POST",
    ]);
    expect(requests.map((request) => request.init?.headers)).toEqual([
      {
        accept: "application/json",
        authorization: "Bearer service-secret",
        "content-type": "application/json",
      },
      {
        accept: "application/json",
        authorization: "Bearer service-secret",
      },
      {
        accept: "application/json",
        authorization: "Bearer service-secret",
        "content-type": "application/json",
      },
    ]);
    expect(getRequestBody(requests[0]?.init)).toEqual({
      host: HOST_USER,
      settings: {
        gameId: "pong",
      },
    });
    expect(getRequestBody(requests[2]?.init)).toEqual({
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
        "Room service request failed for POST http://service.local/_internal/multiplayer/rooms: connect ECONNREFUSED",
      success: false,
    });
  });
});
