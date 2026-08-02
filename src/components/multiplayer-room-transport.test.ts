import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MULTIPLAYER_ROOM_PROTOCOL_VERSION,
  type MultiplayerRealtimeServerMessage,
} from "@/lib/multiplayer/protocol";
import type { PrivateRoom } from "@/lib/multiplayer/room";

import {
  MultiplayerRoomTransportError,
  type MultiplayerRoomTransportSnapshot,
  type MultiplayerRoomWebSocketEventMap,
  type MultiplayerRoomWebSocketLike,
  createMultiplayerRoomCommandMessage,
  createMultiplayerRoomConnectionMessage,
  createMultiplayerRoomDiagnosticsPingMessage,
  createMultiplayerRoomGameInputMessage,
  createMultiplayerRoomWebSocketTransport,
  resolveMultiplayerRoomWebSocketUrl,
} from "./multiplayer-room-transport";

const ROOM: PrivateRoom = {
  code: "ROOM1",
  hostParticipantId: "host-1",
  participants: [
    {
      displayName: "Ada",
      id: "host-1",
      role: "host",
      userId: "user-1",
    },
    {
      displayName: "Grace",
      id: "guest-1",
      role: "observer",
      userId: null,
    },
  ],
  seats: [],
  settings: {
    gameId: "pong",
  },
  status: "lobby",
};

class FakeWebSocket implements MultiplayerRoomWebSocketLike {
  static instances: FakeWebSocket[] = [];

  readonly sentMessages: string[] = [];
  readyState = 0;
  readonly url: string;
  readonly closeListeners = new Set<(event: CloseEvent) => void>();
  readonly errorListeners = new Set<(event: Event) => void>();
  readonly messageListeners = new Set<(event: MessageEvent<unknown>) => void>();
  readonly openListeners = new Set<(event: Event) => void>();

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  addEventListener<EventName extends keyof MultiplayerRoomWebSocketEventMap>(
    eventName: EventName,
    listener: (event: MultiplayerRoomWebSocketEventMap[EventName]) => void,
  ) {
    if (eventName === "close") {
      this.closeListeners.add(listener as (event: CloseEvent) => void);
    } else if (eventName === "error") {
      this.errorListeners.add(listener as (event: Event) => void);
    } else if (eventName === "message") {
      this.messageListeners.add(listener as (event: MessageEvent<unknown>) => void);
    } else {
      this.openListeners.add(listener as (event: Event) => void);
    }
  }

  close() {
    this.readyState = 3;
  }

  emitClose() {
    this.readyState = 3;
    for (const listener of this.closeListeners) {
      listener({} as CloseEvent);
    }
  }

  emitMessage(message: MultiplayerRealtimeServerMessage) {
    this.emitRawMessage(message);
  }

  emitRawMessage(message: unknown) {
    const event = {
      data: JSON.stringify(message),
    } as MessageEvent<unknown>;

    for (const listener of this.messageListeners) {
      listener(event);
    }
  }

  emitOpen() {
    this.readyState = 1;
    for (const listener of this.openListeners) {
      listener({} as Event);
    }
  }

  removeEventListener<EventName extends keyof MultiplayerRoomWebSocketEventMap>(
    eventName: EventName,
    listener: (event: MultiplayerRoomWebSocketEventMap[EventName]) => void,
  ) {
    if (eventName === "close") {
      this.closeListeners.delete(listener as (event: CloseEvent) => void);
    } else if (eventName === "error") {
      this.errorListeners.delete(listener as (event: Event) => void);
    } else if (eventName === "message") {
      this.messageListeners.delete(listener as (event: MessageEvent<unknown>) => void);
    } else {
      this.openListeners.delete(listener as (event: Event) => void);
    }
  }

  send(data: string) {
    this.sentMessages.push(data);
  }
}

