import { WebSocket, WebSocketServer, type RawData, type ServerOptions } from "ws";

import type {
  MultiplayerRealtimeRejectionCode,
  MultiplayerRealtimeRoomSnapshot,
  MultiplayerRealtimeServerMessage,
} from "../multiplayer/protocol";
import { isGameId } from "../game-catalog";

import {
  InProcessMultiplayerRoomStore,
  shouldAdvanceRoomGameSnapshot,
  type MultiplayerRoomGameSnapshot,
  type MultiplayerRoomStore,
  type MultiplayerRoomStoreCommand,
  type MultiplayerRoomStoreErrorCode,
  type MultiplayerRoomStoreResult,
  type MultiplayerRoomSnapshot,
} from "./multiplayer-room-runtime";

export type CreateMultiplayerRoomWebSocketGatewayOptions = ServerOptions & {
  snapshotIntervalMs?: number;
  store?: MultiplayerRoomStore;
};

export type MultiplayerRoomWebSocketGateway = {
  broadcastSnapshot: (snapshot: MultiplayerRoomSnapshot) => void;
  close: () => Promise<void>;
  roomStore: MultiplayerRoomStore;
  webSocketServer: WebSocketServer;
};

type ParseRoomCommandResult =
  | {
      command: MultiplayerRoomStoreCommand;
      success: true;
    }
  | {
      error: string;
      success: false;
    };

type RoomCommandMessage = Record<string, unknown> & {
  command?: unknown;
  requestId?: unknown;
  roomCode?: unknown;
};

type GameInputMessage = Record<string, unknown> & {
  gameId?: unknown;
  input?: unknown;
  participantId?: unknown;
  requestId?: unknown;
  roomCode?: unknown;
};

type ConnectionMessage = Record<string, unknown> & {
  clientTimeMs?: unknown;
  displayName?: unknown;
  participantId?: unknown;
  requestId?: unknown;
  roomCode?: unknown;
};

type GameInputStoreCommand = Extract<
  MultiplayerRoomStoreCommand,
  { type: "game.input" }
>;

const HOST_ONLY_WEBSOCKET_COMMAND_ERROR =
  "Host-only room commands require the authenticated HTTP room route.";
export const DEFAULT_MULTIPLAYER_ROOM_SNAPSHOT_INTERVAL_MS = 33;

