import { describe, expect, it, vi } from "vitest";

import { createMultiplayerRoomRouteHandlers } from "./[code]/route-handlers";
import { createMultiplayerRoomsRouteHandlers } from "./route";

function dependencies() {
  return {
    roomStore: {
      createRoom: vi.fn(async () => ({
        success: false as const, code: "duplicate-room" as const, error: "Room exists.",
      })),
      getRoom: vi.fn(), applyCommand: vi.fn(),
    },
    userStore: { getUserBySessionToken: vi.fn(async () => ({ id: "user-1", displayName: "Host" })) },
  };
}

function request(body: string, headers?: HeadersInit) {
  return new Request("http://localhost/api/multiplayer/rooms/ROOM1/v6", {
    method: "POST", body, headers,
  });
}

const deepSettings = '{"gameId":"pong","parameters":{"future":' +
  "[".repeat(5_000) + "true" + "]".repeat(5_000) + "}}";

describe("multiplayer HTTP settings admission", () => {
  it("returns 400 for deeply nested creation instead of throwing", async () => {
    const { roomStore, userStore } = dependencies();
    const response = await createMultiplayerRoomsRouteHandlers(roomStore, userStore)
      .POST(request(deepSettings));
    expect(response.status).toBe(400);
    expect(roomStore.createRoom).not.toHaveBeenCalled();
  });

  it.each(["room.updateSettings", "room.replaceMatch"])(
    "rejects deeply nested %s before looking up or advancing the room",
    async (type) => {
      const { roomStore, userStore } = dependencies();
      const response = await createMultiplayerRoomRouteHandlers(roomStore, userStore)
        .POST(request(`{"type":"${type}","matchId":1,"settings":${deepSettings}}`), { code: "ROOM1" });
      expect(response.status).toBe(400);
      expect(roomStore.getRoom).not.toHaveBeenCalled();
      expect(roomStore.applyCommand).not.toHaveBeenCalled();
      expect(userStore.getUserBySessionToken).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, { "content-length": String(64 * 1024 + 1) }])(
    "returns 413 for oversized bodies with headers %j",
    async (headers) => {
      const { roomStore, userStore } = dependencies();
      const body = " ".repeat(64 * 1024) + "{}";
      const response = await createMultiplayerRoomsRouteHandlers(roomStore, userStore)
        .POST(request(body, headers));
      expect(response.status).toBe(413);
      expect(roomStore.createRoom).not.toHaveBeenCalled();
    },
  );
});

describe("multiplayer HTTP body budget", () => {
  it("accepts a body exactly at the limit before applying the normal room result", async () => {
    const { roomStore, userStore } = dependencies();
    const response = await createMultiplayerRoomsRouteHandlers(roomStore, userStore)
      .POST(request(" ".repeat(64 * 1024 - 2) + "{}"));
    expect(response.status).toBe(409);
    expect(roomStore.createRoom).toHaveBeenCalledOnce();
  });

  it("cancels an oversized streamed command body before room lookup", async () => {
    const { roomStore, userStore } = dependencies();
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(32 * 1024));
        controller.enqueue(new Uint8Array(32 * 1024 + 1));
      },
      cancel,
    });
    const streamedRequest = new Request("http://localhost/api/multiplayer/rooms/ROOM1/v6", {
      body, method: "POST", duplex: "half",
    } as RequestInit);
    const response = await createMultiplayerRoomRouteHandlers(roomStore, userStore)
      .POST(streamedRequest, { code: "ROOM1" });
    expect(response.status).toBe(413);
    expect(cancel).toHaveBeenCalledOnce();
    expect(roomStore.getRoom).not.toHaveBeenCalled();
    expect(roomStore.applyCommand).not.toHaveBeenCalled();
  });

  it("rejects a serialized UTF-8 settings budget violation below the total body cap", async () => {
    const { roomStore, userStore } = dependencies();
    const response = await createMultiplayerRoomsRouteHandlers(roomStore, userStore)
      .POST(request(JSON.stringify({ gameId: "pong", parameters: { future: "é".repeat(8_192) } })));
    expect(response.status).toBe(400);
    expect(roomStore.createRoom).not.toHaveBeenCalled();
  });
});