describe("multiplayer room WebSocket URL derivation", () => {
  it("resolves absolute and same-origin room stream URLs", () => {
    expect(resolveMultiplayerRoomWebSocketUrl(undefined, "http://localhost:3000"))
      .toBeNull();
    expect(resolveMultiplayerRoomWebSocketUrl("   ", "http://localhost:3000"))
      .toBeNull();
    expect(
      resolveMultiplayerRoomWebSocketUrl(
        "ws://127.0.0.1:3001/multiplayer/rooms",
        null,
      ),
    ).toBe("ws://127.0.0.1:3001/multiplayer/rooms");
    expect(
      resolveMultiplayerRoomWebSocketUrl(
        "https://games.example/multiplayer/rooms",
        null,
      ),
    ).toBe("wss://games.example/multiplayer/rooms");
    expect(
      resolveMultiplayerRoomWebSocketUrl(
        "/multiplayer/rooms",
        "http://localhost:3000",
      ),
    ).toBe("ws://localhost:3000/multiplayer/rooms");
    expect(
      resolveMultiplayerRoomWebSocketUrl(
        "/multiplayer/rooms",
        "https://games.example",
      ),
    ).toBe("wss://games.example/multiplayer/rooms");
    expect(
      resolveMultiplayerRoomWebSocketUrl(
        "multiplayer/rooms",
        "https://games.example",
      ),
    ).toBeNull();
  });
});

