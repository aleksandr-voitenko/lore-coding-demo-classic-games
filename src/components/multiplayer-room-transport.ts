import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { GameId } from "@/lib/game-catalog";
import type {
  MultiplayerGameInputPayload,
  MultiplayerRealtimeConnectionCursor,
  MultiplayerRealtimeConnectionMessage,
  MultiplayerRealtimeGameInputMessage,
  MultiplayerRealtimeRejectionCode,
  MultiplayerRealtimeRoomCommandMessage,
  MultiplayerRealtimeRoomSnapshot,
  MultiplayerRealtimeServerMessage,
  MultiplayerRoomGameSnapshot,
  PrivateRoomCommandMessage,
} from "@/lib/multiplayer/protocol";
import type { PrivateRoom } from "@/lib/multiplayer/room";

const OPEN_WEBSOCKET_READY_STATE = 1;
const DEFAULT_RECONNECT_DELAY_MS = 500;
const DEFAULT_DIAGNOSTICS_PING_INTERVAL_MS = 1_000;

export type MultiplayerRoomWebSocketEventMap = {
  close: CloseEvent;
  error: Event;
  message: MessageEvent<unknown>;
  open: Event;
};

export type MultiplayerRoomTransportStatus =
  | "active"
  | "connecting"
  | "reconnecting"
  | "unavailable"
  | "unconfigured";

export type MultiplayerRoomTransportSnapshot = {
  game?: MultiplayerRoomGameSnapshot;
  participantId?: string;
  room: PrivateRoom;
  seq: number;
};

export type MultiplayerRoomTransportAck = {
  gameSeq?: number;
  participantId?: string;
  seq: number;
};

export type MultiplayerRoomTransportPingSample = {
  clientTimeMs: number;
  receivedAtMs: number;
  requestId?: string;
  roomCode?: string;
  roundTripMs: number;
  serverTimeMs: number;
};

export type MultiplayerRoomWebSocketLike = {
  readonly readyState: number;
  addEventListener<EventName extends keyof MultiplayerRoomWebSocketEventMap>(
    eventName: EventName,
    listener: (event: MultiplayerRoomWebSocketEventMap[EventName]) => void,
  ): void;
  close(): void;
  removeEventListener<EventName extends keyof MultiplayerRoomWebSocketEventMap>(
    eventName: EventName,
    listener: (event: MultiplayerRoomWebSocketEventMap[EventName]) => void,
  ): void;
  send(data: string): void;
};

export type MultiplayerRoomWebSocketConstructor = new (
  url: string,
) => MultiplayerRoomWebSocketLike;

type PendingTransportRequest = {
  reject: (error: MultiplayerRoomTransportError) => void;
  resolve: (ack: MultiplayerRoomTransportAck) => void;
};

type CreateConnectionMessageOptions = {
  displayName?: string | null;
  lastSeq?: MultiplayerRealtimeConnectionCursor | null;
  participantId?: string | null;
  requestId?: string;
  roomCode: string;
};

type CreateWebSocketTransportOptions = {
  displayName?: string | null;
  lastSeq?: MultiplayerRealtimeConnectionCursor | null;
  onBootstrap: (snapshot: MultiplayerRoomTransportSnapshot) => void;
  onBootstrapRejected?: (error: MultiplayerRoomTransportError) => void;
  onClose?: () => void;
  onDiagnosticsPingSample?: (sample: MultiplayerRoomTransportPingSample) => void;
  onError?: (error: MultiplayerRoomTransportError) => void;
  onParticipantId?: (participantId: string) => void;
  onSnapshot: (snapshot: MultiplayerRoomTransportSnapshot) => void;
  participantId?: string | null;
  roomCode: string;
  url: string;
  webSocketConstructor?: MultiplayerRoomWebSocketConstructor | null;
};