export function createMultiplayerRoomWebSocketGateway({
  snapshotIntervalMs = DEFAULT_MULTIPLAYER_ROOM_SNAPSHOT_INTERVAL_MS,
  store = new InProcessMultiplayerRoomStore(),
  ...webSocketOptions
}: CreateMultiplayerRoomWebSocketGatewayOptions = {}): MultiplayerRoomWebSocketGateway {
  const webSocketServer = new WebSocketServer(
    needsNoServerDefault(webSocketOptions)
      ? {
          ...webSocketOptions,
          noServer: true,
        }
      : webSocketOptions,
  );
  const roomCodeBySocket = new Map<WebSocket, string>();
  const socketsByRoomCode = new Map<string, Set<WebSocket>>();
  const lastBroadcastCursorByRoomCode = new Map<string, string>();
  const activeSnapshotRoomCodes = new Set<string>();
  const normalizedSnapshotIntervalMs = normalizeSnapshotIntervalMs(snapshotIntervalMs);
  let isSnapshotPumpRunning = false;
  const snapshotIntervalId =
    normalizedSnapshotIntervalMs === null
      ? null
      : setInterval(() => {
          void pumpSubscribedRoomSnapshots();
        }, normalizedSnapshotIntervalMs);

  function removeSocketFromRoom(socket: WebSocket) {
    const roomCode = roomCodeBySocket.get(socket);

    if (roomCode === undefined) {
      return;
    }

    roomCodeBySocket.delete(socket);

    const sockets = socketsByRoomCode.get(roomCode);

    if (sockets === undefined) {
      return;
    }

    sockets.delete(socket);

    if (sockets.size === 0) {
      socketsByRoomCode.delete(roomCode);
      activeSnapshotRoomCodes.delete(roomCode);
    }
  }

  function assignSocketToRoom(socket: WebSocket, roomCode: string) {
    if (roomCodeBySocket.get(socket) === roomCode) {
      return;
    }

    removeSocketFromRoom(socket);

    roomCodeBySocket.set(socket, roomCode);

    const sockets = socketsByRoomCode.get(roomCode) ?? new Set<WebSocket>();

    sockets.add(socket);
    socketsByRoomCode.set(roomCode, sockets);
  }

  function broadcastSnapshot(snapshot: MultiplayerRoomSnapshot) {
    const roomCode = snapshot.room.code;

    rememberBroadcastSnapshot(snapshot);

    const sockets = socketsByRoomCode.get(roomCode);

    if (sockets === undefined) {
      return;
    }

    const message = {
      roomCode,
      snapshot: createBroadcastSnapshot(snapshot),
      type: "room.snapshot",
    } satisfies MultiplayerRealtimeServerMessage<MultiplayerRoomGameSnapshot>;

    for (const socket of sockets) {
      sendServerMessage(socket, message);
    }
  }

  function handleStoreResult(
    socket: WebSocket,
    result: MultiplayerRoomStoreResult,
    requestId: string | undefined,
    roomCode: string | undefined,
    command: MultiplayerRoomStoreCommand,
  ) {
    if (!result.success) {
      sendRejection(socket, {
        code: result.code,
        error: result.error,
        requestId,
        roomCode,
      });
      return;
    }

    assignSocketToRoom(socket, result.snapshot.room.code);
    sendAck(
      socket,
      result.snapshot,
      requestId,
      result.snapshot.participant?.id ?? getCommandParticipantId(command),
    );
    broadcastSnapshot(result.snapshot);
  }

  async function handleConnectionBootstrap(
    socket: WebSocket,
    message: ConnectionMessage,
  ) {
    const requestId = getOptionalString(message.requestId);
    const roomCode = getOptionalString(message.roomCode);

    if (roomCode === undefined) {
      sendRejection(socket, {
        code: "invalid-message",
        error: "Room code is required.",
        requestId,
      });
      return;
    }

    const result = await store.getRoom(roomCode);

    if (!result.success) {
      sendRejection(socket, {
        code: result.code,
        error: result.error,
        requestId,
        roomCode,
      });
      return;
    }

    const snapshot = createConnectionSnapshot(
      result.snapshot,
      getOptionalString(message.participantId),
    );

    assignSocketToRoom(socket, result.snapshot.room.code);
    rememberBroadcastSnapshot(result.snapshot);
    sendServerMessage(socket, {
      ...(getOptionalString(message.displayName) === undefined
        ? {}
        : { displayName: getOptionalString(message.displayName) }),
      ...(getOptionalString(message.participantId) === undefined
        ? {}
        : { participantId: getOptionalString(message.participantId) }),
      ...(requestId === undefined ? {} : { requestId }),
      roomCode: result.snapshot.room.code,
      snapshot,
      type: "connection.bootstrap",
    });
  }

  async function handleRoomCommand(socket: WebSocket, message: RoomCommandMessage) {
    const requestId = getRoomCommandRequestId(message);
    const roomCode = getOptionalString(message.roomCode);

    if (isHostOnlyRoomCommand(message.command)) {
      sendRejection(socket, {
        code: "not-host",
        error: HOST_ONLY_WEBSOCKET_COMMAND_ERROR,
        requestId,
        roomCode,
      });
      return;
    }

    const parsedCommand = parseRoomCommand(message.command);

    if (!parsedCommand.success) {
      sendRejection(socket, {
        code: "invalid-command",
        error: parsedCommand.error,
        requestId,
        roomCode,
      });
      return;
    }

    handleStoreResult(
      socket,
      await store.applyCommand(roomCode, parsedCommand.command),
      requestId,
      roomCode,
      parsedCommand.command,
    );
  }

  async function handleGameInput(socket: WebSocket, message: GameInputMessage) {
    const requestId = getOptionalString(message.requestId);
    const roomCode = getOptionalString(message.roomCode);

    if (typeof message.gameId !== "string") {
      sendRejection(socket, {
        code: "invalid-message",
        error: "Game id is required.",
        requestId,
        roomCode,
      });
      return;
    }

    const gameId = message.gameId.trim();

    if (!isGameId(gameId)) {
      sendRejection(socket, {
        code: "invalid-message",
        error: "Game id is not supported.",
        requestId,
        roomCode,
      });
      return;
    }

    const command = {
      gameId,
      input: message.input as GameInputStoreCommand["input"],
      participantId: message.participantId,
      type: "game.input",
    } satisfies GameInputStoreCommand;

    handleStoreResult(
      socket,
      await store.applyCommand(roomCode, command),
      requestId,
      roomCode,
      command,
    );
  }

  async function handleClientMessage(
    socket: WebSocket,
    data: RawData,
    isBinary: boolean,
  ) {
    if (isBinary) {
      sendRejection(socket, {
        code: "invalid-message",
        error: "Client message must be valid JSON.",
        roomCode: roomCodeBySocket.get(socket),
      });
      return;
    }

    let message: unknown;

    try {
      message = JSON.parse(rawDataToText(data));
    } catch {
      sendRejection(socket, {
        code: "invalid-message",
        error: "Client message must be valid JSON.",
        roomCode: roomCodeBySocket.get(socket),
      });
      return;
    }

    if (!isObjectRecord(message)) {
      sendRejection(socket, {
        code: "invalid-message",
        error: "Client message must be a JSON object.",
        roomCode: roomCodeBySocket.get(socket),
      });
      return;
    }

    if (message.type === "connection.hello" || message.type === "connection.resume") {
      // Resume currently reboots from the authoritative snapshot because this
      // gateway slice intentionally does not add a durable event log.
      await handleConnectionBootstrap(socket, message);
      return;
    }

    if (message.type === "connection.ping") {
      handleDiagnosticsPing(socket, message);
      return;
    }

    if (message.type === "connection.pong") {
      return;
    }

    if (message.type === "room.command") {
      await handleRoomCommand(socket, message);
      return;
    }

    if (message.type === "game.input") {
      await handleGameInput(socket, message);
      return;
    }

    sendRejection(socket, {
      code: "invalid-message",
      error: "Client message type is not supported.",
      requestId: getOptionalString(message.requestId),
      roomCode: getOptionalString(message.roomCode) ?? roomCodeBySocket.get(socket),
    });
  }

  function handleDiagnosticsPing(socket: WebSocket, message: ConnectionMessage) {
    const requestId = getOptionalString(message.requestId);
    const roomCode = getOptionalString(message.roomCode);
    const serverTimeMs = Date.now();

    sendServerMessage(socket, {
      clientTimeMs: getOptionalNumber(message.clientTimeMs) ?? serverTimeMs,
      ...(requestId === undefined ? {} : { requestId }),
      ...(roomCode === undefined ? {} : { roomCode }),
      serverTimeMs,
      type: "connection.pong",
    });
  }

  webSocketServer.on("connection", (socket) => {
    socket.on("message", (data, isBinary) => {
      void handleClientMessage(socket, data, isBinary).catch((error: unknown) => {
        sendRejection(socket, {
          code: "room-service-unavailable",
          error:
            error instanceof Error
              ? error.message
              : "Room command failed before it reached the room store.",
          roomCode: roomCodeBySocket.get(socket),
        });
      });
    });
    socket.on("close", () => {
      removeSocketFromRoom(socket);
    });
  });

  return {
    broadcastSnapshot,
    close: async () => {
      if (snapshotIntervalId !== null) {
        clearInterval(snapshotIntervalId);
      }

      await closeWebSocketServer(webSocketServer);
    },
    roomStore: store,
    webSocketServer,
  };

  async function pumpSubscribedRoomSnapshots() {
    if (isSnapshotPumpRunning || activeSnapshotRoomCodes.size === 0) {
      return;
    }

    isSnapshotPumpRunning = true;

    try {
      for (const roomCode of activeSnapshotRoomCodes) {
        if (!socketsByRoomCode.has(roomCode)) {
          activeSnapshotRoomCodes.delete(roomCode);
          continue;
        }

        const result = await store.getRoom(roomCode);

        if (!result.success || !isFreshBroadcastSnapshot(result.snapshot)) {
          continue;
        }

        broadcastSnapshot(result.snapshot);
      }
    } finally {
      isSnapshotPumpRunning = false;
    }
  }

  function rememberBroadcastSnapshot(snapshot: MultiplayerRoomSnapshot) {
    lastBroadcastCursorByRoomCode.set(
      snapshot.room.code,
      getBroadcastSnapshotCursor(snapshot),
    );

    if (shouldAdvanceRoomGameSnapshot(snapshot)) {
      activeSnapshotRoomCodes.add(snapshot.room.code);
    } else {
      activeSnapshotRoomCodes.delete(snapshot.room.code);
    }
  }

  function isFreshBroadcastSnapshot(snapshot: MultiplayerRoomSnapshot) {
    return (
      lastBroadcastCursorByRoomCode.get(snapshot.room.code) !==
      getBroadcastSnapshotCursor(snapshot)
    );
  }
}

