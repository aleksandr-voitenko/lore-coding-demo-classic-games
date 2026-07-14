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
  PrivateRoomCommandMessage,
} from "@/lib/multiplayer/protocol";

import {
  MultiplayerRoomTransportError,
  createMultiplayerRoomWebSocketTransport,
  getConfiguredMultiplayerRoomWebSocketUrl,
  type MultiplayerRoomTransportAck,
  type MultiplayerRoomTransportPingSample,
  type MultiplayerRoomTransportSnapshot,
  type MultiplayerRoomTransportStatus,
  type MultiplayerRoomWebSocketConstructor,
} from "./multiplayer-room-websocket-transport";

const DEFAULT_RECONNECT_DELAY_MS = 500;
const DEFAULT_BOOTSTRAP_TIMEOUT_MS = 5_000;
const DEFAULT_COMMAND_ACK_TIMEOUT_MS = 5_000;
const DEFAULT_DIAGNOSTICS_PING_INTERVAL_MS = 1_000;

type UseMultiplayerRoomWebSocketTransportOptions = {
  bootstrapTimeoutMs?: number;
  commandAckTimeoutMs?: number;
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

export function useMultiplayerRoomWebSocketTransport({
  bootstrapTimeoutMs = DEFAULT_BOOTSTRAP_TIMEOUT_MS,
  commandAckTimeoutMs = DEFAULT_COMMAND_ACK_TIMEOUT_MS,
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

      let selectedUnavailable = false;
      const latestOptions = latestOptionsRef.current;

      try {
        transportRef.current = createMultiplayerRoomWebSocketTransport({
          bootstrapTimeoutMs,
          commandAckTimeoutMs,
          displayName: latestOptions.displayName,
          lastSeq: latestOptions.lastSeq,
          onBootstrap: (snapshot) => {
            if (!isCurrent) {
              return;
            }

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
    bootstrapTimeoutMs,
    commandAckTimeoutMs,
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

function getBrowserWebSocketConstructor() {
  return typeof WebSocket === "undefined" ? null : WebSocket;
}

function toTransportError(error: unknown) {
  return error instanceof MultiplayerRoomTransportError
    ? error
    : new MultiplayerRoomTransportError(
        error instanceof Error ? error.message : "Room stream request failed.",
      );
}
