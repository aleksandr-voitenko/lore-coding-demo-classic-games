import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocket, type RawData } from "ws";

import type { MultiplayerRealtimeServerMessage } from "@/lib/multiplayer/protocol";
import type { PongGameState } from "@/lib/pong-game-engine";
import type { AuthenticatedUser } from "@/lib/user-profile";

import {
  InProcessMultiplayerRoomStore,
  type MultiplayerRoomStoreResult,
} from "./multiplayer-room-runtime";
import { createMultiplayerRoomWebSocketGateway } from "./multiplayer-room-websocket";

const HOST_USER = {
  displayName: "Ada Host",
  id: "user-1",
} satisfies AuthenticatedUser;

const HOST_ONLY_WEBSOCKET_COMMAND_ERROR =
  "Host-only room commands require the authenticated HTTP room route.";

const cleanupCallbacks: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  const callbacks = cleanupCallbacks.splice(0).reverse();

  await Promise.all(callbacks.map((callback) => Promise.resolve().then(callback)));
});

function createTestRoomStore({
  getNowMs,
  participantIds = ["host-1", "guest-1", "guest-2", "observer-1"],
  roomCodes = ["ROOM1"],
}: {
  getNowMs?: () => number;
  participantIds?: string[];
  roomCodes?: string[];
} = {}) {
  let participantIdIndex = 0;
  let roomCodeIndex = 0;

  return new InProcessMultiplayerRoomStore({
    createParticipantId: ({ role }) =>
      participantIds[participantIdIndex++] ?? `${role}-${participantIdIndex}`,
    createRoomCode: () => roomCodes[roomCodeIndex++] ?? "ROOM-FALLBACK",
    getNowMs,
  });
}

function expectStoreSuccess(result: MultiplayerRoomStoreResult) {
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.snapshot;
}

function createLobbyRoom(store: InProcessMultiplayerRoomStore) {
  return expectStoreSuccess(store.createRoom({ host: HOST_USER }));
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
      type: "room.claimSeat",
    }),
  );
  expectStoreSuccess(
    store.applyCommand("ROOM1", {
      participantId: "guest-1",
      seatId: "right",
      type: "room.claimSeat",
    }),
  );

  return expectStoreSuccess(
    store.applyCommand("ROOM1", {
      command: "start",
      participantId: "host-1",
      type: "room.lifecycle",
    }),
  );
}

function serveStartedPongRoom(store: InProcessMultiplayerRoomStore) {
  const snapshot = expectStoreSuccess(store.getRoom("ROOM1"));
  const serveSide = snapshot.game!.snapshot.serveSide;

  return expectStoreSuccess(
    store.applyCommand("ROOM1", {
      input: {
        type: "pong.serve",
      },
      participantId: serveSide === "left" ? "host-1" : "guest-1",
      type: "game.input",
    }),
  );
}

async function createGatewayFixture(
  store = createTestRoomStore(),
  gatewayOptions: {
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
  client.send(JSON.stringify(message));
}

async function bootstrapClient(client: WebSocket, roomCode = "ROOM1") {
  const bootstrapPromise = waitForServerMessage(
    client,
    (message) => message.type === "connection.bootstrap",
  );

  sendClientMessage(client, {
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

describe("multiplayer room WebSocket gateway", () => {
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

  it("acks game input and broadcasts updated Pong snapshots", async () => {
    const store = createTestRoomStore();
    const started = createStartedPongRoom(store);
    const { url } = await createGatewayFixture(store);
    const sender = await connectClient(url);
    const observer = await connectClient(url);

    await bootstrapClient(sender);
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

    expect(gameSnapshot?.ball.position.x).not.toBe(started.game!.snapshot.ball.position.x);
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

  it("rejects unsupported game input without adding transport-specific message types", async () => {
    const store = createTestRoomStore();
    createLobbyRoom(store);
    const { url } = await createGatewayFixture(store);
    const client = await connectClient(url);
    const rejectionPromise = waitForServerMessage(
      client,
      (message) =>
        message.type === "room.commandRejected" &&
        message.requestId === "asteroids-1",
    );

    sendClientMessage(client, {
      gameId: "asteroids",
      input: {
        thrust: true,
        type: "asteroids.setControls",
      },
      participantId: "host-1",
      requestId: "asteroids-1",
      roomCode: "ROOM1",
      type: "game.input",
    });

    await expect(rejectionPromise).resolves.toEqual({
      code: "unsupported-game",
      error: "Game input is not supported for asteroids.",
      requestId: "asteroids-1",
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
