import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocket, type RawData } from "ws";

import {
  MULTIPLAYER_ROOM_PROTOCOL_VERSION,
  type MultiplayerRealtimeServerMessage,
} from "@/lib/multiplayer/protocol";
import { getAsteroidsTickDelay } from "@/lib/asteroids-game-engine";
import type { AsteroidsMultiplayerGameSnapshot } from "@/lib/asteroids-multiplayer";
import type { PongGameState } from "@/lib/pong-game-engine";
import type { PongMultiplayerGameSnapshot } from "@/lib/pong-multiplayer";
import { getSpaceInvadersTickDelay } from "@/lib/space-invaders-game-engine";
import type { AuthenticatedUser } from "@/lib/user-profile";

import type { SpaceInvadersMultiplayerServerGameSnapshot } from "./multiplayer-game-adapters";
import {
  InProcessMultiplayerRoomStore,
  shouldAdvanceRoomGameSnapshot,
  type MultiplayerRoomParticipantConnectionStore,
  type MultiplayerRoomSnapshot,
  type MultiplayerRoomStore,
  type MultiplayerRoomStoreResult,
} from "./multiplayer-room-runtime";
import { createMultiplayerRoomWebSocketGateway } from "./multiplayer-room-websocket";

const HOST_USER = {
  displayName: "Ada Host",
  id: "user-1",
} satisfies AuthenticatedUser;

const HOST_ONLY_WEBSOCKET_COMMAND_ERROR =
  "Host-only room commands require the authenticated HTTP room route.";
const EXPECTED_DEFAULT_MAX_PAYLOAD_BYTES = 64 * 1024;

const cleanupCallbacks: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  const callbacks = cleanupCallbacks.splice(0).reverse();

  await Promise.all(callbacks.map((callback) => Promise.resolve().then(callback)));
});

function createTestRoomStore({
  getNowMs,
  maxRooms,
  participantCapabilities = [
    "host-capability",
    "guest-capability",
    "guest-two-capability",
    "observer-capability",
  ],
  participantIds = ["host-1", "guest-1", "guest-2", "observer-1"],
  retentionPolicy,
  roomCodes = ["ROOM1"],
}: {
  getNowMs?: () => number;
  maxRooms?: number;
  participantCapabilities?: string[];
  participantIds?: string[];
  retentionPolicy?: {
    inProgressIdleTtlMs?: number;
    lobbyIdleTtlMs?: number;
    sweepIntervalMs?: number;
    terminalTtlMs?: number;
    tombstoneTtlMs?: number;
  };
  roomCodes?: string[];
} = {}) {
  let participantCapabilityIndex = 0;
  let participantIdIndex = 0;
  let roomCodeIndex = 0;
  const capabilityOptions = {
    createParticipantCapability: () =>
      participantCapabilities[participantCapabilityIndex++] ??
      `participant-capability-${participantCapabilityIndex}`,
  };

  return new InProcessMultiplayerRoomStore({
    ...capabilityOptions,
    createParticipantId: ({ role }) =>
      participantIds[participantIdIndex++] ?? `${role}-${participantIdIndex}`,
    createRoomCode: () => roomCodes[roomCodeIndex++] ?? "ROOM-FALLBACK",
    getNowMs,
    maxRooms,
    retentionPolicy,
  });
}

function expectStoreSuccess(result: MultiplayerRoomStoreResult) {
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.snapshot;
}

function expectPongGame(snapshot: MultiplayerRoomSnapshot) {
  expect(snapshot.game?.gameId).toBe("pong");

  return snapshot.game as PongMultiplayerGameSnapshot;
}

function expectAsteroidsGame(snapshot: MultiplayerRoomSnapshot) {
  expect(snapshot.game?.gameId).toBe("asteroids");

  return snapshot.game as AsteroidsMultiplayerGameSnapshot;
}

function expectSpaceInvadersGame(snapshot: MultiplayerRoomSnapshot) {
  expect(snapshot.game?.gameId).toBe("space-invaders");

  return snapshot.game as SpaceInvadersMultiplayerServerGameSnapshot;
}

function createLobbyRoom(store: InProcessMultiplayerRoomStore) {
  return expectStoreSuccess(store.createRoom({ host: HOST_USER }));
}

function createPongSnapshotWithStatus(
  snapshot: MultiplayerRoomSnapshot,
  status: PongGameState["status"],
): MultiplayerRoomSnapshot {
  if (snapshot.game === undefined) {
    throw new Error("Expected a Pong game snapshot.");
  }
  const pongGame = expectPongGame(snapshot);

  return {
    ...snapshot,
    game: {
      ...pongGame,
      snapshot: {
        ...pongGame.snapshot,
        status,
      },
    },
  };
}

function createStartedPongRoom(store: InProcessMultiplayerRoomStore) {
  createLobbyRoom(store);
  expectStoreSuccess(
    store.applyCommand("ROOM1", {
      displayName: "Guest Hero",
      type: "room.joinObserver",
    }),
  );
  expectStoreSuccess(
    store.applyCommand("ROOM1", {
      participantId: "host-1",
      seatId: "left",
      matchId: 1,
      type: "room.claimSeat",
    }),
  );
  expectStoreSuccess(
    store.applyCommand("ROOM1", {
      participantId: "guest-1",
      seatId: "right",
      matchId: 1,
      type: "room.claimSeat",
    }),
  );

  return expectStoreSuccess(
    store.applyCommand("ROOM1", {
      command: "start",
      participantId: "host-1",
      matchId: 1,
      type: "room.lifecycle",
    }),
  );
}

function createStartedSpaceInvadersRoom(store: InProcessMultiplayerRoomStore) {
  expectStoreSuccess(
    store.createRoom({
      host: HOST_USER,
      settings: { gameId: "space-invaders" },
    }),
  );
  expectStoreSuccess(
    store.applyCommand("ROOM1", {
      displayName: "Guest Hero",
      type: "room.joinObserver",
    }),
  );
  expectStoreSuccess(
    store.applyCommand("ROOM1", {
      participantId: "host-1",
      seatId: "ship-a",
      matchId: 1,
      type: "room.claimSeat",
    }),
  );
  expectStoreSuccess(
    store.applyCommand("ROOM1", {
      participantId: "guest-1",
      seatId: "ship-b",
      matchId: 1,
      type: "room.claimSeat",
    }),
  );

  return expectStoreSuccess(
    store.applyCommand("ROOM1", {
      command: "start",
      participantId: "host-1",
      matchId: 1,
      type: "room.lifecycle",
    }),
  );
}

function createStartedAsteroidsRoom(store: InProcessMultiplayerRoomStore) {
  expectStoreSuccess(
    store.createRoom({
      host: HOST_USER,
      settings: { gameId: "asteroids" },
    }),
  );
  expectStoreSuccess(
    store.applyCommand("ROOM1", {
      displayName: "Guest Hero",
      type: "room.joinObserver",
    }),
  );
  expectStoreSuccess(
    store.applyCommand("ROOM1", {
      participantId: "host-1",
      seatId: "ship-a",
      matchId: 1,
      type: "room.claimSeat",
    }),
  );
  expectStoreSuccess(
    store.applyCommand("ROOM1", {
      participantId: "guest-1",
      seatId: "ship-b",
      matchId: 1,
      type: "room.claimSeat",
    }),
  );

  return expectStoreSuccess(
    store.applyCommand("ROOM1", {
      command: "start",
      participantId: "host-1",
      matchId: 1,
      type: "room.lifecycle",
    }),
  );
}

function serveStartedPongRoom(store: InProcessMultiplayerRoomStore) {
  const snapshot = expectStoreSuccess(store.getRoom("ROOM1"));
  const serveSide = expectPongGame(snapshot).snapshot.serveSide;

  return expectStoreSuccess(
    store.applyCommand("ROOM1", {
      input: {
        type: "pong.serve",
      },
      participantId: serveSide === "left" ? "host-1" : "guest-1",
      matchId: 1,
      type: "game.input",
    }),
  );
}

