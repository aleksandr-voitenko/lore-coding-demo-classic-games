import { WebSocket, WebSocketServer, type RawData, type ServerOptions } from "ws";

import { MULTIPLAYER_ROOM_PROTOCOL_VERSION } from "../multiplayer/protocol";
import type {
  MultiplayerRealtimeRejectionCode,
  MultiplayerRealtimeRoomSnapshot,
  MultiplayerRealtimeServerMessage,
} from "../multiplayer/protocol";
import { isGameId } from "../game-catalog";

import {
  InProcessMultiplayerRoomStore,
  isMultiplayerRoomParticipantConnectionStore,
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
  getTrackedRoomCounts: () => {
    activeSnapshotRooms: number;
    broadcastCursors: number;
    subscribedRooms: number;
  };
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
  participantCapability?: unknown;
  participantId?: unknown;
  protocolVersion?: unknown;
  requestId?: unknown;
  roomCode?: unknown;
};

type GameInputStoreCommand = Extract<
  MultiplayerRoomStoreCommand,
  { type: "game.input" }
>;

type SocketRoomAssignmentResult =
  | "assigned"
  | "participant-rejected"
  | "socket-closed";

const HOST_ONLY_WEBSOCKET_COMMAND_ERROR =
  "Host-only room commands require the authenticated HTTP room route.";
const PARTICIPANT_UNAUTHORIZED_ERROR =
  "Participant credentials are invalid or no longer active.";
const PROTOCOL_VERSION_MISMATCH_ERROR =
  "Room stream protocol version is not supported. Refresh the page.";
const DEFAULT_MULTIPLAYER_ROOM_MAX_PAYLOAD_BYTES = 64 * 1024;
export const DEFAULT_MULTIPLAYER_ROOM_SNAPSHOT_INTERVAL_MS = 33;