type UseMultiplayerRoomWebSocketTransportOptions = {
  diagnosticsEnabled?: boolean;
  diagnosticsPingIntervalMs?: number;
  displayName?: string | null;
  enabled: boolean;
  lastSeq?: MultiplayerRealtimeConnectionCursor | null;
  onConnectionError?: (error: MultiplayerRoomTransportError) => void;
  onDiagnosticsPingSample?: (sample: MultiplayerRoomTransportPingSample) => void;
  onParticipantId?: (participantId: string) => void;
  onSnapshot: (snapshot: MultiplayerRoomTransportSnapshot) => void;
  participantId?: string | null;
  reconnectDelayMs?: number;
  roomCode: string | null;
  webSocketConstructor?: MultiplayerRoomWebSocketConstructor | null;
  webSocketUrl?: string | null;
};

type UseMultiplayerRoomWebSocketTransportResult = {
  sendGameInput: <Game extends GameId, Input = MultiplayerGameInputPayload<Game>>(
    gameId: Game,
    input: Input,
    participantId: string,
  ) => Promise<MultiplayerRoomTransportAck>;
  sendRoomCommand: (
    command: PrivateRoomCommandMessage,
  ) => Promise<MultiplayerRoomTransportAck>;
  status: MultiplayerRoomTransportStatus;
};

let nextRequestId = 0;

export class MultiplayerRoomTransportError extends Error {
  readonly code?: MultiplayerRealtimeRejectionCode;

  constructor(
    message: string,
    options: { code?: MultiplayerRealtimeRejectionCode } = {},
  ) {
    super(message);
    this.name = "MultiplayerRoomTransportError";

    if (options.code !== undefined) {
      this.code = options.code;
    }
  }
}

export function resolveMultiplayerRoomWebSocketUrl(
  configuredUrl: string | null | undefined,
  origin: string | null,
) {
  const trimmedUrl = configuredUrl?.trim();

  if (trimmedUrl === undefined || trimmedUrl.length === 0) {
    return null;
  }

  try {
    const parsedUrl =
      isAbsoluteWebSocketOrHttpUrl(trimmedUrl)
        ? new URL(trimmedUrl)
        : trimmedUrl.startsWith("/") && origin !== null
          ? new URL(trimmedUrl, origin)
          : null;

    if (parsedUrl === null) {
      return null;
    }

    if (parsedUrl.protocol === "http:") {
      parsedUrl.protocol = "ws:";
    } else if (parsedUrl.protocol === "https:") {
      parsedUrl.protocol = "wss:";
    }

    if (parsedUrl.protocol !== "ws:" && parsedUrl.protocol !== "wss:") {
      return null;
    }

    return parsedUrl.toString();
  } catch {
    return null;
  }
}

export function getConfiguredMultiplayerRoomWebSocketUrl(
  configuredUrl = process.env.NEXT_PUBLIC_MULTIPLAYER_WEBSOCKET_URL,
) {
  return resolveMultiplayerRoomWebSocketUrl(configuredUrl, getBrowserOrigin());
}

export function createMultiplayerRoomConnectionMessage({
  displayName,
  lastSeq,
  participantId,
  requestId,
  roomCode,
}: CreateConnectionMessageOptions): MultiplayerRealtimeConnectionMessage {
  const normalizedDisplayName = getOptionalNonEmptyString(displayName);
  const normalizedParticipantId = getOptionalNonEmptyString(participantId);
  const normalizedLastSeq = normalizeConnectionCursor(lastSeq);
  const sharedFields = {
    ...(normalizedDisplayName === undefined
      ? {}
      : { displayName: normalizedDisplayName }),
    ...(normalizedParticipantId === undefined
      ? {}
      : { participantId: normalizedParticipantId }),
    ...(requestId === undefined ? {} : { requestId }),
    roomCode,
  };

  if (normalizedParticipantId !== undefined || normalizedLastSeq !== undefined) {
    return {
      ...sharedFields,
      ...(normalizedLastSeq === undefined ? {} : { lastSeq: normalizedLastSeq }),
      type: "connection.resume",
    };
  }

  return {
    ...sharedFields,
    type: "connection.hello",
  };
}

