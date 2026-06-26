import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocket, type RawData } from "ws";

import type { MultiplayerRoomStoreResult } from "./multiplayer-room-runtime";

import {
  DEFAULT_MULTIPLAYER_SIDECAR_HOST,
  DEFAULT_MULTIPLAYER_SIDECAR_PORT,
  DEFAULT_MULTIPLAYER_SIDECAR_ROOM_SERVICE_PATH,
  DEFAULT_MULTIPLAYER_SIDECAR_SNAPSHOT_INTERVAL_MS,
  DEFAULT_MULTIPLAYER_SIDECAR_WEBSOCKET_PATH,
  MULTIPLAYER_SIDECAR_HEALTH_PATH,
  createMultiplayerRoomSidecar,
  parseMultiplayerRoomSidecarConfig,
  type MultiplayerRoomSidecar,
} from "./multiplayer-room-sidecar";

const cleanupCallbacks: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  const callbacks = cleanupCallbacks.splice(0).reverse();

  await Promise.all(callbacks.map((callback) => Promise.resolve().then(callback)));
});

function createTestConfig(
  overrides: Partial<ReturnType<typeof parseMultiplayerRoomSidecarConfig>> = {},
) {
  return {
    healthPath: MULTIPLAYER_SIDECAR_HEALTH_PATH,
    host: "127.0.0.1",
    port: 0,
    roomServicePath: "/_internal/rooms",
    snapshotIntervalMs: DEFAULT_MULTIPLAYER_SIDECAR_SNAPSHOT_INTERVAL_MS,
    websocketPath: "/rooms",
    ...overrides,
  };
}

function getOrigin(sidecar: MultiplayerRoomSidecar) {
  const address = sidecar.server.address();

  if (address === null || typeof address === "string") {
    throw new Error("Expected the sidecar test server to listen on a TCP port.");
  }

  return `http://127.0.0.1:${(address as AddressInfo).port}`;
}

async function createStartedSidecar(
  config = createTestConfig(),
): Promise<MultiplayerRoomSidecar> {
  const sidecar = createMultiplayerRoomSidecar(config);

  cleanupCallbacks.push(() => sidecar.close());
  await sidecar.start();

  return sidecar;
}

async function connectClient(url: string) {
  const client = new WebSocket(url);

  cleanupCallbacks.push(() => {
    if (
      client.readyState === WebSocket.CONNECTING ||
      client.readyState === WebSocket.OPEN
    ) {
      client.terminate();
    }
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for the WebSocket client to open."));
    }, 1_000);
    const handleOpen = () => {
      cleanup();
      resolve();
    };
    const handleError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timeout);
      client.off("open", handleOpen);
      client.off("error", handleError);
    };

    client.once("open", handleOpen);
    client.once("error", handleError);
  });

  return client;
}

function waitForServerMessage(
  client: WebSocket,
  predicate: (message: Record<string, unknown>) => boolean = () => true,
) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for a matching WebSocket message."));
    }, 1_000);
    const handleMessage = (data: RawData) => {
      const parsedMessage = JSON.parse(rawDataToText(data)) as unknown;

      if (!isRecord(parsedMessage) || !predicate(parsedMessage)) {
        return;
      }

      cleanup();
      resolve(parsedMessage);
    };
    const handleError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timeout);
      client.off("message", handleMessage);
      client.off("error", handleError);
    };

    client.on("message", handleMessage);
    client.once("error", handleError);
  });
}

function rawDataToText(data: RawData) {
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString("utf8");
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString("utf8");
  }

  return Buffer.from(data).toString("utf8");
}

function sendClientMessage(client: WebSocket, message: unknown) {
  client.send(JSON.stringify(message));
}

async function readStoreResult(response: Response) {
  return (await response.json()) as MultiplayerRoomStoreResult;
}

function expectStoreSuccess(result: MultiplayerRoomStoreResult) {
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.snapshot;
}