describe("multiplayer room WebSocket message shapes", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
  });

  it("builds generic connection, room-command, and game-input envelopes", () => {
    expect(
      createMultiplayerRoomConnectionMessage({
        displayName: "Grace",
        requestId: "hello-1",
        roomCode: "ROOM1",
      }),
    ).toEqual({
      displayName: "Grace",
      protocolVersion: MULTIPLAYER_ROOM_PROTOCOL_VERSION,
      requestId: "hello-1",
      roomCode: "ROOM1",
      type: "connection.hello",
    });
    expect(
      createMultiplayerRoomConnectionMessage({
        lastSeq: {
          game: 4,
          room: 3,
        },
        participantCapability: "guest-capability",
        participantId: "guest-1",
        requestId: "resume-1",
        roomCode: "ROOM1",
      }),
    ).toEqual({
      lastSeq: {
        game: 4,
        room: 3,
      },
      participantCapability: "guest-capability",
      participantId: "guest-1",
      protocolVersion: MULTIPLAYER_ROOM_PROTOCOL_VERSION,
      requestId: "resume-1",
      roomCode: "ROOM1",
      type: "connection.resume",
    });
    expect(
      createMultiplayerRoomCommandMessage(
        "ROOM1",
        {
          displayName: "Grace",
          type: "room.joinObserver",
        },
        "join-1",
      ),
    ).toEqual({
      command: {
        displayName: "Grace",
        type: "room.joinObserver",
      },
      requestId: "join-1",
      roomCode: "ROOM1",
      type: "room.command",
    });
    expect(
      createMultiplayerRoomGameInputMessage({
        gameId: "pong",
        input: {
          direction: "up",
          type: "pong.setPaddleDirection",
        },
        participantId: "host-1",
        requestId: "input-1",
        roomCode: "ROOM1",
      }),
    ).toEqual({
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
    expect(
      createMultiplayerRoomDiagnosticsPingMessage(
        "ROOM1",
        "diagnostics-1",
        1_000,
      ),
    ).toEqual({
      clientTimeMs: 1_000,
      requestId: "diagnostics-1",
      roomCode: "ROOM1",
      type: "connection.ping",
    });
  });

  it("sends room commands and Pong input through the generic WebSocket envelopes", async () => {
    const participantCapabilities: string[] = [];
    const participantIds: string[] = [];
    const snapshots: MultiplayerRoomTransportSnapshot[] = [];
    const transport = createMultiplayerRoomWebSocketTransport({
      displayName: "Grace",
      onBootstrap: (snapshot) => snapshots.push(snapshot),
      onParticipantCapability: (participantCapability) =>
        participantCapabilities.push(participantCapability),
      onParticipantId: (participantId) => participantIds.push(participantId),
      onSnapshot: (snapshot) => snapshots.push(snapshot),
      roomCode: "ROOM1",
      url: "ws://127.0.0.1:3001/multiplayer/rooms",
      webSocketConstructor: FakeWebSocket,
    });
    const socket = FakeWebSocket.instances[0]!;

    expect(socket.url).toBe("ws://127.0.0.1:3001/multiplayer/rooms");

    socket.emitOpen();

    expect(JSON.parse(socket.sentMessages[0]!)).toMatchObject({
      displayName: "Grace",
      roomCode: "ROOM1",
      type: "connection.hello",
    });

    socket.emitMessage({
      protocolVersion: MULTIPLAYER_ROOM_PROTOCOL_VERSION,
      requestId: JSON.parse(socket.sentMessages[0]!).requestId,
      roomCode: "ROOM1",
      snapshot: {
        room: ROOM,
        seq: 1,
      },
      type: "connection.bootstrap",
    });

    const joinAck = transport.sendRoomCommand({
      displayName: "Grace",
      type: "room.joinObserver",
    });
    const joinMessage = JSON.parse(socket.sentMessages[1]!);

    expect(joinMessage).toMatchObject({
      command: {
        displayName: "Grace",
        type: "room.joinObserver",
      },
      roomCode: "ROOM1",
      type: "room.command",
    });

    socket.emitMessage({
      participantCapability: "guest-capability",
      participantId: "guest-1",
      requestId: joinMessage.requestId,
      roomCode: "ROOM1",
      seq: 2,
      type: "room.commandAck",
    });

    await expect(joinAck).resolves.toEqual({
      participantCapability: "guest-capability",
      participantId: "guest-1",
      seq: 2,
    });

    const claimAck = transport.sendRoomCommand({
      participantId: "guest-1",
      seatId: "right",
      type: "room.claimSeat",
    });
    const claimMessage = JSON.parse(socket.sentMessages[2]!);

    expect(claimMessage).toMatchObject({
      command: {
        participantId: "guest-1",
        seatId: "right",
        type: "room.claimSeat",
      },
      roomCode: "ROOM1",
      type: "room.command",
    });

    socket.emitMessage({
      requestId: claimMessage.requestId,
      roomCode: "ROOM1",
      seq: 3,
      type: "room.commandAck",
    });

    await expect(claimAck).resolves.toEqual({
      seq: 3,
    });

    const releaseAck = transport.sendRoomCommand({
      participantId: "guest-1",
      seatId: "right",
      type: "room.releaseSeat",
    });
    const releaseMessage = JSON.parse(socket.sentMessages[3]!);

    expect(releaseMessage).toMatchObject({
      command: {
        participantId: "guest-1",
        seatId: "right",
        type: "room.releaseSeat",
      },
      roomCode: "ROOM1",
      type: "room.command",
    });

    socket.emitMessage({
      requestId: releaseMessage.requestId,
      roomCode: "ROOM1",
      seq: 4,
      type: "room.commandAck",
    });

    await expect(releaseAck).resolves.toEqual({
      seq: 4,
    });

    const inputAck = transport.sendGameInput(
      "pong",
      {
        direction: "up",
        type: "pong.setPaddleDirection",
      },
      "guest-1",
    );
    const inputMessage = JSON.parse(socket.sentMessages[4]!);

    expect(inputMessage).toMatchObject({
      gameId: "pong",
      input: {
        direction: "up",
        type: "pong.setPaddleDirection",
      },
      participantId: "guest-1",
      roomCode: "ROOM1",
      type: "game.input",
    });

    socket.emitMessage({
      gameSeq: 7,
      participantId: "guest-1",
      requestId: inputMessage.requestId,
      roomCode: "ROOM1",
      seq: 4,
      type: "room.commandAck",
    });

    await expect(inputAck).resolves.toEqual({
      gameSeq: 7,
      participantId: "guest-1",
      seq: 4,
    });
    expect(participantIds).toEqual(["guest-1", "guest-1"]);
    expect(participantCapabilities).toEqual(["guest-capability"]);
    expect(snapshots).toEqual([
      {
        room: ROOM,
        seq: 1,
      },
    ]);

    transport.close();
  });

  it("preserves unrecoverable bootstrap rejection codes for room-gone UX", () => {
    const bootstrapErrors: MultiplayerRoomTransportError[] = [];
    const transport = createMultiplayerRoomWebSocketTransport({
      lastSeq: {
        game: 4,
        room: 3,
      },
      onBootstrap: () => {
        throw new Error("Bootstrap should not succeed.");
      },
      onBootstrapRejected: (error) => bootstrapErrors.push(error),
      onSnapshot: () => {
        throw new Error("Snapshot should not arrive.");
      },
      participantId: "guest-1",
      roomCode: "ROOM1",
      url: "ws://127.0.0.1:3001/multiplayer/rooms",
      webSocketConstructor: FakeWebSocket,
    });
    const socket = FakeWebSocket.instances[0]!;

    socket.emitOpen();

    const resumeMessage = JSON.parse(socket.sentMessages[0]!);

    expect(resumeMessage).toMatchObject({
      lastSeq: {
        game: 4,
        room: 3,
      },
      participantId: "guest-1",
      roomCode: "ROOM1",
      type: "connection.resume",
    });

    socket.emitMessage({
      code: "room-not-found",
      error: "Room was not found.",
      requestId: resumeMessage.requestId,
      roomCode: "ROOM1",
      type: "room.commandRejected",
    });

    expect(bootstrapErrors).toHaveLength(1);
    expect(bootstrapErrors[0]).toBeInstanceOf(MultiplayerRoomTransportError);
    expect(bootstrapErrors[0]).toMatchObject({
      code: "room-not-found",
      message: "Room was not found.",
    });
    expect(socket.readyState).toBe(3);

    transport.close();
  });

  it("normalizes a lowercase requested room code before bootstrap validation", () => {
    const onBootstrap = vi.fn();
    const transport = createMultiplayerRoomWebSocketTransport({
      onBootstrap,
      onSnapshot: () => {},
      roomCode: "room1",
      url: "ws://127.0.0.1:3001/multiplayer/rooms",
      webSocketConstructor: FakeWebSocket,
    });
    const socket = FakeWebSocket.instances[0]!;

    socket.emitOpen();

    const connectionMessage = JSON.parse(socket.sentMessages[0]!);

    expect(connectionMessage.roomCode).toBe("ROOM1");

    socket.emitMessage({
      protocolVersion: MULTIPLAYER_ROOM_PROTOCOL_VERSION,
      requestId: connectionMessage.requestId,
      roomCode: "ROOM1",
      snapshot: {
        room: ROOM,
        seq: 1,
      },
      type: "connection.bootstrap",
    });

    expect(onBootstrap).toHaveBeenCalledWith({
      room: ROOM,
      seq: 1,
    });

    transport.close();
  });

  it("terminates an unversioned bootstrap without accepting pre-bootstrap snapshots or reconnecting", () => {
    vi.useFakeTimers();

    try {
      const bootstrapRejections: MultiplayerRoomTransportError[] = [];
      const errors: MultiplayerRoomTransportError[] = [];
      const onBootstrap = vi.fn();
      const onClose = vi.fn();
      const onSnapshot = vi.fn();
      const transport = createMultiplayerRoomWebSocketTransport({
        onBootstrap,
        onBootstrapRejected: (error) => bootstrapRejections.push(error),
        onClose,
        onError: (error) => errors.push(error),
        onSnapshot,
        roomCode: "ROOM1",
        url: "ws://127.0.0.1:3001/multiplayer/rooms",
        webSocketConstructor: FakeWebSocket,
      });
      const socket = FakeWebSocket.instances[0]!;

      socket.emitOpen();
      socket.emitMessage({
        roomCode: "ROOM1",
        snapshot: {
          room: ROOM,
          seq: 1,
        },
        type: "room.snapshot",
      });
      socket.emitRawMessage({
        requestId: JSON.parse(socket.sentMessages[0]!).requestId,
        roomCode: "ROOM1",
        snapshot: {
          room: ROOM,
          seq: 1,
        },
        type: "connection.bootstrap",
      });

      expect(bootstrapRejections).toEqual([
        expect.objectContaining({
          code: "protocol-version-mismatch",
          message: "Room stream protocol version is not supported. Refresh the page.",
        }),
      ]);
      expect(onBootstrap).not.toHaveBeenCalled();
      expect(onSnapshot).not.toHaveBeenCalled();
      expect(errors).toEqual([]);
      expect(onClose).not.toHaveBeenCalled();
      expect(socket.readyState).toBe(3);
      expect(vi.getTimerCount()).toBe(0);

      transport.close();
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    {
      message: {
        protocolVersion: MULTIPLAYER_ROOM_PROTOCOL_VERSION,
        roomCode: "ROOM1",
        type: "connection.bootstrap",
      },
      name: "bootstrap without a snapshot",
    },
    {
      message: {
        roomCode: "ROOM1",
        type: "room.snapshot",
      },
      name: "room snapshot without a snapshot",
    },
    {
      message: {
        roomCode: "ROOM1",
        snapshot: {
          room: ROOM,
          seq: -1,
        },
        type: "room.snapshot",
      },
      name: "negative room sequence",
    },
    {
      message: {
        roomCode: "ROOM1",
        snapshot: {
          room: {
            ...ROOM,
            participants: [{ ...ROOM.participants[0], id: 12 }],
          },
          seq: 1,
        },
        type: "room.snapshot",
      },
      name: "malformed participant nesting",
    },
    {
      message: {
        roomCode: "ROOM1",
        snapshot: {
          game: {
            gameId: "asteroids",
            seq: 1,
            serverTimeMs: 1_000,
            snapshot: {},
          },
          room: ROOM,
          seq: 1,
        },
        type: "room.snapshot",
      },
      name: "game snapshot that does not match the room game",
    },
    {
      message: {
        roomCode: "ROOM1",
        seq: -1,
        type: "room.commandAck",
      },
      name: "acknowledgement with an invalid sequence",
    },
    {
      message: {
        event: {
          payload: {},
          seq: 1,
        },
        roomCode: "ROOM1",
        type: "room.event",
      },
      name: "room event without an event type",
    },
    {
      message: {
        code: "made-up-error",
        error: "Rejected.",
        type: "room.commandRejected",
      },
      name: "rejection with an unknown code",
    },
    {
      message: {
        serverTimeMs: "soon",
        type: "connection.ping",
      },
      name: "ping with an invalid timestamp",
    },
    {
      message: {
        clientTimeMs: 1_000,
        serverTimeMs: Number.NaN,
        type: "connection.pong",
      },
      name: "pong with an invalid timestamp",
    },
    {
      message: {
        type: "room.unknown",
      },
      name: "unknown top-level message type",
    },
  ])("reports a controlled transport error for $name", ({ message }) => {
    const errors: MultiplayerRoomTransportError[] = [];
    const onBootstrap = vi.fn();
    const onSnapshot = vi.fn();
    const transport = createMultiplayerRoomWebSocketTransport({
      onBootstrap,
      onError: (error) => errors.push(error),
      onSnapshot,
      roomCode: "ROOM1",
      url: "ws://127.0.0.1:3001/multiplayer/rooms",
      webSocketConstructor: FakeWebSocket,
    });
    const socket = FakeWebSocket.instances[0]!;
    let thrownError: unknown;

    socket.emitOpen();

    try {
      socket.emitRawMessage(message);
    } catch (error) {
      thrownError = error;
    } finally {
      transport.close();
    }

    expect(thrownError).toBeUndefined();
    expect(errors).toEqual([
      expect.objectContaining({
        message: "Room stream sent an unsupported message.",
      }),
    ]);
    expect(onBootstrap).not.toHaveBeenCalled();
    expect(onSnapshot).not.toHaveBeenCalled();
  });

  describe("timeout recovery", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("closes and requests reconnect when bootstrap is lost on an open socket", () => {
      const connectionErrors: MultiplayerRoomTransportError[] = [];
      const onClose = vi.fn();
      const transport = createMultiplayerRoomWebSocketTransport({
        bootstrapTimeoutMs: 5_000,
        onBootstrap: () => {
          throw new Error("Bootstrap should not succeed.");
        },
        onClose,
        onError: (error) => connectionErrors.push(error),
        onSnapshot: () => {},
        roomCode: "ROOM1",
        url: "ws://127.0.0.1:3001/multiplayer/rooms",
        webSocketConstructor: FakeWebSocket,
      });
      const socket = FakeWebSocket.instances[0]!;

      socket.emitOpen();
      vi.advanceTimersByTime(4_999);

      expect(socket.readyState).toBe(1);
      expect(connectionErrors).toEqual([]);
      expect(onClose).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);

      expect(connectionErrors).toEqual([
        expect.objectContaining({
          message: "Room stream connection timed out.",
        }),
      ]);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(socket.readyState).toBe(3);
      expect(vi.getTimerCount()).toBe(0);

      transport.close();
    });

    it("rejects an unacknowledged command without retrying or closing the socket", async () => {
      const transport = createMultiplayerRoomWebSocketTransport({
        commandAckTimeoutMs: 5_000,
        onBootstrap: () => {},
        onSnapshot: () => {},
        roomCode: "ROOM1",
        url: "ws://127.0.0.1:3001/multiplayer/rooms",
        webSocketConstructor: FakeWebSocket,
      });
      const socket = FakeWebSocket.instances[0]!;

      socket.emitOpen();
      socket.emitMessage({
        protocolVersion: MULTIPLAYER_ROOM_PROTOCOL_VERSION,
        requestId: JSON.parse(socket.sentMessages[0]!).requestId,
        roomCode: "ROOM1",
        snapshot: {
          room: ROOM,
          seq: 1,
        },
        type: "connection.bootstrap",
      });

      const commandAck = transport.sendRoomCommand({
        participantId: "guest-1",
        seatId: "right",
        type: "room.claimSeat",
      });

      expect(socket.sentMessages).toHaveLength(2);

      vi.advanceTimersByTime(5_000);

      await expect(commandAck).rejects.toMatchObject({
        message: "Room command response timed out.",
      });
      expect(socket.sentMessages).toHaveLength(2);
      expect(socket.readyState).toBe(1);
      expect(vi.getTimerCount()).toBe(0);

      const nextCommandAck = transport.sendRoomCommand({
        participantId: "guest-1",
        seatId: "right",
        type: "room.releaseSeat",
      });
      const nextCommandMessage = JSON.parse(socket.sentMessages[2]!);

      socket.emitMessage({
        requestId: nextCommandMessage.requestId,
        roomCode: "ROOM1",
        seq: 2,
        type: "room.commandAck",
      });

      await expect(nextCommandAck).resolves.toEqual({ seq: 2 });
      expect(vi.getTimerCount()).toBe(0);

      transport.close();
    });

    it("clears command deadlines when the server rejects or the transport closes", async () => {
      const transport = createMultiplayerRoomWebSocketTransport({
        commandAckTimeoutMs: 5_000,
        onBootstrap: () => {},
        onSnapshot: () => {},
        roomCode: "ROOM1",
        url: "ws://127.0.0.1:3001/multiplayer/rooms",
        webSocketConstructor: FakeWebSocket,
      });
      const socket = FakeWebSocket.instances[0]!;

      socket.emitOpen();
      socket.emitMessage({
        protocolVersion: MULTIPLAYER_ROOM_PROTOCOL_VERSION,
        requestId: JSON.parse(socket.sentMessages[0]!).requestId,
        roomCode: "ROOM1",
        snapshot: {
          room: ROOM,
          seq: 1,
        },
        type: "connection.bootstrap",
      });

      const rejectedCommand = transport.sendRoomCommand({
        participantId: "guest-1",
        seatId: "left",
        type: "room.claimSeat",
      });
      const rejectedCommandMessage = JSON.parse(socket.sentMessages[1]!);

      expect(vi.getTimerCount()).toBe(1);

      socket.emitMessage({
        code: "seat-occupied",
        error: "Seat is unavailable.",
        requestId: rejectedCommandMessage.requestId,
        roomCode: "ROOM1",
        type: "room.commandRejected",
      });

      await expect(rejectedCommand).rejects.toMatchObject({
        code: "seat-occupied",
        message: "Seat is unavailable.",
      });
      expect(vi.getTimerCount()).toBe(0);

      const interruptedCommand = transport.sendRoomCommand({
        participantId: "guest-1",
        seatId: "right",
        type: "room.claimSeat",
      });

      expect(vi.getTimerCount()).toBe(1);

      transport.close();

      await expect(interruptedCommand).rejects.toMatchObject({
        message: "Room stream closed.",
      });
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  it("sends diagnostics pings and records echoed pong samples", () => {
    const samples: Array<{
      roundTripMs: number;
      serverTimeMs: number;
    }> = [];
    const dateNowSpy = vi.spyOn(Date, "now");
    const transport = createMultiplayerRoomWebSocketTransport({
      onBootstrap: () => {},
      onDiagnosticsPingSample: (sample) => {
        samples.push({
          roundTripMs: sample.roundTripMs,
          serverTimeMs: sample.serverTimeMs,
        });
      },
      onSnapshot: () => {},
      roomCode: "ROOM1",
      url: "ws://127.0.0.1:3001/multiplayer/rooms",
      webSocketConstructor: FakeWebSocket,
    });
    const socket = FakeWebSocket.instances[0]!;

    socket.emitOpen();
    dateNowSpy.mockReturnValueOnce(1_000);
    transport.sendDiagnosticsPing();

    const pingMessage = JSON.parse(socket.sentMessages[1]!);

    expect(pingMessage).toMatchObject({
      clientTimeMs: 1_000,
      roomCode: "ROOM1",
      type: "connection.ping",
    });

    dateNowSpy.mockReturnValueOnce(1_037);
    socket.emitMessage({
      clientTimeMs: pingMessage.clientTimeMs,
      requestId: pingMessage.requestId,
      roomCode: "ROOM1",
      serverTimeMs: 1_018,
      type: "connection.pong",
    });

    expect(samples).toEqual([
      {
        roundTripMs: 37,
        serverTimeMs: 1_018,
      },
    ]);

    transport.close();
    dateNowSpy.mockRestore();
  });

  it("ignores unsupported diagnostics ping rejections from older sidecars", () => {
    const errors: MultiplayerRoomTransportError[] = [];
    const transport = createMultiplayerRoomWebSocketTransport({
      onBootstrap: () => {},
      onError: (error) => errors.push(error),
      onSnapshot: () => {},
      roomCode: "ROOM1",
      url: "ws://127.0.0.1:3001/multiplayer/rooms",
      webSocketConstructor: FakeWebSocket,
    });
    const socket = FakeWebSocket.instances[0]!;

    socket.emitOpen();
    transport.sendDiagnosticsPing();

    const pingMessage = JSON.parse(socket.sentMessages[1]!);

    socket.emitMessage({
      code: "invalid-message",
      error: "Client message type is not supported.",
      requestId: pingMessage.requestId,
      roomCode: "ROOM1",
      type: "room.commandRejected",
    });
    transport.sendDiagnosticsPing();

    expect(errors).toEqual([]);
    expect(socket.sentMessages).toHaveLength(2);

    transport.close();
  });
});