export function createMultiplayerRoomWebSocketGateway({
  maxPayload = DEFAULT_MULTIPLAYER_ROOM_MAX_PAYLOAD_BYTES,
  snapshotIntervalMs = DEFAULT_MULTIPLAYER_ROOM_SNAPSHOT_INTERVAL_MS,
  store = new InProcessMultiplayerRoomStore(),
  ...webSocketOptions
}: CreateMultiplayerRoomWebSocketGatewayOptions = {}): MultiplayerRoomWebSocketGateway {
  const webSocketServerOptions = {
    ...webSocketOptions,
    maxPayload,
  };
  const webSocketServer = new WebSocketServer(
    needsNoServerDefault(webSocketServerOptions)
      ? {
          ...webSocketServerOptions,
          noServer: true,
        }
      : webSocketServerOptions,
  );
  const roomCodeBySocket = new Map<WebSocket, string>();
  const participantIdBySocket = new Map<WebSocket, string>();
  const socketsByRoomCode = new Map<string, Set<WebSocket>>();
  const participantConnectionStore = isMultiplayerRoomParticipantConnectionStore(
    store,
  )
    ? store
    : null;
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
    const participantId = participantIdBySocket.get(socket);

    if (roomCode === undefined) {
      return;
    }

    roomCodeBySocket.delete(socket);
    participantIdBySocket.delete(socket);

    if (participantId !== undefined) {
      participantConnectionStore?.unregisterParticipantConnection(
        roomCode,
        participantId,
      );
    }

    const sockets = socketsByRoomCode.get(roomCode);

    if (sockets === undefined) {
      return;
    }

    sockets.delete(socket);

    if (sockets.size === 0) {
      socketsByRoomCode.delete(roomCode);
      activeSnapshotRoomCodes.delete(roomCode);
      lastBroadcastCursorByRoomCode.delete(roomCode);
    }
  }

  function assignSocketToRoom(
    socket: WebSocket,
    roomCode: string,
    participantId?: string,
    participantCapability?: string,
  ): SocketRoomAssignmentResult {
    if (socket.readyState !== WebSocket.OPEN) {
      return "socket-closed";
    }

    let resolvedParticipantId: string | undefined;

    if (participantCapability !== undefined) {
      const resolvedParticipant =
        participantConnectionStore?.resolveParticipantCapability(
          roomCode,
          participantCapability,
        ) ?? null;

      if (
        resolvedParticipant === null ||
        (participantId !== undefined && participantId !== resolvedParticipant)
      ) {
        return "participant-rejected";
      }

      resolvedParticipantId = resolvedParticipant;
    } else if (participantId !== undefined) {
      return "participant-rejected";
    }

    if (
      roomCodeBySocket.get(socket) === roomCode &&
      participantIdBySocket.get(socket) === resolvedParticipantId
    ) {
      return "assigned";
    }

    removeSocketFromRoom(socket);

    if (
      resolvedParticipantId !== undefined &&
      participantConnectionStore !== null &&
      !participantConnectionStore.registerParticipantConnection(
        roomCode,
        resolvedParticipantId,
      )
    ) {
      return "participant-rejected";
    }

    roomCodeBySocket.set(socket, roomCode);

    const sockets = socketsByRoomCode.get(roomCode) ?? new Set<WebSocket>();

    sockets.add(socket);
    socketsByRoomCode.set(roomCode, sockets);

    if (resolvedParticipantId !== undefined) {
      participantIdBySocket.set(socket, resolvedParticipantId);
    }

    return "assigned";
  }

  function broadcastSnapshot(snapshot: MultiplayerRoomSnapshot) {
    const roomCode = snapshot.room.code;
    const sockets = socketsByRoomCode.get(roomCode);

    if (sockets === undefined || sockets.size === 0) {
      socketsByRoomCode.delete(roomCode);
      activeSnapshotRoomCodes.delete(roomCode);
      lastBroadcastCursorByRoomCode.delete(roomCode);
      return;
    }

    rememberBroadcastSnapshot(snapshot);

    const message = {
      roomCode,
      snapshot: createBroadcastSnapshot(snapshot),
      type: "room.snapshot",
    } satisfies MultiplayerRealtimeServerMessage<MultiplayerRoomGameSnapshot>;

    for (const socket of sockets) {
      sendServerMessage(socket, message);
    }
  }

  async function handleStoreResult(
    socket: WebSocket,
    result: MultiplayerRoomStoreResult,
    requestId: string | undefined,
    roomCode: string | undefined,
    command: MultiplayerRoomStoreCommand,
    promoteParticipant = false,
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

    const assignmentResult = promoteParticipant
      ? assignSocketToRoom(
          socket,
          result.snapshot.room.code,
          result.snapshot.participant?.id,
          result.participantCapability,
        )
      : "assigned";

    if (assignmentResult === "participant-rejected") {
      await rejectFailedParticipantAssignment(
        socket,
        result.snapshot.room.code,
        requestId,
      );
      return;
    }

    if (assignmentResult === "assigned") {
      sendAck(
        socket,
        result.snapshot,
        requestId,
        result.snapshot.participant?.id ??
          participantIdBySocket.get(socket) ??
          getCommandParticipantId(command),
        result.participantCapability,
      );
    }

    broadcastSnapshot(result.snapshot);
  }

  async function handleConnectionBootstrap(
    socket: WebSocket,
    message: ConnectionMessage,
  ) {
    const requestId = getOptionalString(message.requestId);
    const roomCode = getOptionalString(message.roomCode);

    if (message.protocolVersion !== MULTIPLAYER_ROOM_PROTOCOL_VERSION) {
      sendRejection(socket, {
        code: "protocol-version-mismatch",
        error: PROTOCOL_VERSION_MISMATCH_ERROR,
        requestId,
        ...(roomCode === undefined ? {} : { roomCode }),
      });
      return;
    }

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

    const requestedParticipantId = getOptionalString(message.participantId);
    const participantCapability = getOptionalString(
      message.participantCapability,
    );

    const assignmentResult = assignSocketToRoom(
      socket,
      result.snapshot.room.code,
      requestedParticipantId,
      participantCapability,
    );

    if (assignmentResult === "socket-closed") {
      return;
    }

    if (assignmentResult === "participant-rejected") {
      await rejectFailedParticipantAssignment(
        socket,
        result.snapshot.room.code,
        requestId,
      );
      return;
    }

    const recognizedParticipantId = participantIdBySocket.get(socket);
    const snapshot = createConnectionSnapshot(
      result.snapshot,
      recognizedParticipantId,
    );

    rememberBroadcastSnapshot(result.snapshot);
    sendServerMessage(socket, {
      ...(requestId === undefined ? {} : { requestId }),
      protocolVersion: MULTIPLAYER_ROOM_PROTOCOL_VERSION,
      roomCode: result.snapshot.room.code,
      snapshot,
      type: "connection.bootstrap",
    });
  }

  async function handleRoomCommand(socket: WebSocket, message: RoomCommandMessage) {
    const requestId = getRoomCommandRequestId(message);
    const roomCode = getOptionalString(message.roomCode);
    const assignedRoomCode = roomCodeBySocket.get(socket);

    if (assignedRoomCode === undefined || roomCode !== assignedRoomCode) {
      sendRejection(socket, {
        code: "invalid-message",
        error: "Room command must target the bootstrapped room.",
        requestId,
        roomCode,
      });
      return;
    }

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

    if (parsedCommand.command.type === "room.joinObserver") {
      if (participantIdBySocket.has(socket)) {
        sendRejection(socket, {
          code: "invalid-command",
          error: "This connection has already joined the room.",
          requestId,
          roomCode: assignedRoomCode,
        });
        return;
      }

      await handleStoreResult(
        socket,
        await store.applyCommand(assignedRoomCode, parsedCommand.command),
        requestId,
        assignedRoomCode,
        parsedCommand.command,
        true,
      );
      return;
    }

    const boundParticipantId = participantIdBySocket.get(socket);

    if (
      boundParticipantId === undefined ||
      !doesSubmittedParticipantMatch(
        parsedCommand.command,
        boundParticipantId,
      )
    ) {
      sendRejection(socket, {
        code: "participant-unauthorized",
        error: PARTICIPANT_UNAUTHORIZED_ERROR,
        requestId,
        roomCode: assignedRoomCode,
      });
      return;
    }

    const boundCommand = bindCommandParticipant(
      parsedCommand.command,
      boundParticipantId,
    );

    await handleStoreResult(
      socket,
      await store.applyCommand(assignedRoomCode, boundCommand),
      requestId,
      assignedRoomCode,
      boundCommand,
    );
  }

  async function handleGameInput(socket: WebSocket, message: GameInputMessage) {
    const requestId = getOptionalString(message.requestId);
    const roomCode = getOptionalString(message.roomCode);
    const assignedRoomCode = roomCodeBySocket.get(socket);
    const boundParticipantId = participantIdBySocket.get(socket);

    if (
      assignedRoomCode === undefined ||
      roomCode !== assignedRoomCode
    ) {
      sendRejection(socket, {
        code: "invalid-message",
        error: "Game input must target the bootstrapped room.",
        requestId,
        roomCode,
      });
      return;
    }

    if (
      boundParticipantId === undefined ||
      getOptionalString(message.participantId) !== boundParticipantId
    ) {
      sendRejection(socket, {
        code: "participant-unauthorized",
        error: PARTICIPANT_UNAUTHORIZED_ERROR,
        requestId,
        roomCode: assignedRoomCode,
      });
      return;
    }

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
      participantId: boundParticipantId,
      type: "game.input",
    } satisfies GameInputStoreCommand;

    await handleStoreResult(
      socket,
      await store.applyCommand(assignedRoomCode, command),
      requestId,
      assignedRoomCode,
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
    socket.on("error", () => {
      // ws reports receiver protocol errors, including oversized payloads,
      // before it completes the close handshake with the client.
      removeSocketFromRoom(socket);
    });
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
    getTrackedRoomCounts: () => ({
      activeSnapshotRooms: activeSnapshotRoomCodes.size,
      broadcastCursors: lastBroadcastCursorByRoomCode.size,
      subscribedRooms: socketsByRoomCode.size,
    }),
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
          lastBroadcastCursorByRoomCode.delete(roomCode);
          continue;
        }

        const result = await store.getRoom(roomCode);

        if (!result.success) {
          if (isDefinitiveRoomLookupFailure(result)) {
            rejectAndDetachRoomSubscribers(roomCode, result);
          }

          continue;
        }

        if (!isFreshBroadcastSnapshot(result.snapshot)) {
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

  async function rejectFailedParticipantAssignment(
    socket: WebSocket,
    roomCode: string,
    requestId: string | undefined,
  ) {
    if (socket.readyState !== WebSocket.OPEN) {
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

    sendRejection(socket, {
      code: "participant-unauthorized",
      error: PARTICIPANT_UNAUTHORIZED_ERROR,
      requestId,
      roomCode,
    });
  }

  function rejectAndDetachRoomSubscribers(
    roomCode: string,
    result: Extract<MultiplayerRoomStoreResult, { success: false }>,
  ) {
    const sockets = Array.from(socketsByRoomCode.get(roomCode) ?? []);

    activeSnapshotRoomCodes.delete(roomCode);
    lastBroadcastCursorByRoomCode.delete(roomCode);

    for (const socket of sockets) {
      sendRejection(socket, {
        code: result.code,
        error: result.error,
        roomCode,
      });
      removeSocketFromRoom(socket);
    }
  }
}

function isDefinitiveRoomLookupFailure(
  result: Extract<MultiplayerRoomStoreResult, { success: false }>,
) {
  return result.code === "room-expired" || result.code === "room-not-found";
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
  participantCapability: string | undefined,
) {
  sendServerMessage(socket, {
    ...(snapshot.game === undefined ? {} : { gameSeq: snapshot.game.seq }),
    ...(participantCapability === undefined
      ? {}
      : { participantCapability }),
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
    code === "room-capacity-reached" ||
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

function doesSubmittedParticipantMatch(
  command: MultiplayerRoomStoreCommand,
  participantId: string,
) {
  return (
    !("participantId" in command) ||
    getOptionalString(command.participantId) === participantId
  );
}

function bindCommandParticipant(
  command: Exclude<
    MultiplayerRoomStoreCommand,
    { type: "room.joinObserver" }
  >,
  participantId: string,
): MultiplayerRoomStoreCommand {
  return {
    ...command,
    participantId,
  };
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