export function createMultiplayerRoomCommandMessage(
  roomCode: string,
  command: PrivateRoomCommandMessage,
  requestId?: string,
): MultiplayerRealtimeRoomCommandMessage {
  return {
    command,
    ...(requestId === undefined ? {} : { requestId }),
    roomCode,
    type: "room.command",
  };
}

export function createMultiplayerRoomGameInputMessage<
  Game extends GameId,
  Input = MultiplayerGameInputPayload<Game>,
>({
  gameId,
  input,
  participantId,
  requestId,
  roomCode,
}: {
  gameId: Game;
  input: Input;
  participantId: string;
  requestId?: string;
  roomCode: string;
}): MultiplayerRealtimeGameInputMessage<Game, Input> {
  return {
    gameId,
    input,
    participantId,
    ...(requestId === undefined ? {} : { requestId }),
    roomCode,
    type: "game.input",
  };
}

export function createMultiplayerRoomDiagnosticsPingMessage(
  roomCode: string,
  requestId: string,
  clientTimeMs: number,
): MultiplayerRealtimeConnectionMessage {
  return {
    clientTimeMs,
    requestId,
    roomCode,
    type: "connection.ping",
  };
}

export function createMultiplayerRoomWebSocketTransport({
  displayName,
  lastSeq,
  onBootstrap,
  onBootstrapRejected,
  onClose,
  onDiagnosticsPingSample,
  onError,
  onParticipantId,
  onSnapshot,
  participantId,
  roomCode,
  url,
  webSocketConstructor = getBrowserWebSocketConstructor(),
}: CreateWebSocketTransportOptions) {
  if (webSocketConstructor === null) {
    throw new MultiplayerRoomTransportError("WebSocket is not available.");
  }

  const socket = new webSocketConstructor(url);
  const pendingRequests = new Map<string, PendingTransportRequest>();
  const connectionRequestId = createMultiplayerRoomRequestId("connection");
  let hasBootstrapped = false;
  let isClosedByClient = false;

  function rejectPendingRequests(message: string) {
    const error = new MultiplayerRoomTransportError(message);

    for (const pendingRequest of pendingRequests.values()) {
      pendingRequest.reject(error);
    }

    pendingRequests.clear();
  }

  function sendMessage(message: MultiplayerRealtimeConnectionMessage): void;
  function sendMessage(message: MultiplayerRealtimeRoomCommandMessage): void;
  function sendMessage<Game extends GameId, Input>(
    message: MultiplayerRealtimeGameInputMessage<Game, Input>,
  ): void;
  function sendMessage(message: unknown) {
    if (socket.readyState !== OPEN_WEBSOCKET_READY_STATE) {
      throw new MultiplayerRoomTransportError("Room stream is not connected.");
    }

    socket.send(JSON.stringify(message));
  }

  function handleOpen() {
    try {
      sendMessage(
        createMultiplayerRoomConnectionMessage({
          displayName,
          lastSeq,
          participantId,
          requestId: connectionRequestId,
          roomCode,
        }),
      );
    } catch (error) {
      const transportError = toTransportError(error);

      onBootstrapRejected?.(transportError);
      close();
    }
  }

  function handleMessage(event: MessageEvent<unknown>) {
    const message = parseServerMessage(event.data);

    if (message === null) {
      onError?.(
        new MultiplayerRoomTransportError(
          "Room stream sent an unsupported message.",
        ),
      );
      return;
    }

    if (message.type === "connection.bootstrap") {
      const snapshot = createTransportSnapshot(message.snapshot);

      hasBootstrapped = true;
      notifyParticipantId(snapshot.participantId);
      onBootstrap(snapshot);
      return;
    }

    if (message.type === "room.snapshot") {
      onSnapshot(createTransportSnapshot(message.snapshot));
      return;
    }

    if (message.type === "room.commandAck") {
      notifyParticipantId(message.participantId);
      resolvePendingRequest(message.requestId, {
        ...(message.gameSeq === undefined ? {} : { gameSeq: message.gameSeq }),
        ...(message.participantId === undefined
          ? {}
          : { participantId: message.participantId }),
        seq: message.seq,
      });
      return;
    }

    if (message.type === "room.commandRejected") {
      const error = new MultiplayerRoomTransportError(message.error, {
        code: message.code,
      });

      if (!hasBootstrapped && message.requestId === connectionRequestId) {
        onBootstrapRejected?.(error);
        close();
        return;
      }

      rejectPendingRequest(message.requestId, error);
      return;
    }

    if (message.type === "connection.pong") {
      const receivedAtMs = getTransportNowMs();

      onDiagnosticsPingSample?.({
        clientTimeMs: message.clientTimeMs,
        receivedAtMs,
        ...(message.requestId === undefined ? {} : { requestId: message.requestId }),
        ...(message.roomCode === undefined ? {} : { roomCode: message.roomCode }),
        roundTripMs: Math.max(0, receivedAtMs - message.clientTimeMs),
        serverTimeMs: message.serverTimeMs,
      });
      return;
    }

    if (message.type === "connection.ping") {
      try {
        sendMessage({
          ...(message.nonce === undefined ? {} : { nonce: message.nonce }),
          clientTimeMs: Date.now(),
          roomCode,
          type: "connection.pong",
        });
      } catch (error) {
        onError?.(toTransportError(error));
      }
    }
  }

  function handleError() {
    onError?.(new MultiplayerRoomTransportError("Room stream connection failed."));
  }

  function handleClose() {
    cleanup();
    rejectPendingRequests("Room stream closed.");

    if (!isClosedByClient) {
      onClose?.();
    }
  }

  function resolvePendingRequest(
    requestId: string | undefined,
    ack: MultiplayerRoomTransportAck,
  ) {
    if (requestId === undefined) {
      return;
    }

    const pendingRequest = pendingRequests.get(requestId);

    if (pendingRequest === undefined) {
      return;
    }

    pendingRequests.delete(requestId);
    pendingRequest.resolve(ack);
  }

  function rejectPendingRequest(
    requestId: string | undefined,
    error: MultiplayerRoomTransportError,
  ) {
    if (requestId === undefined) {
      onError?.(error);
      return;
    }

    const pendingRequest = pendingRequests.get(requestId);

    if (pendingRequest === undefined) {
      onError?.(error);
      return;
    }

    pendingRequests.delete(requestId);
    pendingRequest.reject(error);
  }

  function notifyParticipantId(nextParticipantId: string | undefined) {
    if (nextParticipantId !== undefined) {
      onParticipantId?.(nextParticipantId);
    }
  }

  function cleanup() {
    socket.removeEventListener("open", handleOpen);
    socket.removeEventListener("message", handleMessage);
    socket.removeEventListener("error", handleError);
    socket.removeEventListener("close", handleClose);
  }

  function sendRoomCommand(command: PrivateRoomCommandMessage) {
    const requestId = command.requestId ?? createMultiplayerRoomRequestId("room");

    return sendPendingRequest(requestId, () => {
      sendMessage(createMultiplayerRoomCommandMessage(roomCode, command, requestId));
    });
  }

  function sendGameInput<
    Game extends GameId,
    Input = MultiplayerGameInputPayload<Game>,
  >(gameId: Game, input: Input, nextParticipantId: string) {
    const requestId = createMultiplayerRoomRequestId("game");

    return sendPendingRequest(requestId, () => {
      sendMessage(
        createMultiplayerRoomGameInputMessage({
          gameId,
          input,
          participantId: nextParticipantId,
          requestId,
          roomCode,
        }),
      );
    });
  }

  function sendDiagnosticsPing() {
    const requestId = createMultiplayerRoomRequestId("diagnostics");

    sendMessage(
      createMultiplayerRoomDiagnosticsPingMessage(
        roomCode,
        requestId,
        getTransportNowMs(),
      ),
    );
  }

  function sendPendingRequest(
    requestId: string,
    sendRequest: () => void,
  ): Promise<MultiplayerRoomTransportAck> {
    return new Promise((resolve, reject) => {
      pendingRequests.set(requestId, { reject, resolve });

      try {
        sendRequest();
      } catch (error) {
        pendingRequests.delete(requestId);
        reject(toTransportError(error));
      }
    });
  }

  function close() {
    isClosedByClient = true;
    cleanup();
    rejectPendingRequests("Room stream closed.");

    if (socket.readyState === 0 || socket.readyState === OPEN_WEBSOCKET_READY_STATE) {
      socket.close();
    }
  }

  socket.addEventListener("open", handleOpen);
  socket.addEventListener("message", handleMessage);
  socket.addEventListener("error", handleError);
  socket.addEventListener("close", handleClose);

  return {
    close,
    sendDiagnosticsPing,
    sendGameInput,
    sendRoomCommand,
    socket,
  };
}