async function createGatewayFixture(
  store: MultiplayerRoomStore = createTestRoomStore(),
  gatewayOptions: {
    maxPayload?: number;
    snapshotIntervalMs?: number;
  } = {},
) {
  const httpServer = createServer();
  const gateway = createMultiplayerRoomWebSocketGateway({
    ...gatewayOptions,
    path: "/rooms",
    server: httpServer,
    store,
  });

  cleanupCallbacks.push(async () => {
    await gateway.close();
    await closeHttpServer(httpServer);
  });

  await listenOnEphemeralPort(httpServer);

  const address = httpServer.address();

  if (address === null || typeof address === "string") {
    throw new Error("Expected the test HTTP server to listen on a TCP port.");
  }

  return {
    gateway,
    store,
    url: `ws://127.0.0.1:${(address as AddressInfo).port}/rooms`,
  };
}

function listenOnEphemeralPort(httpServer: HttpServer) {
  return new Promise<void>((resolve, reject) => {
    const handleError = (error: Error) => {
      httpServer.off("listening", handleListening);
      reject(error);
    };
    const handleListening = () => {
      httpServer.off("error", handleError);
      resolve();
    };

    httpServer.once("error", handleError);
    httpServer.once("listening", handleListening);
    httpServer.listen(0, "127.0.0.1");
  });
}

function closeHttpServer(httpServer: HttpServer) {
  if (!httpServer.listening) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    httpServer.close((error) => {
      if (error === undefined) {
        resolve();
      } else {
        reject(error);
      }
    });
  });
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
  predicate: (message: MultiplayerRealtimeServerMessage) => boolean = () => true,
) {
  return new Promise<MultiplayerRealtimeServerMessage>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for a matching WebSocket message."));
    }, 1_000);
    const handleMessage = (data: RawData) => {
      const parsedMessage = JSON.parse(rawDataToText(data)) as unknown;

      if (!isServerMessage(parsedMessage) || !predicate(parsedMessage)) {
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

function waitForClientClose(client: WebSocket) {
  return new Promise<{ code: number; reason: string }>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for the WebSocket client to close."));
    }, 1_000);
    const handleClose = (code: number, reason: Buffer) => {
      cleanup();
      resolve({ code, reason: reason.toString("utf8") });
    };
    const handleError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timeout);
      client.off("close", handleClose);
      client.off("error", handleError);
    };

    client.once("close", handleClose);
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

function isServerMessage(value: unknown): value is MultiplayerRealtimeServerMessage {
  return typeof value === "object" && value !== null && "type" in value;
}

function sendClientMessage(client: WebSocket, message: unknown) {
  const messageRecord =
    typeof message === "object" && message !== null
      ? (message as Record<string, unknown>)
      : null;
  const versionedMessage =
    messageRecord !== null &&
    (messageRecord.type === "connection.hello" ||
      messageRecord.type === "connection.resume")
      ? {
          protocolVersion: MULTIPLAYER_ROOM_PROTOCOL_VERSION,
          ...messageRecord,
        }
      : message;

  client.send(JSON.stringify(versionedMessage));
}

async function bootstrapClient(
  client: WebSocket,
  roomCode = "ROOM1",
  participantId?: string,
) {
  const bootstrapPromise = waitForServerMessage(
    client,
    (message) => message.type === "connection.bootstrap",
  );

  sendClientMessage(client, {
    ...(participantId === undefined
      ? {}
      : {
          participantCapability: getTestParticipantCapability(participantId),
          participantId,
        }),
    requestId: `hello-${roomCode}`,
    roomCode,
    type: "connection.hello",
  });

  const bootstrap = await bootstrapPromise;

  expect(bootstrap.type).toBe("connection.bootstrap");

  if (bootstrap.type !== "connection.bootstrap") {
    throw new Error("Expected a connection bootstrap message.");
  }

  return bootstrap;
}

function getTestParticipantCapability(participantId: string) {
  if (participantId === "host-1") {
    return "host-capability";
  }

  if (participantId === "guest-1") {
    return "guest-capability";
  }

  if (participantId === "host-2") {
    return "guest-two-capability";
  }

  throw new Error(`No test capability is configured for ${participantId}.`);
}