function needsNoServerDefault(options: ServerOptions) {
  return (
    options.noServer === undefined &&
    options.port === undefined &&
    options.server === undefined
  );
}

function closeWebSocketServer(webSocketServer: WebSocketServer) {
  for (const client of webSocketServer.clients) {
    client.terminate();
  }

  return new Promise<void>((resolve, reject) => {
    webSocketServer.close((error) => {
      if (error === undefined) {
        resolve();
      } else {
        reject(error);
      }
    });
  });
}

function sendAck(
  socket: WebSocket,
  snapshot: MultiplayerRoomSnapshot,
  requestId: string | undefined,
  participantId: string | undefined,
) {
  sendServerMessage(socket, {
    ...(snapshot.game === undefined ? {} : { gameSeq: snapshot.game.seq }),
    ...(participantId === undefined ? {} : { participantId }),
    ...(requestId === undefined ? {} : { requestId }),
    roomCode: snapshot.room.code,
    seq: snapshot.seq,
    type: "room.commandAck",
  });
}

function sendRejection(
  socket: WebSocket,
  {
    code,
    error,
    requestId,
    roomCode,
  }: {
    code: MultiplayerRealtimeRejectionCode | MultiplayerRoomStoreErrorCode;
    error: string;
    requestId?: string;
    roomCode?: string;
  },
) {
  sendServerMessage(socket, {
    code: getRealtimeRejectionCode(code),
    error,
    ...(requestId === undefined ? {} : { requestId }),
    ...(roomCode === undefined ? {} : { roomCode }),
    type: "room.commandRejected",
  });
}