function hasSeatOccupantSnapshot(
  message: Record<string, unknown>,
  seatId: string,
  participantId: string,
) {
  if (message.type !== "room.snapshot" || !isRecord(message.snapshot)) {
    return false;
  }

  const { room } = message.snapshot;

  if (!isRecord(room) || !Array.isArray(room.seats)) {
    return false;
  }

  return room.seats.some(
    (seat) =>
      isRecord(seat) &&
      seat.id === seatId &&
      seat.occupiedByParticipantId === participantId,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

describe("multiplayer room sidecar", () => {
  it("parses safe defaults and environment overrides", () => {
    expect(parseMultiplayerRoomSidecarConfig({})).toEqual({
      healthPath: MULTIPLAYER_SIDECAR_HEALTH_PATH,
      host: DEFAULT_MULTIPLAYER_SIDECAR_HOST,
      port: DEFAULT_MULTIPLAYER_SIDECAR_PORT,
      roomServicePath: DEFAULT_MULTIPLAYER_SIDECAR_ROOM_SERVICE_PATH,
      snapshotIntervalMs: DEFAULT_MULTIPLAYER_SIDECAR_SNAPSHOT_INTERVAL_MS,
      websocketPath: DEFAULT_MULTIPLAYER_SIDECAR_WEBSOCKET_PATH,
    });

    expect(
      parseMultiplayerRoomSidecarConfig({
        MULTIPLAYER_SIDECAR_HOST: " 0.0.0.0 ",
        MULTIPLAYER_SIDECAR_PORT: "3002",
        MULTIPLAYER_SIDECAR_ROOM_SERVICE_PATH: " /_sidecar/rooms ",
        MULTIPLAYER_SIDECAR_SNAPSHOT_INTERVAL_MS: "33",
        MULTIPLAYER_SIDECAR_WEBSOCKET_PATH: " /ws/rooms ",
        MULTIPLAYER_SIDECAR_ROOM_SERVICE_BEARER_TOKEN: " service-secret ",
      }),
    ).toEqual({
      healthPath: MULTIPLAYER_SIDECAR_HEALTH_PATH,
      host: "0.0.0.0",
      port: 3002,
      roomServiceBearerToken: "service-secret",
      roomServicePath: "/_sidecar/rooms",
      snapshotIntervalMs: 33,
      websocketPath: "/ws/rooms",
    });
  });

  it("rejects invalid sidecar port and path configuration", () => {
    expect(() =>
      parseMultiplayerRoomSidecarConfig({
        MULTIPLAYER_SIDECAR_PORT: "not-a-port",
      }),
    ).toThrow("MULTIPLAYER_SIDECAR_PORT must be an integer");

    expect(() =>
      parseMultiplayerRoomSidecarConfig({
        MULTIPLAYER_SIDECAR_WEBSOCKET_PATH: "rooms",
      }),
    ).toThrow('MULTIPLAYER_SIDECAR_WEBSOCKET_PATH must start with "/"');

    expect(() =>
      parseMultiplayerRoomSidecarConfig({
        MULTIPLAYER_SIDECAR_WEBSOCKET_PATH: "/rooms?debug=true",
      }),
    ).toThrow("MULTIPLAYER_SIDECAR_WEBSOCKET_PATH must be a URL path");

    expect(() =>
      parseMultiplayerRoomSidecarConfig({
        MULTIPLAYER_SIDECAR_ROOM_SERVICE_PATH: "rooms",
      }),
    ).toThrow('MULTIPLAYER_SIDECAR_ROOM_SERVICE_PATH must start with "/"');

    expect(() =>
      parseMultiplayerRoomSidecarConfig({
        MULTIPLAYER_SIDECAR_SNAPSHOT_INTERVAL_MS: "0",
      }),
    ).toThrow("MULTIPLAYER_SIDECAR_SNAPSHOT_INTERVAL_MS must be a positive integer");
  });

  it("serves health JSON and closes the HTTP server", async () => {
    const sidecar = await createStartedSidecar();
    const origin = getOrigin(sidecar);

    const healthResponse = await fetch(`${origin}/healthz`);

    expect(healthResponse.status).toBe(200);
    await expect(healthResponse.json()).resolves.toEqual({
      service: "multiplayer-room-sidecar",
      status: "ok",
      websocketPath: "/rooms",
    });

    const missingResponse = await fetch(`${origin}/missing`);

    expect(missingResponse.status).toBe(404);
    await expect(missingResponse.json()).resolves.toEqual({
      error: "Not found.",
    });

    expect(sidecar.server.listening).toBe(true);
    await sidecar.close();
    expect(sidecar.server.listening).toBe(false);
  });

  it("attaches the room WebSocket gateway to the configured path", async () => {
    const sidecar = await createStartedSidecar();
    const origin = getOrigin(sidecar);
    const client = await connectClient(origin.replace("http://", "ws://") + "/rooms");

    expect(client.readyState).toBe(WebSocket.OPEN);
  });

  it("shares HTTP room endpoints with the WebSocket gateway store", async () => {
    const sidecar = await createStartedSidecar();
    const origin = getOrigin(sidecar);
    const publicPathCreateResponse = await fetch(`${origin}/rooms`, {
      body: JSON.stringify({
        host: {
          displayName: "Ada Host",
          id: "user-1",
        },
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });
    const serviceBaseUrl = `${origin}/_internal/rooms`;
    const createResponse = await fetch(serviceBaseUrl, {
      body: JSON.stringify({
        host: {
          displayName: "Ada Host",
          id: "user-1",
        },
        settings: {
          gameId: "pong",
        },
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    expect(publicPathCreateResponse.status).toBe(404);
    await expect(publicPathCreateResponse.json()).resolves.toEqual({
      error: "Not found.",
    });
    expect(createResponse.status).toBe(201);

    const createdSnapshot = expectStoreSuccess(
      await readStoreResult(createResponse),
    );
    const { code: roomCode, hostParticipantId } = createdSnapshot.room;
    const client = await connectClient(
      origin.replace("http://", "ws://") + "/rooms",
    );
    const bootstrapPromise = waitForServerMessage(
      client,
      (message) => message.type === "connection.bootstrap",
    );

    sendClientMessage(client, {
      requestId: "hello-1",
      roomCode,
      type: "connection.hello",
    });

    await expect(bootstrapPromise).resolves.toMatchObject({
      requestId: "hello-1",
      roomCode,
      snapshot: {
        room: {
          code: roomCode,
          hostParticipantId,
        },
        seq: 1,
      },
      type: "connection.bootstrap",
    });

    const joinAckPromise = waitForServerMessage(
      client,
      (message) =>
        message.type === "room.commandAck" && message.requestId === "join-1",
    );

    sendClientMessage(client, {
      command: {
        displayName: "Guest Hero",
        type: "room.joinObserver",
      },
      requestId: "join-1",
      roomCode,
      type: "room.command",
    });

    const joinAck = await joinAckPromise;
    const guestParticipantId = joinAck.participantId;

    if (typeof guestParticipantId !== "string") {
      throw new Error("Expected the join ack to include a participant id.");
    }

    const httpCommandBroadcastPromise = waitForServerMessage(
      client,
      (message) => hasSeatOccupantSnapshot(message, "left", guestParticipantId),
    );

    const afterWebSocketCommandResponse = await fetch(
      `${serviceBaseUrl}/${roomCode}`,
    );

    expect(afterWebSocketCommandResponse.status).toBe(200);
    const afterWebSocketCommandSnapshot = expectStoreSuccess(
      await readStoreResult(afterWebSocketCommandResponse),
    );

    expect(afterWebSocketCommandSnapshot.room.participants).toEqual([
      expect.objectContaining({ id: hostParticipantId, role: "host" }),
      expect.objectContaining({
        displayName: "Guest Hero",
        id: guestParticipantId,
        role: "observer",
      }),
    ]);

    const httpCommandResponse = await fetch(`${serviceBaseUrl}/${roomCode}`, {
      body: JSON.stringify({
        participantId: guestParticipantId,
        seatId: "left",
        type: "room.claimSeat",
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    expect(httpCommandResponse.status).toBe(200);

    const afterHttpCommandSnapshot = expectStoreSuccess(
      await readStoreResult(httpCommandResponse),
    );
    const httpCommandBroadcast = await httpCommandBroadcastPromise;

    expect(afterHttpCommandSnapshot.room.seats).toEqual([
      expect.objectContaining({
        id: "left",
        occupiedByParticipantId: guestParticipantId,
      }),
      expect.objectContaining({
        id: "right",
        occupiedByParticipantId: null,
      }),
    ]);
    expect(httpCommandBroadcast).toMatchObject({
      roomCode,
      snapshot: {
        room: {
          seats: [
            expect.objectContaining({
              id: "left",
              occupiedByParticipantId: guestParticipantId,
            }),
            expect.objectContaining({
              id: "right",
              occupiedByParticipantId: null,
            }),
          ],
        },
        seq: afterHttpCommandSnapshot.seq,
      },
      type: "room.snapshot",
    });

    const observer = await connectClient(
      origin.replace("http://", "ws://") + "/rooms",
    );
    const observerBootstrapPromise = waitForServerMessage(
      observer,
      (message) => message.type === "connection.bootstrap",
    );

    sendClientMessage(observer, {
      requestId: "hello-2",
      roomCode,
      type: "connection.hello",
    });

    await expect(observerBootstrapPromise).resolves.toMatchObject({
      requestId: "hello-2",
      roomCode,
      snapshot: {
        room: {
          seats: [
            expect.objectContaining({
              id: "left",
              occupiedByParticipantId: guestParticipantId,
            }),
            expect.objectContaining({
              id: "right",
              occupiedByParticipantId: null,
            }),
          ],
        },
        seq: afterHttpCommandSnapshot.seq,
      },
      type: "connection.bootstrap",
    });
  });

  it("protects room service endpoints when a bearer token is configured", async () => {
    const sidecar = await createStartedSidecar(
      createTestConfig({
        roomServiceBearerToken: "service-secret",
      }),
    );
    const origin = getOrigin(sidecar);
    const unauthorizedResponse = await fetch(`${origin}/_internal/rooms`, {
      body: "{}",
      method: "POST",
    });
    const authorizedResponse = await fetch(`${origin}/_internal/rooms`, {
      body: JSON.stringify({
        host: {
          displayName: "Ada Host",
          id: "user-1",
        },
      }),
      headers: {
        authorization: "Bearer service-secret",
        "content-type": "application/json",
      },
      method: "POST",
    });

    expect(unauthorizedResponse.status).toBe(401);
    await expect(unauthorizedResponse.json()).resolves.toEqual({
      error: "Unauthorized.",
    });
    expect(authorizedResponse.status).toBe(201);
    expectStoreSuccess(await readStoreResult(authorizedResponse));
  });

  it("imports without resolving the Next server-only marker", async () => {
    vi.resetModules();
    vi.doMock("server-only", () => {
      throw new Error("The sidecar entrypoint must not import server-only.");
    });

    try {
      const { createMultiplayerRoomSidecar: createSidecar } = await import(
        "./multiplayer-room-sidecar"
      );
      const sidecar = createSidecar(createTestConfig());

      cleanupCallbacks.push(() => sidecar.close());

      expect(sidecar.gateway.webSocketServer.options.path).toBe("/rooms");
    } finally {
      vi.doUnmock("server-only");
    }
  });
});