export function useMultiplayerRoomWebSocketTransport({
  diagnosticsEnabled = false,
  diagnosticsPingIntervalMs = DEFAULT_DIAGNOSTICS_PING_INTERVAL_MS,
  displayName,
  enabled,
  lastSeq,
  onConnectionError,
  onDiagnosticsPingSample,
  onParticipantId,
  onSnapshot,
  participantId,
  reconnectDelayMs = DEFAULT_RECONNECT_DELAY_MS,
  roomCode,
  webSocketConstructor,
  webSocketUrl,
}: UseMultiplayerRoomWebSocketTransportOptions): UseMultiplayerRoomWebSocketTransportResult {
  const [status, setStatusState] =
    useState<MultiplayerRoomTransportStatus>("unconfigured");
  const statusRef = useRef<MultiplayerRoomTransportStatus>("unconfigured");
  const latestOptionsRef = useRef({
    displayName,
    lastSeq,
    onConnectionError,
    onDiagnosticsPingSample,
    onParticipantId,
    onSnapshot,
    participantId,
  });
  const transportRef = useRef<ReturnType<
    typeof createMultiplayerRoomWebSocketTransport
  > | null>(null);
  const hasBootstrappedRef = useRef(false);

  useEffect(() => {
    latestOptionsRef.current = {
      displayName,
      lastSeq,
      onConnectionError,
      onDiagnosticsPingSample,
      onParticipantId,
      onSnapshot,
      participantId,
    };
  }, [
    displayName,
    lastSeq,
    onConnectionError,
    onDiagnosticsPingSample,
    onParticipantId,
    onSnapshot,
    participantId,
  ]);

  const setStatus = useCallback((nextStatus: MultiplayerRoomTransportStatus) => {
    statusRef.current = nextStatus;
    setStatusState(nextStatus);
  }, []);

  useEffect(() => {
    let isCurrent = true;
    const resolvedUrl =
      webSocketUrl === undefined
        ? getConfiguredMultiplayerRoomWebSocketUrl()
        : webSocketUrl;
    const ResolvedWebSocket =
      webSocketConstructor === undefined
        ? getBrowserWebSocketConstructor()
        : webSocketConstructor;

    if (!enabled || roomCode === null) {
      hasBootstrappedRef.current = false;
      queueStatusUpdate("unconfigured");
      return () => {
        isCurrent = false;
      };
    }

    if (resolvedUrl === null) {
      hasBootstrappedRef.current = false;
      queueStatusUpdate("unconfigured");
      latestOptionsRef.current.onConnectionError?.(
        new MultiplayerRoomTransportError("Room stream is not configured."),
      );
      return () => {
        isCurrent = false;
      };
    }

    if (ResolvedWebSocket === null) {
      hasBootstrappedRef.current = false;
      queueStatusUpdate("unavailable");
      latestOptionsRef.current.onConnectionError?.(
        new MultiplayerRoomTransportError("Room stream is unavailable."),
      );
      return () => {
        isCurrent = false;
      };
    }

    const activeRoomCode = roomCode;
    const activeUrl = resolvedUrl;
    let reconnectTimeoutId: number | null = null;

    function queueStatusUpdate(nextStatus: MultiplayerRoomTransportStatus) {
      queueMicrotask(() => {
        if (isCurrent) {
          setStatus(nextStatus);
        }
      });
    }

    function clearReconnectTimeout() {
      if (reconnectTimeoutId !== null) {
        window.clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = null;
      }
    }

    function connect(isReconnect: boolean) {
      clearReconnectTimeout();
      transportRef.current?.close();
      setStatus(isReconnect ? "reconnecting" : "connecting");

      let connectionBootstrapped = false;
      let selectedUnavailable = false;
      const latestOptions = latestOptionsRef.current;

      try {
        transportRef.current = createMultiplayerRoomWebSocketTransport({
          displayName: latestOptions.displayName,
          lastSeq: latestOptions.lastSeq,
          onBootstrap: (snapshot) => {
            if (!isCurrent) {
              return;
            }

            connectionBootstrapped = true;
            hasBootstrappedRef.current = true;
            setStatus("active");
            latestOptionsRef.current.onSnapshot(snapshot);
          },
          onBootstrapRejected: (error) => {
            if (!isCurrent) {
              return;
            }

            selectedUnavailable = true;
            hasBootstrappedRef.current = false;
            setStatus("unavailable");
            latestOptionsRef.current.onConnectionError?.(error);
          },
          onClose: () => {
            if (!isCurrent || selectedUnavailable) {
              return;
            }

            transportRef.current = null;

            if (!connectionBootstrapped && !hasBootstrappedRef.current) {
              setStatus("unavailable");
              return;
            }

            setStatus("reconnecting");
            reconnectTimeoutId = window.setTimeout(() => {
              connect(true);
            }, reconnectDelayMs);
          },
          onError: (error) => {
            if (isCurrent) {
              latestOptionsRef.current.onConnectionError?.(error);
            }
          },
          onDiagnosticsPingSample: (sample) => {
            if (isCurrent) {
              latestOptionsRef.current.onDiagnosticsPingSample?.(sample);
            }
          },
          onParticipantId: (nextParticipantId) => {
            if (isCurrent) {
              latestOptionsRef.current.onParticipantId?.(nextParticipantId);
            }
          },
          onSnapshot: (snapshot) => {
            if (isCurrent) {
              latestOptionsRef.current.onSnapshot(snapshot);
            }
          },
          participantId: latestOptions.participantId,
          roomCode: activeRoomCode,
          url: activeUrl,
          webSocketConstructor: ResolvedWebSocket,
        });
      } catch (error) {
        hasBootstrappedRef.current = false;
        setStatus("unavailable");
        latestOptionsRef.current.onConnectionError?.(toTransportError(error));
      }
    }

    function reconnectNow() {
      if (
        !hasBootstrappedRef.current ||
        (statusRef.current !== "reconnecting" &&
          statusRef.current !== "connecting")
      ) {
        return;
      }

      connect(true);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        reconnectNow();
      }
    }

    connect(false);
    window.addEventListener("focus", reconnectNow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isCurrent = false;
      clearReconnectTimeout();
      window.removeEventListener("focus", reconnectNow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      transportRef.current?.close();
      transportRef.current = null;
    };
  }, [
    enabled,
    reconnectDelayMs,
    roomCode,
    setStatus,
    webSocketConstructor,
    webSocketUrl,
  ]);

  useEffect(() => {
    if (
      !enabled ||
      !diagnosticsEnabled ||
      roomCode === null ||
      status !== "active" ||
      typeof window === "undefined"
    ) {
      return;
    }

    function sendDiagnosticsPing() {
      try {
        transportRef.current?.sendDiagnosticsPing();
      } catch (error) {
        latestOptionsRef.current.onConnectionError?.(toTransportError(error));
      }
    }

    sendDiagnosticsPing();
    const pingIntervalId = window.setInterval(
      sendDiagnosticsPing,
      diagnosticsPingIntervalMs,
    );

    return () => {
      window.clearInterval(pingIntervalId);
    };
  }, [
    diagnosticsEnabled,
    diagnosticsPingIntervalMs,
    enabled,
    roomCode,
    status,
  ]);

  const sendRoomCommand = useCallback(
    (command: PrivateRoomCommandMessage) => {
      const transport = transportRef.current;

      if (statusRef.current !== "active" || transport === null) {
        return Promise.reject(
          new MultiplayerRoomTransportError("Room stream is not connected."),
        );
      }

      return transport.sendRoomCommand(command);
    },
    [],
  );

  const sendGameInput = useCallback(
    <Game extends GameId, Input = MultiplayerGameInputPayload<Game>>(
      gameId: Game,
      input: Input,
      nextParticipantId: string,
    ) => {
      const transport = transportRef.current;

      if (statusRef.current !== "active" || transport === null) {
        return Promise.reject(
          new MultiplayerRoomTransportError("Room stream is not connected."),
        );
      }

      return transport.sendGameInput(gameId, input, nextParticipantId);
    },
    [],
  );

  return {
    sendGameInput,
    sendRoomCommand,
    status,
  };
}