function getRealtimeRejectionCode(
  code: MultiplayerRealtimeRejectionCode | MultiplayerRoomStoreErrorCode,
): MultiplayerRealtimeRejectionCode {
  if (
    code === "room-service-invalid-response" ||
    code === "room-service-unavailable"
  ) {
    return "invalid-message";
  }

  return code;
}

function sendServerMessage(
  socket: WebSocket,
  message: MultiplayerRealtimeServerMessage<MultiplayerRoomGameSnapshot>,
) {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(message));
}

function normalizeSnapshotIntervalMs(intervalMs: number) {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    return null;
  }

  return Math.max(16, Math.round(intervalMs));
}

function getBroadcastSnapshotCursor(snapshot: MultiplayerRoomSnapshot) {
  return `${snapshot.seq}:${snapshot.game?.seq ?? "none"}`;
}

function createBroadcastSnapshot(
  snapshot: MultiplayerRoomSnapshot,
): MultiplayerRealtimeRoomSnapshot<MultiplayerRoomGameSnapshot> {
  return {
    ...(snapshot.game === undefined ? {} : { game: snapshot.game }),
    room: snapshot.room,
    seq: snapshot.seq,
  };
}

function createConnectionSnapshot(
  snapshot: MultiplayerRoomSnapshot,
  participantId: string | undefined,
): MultiplayerRealtimeRoomSnapshot<MultiplayerRoomGameSnapshot> {
  const participant =
    participantId === undefined
      ? undefined
      : snapshot.room.participants.find((entry) => entry.id === participantId);

  return {
    ...createBroadcastSnapshot(snapshot),
    ...(participant === undefined ? {} : { participant }),
  };
}

function getCommandParticipantId(command: MultiplayerRoomStoreCommand) {
  if ("participantId" in command) {
    return getOptionalString(command.participantId);
  }

  return undefined;
}

function isHostOnlyRoomCommand(value: unknown) {
  return (
    isObjectRecord(value) &&
    (value.type === "room.lifecycle" || value.type === "room.updateSettings")
  );
}

function getRoomCommandRequestId(message: RoomCommandMessage) {
  if (typeof message.requestId === "string") {
    return message.requestId;
  }

  if (isObjectRecord(message.command) && typeof message.command.requestId === "string") {
    return message.command.requestId;
  }

  return undefined;
}

function parseRoomCommand(value: unknown): ParseRoomCommandResult {
  if (!isObjectRecord(value)) {
    return {
      error: "Room command must be a JSON object.",
      success: false,
    };
  }

  if (value.type === "room.joinObserver") {
    return {
      command: {
        displayName: value.displayName,
        ...(value.userId === undefined ? {} : { userId: value.userId }),
        type: "room.joinObserver",
      },
      success: true,
    };
  }

  if (value.type === "room.claimSeat") {
    return {
      command: {
        participantId: value.participantId,
        seatId: value.seatId,
        type: "room.claimSeat",
      },
      success: true,
    };
  }

  if (value.type === "room.releaseSeat") {
    return {
      command: {
        participantId: value.participantId,
        seatId: value.seatId,
        type: "room.releaseSeat",
      },
      success: true,
    };
  }

  return {
    error: "Room command type is not supported.",
    success: false,
  };
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

function getOptionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function getOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