describe("multiplayer room WebSocket gateway", () => {
  it.each([
    ["missing", undefined],
    ["mismatched", 1],
  ])("rejects a %s bootstrap protocol before reading room state", async (_name, protocolVersion) => {
    const store = createTestRoomStore();
    const getRoomSpy = vi.spyOn(store, "getRoom");
    const fixture = await createGatewayFixture(store);
    const client = await connectClient(fixture.url);
    const rejectionPromise = waitForServerMessage(
      client,
      (message) =>
        message.type === "room.commandRejected" &&
        message.requestId === `protocol-${protocolVersion ?? "missing"}`,
    );

    client.send(
      JSON.stringify({
        ...(protocolVersion === undefined ? {} : { protocolVersion }),
        requestId: `protocol-${protocolVersion ?? "missing"}`,
        roomCode: "ROOM1",
        type: "connection.hello",
      }),
    );

    await expect(rejectionPromise).resolves.toEqual({
      code: "protocol-version-mismatch",
      error: "Room stream protocol version is not supported. Refresh the page.",
      requestId: `protocol-${protocolVersion ?? "missing"}`,
      roomCode: "ROOM1",
      type: "room.commandRejected",
    });
    expect(getRoomSpy).not.toHaveBeenCalled();
  });

  it("normalizes snapshot pump intervals at gateway setup", async () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const gateways: Array<
      ReturnType<typeof createMultiplayerRoomWebSocketGateway>
    > = [];

    try {
      for (const snapshotIntervalMs of [1, 16, 33.4]) {
        gateways.push(
          createMultiplayerRoomWebSocketGateway({
            noServer: true,
            snapshotIntervalMs,
            store: createTestRoomStore(),
          }),
        );
      }

      gateways.push(
        createMultiplayerRoomWebSocketGateway({
          noServer: true,
          store: createTestRoomStore(),
        }),
      );

      expect(setIntervalSpy.mock.calls.map((call) => call[1])).toEqual([
        16,
        16,
        33,
        33,
      ]);

      setIntervalSpy.mockClear();

      for (const snapshotIntervalMs of [
        0,
        -10,
        Number.POSITIVE_INFINITY,
        Number.NaN,
      ]) {
        gateways.push(
          createMultiplayerRoomWebSocketGateway({
            noServer: true,
            snapshotIntervalMs,
            store: createTestRoomStore(),
          }),
        );
      }

      expect(setIntervalSpy).not.toHaveBeenCalled();
    } finally {
      setIntervalSpy.mockRestore();
      await Promise.all(gateways.map((gateway) => gateway.close()));
    }
  });

  it("uses the server game adapter to decide which room snapshots keep pumping", () => {
    const store = createTestRoomStore();
    const readySnapshot = createStartedPongRoom(store);
    const runningSnapshot = serveStartedPongRoom(store);
    const asteroidsRunningSnapshot = createStartedAsteroidsRoom(createTestRoomStore());
    const pausedSnapshot = createPongSnapshotWithStatus(readySnapshot, "paused");
    const wonSnapshot = createPongSnapshotWithStatus(readySnapshot, "won");
    const lostSnapshot = createPongSnapshotWithStatus(readySnapshot, "lost");
    const finishedSnapshot = {
      ...readySnapshot,
      room: {
        ...readySnapshot.room,
        status: "finished" as const,
      },
    } satisfies MultiplayerRoomSnapshot;
    const missingGameSnapshot = {
      ...readySnapshot,
      game: undefined,
    } satisfies MultiplayerRoomSnapshot;
    const unsupportedGameSnapshot = {
      ...readySnapshot,
      game: {
        gameId: "snake",
        seq: 1,
        serverTimeMs: 1_000,
        snapshot: {
          status: "running",
        },
      },
      room: {
        ...readySnapshot.room,
        settings: {
          gameId: "snake",
        },
      },
    } as unknown as MultiplayerRoomSnapshot;

    expect(shouldAdvanceRoomGameSnapshot(readySnapshot)).toBe(true);
    expect(shouldAdvanceRoomGameSnapshot(runningSnapshot)).toBe(true);
    expect(shouldAdvanceRoomGameSnapshot(asteroidsRunningSnapshot)).toBe(true);
    expect(shouldAdvanceRoomGameSnapshot(pausedSnapshot)).toBe(false);
    expect(shouldAdvanceRoomGameSnapshot(wonSnapshot)).toBe(false);
    expect(shouldAdvanceRoomGameSnapshot(lostSnapshot)).toBe(false);
    expect(shouldAdvanceRoomGameSnapshot(finishedSnapshot)).toBe(false);
    expect(shouldAdvanceRoomGameSnapshot(missingGameSnapshot)).toBe(false);
    expect(shouldAdvanceRoomGameSnapshot(unsupportedGameSnapshot)).toBe(false);
  });

  it("bootstraps existing room snapshots without joining the socket", async () => {
    const store = createTestRoomStore();
    createLobbyRoom(store);
    const { url } = await createGatewayFixture(store);
    const client = await connectClient(url);
    const bootstrap = await bootstrapClient(client, "room1");

    expect(bootstrap).toMatchObject({
      requestId: "hello-room1",
      roomCode: "ROOM1",
      snapshot: {
        room: {
          code: "ROOM1",
          participants: [
            {
              id: "host-1",
              role: "host",
            },
          ],
        },
        seq: 1,
      },
    });
    expect(bootstrap.snapshot).not.toHaveProperty("participant");
  });

  it("does not treat a public participant id as a resume capability", async () => {
    const store = createTestRoomStore();
    createLobbyRoom(store);
    const { url } = await createGatewayFixture(store);
    const client = await connectClient(url);
    const responsePromise = waitForServerMessage(
      client,
      (message) =>
        "requestId" in message && message.requestId === "resume-with-public-id",
    );

    sendClientMessage(client, {
      participantId: "host-1",
      requestId: "resume-with-public-id",
      roomCode: "ROOM1",
      type: "connection.resume",
    });

    await expect(responsePromise).resolves.toMatchObject({
      requestId: "resume-with-public-id",
      roomCode: "ROOM1",
      type: "room.commandRejected",
    });
  });

  it("binds a resumed socket only through its opaque participant capability", async () => {
    const store = createTestRoomStore();
    createLobbyRoom(store);
    const { url } = await createGatewayFixture(store);
    const client = await connectClient(url);
    const bootstrapPromise = waitForServerMessage(
      client,
      (message) =>
        message.type === "connection.bootstrap" &&
        message.requestId === "resume-with-capability",
    );

    sendClientMessage(client, {
      participantCapability: "host-capability",
      requestId: "resume-with-capability",
      roomCode: "ROOM1",
      type: "connection.resume",
    });

    const bootstrap = await bootstrapPromise;

    expect(bootstrap).toMatchObject({
      requestId: "resume-with-capability",
      roomCode: "ROOM1",
      snapshot: {
        participant: {
          id: "host-1",
          role: "host",
          userId: "user-1",
        },
      },
      type: "connection.bootstrap",
    });
    expect(bootstrap).not.toHaveProperty("participantCapability");

    if (bootstrap.type !== "connection.bootstrap") {
      throw new Error("Expected a connection bootstrap message.");
    }

    expect(bootstrap.snapshot).not.toHaveProperty("participantCapability");
  });

  it("echoes diagnostics pings with server timing data", async () => {
    const store = createTestRoomStore();
    createLobbyRoom(store);
    const { url } = await createGatewayFixture(store);
    const client = await connectClient(url);

    await bootstrapClient(client);

    const pongPromise = waitForServerMessage(
      client,
      (message) => message.type === "connection.pong",
    );

    sendClientMessage(client, {
      clientTimeMs: 1_000,
      requestId: "diagnostics-1",
      roomCode: "ROOM1",
      type: "connection.ping",
    });

    const pong = await pongPromise;

    expect(pong).toMatchObject({
      clientTimeMs: 1_000,
      requestId: "diagnostics-1",
      roomCode: "ROOM1",
      type: "connection.pong",
    });
    expect(pong.type === "connection.pong" ? pong.serverTimeMs : null).toEqual(
      expect.any(Number),
    );
  });

  it("rejects bootstrap when the volatile room is no longer in memory", async () => {
    const { url } = await createGatewayFixture();
    const client = await connectClient(url);
    const rejectionPromise = waitForServerMessage(
      client,
      (message) =>
        message.type === "room.commandRejected" &&
        message.requestId === "resume-missing",
    );

    sendClientMessage(client, {
      lastSeq: {
        game: 4,
        room: 3,
      },
      participantId: "guest-1",
      requestId: "resume-missing",
      roomCode: "ROOM1",
      type: "connection.resume",
    });

    await expect(rejectionPromise).resolves.toEqual({
      code: "room-not-found",
      error: "Room was not found.",
      requestId: "resume-missing",
      roomCode: "ROOM1",
      type: "room.commandRejected",
    });
  });

  it("rejects bootstrap with a specific code while an expired-room tombstone remains", async () => {
    let nowMs = 0;
    const store = createTestRoomStore({
      getNowMs: () => nowMs,
      retentionPolicy: {
        lobbyIdleTtlMs: 1_000,
        sweepIntervalMs: 100,
      },
    });

    createLobbyRoom(store);
    nowMs = 1_000;
    const { url } = await createGatewayFixture(store);
    const client = await connectClient(url);
    const rejectionPromise = waitForServerMessage(
      client,
      (message) =>
        message.type === "room.commandRejected" &&
        message.requestId === "resume-expired",
    );

    sendClientMessage(client, {
      participantId: "host-1",
      requestId: "resume-expired",
      roomCode: "ROOM1",
      type: "connection.resume",
    });

    await expect(rejectionPromise).resolves.toEqual({
      code: "room-expired",
      error: "Room has expired. Create or join a new room.",
      requestId: "resume-expired",
      roomCode: "ROOM1",
      type: "room.commandRejected",
    });
  });

  it("rejects a recognized bootstrap when registration crosses the expiry boundary", async () => {
    let nowMs = 0;
    const store = createTestRoomStore({
      getNowMs: () => nowMs,
      retentionPolicy: {
        lobbyIdleTtlMs: 1_000,
        sweepIntervalMs: 100,
      },
    });

    createLobbyRoom(store);
    nowMs = 999;
    const registerParticipantConnection = store.registerParticipantConnection.bind(
      store,
    );

    vi.spyOn(store, "registerParticipantConnection").mockImplementation(
      (roomCode, participantId) => {
        nowMs = 1_000;
        return registerParticipantConnection(roomCode, participantId);
      },
    );

    const { url } = await createGatewayFixture(store);
    const client = await connectClient(url);
    const rejectionPromise = waitForServerMessage(
      client,
      (message) =>
        message.type === "room.commandRejected" &&
        message.requestId === "boundary-bootstrap",
    );

    sendClientMessage(client, {
      participantCapability: "host-capability",
      participantId: "host-1",
      requestId: "boundary-bootstrap",
      roomCode: "ROOM1",
      type: "connection.resume",
    });

    await expect(rejectionPromise).resolves.toEqual({
      code: "room-expired",
      error: "Room has expired. Create or join a new room.",
      requestId: "boundary-bootstrap",
      roomCode: "ROOM1",
      type: "room.commandRejected",
    });
  });

  it("does not retain room cursors after unique subscriber churn", async () => {
    const roomCodes = Array.from(
      { length: 12 },
      (_, index) => `ROOM${index + 1}`,
    );
    const participantIds = roomCodes.map((_, index) => `host-${index + 1}`);
    const store = createTestRoomStore({
      maxRooms: roomCodes.length,
      participantIds,
      roomCodes,
    });

    for (const roomCode of roomCodes) {
      createLobbyRoom(store);
      expect(store.getRoom(roomCode).success).toBe(true);
    }

    const { gateway, url } = await createGatewayFixture(store);

    for (const roomCode of roomCodes) {
      const client = await connectClient(url);

      await bootstrapClient(client, roomCode);
      const closePromise = waitForClientClose(client);

      client.close();
      await closePromise;
    }

    await vi.waitFor(() => {
      expect(gateway.getTrackedRoomCounts()).toEqual({
        activeSnapshotRooms: 0,
        broadcastCursors: 0,
        subscribedRooms: 0,
      });
    });
  });

  it("does not retain snapshot tracking when broadcasting without subscribers", async () => {
    const store = createTestRoomStore();
    createStartedPongRoom(store);
    const snapshot = serveStartedPongRoom(store);
    const { gateway } = await createGatewayFixture(store);

    gateway.broadcastSnapshot(snapshot);

    expect(gateway.getTrackedRoomCounts()).toEqual({
      activeSnapshotRooms: 0,
      broadcastCursors: 0,
      subscribedRooms: 0,
    });
  });

  it("protects only recognized participant sockets and starts grace after disconnect", async () => {
    let nowMs = 0;
    const store = createTestRoomStore({
      getNowMs: () => nowMs,
      retentionPolicy: {
        lobbyIdleTtlMs: 1_000,
        sweepIntervalMs: 100,
      },
    });

    createLobbyRoom(store);
    const unregisterParticipantConnection = vi.spyOn(
      store,
      "unregisterParticipantConnection",
    );
    const { url } = await createGatewayFixture(store);
    const client = await connectClient(url);

    await bootstrapClient(client, "ROOM1", "host-1");
    nowMs = 10_000;
    expectStoreSuccess(store.getRoom("ROOM1"));

    const closePromise = waitForClientClose(client);

    client.close();
    await closePromise;
    await vi.waitFor(() => {
      expect(unregisterParticipantConnection).toHaveBeenCalledWith(
        "ROOM1",
        "host-1",
      );
    });
    nowMs += 999;
    expectStoreSuccess(store.getRoom("ROOM1"));
    nowMs += 1;
    await vi.waitFor(() => {
      expect(store.getRoom("ROOM1")).toMatchObject({
        code: "room-expired",
        success: false,
      });
    });
  });

  it("does not let anonymous bootstrap protect an inactive room", async () => {
    let nowMs = 0;
    const store = createTestRoomStore({
      getNowMs: () => nowMs,
      retentionPolicy: {
        lobbyIdleTtlMs: 1_000,
        sweepIntervalMs: 100,
      },
    });

    createLobbyRoom(store);
    const { url } = await createGatewayFixture(store);
    const client = await connectClient(url);

    await bootstrapClient(client);
    nowMs = 1_000;
    expect(store.getRoom("ROOM1")).toMatchObject({
      code: "room-expired",
      success: false,
    });
  });

  it("promotes a joined socket to protected presence and releases it on room change", async () => {
    let nowMs = 0;
    const store = createTestRoomStore({
      getNowMs: () => nowMs,
      participantIds: ["host-1", "guest-1", "host-2"],
      retentionPolicy: {
        lobbyIdleTtlMs: 1_000,
        sweepIntervalMs: 100,
      },
      roomCodes: ["ROOM1", "ROOM2"],
    });

    createLobbyRoom(store);
    const { url } = await createGatewayFixture(store);
    const client = await connectClient(url);

    await bootstrapClient(client, "ROOM1");
    const ackPromise = waitForServerMessage(
      client,
      (message) =>
        message.type === "room.commandAck" && message.requestId === "join-retention",
    );

    sendClientMessage(client, {
      command: {
        displayName: "Grace Guest",
        type: "room.joinObserver",
      },
      requestId: "join-retention",
      roomCode: "ROOM1",
      type: "room.command",
    });
    await ackPromise;
    nowMs = 10_000;
    expectStoreSuccess(store.getRoom("ROOM1"));

    createLobbyRoom(store);
    await bootstrapClient(client, "ROOM2", "host-2");
    nowMs += 1_000;
    expect(store.getRoom("ROOM1")).toMatchObject({
      code: "room-expired",
      success: false,
    });
    expectStoreSuccess(store.getRoom("ROOM2"));
  });

  it("rejects seat commands from an unbound socket even when it submits a public participant id", async () => {
    const store = createTestRoomStore();
    createLobbyRoom(store);
    const { url } = await createGatewayFixture(store);
    const client = await connectClient(url);

    await bootstrapClient(client);

    const responsePromise = waitForServerMessage(
      client,
      (message) =>
        "requestId" in message && message.requestId === "spoof-host-seat",
    );

    sendClientMessage(client, {
      command: {
        participantId: "host-1",
        seatId: "left",
        matchId: 1,
        type: "room.claimSeat",
      },
      requestId: "spoof-host-seat",
      roomCode: "ROOM1",
      type: "room.command",
    });

    await expect(responsePromise).resolves.toMatchObject({
      requestId: "spoof-host-seat",
      roomCode: "ROOM1",
      type: "room.commandRejected",
    });
    expect(expectStoreSuccess(store.getRoom("ROOM1")).room.seats[0]).toMatchObject({
      id: "left",
      occupiedByParticipantId: "host-1",
    });
  });

  it("rejects gameplay input from an unbound socket even when it submits a seated participant id", async () => {
    const store = createTestRoomStore();
    createStartedPongRoom(store);
    const { url } = await createGatewayFixture(store);
    const client = await connectClient(url);

    await bootstrapClient(client);

    const responsePromise = waitForServerMessage(
      client,
      (message) =>
        "requestId" in message && message.requestId === "spoof-host-input",
    );

    sendClientMessage(client, {
      gameId: "pong",
      input: {
        direction: "up",
        type: "pong.setPaddleDirection",
      },
      participantId: "host-1",
      requestId: "spoof-host-input",
      roomCode: "ROOM1",
      matchId: 1,
      type: "game.input",
    });

    await expect(responsePromise).resolves.toMatchObject({
      requestId: "spoof-host-input",
      roomCode: "ROOM1",
      type: "room.commandRejected",
    });
    expect(expectPongGame(expectStoreSuccess(store.getRoom("ROOM1"))).heldInputs).toEqual(
      {},
    );
  });

  it("rejects a participant id that does not match the capability-bound socket", async () => {
    const store = createTestRoomStore();
    createStartedPongRoom(store);
    const { url } = await createGatewayFixture(store);
    const client = await connectClient(url);
    const bootstrapPromise = waitForServerMessage(
      client,
      (message) =>
        message.type === "connection.bootstrap" &&
        message.requestId === "resume-host-for-mismatch",
    );

    sendClientMessage(client, {
      participantCapability: "host-capability",
      requestId: "resume-host-for-mismatch",
      roomCode: "ROOM1",
      type: "connection.resume",
    });
    await bootstrapPromise;

    const responsePromise = waitForServerMessage(
      client,
      (message) =>
        "requestId" in message && message.requestId === "spoof-guest-input",
    );

    sendClientMessage(client, {
      gameId: "pong",
      input: {
        direction: "up",
        type: "pong.setPaddleDirection",
      },
      participantId: "guest-1",
      requestId: "spoof-guest-input",
      roomCode: "ROOM1",
      matchId: 1,
      type: "game.input",
    });

    await expect(responsePromise).resolves.toMatchObject({
      requestId: "spoof-guest-input",
      roomCode: "ROOM1",
      type: "room.commandRejected",
    });
    expect(expectPongGame(expectStoreSuccess(store.getRoom("ROOM1"))).heldInputs).toEqual(
      {},
    );
  });

  it("keeps public observer joins guest-only and returns their capability only in the private ack", async () => {
    const store = createTestRoomStore();
    createLobbyRoom(store);
    const { url } = await createGatewayFixture(store);
    const sender = await connectClient(url);
    const observer = await connectClient(url);

    await bootstrapClient(sender);
    await bootstrapClient(observer);

    const ackPromise = waitForServerMessage(
      sender,
      (message) =>
        message.type === "room.commandAck" &&
        message.requestId === "join-with-forged-user",
    );
    const observerSnapshotPromise = waitForServerMessage(
      observer,
      (message) => message.type === "room.snapshot" && message.snapshot.seq === 2,
    );

    sendClientMessage(sender, {
      command: {
        displayName: "Grace Guest",
        type: "room.joinObserver",
        userId: "user-1",
      },
      requestId: "join-with-forged-user",
      roomCode: "ROOM1",
      type: "room.command",
    });

    const [ack, observerSnapshot] = await Promise.all([
      ackPromise,
      observerSnapshotPromise,
    ]);

    expect(observerSnapshot.type).toBe("room.snapshot");

    if (observerSnapshot.type !== "room.snapshot") {
      throw new Error("Expected an observer room snapshot.");
    }

    expect(observerSnapshot).not.toHaveProperty("participantCapability");
    expect(observerSnapshot.snapshot).not.toHaveProperty(
      "participantCapability",
    );
    expect(observerSnapshot.snapshot.room.participants).toContainEqual({
      displayName: "Grace Guest",
      id: "guest-1",
      role: "observer",
      userId: null,
    });
    expect(ack).toMatchObject({
      participantCapability: "guest-capability",
      participantId: "guest-1",
      requestId: "join-with-forged-user",
      roomCode: "ROOM1",
      type: "room.commandAck",
    });
  });

  it("atomically seats a public player join and returns its capability privately", async () => {
    const store = createTestRoomStore();
    createLobbyRoom(store);
    const { url } = await createGatewayFixture(store);
    const sender = await connectClient(url);
    const observer = await connectClient(url);

    await bootstrapClient(sender);
    await bootstrapClient(observer);

    const ackPromise = waitForServerMessage(
      sender,
      (message) =>
        message.type === "room.commandAck" &&
        message.requestId === "join-as-player",
    );
    const snapshotPromise = waitForServerMessage(
      observer,
      (message) => message.type === "room.snapshot" && message.snapshot.seq === 2,
    );

    sendClientMessage(sender, {
      command: {
        displayName: "Grace Player",
        type: "room.joinPlayer",
      },
      requestId: "join-as-player",
      roomCode: "ROOM1",
      type: "room.command",
    });

    await expect(ackPromise).resolves.toMatchObject({
      participantCapability: "guest-capability",
      participantId: "guest-1",
      requestId: "join-as-player",
      roomCode: "ROOM1",
      type: "room.commandAck",
    });
    await expect(snapshotPromise).resolves.toMatchObject({
      snapshot: {
        room: {
          participants: expect.arrayContaining([
            expect.objectContaining({ id: "guest-1", role: "player" }),
          ]),
          seats: [
            expect.objectContaining({ occupiedByParticipantId: "host-1" }),
            expect.objectContaining({ occupiedByParticipantId: "guest-1" }),
          ],
        },
      },
      type: "room.snapshot",
    });
  });

  it("acks room commands and broadcasts authoritative snapshots", async () => {
    const store = createTestRoomStore();
    createLobbyRoom(store);
    const { url } = await createGatewayFixture(store);
    const sender = await connectClient(url);
    const observer = await connectClient(url);

    await bootstrapClient(sender);
    await bootstrapClient(observer);

    const ackPromise = waitForServerMessage(
      sender,
      (message) =>
        message.type === "room.commandAck" && message.requestId === "join-1",
    );
    const senderSnapshotPromise = waitForServerMessage(
      sender,
      (message) => message.type === "room.snapshot" && message.snapshot.seq === 2,
    );
    const observerSnapshotPromise = waitForServerMessage(
      observer,
      (message) => message.type === "room.snapshot" && message.snapshot.seq === 2,
    );

    sendClientMessage(sender, {
      command: {
        displayName: "Guest Hero",
        type: "room.joinObserver",
      },
      requestId: "join-1",
      roomCode: "ROOM1",
      type: "room.command",
    });

    const ack = await ackPromise;
    const snapshots = await Promise.all([
      senderSnapshotPromise,
      observerSnapshotPromise,
    ]);

    expect(ack).toMatchObject({
      participantId: "guest-1",
      requestId: "join-1",
      roomCode: "ROOM1",
      seq: 2,
      type: "room.commandAck",
    });

    for (const snapshotMessage of snapshots) {
      expect(snapshotMessage.type).toBe("room.snapshot");

      if (snapshotMessage.type !== "room.snapshot") {
        throw new Error("Expected a room snapshot message.");
      }

      expect(snapshotMessage.snapshot).not.toHaveProperty("participant");
      expect(snapshotMessage.snapshot.room.participants).toEqual([
        expect.objectContaining({ id: "host-1", role: "host" }),
        expect.objectContaining({ id: "guest-1", role: "observer" }),
      ]);
    }

    const rejectionPromise = waitForServerMessage(
      sender,
      (message) =>
        message.type === "room.commandRejected" &&
        message.requestId === "guest-start",
    );

    sendClientMessage(sender, {
      command: {
        command: "start",
        participantId: "guest-1",
        matchId: 1,
        type: "room.lifecycle",
      },
      requestId: "guest-start",
      roomCode: "ROOM1",
      type: "room.command",
    });

    await expect(rejectionPromise).resolves.toEqual({
      code: "not-host",
      error: HOST_ONLY_WEBSOCKET_COMMAND_ERROR,
      requestId: "guest-start",
      roomCode: "ROOM1",
      type: "room.commandRejected",
    });
  });

  it("broadcasts an accepted delayed command after its sender disconnects", async () => {
    const backingStore = createTestRoomStore();
    createLobbyRoom(backingStore);
    const registerParticipantConnection = vi.fn(
      backingStore.registerParticipantConnection.bind(backingStore),
    );
    let settleCommand: (() => void) | undefined;
    const store = {
      applyCommand: (roomCode, command) =>
        new Promise<MultiplayerRoomStoreResult>((resolve) => {
          settleCommand = () => {
            resolve(backingStore.applyCommand(roomCode, command));
          };
        }),
      createRoom: backingStore.createRoom.bind(backingStore),
      getRoom: backingStore.getRoom.bind(backingStore),
      resolveParticipantCapability:
        backingStore.resolveParticipantCapability.bind(backingStore),
      registerParticipantConnection,
      unregisterParticipantConnection:
        backingStore.unregisterParticipantConnection.bind(backingStore),
    } satisfies MultiplayerRoomStore & MultiplayerRoomParticipantConnectionStore;
    const { gateway, url } = await createGatewayFixture(store);
    const sender = await connectClient(url);
    const observer = await connectClient(url);

    await bootstrapClient(sender);
    await bootstrapClient(observer);
    const observerSnapshotPromise = waitForServerMessage(
      observer,
      (message) => message.type === "room.snapshot" && message.snapshot.seq === 2,
    );

    sendClientMessage(sender, {
      command: {
        displayName: "Delayed Guest",
        type: "room.joinObserver",
      },
      requestId: "delayed-join",
      roomCode: "ROOM1",
      type: "room.command",
    });
    await vi.waitFor(() => {
      expect(settleCommand).toBeTypeOf("function");
    });
    const closePromise = waitForClientClose(sender);

    sender.close();
    await closePromise;
    settleCommand?.();

    await expect(observerSnapshotPromise).resolves.toMatchObject({
      roomCode: "ROOM1",
      snapshot: {
        room: {
          participants: expect.arrayContaining([
            expect.objectContaining({
              displayName: "Delayed Guest",
              id: "guest-1",
            }),
          ]),
        },
        seq: 2,
      },
      type: "room.snapshot",
    });
    expect(registerParticipantConnection).not.toHaveBeenCalledWith(
      "ROOM1",
      "guest-1",
    );
    expect(gateway.webSocketServer.clients.size).toBe(1);
    expect(gateway.getTrackedRoomCounts()).toMatchObject({
      subscribedRooms: 1,
    });
  });

  it("rejects public lifecycle commands before they reach the room store", async () => {
    const store = createTestRoomStore();
    createStartedPongRoom(store);
    const applyCommand = vi.spyOn(store, "applyCommand");
    const { url } = await createGatewayFixture(store);
    const client = await connectClient(url);

    await bootstrapClient(client);

    const responsePromise = waitForServerMessage(
      client,
      (message) => "requestId" in message && message.requestId === "host-pause",
    );

    sendClientMessage(client, {
      command: {
        command: "pause",
        participantId: "host-1",
        matchId: 1,
        type: "room.lifecycle",
      },
      requestId: "host-pause",
      roomCode: "ROOM1",
      type: "room.command",
    });

    await expect(responsePromise).resolves.toEqual({
      code: "not-host",
      error: HOST_ONLY_WEBSOCKET_COMMAND_ERROR,
      requestId: "host-pause",
      roomCode: "ROOM1",
      type: "room.commandRejected",
    });
    expect(applyCommand).not.toHaveBeenCalled();
  });

  it("rejects public settings commands before they reach the room store", async () => {
    const store = createTestRoomStore();
    createLobbyRoom(store);
    const applyCommand = vi.spyOn(store, "applyCommand");
    const { url } = await createGatewayFixture(store);
    const client = await connectClient(url);

    await bootstrapClient(client);

    const responsePromise = waitForServerMessage(
      client,
      (message) =>
        "requestId" in message && message.requestId === "host-settings",
    );

    sendClientMessage(client, {
      command: {
        participantId: "host-1",
        settings: {
          gameId: "pong",
          parameters: {
            targetScore: 7,
          },
        },
        matchId: 1,
        type: "room.updateSettings",
      },
      requestId: "host-settings",
      roomCode: "ROOM1",
      type: "room.command",
    });

    await expect(responsePromise).resolves.toEqual({
      code: "not-host",
      error: HOST_ONLY_WEBSOCKET_COMMAND_ERROR,
      requestId: "host-settings",
      roomCode: "ROOM1",
      type: "room.commandRejected",
    });
    expect(applyCommand).not.toHaveBeenCalled();
  });

  it("rejects public match replacement before it reaches the room store", async () => {
    const store = createTestRoomStore();
    createLobbyRoom(store);
    const applyCommand = vi.spyOn(store, "applyCommand");
    const { url } = await createGatewayFixture(store);
    const client = await connectClient(url);

    await bootstrapClient(client);

    const responsePromise = waitForServerMessage(
      client,
      (message) =>
        "requestId" in message && message.requestId === "host-replace-match",
    );

    sendClientMessage(client, {
      command: {
        participantId: "host-1",
        settings: {
          gameId: "asteroids",
        },
        matchId: 1,
        type: "room.replaceMatch",
      },
      requestId: "host-replace-match",
      roomCode: "ROOM1",
      type: "room.command",
    });

    await expect(responsePromise).resolves.toEqual({
      code: "not-host",
      error: HOST_ONLY_WEBSOCKET_COMMAND_ERROR,
      requestId: "host-replace-match",
      roomCode: "ROOM1",
      type: "room.commandRejected",
    });
    expect(applyCommand).not.toHaveBeenCalled();
  });

  it("acks game input and broadcasts updated Pong snapshots", async () => {
    const store = createTestRoomStore();
    const started = createStartedPongRoom(store);
    const { url } = await createGatewayFixture(store);
    const sender = await connectClient(url);
    const observer = await connectClient(url);

    await bootstrapClient(sender, "ROOM1", "host-1");
    await bootstrapClient(observer);

    const expectedGameSeq = started.game!.seq + 1;
    const ackPromise = waitForServerMessage(
      sender,
      (message) =>
        message.type === "room.commandAck" && message.requestId === "input-1",
    );
    const senderSnapshotPromise = waitForServerMessage(
      sender,
      (message) =>
        message.type === "room.snapshot" &&
        message.snapshot.game?.seq === expectedGameSeq,
    );
    const observerSnapshotPromise = waitForServerMessage(
      observer,
      (message) =>
        message.type === "room.snapshot" &&
        message.snapshot.game?.seq === expectedGameSeq,
    );

    sendClientMessage(sender, {
      gameId: "pong",
      input: {
        direction: "up",
        type: "pong.setPaddleDirection",
      },
      participantId: "host-1",
      requestId: "input-1",
      roomCode: "ROOM1",
      matchId: 1,
      type: "game.input",
    });

    const ack = await ackPromise;
    const snapshots = await Promise.all([
      senderSnapshotPromise,
      observerSnapshotPromise,
    ]);

    expect(ack).toMatchObject({
      gameSeq: expectedGameSeq,
      participantId: "host-1",
      requestId: "input-1",
      roomCode: "ROOM1",
      seq: started.seq,
      type: "room.commandAck",
    });

    for (const snapshotMessage of snapshots) {
      expect(snapshotMessage.type).toBe("room.snapshot");

      if (snapshotMessage.type !== "room.snapshot") {
        throw new Error("Expected a room snapshot message.");
      }

      expect(snapshotMessage.snapshot).not.toHaveProperty("participant");
      expect(snapshotMessage.snapshot).toMatchObject({
        game: {
          gameId: "pong",
          heldInputs: {
            left: {
              up: true,
            },
          },
          seq: expectedGameSeq,
          snapshot: {
            status: "ready",
          },
        },
        room: {
          code: "ROOM1",
        },
        seq: started.seq,
      });
    }
  });

  it("rejects stale Pong input without acknowledging or broadcasting it", async () => {
    const store = createTestRoomStore();

    createStartedPongRoom(store);
    const restarted = expectStoreSuccess(
      store.applyCommand("ROOM1", {
        command: "restart",
        matchId: 1,
        participantId: "host-1",
        type: "room.lifecycle",
      }),
    );
    const { url } = await createGatewayFixture(store, {
      snapshotIntervalMs: 0,
    });
    const sender = await connectClient(url);

    await bootstrapClient(sender, "ROOM1", "host-1");

    const receivedMessages: MultiplayerRealtimeServerMessage[] = [];
    const recordMessage = (data: RawData) => {
      const message = JSON.parse(rawDataToText(data)) as unknown;

      if (isServerMessage(message)) {
        receivedMessages.push(message);
      }
    };
    const rejectionPromise = waitForServerMessage(
      sender,
      (message) =>
        message.type === "room.commandRejected" &&
        message.requestId === "stale-input",
    );

    sender.on("message", recordMessage);
    sendClientMessage(sender, {
      gameId: "pong",
      input: {
        direction: "up",
        type: "pong.setPaddleDirection",
      },
      matchId: 1,
      participantId: "host-1",
      requestId: "stale-input",
      roomCode: "ROOM1",
      type: "game.input",
    });

    await expect(rejectionPromise).resolves.toMatchObject({
      code: "stale-match",
      requestId: "stale-input",
      roomCode: "ROOM1",
      type: "room.commandRejected",
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    sender.off("message", recordMessage);

    expect(receivedMessages).toEqual([
      expect.objectContaining({
        code: "stale-match",
        requestId: "stale-input",
        type: "room.commandRejected",
      }),
    ]);

    const unchanged = expectStoreSuccess(store.getRoom("ROOM1"));

    expect(unchanged.seq).toBe(restarted.seq);
    expect(unchanged.room.matchId).toBe(2);
    expect(expectPongGame(unchanged)).toMatchObject({
      heldInputs: {},
      matchId: 2,
      seq: 1,
    });
  });

  it("acks game input and broadcasts updated Space Invaders snapshots", async () => {
    const store = createTestRoomStore();
    const started = createStartedSpaceInvadersRoom(store);
    const { url } = await createGatewayFixture(store);
    const sender = await connectClient(url);
    const observer = await connectClient(url);

    await bootstrapClient(sender, "ROOM1", "guest-1");
    await bootstrapClient(observer);

    const expectedGameSeq = started.game!.seq + 1;
    const ackPromise = waitForServerMessage(
      sender,
      (message) =>
        message.type === "room.commandAck" &&
        message.requestId === "space-input-1",
    );
    const senderSnapshotPromise = waitForServerMessage(
      sender,
      (message) =>
        message.type === "room.snapshot" &&
        message.snapshot.game?.gameId === "space-invaders" &&
        message.snapshot.game.seq === expectedGameSeq,
    );
    const observerSnapshotPromise = waitForServerMessage(
      observer,
      (message) =>
        message.type === "room.snapshot" &&
        message.snapshot.game?.gameId === "space-invaders" &&
        message.snapshot.game.seq === expectedGameSeq,
    );

    sendClientMessage(sender, {
      gameId: "space-invaders",
      input: {
        direction: "left",
        type: "space-invaders.setShipDirection",
      },
      participantId: "guest-1",
      requestId: "space-input-1",
      roomCode: "ROOM1",
      matchId: 1,
      type: "game.input",
    });

    const ack = await ackPromise;
    const snapshots = await Promise.all([
      senderSnapshotPromise,
      observerSnapshotPromise,
    ]);

    expect(ack).toMatchObject({
      gameSeq: expectedGameSeq,
      participantId: "guest-1",
      requestId: "space-input-1",
      roomCode: "ROOM1",
      seq: started.seq,
      type: "room.commandAck",
    });

    for (const snapshotMessage of snapshots) {
      expect(snapshotMessage.type).toBe("room.snapshot");

      if (snapshotMessage.type !== "room.snapshot") {
        throw new Error("Expected a room snapshot message.");
      }

      expect(snapshotMessage.snapshot).not.toHaveProperty("participant");
      expect(snapshotMessage.snapshot).toMatchObject({
        game: {
          gameId: "space-invaders",
          heldInputs: {
            "ship-b": {
              left: true,
            },
          },
          seq: expectedGameSeq,
          snapshot: {
            status: "running",
          },
        },
        room: {
          code: "ROOM1",
          settings: {
            gameId: "space-invaders",
          },
        },
        seq: started.seq,
      });
    }
  });

  it("acks game input and broadcasts updated Asteroids snapshots", async () => {
    const store = createTestRoomStore();
    const started = createStartedAsteroidsRoom(store);
    const { url } = await createGatewayFixture(store);
    const sender = await connectClient(url);
    const observer = await connectClient(url);

    await bootstrapClient(sender, "ROOM1", "guest-1");
    await bootstrapClient(observer);

    const expectedGameSeq = started.game!.seq + 1;
    const ackPromise = waitForServerMessage(
      sender,
      (message) =>
        message.type === "room.commandAck" &&
        message.requestId === "asteroids-input-1",
    );
    const senderSnapshotPromise = waitForServerMessage(
      sender,
      (message) =>
        message.type === "room.snapshot" &&
        message.snapshot.game?.gameId === "asteroids" &&
        message.snapshot.game.seq === expectedGameSeq,
    );
    const observerSnapshotPromise = waitForServerMessage(
      observer,
      (message) =>
        message.type === "room.snapshot" &&
        message.snapshot.game?.gameId === "asteroids" &&
        message.snapshot.game.seq === expectedGameSeq,
    );

    sendClientMessage(sender, {
      gameId: "asteroids",
      input: {
        controls: {
          rotateLeft: true,
          rotateRight: false,
          thrust: true,
        },
        type: "asteroids.setShipControls",
      },
      participantId: "guest-1",
      requestId: "asteroids-input-1",
      roomCode: "ROOM1",
      matchId: 1,
      type: "game.input",
    });

    const ack = await ackPromise;
    const snapshots = await Promise.all([
      senderSnapshotPromise,
      observerSnapshotPromise,
    ]);

    expect(ack).toMatchObject({
      gameSeq: expectedGameSeq,
      participantId: "guest-1",
      requestId: "asteroids-input-1",
      roomCode: "ROOM1",
      seq: started.seq,
      type: "room.commandAck",
    });

    for (const snapshotMessage of snapshots) {
      expect(snapshotMessage.type).toBe("room.snapshot");

      if (snapshotMessage.type !== "room.snapshot") {
        throw new Error("Expected a room snapshot message.");
      }

      expect(snapshotMessage.snapshot).not.toHaveProperty("participant");
      expect(snapshotMessage.snapshot).toMatchObject({
        game: {
          gameId: "asteroids",
          heldInputs: {
            "ship-b": {
              rotateLeft: true,
              thrust: true,
            },
          },
          seq: expectedGameSeq,
          snapshot: {
            status: "running",
          },
        },
        room: {
          code: "ROOM1",
          settings: {
            gameId: "asteroids",
          },
        },
        seq: started.seq,
      });
    }
  });

  it("pushes fresh running Pong snapshots without waiting for client input", async () => {
    let nowMs = 0;
    const store = createTestRoomStore({ getNowMs: () => nowMs });
    createStartedPongRoom(store);
    const started = serveStartedPongRoom(store);
    const { url } = await createGatewayFixture(store, { snapshotIntervalMs: 10 });
    const observer = await connectClient(url);

    await bootstrapClient(observer);

    const runningSnapshotPromise = waitForServerMessage(
      observer,
      (message) =>
        message.type === "room.snapshot" &&
        (message.snapshot.game?.seq ?? 0) > (started.game?.seq ?? 0),
    );

    nowMs += 80;

    const runningSnapshot = await runningSnapshotPromise;

    expect(runningSnapshot.type).toBe("room.snapshot");

    if (runningSnapshot.type !== "room.snapshot") {
      throw new Error("Expected a room snapshot message.");
    }

    const gameSnapshot = runningSnapshot.snapshot.game?.snapshot as
      | PongGameState
      | undefined;

    const startedPongGame = expectPongGame(started).snapshot;

    expect(gameSnapshot?.ball.position.x).not.toBe(startedPongGame.ball.position.x);
  });

  it("stops pumping and rejects subscribers after an anonymous active room expires", async () => {
    let nowMs = 0;
    const store = createTestRoomStore({
      getNowMs: () => nowMs,
      retentionPolicy: {
        inProgressIdleTtlMs: 1_000,
        sweepIntervalMs: 100,
      },
    });
    createStartedPongRoom(store);
    const getRoom = vi.spyOn(store, "getRoom");
    const { gateway, url } = await createGatewayFixture(store, {
      snapshotIntervalMs: 16,
    });
    const client = await connectClient(url);

    await bootstrapClient(client);
    nowMs = 1_000;
    const rejectionPromise = waitForServerMessage(
      client,
      (message) =>
        message.type === "room.commandRejected" &&
        message.code === "room-expired",
    );

    await expect(rejectionPromise).resolves.toMatchObject({
      code: "room-expired",
      error: "Room has expired. Create or join a new room.",
      roomCode: "ROOM1",
      type: "room.commandRejected",
    });
    await vi.waitFor(() => {
      expect(gateway.getTrackedRoomCounts()).toEqual({
        activeSnapshotRooms: 0,
        broadcastCursors: 0,
        subscribedRooms: 0,
      });
    });
    const lookupCountAfterExpiry = getRoom.mock.calls.length;

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(getRoom).toHaveBeenCalledTimes(lookupCountAfterExpiry);
  });

  it("keeps pumping after a transient room-service lookup failure", async () => {
    let nowMs = 0;
    const backingStore = createTestRoomStore({ getNowMs: () => nowMs });
    createStartedPongRoom(backingStore);
    const started = serveStartedPongRoom(backingStore);
    let failNextLookup = false;
    let transientFailureCount = 0;
    const getRoom = vi.fn((roomCode: unknown): MultiplayerRoomStoreResult => {
      if (failNextLookup) {
        failNextLookup = false;
        transientFailureCount += 1;
        return {
          code: "room-service-unavailable",
          error: "Room service is temporarily unavailable.",
          success: false,
        };
      }

      return backingStore.getRoom(roomCode);
    });
    const store = {
      applyCommand: backingStore.applyCommand.bind(backingStore),
      createRoom: backingStore.createRoom.bind(backingStore),
      getRoom,
    } satisfies MultiplayerRoomStore;
    const { gateway, url } = await createGatewayFixture(store, {
      snapshotIntervalMs: 16,
    });
    const observer = await connectClient(url);

    await bootstrapClient(observer);
    failNextLookup = true;
    nowMs = 80;
    const freshSnapshotPromise = waitForServerMessage(
      observer,
      (message) =>
        message.type === "room.snapshot" &&
        (message.snapshot.game?.seq ?? 0) > (started.game?.seq ?? 0),
    );

    await expect(freshSnapshotPromise).resolves.toMatchObject({
      roomCode: "ROOM1",
      type: "room.snapshot",
    });
    expect(transientFailureCount).toBe(1);
    expect(gateway.getTrackedRoomCounts()).toEqual({
      activeSnapshotRooms: 1,
      broadcastCursors: 1,
      subscribedRooms: 1,
    });
  });

  it("pushes fresh running Space Invaders snapshots without waiting for client input", async () => {
    let nowMs = 0;
    const store = createTestRoomStore({ getNowMs: () => nowMs });
    const started = createStartedSpaceInvadersRoom(store);
    const startedGame = expectSpaceInvadersGame(started);
    const { url } = await createGatewayFixture(store, { snapshotIntervalMs: 10 });
    const observer = await connectClient(url);

    await bootstrapClient(observer);

    const runningSnapshotPromise = waitForServerMessage(
      observer,
      (message) =>
        message.type === "room.snapshot" &&
        message.snapshot.game?.gameId === "space-invaders" &&
        (message.snapshot.game?.seq ?? 0) > startedGame.seq,
    );

    nowMs += getSpaceInvadersTickDelay() * 2;

    const runningSnapshot = await runningSnapshotPromise;

    expect(runningSnapshot.type).toBe("room.snapshot");

    if (runningSnapshot.type !== "room.snapshot") {
      throw new Error("Expected a room snapshot message.");
    }

    expect(runningSnapshot.snapshot.game).toMatchObject({
      gameId: "space-invaders",
      snapshot: {
        status: "running",
      },
    });
  });

  it("pushes fresh running Asteroids snapshots without waiting for client input", async () => {
    let nowMs = 0;
    const store = createTestRoomStore({ getNowMs: () => nowMs });
    const started = createStartedAsteroidsRoom(store);
    const startedGame = expectAsteroidsGame(started);
    const { url } = await createGatewayFixture(store, { snapshotIntervalMs: 10 });
    const observer = await connectClient(url);

    await bootstrapClient(observer);

    const runningSnapshotPromise = waitForServerMessage(
      observer,
      (message) =>
        message.type === "room.snapshot" &&
        message.snapshot.game?.gameId === "asteroids" &&
        (message.snapshot.game?.seq ?? 0) > startedGame.seq,
    );

    nowMs += getAsteroidsTickDelay() * 2;

    const runningSnapshot = await runningSnapshotPromise;

    expect(runningSnapshot.type).toBe("room.snapshot");

    if (runningSnapshot.type !== "room.snapshot") {
      throw new Error("Expected a room snapshot message.");
    }

    expect(runningSnapshot.snapshot.game).toMatchObject({
      gameId: "asteroids",
      snapshot: {
        status: "running",
      },
    });
  });

  it("pushes fresh ready Pong snapshots after held paddle input", async () => {
    let nowMs = 0;
    const store = createTestRoomStore({ getNowMs: () => nowMs });
    const started = createStartedPongRoom(store);
    const { url } = await createGatewayFixture(store, { snapshotIntervalMs: 10 });
    const observer = await connectClient(url);

    await bootstrapClient(observer, "ROOM1", "host-1");

    const inputAckPromise = waitForServerMessage(
      observer,
      (message) =>
        message.type === "room.commandAck" && message.requestId === "hold-left-up",
    );
    const expectedHeldInputSeq = started.game!.seq + 1;
    const readySnapshotPromise = waitForServerMessage(
      observer,
      (message) =>
        message.type === "room.snapshot" &&
        (message.snapshot.game?.seq ?? 0) > expectedHeldInputSeq,
    );

    sendClientMessage(observer, {
      gameId: "pong",
      input: {
        direction: "up",
        type: "pong.setPaddleDirection",
      },
      participantId: "host-1",
      requestId: "hold-left-up",
      roomCode: "ROOM1",
      matchId: 1,
      type: "game.input",
    });

    await inputAckPromise;
    nowMs += 80;

    const readySnapshot = await readySnapshotPromise;

    expect(readySnapshot.type).toBe("room.snapshot");

    if (readySnapshot.type !== "room.snapshot") {
      throw new Error("Expected a room snapshot message.");
    }

    const gameSnapshot = readySnapshot.snapshot.game?.snapshot as
      | PongGameState
      | undefined;
    const startedPongGame = expectPongGame(started).snapshot;

    expect(gameSnapshot?.status).toBe("ready");
    expect(gameSnapshot?.playerPaddle.y).toBeLessThan(
      startedPongGame.playerPaddle.y,
    );
  });

  it("rejects malformed client messages", async () => {
    const { url } = await createGatewayFixture();
    const client = await connectClient(url);

    const rejectionPromise = waitForServerMessage(
      client,
      (message) => message.type === "room.commandRejected",
    );

    client.send("{not json");

    await expect(rejectionPromise).resolves.toEqual({
      code: "invalid-message",
      error: "Client message must be valid JSON.",
      type: "room.commandRejected",
    });
  });

  it("closes client messages above the default payload limit", async () => {
    const { url } = await createGatewayFixture();
    const client = await connectClient(url);
    const closePromise = waitForClientClose(client);
    const oversizedMessage = JSON.stringify({
      clientTimeMs: 123,
      padding: "x".repeat(EXPECTED_DEFAULT_MAX_PAYLOAD_BYTES),
      type: "connection.ping",
    });

    expect(Buffer.byteLength(oversizedMessage)).toBeGreaterThan(
      EXPECTED_DEFAULT_MAX_PAYLOAD_BYTES,
    );

    client.send(oversizedMessage);

    await expect(closePromise).resolves.toEqual({ code: 1009, reason: "" });
  });

  it.each([
    {
      label: "a larger byte limit",
      maxPayload: EXPECTED_DEFAULT_MAX_PAYLOAD_BYTES + 1024,
    },
    { label: "zero to disable the limit", maxPayload: 0 },
  ])("honors explicit maxPayload overrides: $label", async ({ maxPayload }) => {
    const { url } = await createGatewayFixture(undefined, { maxPayload });
    const client = await connectClient(url);
    const pongPromise = waitForServerMessage(
      client,
      (message) => message.type === "connection.pong",
    );
    const messageAboveDefault = JSON.stringify({
      clientTimeMs: 456,
      padding: "x".repeat(EXPECTED_DEFAULT_MAX_PAYLOAD_BYTES),
      type: "connection.ping",
    });

    expect(Buffer.byteLength(messageAboveDefault)).toBeGreaterThan(
      EXPECTED_DEFAULT_MAX_PAYLOAD_BYTES,
    );
    if (maxPayload > 0) {
      expect(Buffer.byteLength(messageAboveDefault)).toBeLessThan(maxPayload);
    }

    client.send(messageAboveDefault);

    await expect(pongPromise).resolves.toMatchObject({
      clientTimeMs: 456,
      type: "connection.pong",
    });
    expect(client.readyState).toBe(WebSocket.OPEN);
  });

  it("lets the room store reject registered game ids without adapters", async () => {
    const store = createTestRoomStore();
    expectStoreSuccess(
      store.createRoom({
        host: HOST_USER,
        settings: { gameId: "snake" },
      }),
    );
    const { url } = await createGatewayFixture(store);
    const client = await connectClient(url);

    await bootstrapClient(client, "ROOM1", "host-1");
    const rejectionPromise = waitForServerMessage(
      client,
      (message) =>
        message.type === "room.commandRejected" &&
        message.requestId === "snake-1",
    );

    sendClientMessage(client, {
      gameId: "snake",
      input: {
        direction: "up",
        type: "snake.setDirection",
      },
      participantId: "host-1",
      requestId: "snake-1",
      roomCode: "ROOM1",
      matchId: 1,
      type: "game.input",
    });

    await expect(rejectionPromise).resolves.toEqual({
      code: "invalid-command",
      error: "Game input is not supported for snake rooms.",
      requestId: "snake-1",
      roomCode: "ROOM1",
      type: "room.commandRejected",
    });
  });

  it("imports without resolving the Next server-only marker", async () => {
    vi.resetModules();
    vi.doMock("server-only", () => {
      throw new Error("The reusable WebSocket gateway must not import server-only.");
    });

    try {
      const { createMultiplayerRoomWebSocketGateway: createGateway } = await import(
        "./multiplayer-room-websocket"
      );
      const gateway = createGateway({
        noServer: true,
        store: createTestRoomStore(),
      });

      cleanupCallbacks.push(() => gateway.close());

      expect(gateway.webSocketServer.options.noServer).toBe(true);
    } finally {
      vi.doUnmock("server-only");
    }
  });
});