function isAbsoluteWebSocketOrHttpUrl(url: string) {
  return /^(?:wss?|https?):\/\//i.test(url);
}

function getBrowserOrigin() {
  return typeof window === "undefined" ? null : window.location.origin;
}

function getBrowserWebSocketConstructor() {
  return typeof WebSocket === "undefined" ? null : WebSocket;
}

function getTransportNowMs() {
  return Date.now();
}

function createMultiplayerRoomRequestId(prefix: string) {
  nextRequestId += 1;
  return `${prefix}-${nextRequestId}`;
}

function getOptionalNonEmptyString(value: string | null | undefined) {
  const trimmedValue = value?.trim();

  return trimmedValue === undefined || trimmedValue.length === 0
    ? undefined
    : trimmedValue;
}

function normalizeConnectionCursor(
  cursor: MultiplayerRealtimeConnectionCursor | null | undefined,
) {
  if (cursor === null || cursor === undefined) {
    return undefined;
  }

  const room = typeof cursor.room === "number" ? cursor.room : undefined;
  const game = typeof cursor.game === "number" ? cursor.game : undefined;

  if (room === undefined && game === undefined) {
    return undefined;
  }

  return {
    ...(game === undefined ? {} : { game }),
    ...(room === undefined ? {} : { room }),
  } satisfies MultiplayerRealtimeConnectionCursor;
}

function parseServerMessage(
  data: unknown,
): MultiplayerRealtimeServerMessage<MultiplayerRoomGameSnapshot> | null {
  if (typeof data !== "string") {
    return null;
  }

  try {
    const parsedMessage = JSON.parse(data) as unknown;

    return isServerMessage(parsedMessage) ? parsedMessage : null;
  } catch {
    return null;
  }
}

function isServerMessage(
  value: unknown,
): value is MultiplayerRealtimeServerMessage<MultiplayerRoomGameSnapshot> {
  return typeof value === "object" && value !== null && "type" in value;
}

function createTransportSnapshot(
  snapshot: MultiplayerRealtimeRoomSnapshot<MultiplayerRoomGameSnapshot>,
): MultiplayerRoomTransportSnapshot {
  return {
    ...(snapshot.game === undefined ? {} : { game: snapshot.game }),
    ...(snapshot.participant === undefined
      ? {}
      : { participantId: snapshot.participant.id }),
    room: snapshot.room,
    seq: snapshot.seq,
  };
}

function toTransportError(error: unknown) {
  return error instanceof MultiplayerRoomTransportError
    ? error
    : new MultiplayerRoomTransportError(
        error instanceof Error ? error.message : "Room stream request failed.",
      );
}
