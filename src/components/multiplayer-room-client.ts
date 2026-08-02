"use client";

import { useCallback } from "react";

import {
  type MultiplayerRoomTransportAck,
  type MultiplayerRoomTransportPingSample,
  type MultiplayerRoomTransportStatus,
  useMultiplayerRoomWebSocketTransport,
} from "@/components/multiplayer-room-transport";
import type { GameId } from "@/lib/game-catalog";
import { MULTIPLAYER_ROOM_PROTOCOL_PATH_SEGMENT } from "@/lib/multiplayer/protocol";
import type {
  MultiplayerGameInputPayload,
  MultiplayerRealtimeConnectionCursor,
  MultiplayerRoomGameSnapshot,
  PrivateRoomClientMessage,
  PrivateRoomCommandMessage,
} from "@/lib/multiplayer/protocol";
import { isMultiplayerRoomSnapshot } from "@/lib/multiplayer/protocol-validation";
import {
  normalizePrivateRoomCode,
  type PrivateRoom,
  type PrivateRoomSettings,
} from "@/lib/multiplayer/room";

export const MULTIPLAYER_ROOMS_API_PATH = "/api/multiplayer/rooms";

type RoomFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type MultiplayerRoomClientSnapshot = {
  game?: MultiplayerRoomGameSnapshot;
  participantCapability?: string;
  participantId?: string;
  room: PrivateRoom;
  seq: number;
};

type HostOnlyRoomCommandMessage = Extract<
  PrivateRoomCommandMessage,
  { type: "room.lifecycle" | "room.updateSettings" }
>;

type CreateMultiplayerRoomOptions = {
  fetcher?: RoomFetch;
  gameId: GameId;
  settings?: PrivateRoomSettings;
};

export type MultiplayerRoomClientCommandTransport = {
  sendGameInput: <Game extends GameId, Input = MultiplayerGameInputPayload<Game>>(
    gameId: Game,
    input: Input,
    matchId: number,
    participantId: string,
  ) => Promise<MultiplayerRoomTransportAck>;
  sendRoomCommand: (
    command: PrivateRoomCommandMessage,
  ) => Promise<MultiplayerRoomTransportAck>;
  status: MultiplayerRoomTransportStatus;
};

type MultiplayerRoomHostCommandPoster = (
  roomCode: string,
  message: HostOnlyRoomCommandMessage,
) => Promise<MultiplayerRoomClientSnapshot>;

type DispatchMultiplayerRoomClientMessageOptions<
  Game extends GameId,
  Input,
> = {
  message: PrivateRoomClientMessage<Game, Input>;
  postHostCommand?: MultiplayerRoomHostCommandPoster;
  roomCode: string | null;
  transport: MultiplayerRoomClientCommandTransport;
};

type UseMultiplayerRoomClientOptions = {
  diagnosticsEnabled?: boolean;
  displayName?: string | null;
  enabled: boolean;
  lastSeq?: MultiplayerRealtimeConnectionCursor | null;
  onConnectionError?: (error: Error) => void;
  onDiagnosticsPingSample?: (sample: MultiplayerRoomTransportPingSample) => void;
  onParticipantCapability?: (participantCapability: string) => void;
  onParticipantId?: (participantId: string) => void;
  onSnapshot: (
    snapshot: MultiplayerRoomClientSnapshot,
    source: "http" | "websocket",
  ) => void;
  participantCapability?: string | null;
  participantId?: string | null;
  roomCode: string | null;
};

type UseMultiplayerRoomClientResult = {
  sendMessage: <Game extends GameId, Input = MultiplayerGameInputPayload<Game>>(
    message: PrivateRoomClientMessage<Game, Input>,
  ) => Promise<MultiplayerRoomClientSnapshot | MultiplayerRoomTransportAck>;
  status: MultiplayerRoomTransportStatus;
};

export class MultiplayerRoomRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "MultiplayerRoomRequestError";
    this.status = status;
  }
}

export async function createMultiplayerRoom({
  fetcher,
  gameId,
  settings,
}: CreateMultiplayerRoomOptions) {
  const response = await getDefaultFetcher(fetcher)(
    `${MULTIPLAYER_ROOMS_API_PATH}/${MULTIPLAYER_ROOM_PROTOCOL_PATH_SEGMENT}`,
    {
      body: JSON.stringify({ gameId, settings }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  const payload = await readRoomApiPayload(response, "Create room");

  if (
    payload.participantId === undefined ||
    payload.participantCapability === undefined
  ) {
    throw new MultiplayerRoomRequestError(
      "Create room response did not include participant credentials.",
      response.status,
    );
  }

  return {
    ...(payload.game === undefined ? {} : { game: payload.game }),
    participantCapability: payload.participantCapability,
    participantId: payload.participantId,
    room: payload.room,
    seq: payload.seq,
  };
}

export async function postMultiplayerRoomCommand(
  roomCode: string,
  message: HostOnlyRoomCommandMessage,
  fetcher?: RoomFetch,
) {
  const response = await getDefaultFetcher(fetcher)(
    getRoomMutationApiPath(roomCode),
    {
      body: JSON.stringify(message),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  return readRoomApiPayload(response, "Room command");
}

export function getMultiplayerRoomRequestErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Room request failed.";
}

export function shouldPostMultiplayerRoomCommandOverHttp<
  Game extends GameId = GameId,
  Input = MultiplayerGameInputPayload<Game>,
>(
  message: PrivateRoomClientMessage<Game, Input>,
): message is HostOnlyRoomCommandMessage {
  return message.type === "room.lifecycle" || message.type === "room.updateSettings";
}

export function getMultiplayerRoomStreamUnavailableMessage(
  transportStatus: MultiplayerRoomTransportStatus,
) {
  if (transportStatus === "unconfigured") {
    return "Room stream is not configured. Live room commands require WebSockets.";
  }

  if (transportStatus === "unavailable") {
    return "Room stream is unavailable. Live room commands require WebSockets.";
  }

  if (transportStatus === "reconnecting") {
    return "Room stream is reconnecting. Try again once the WebSocket stream is ready.";
  }

  if (transportStatus === "connecting") {
    return "Room stream is connecting. Try again once the WebSocket stream is ready.";
  }

  return "Room stream is connected.";
}

export async function dispatchMultiplayerRoomClientMessage<
  Game extends GameId = GameId,
  Input = MultiplayerGameInputPayload<Game>,
>({
  message,
  postHostCommand = postMultiplayerRoomCommand,
  roomCode: requestedRoomCode,
  transport,
}: DispatchMultiplayerRoomClientMessageOptions<Game, Input>) {
  const roomCode = normalizePrivateRoomCode(requestedRoomCode);

  if (roomCode === null) {
    throw new MultiplayerRoomRequestError("Room code is not supported.", 400);
  }

  if (shouldPostMultiplayerRoomCommandOverHttp(message)) {
    return postHostCommand(roomCode, message);
  }

  if (transport.status !== "active") {
    throw new MultiplayerRoomRequestError(
      getMultiplayerRoomStreamUnavailableMessage(transport.status),
      0,
    );
  }

  return message.type === "game.input"
    ? transport.sendGameInput(
        message.gameId,
        message.input,
        message.matchId,
        message.participantId,
      )
    : transport.sendRoomCommand(message);
}

export function useMultiplayerRoomClient({
  diagnosticsEnabled = false,
  displayName,
  enabled,
  lastSeq,
  onConnectionError,
  onDiagnosticsPingSample,
  onParticipantCapability,
  onParticipantId,
  onSnapshot,
  participantCapability,
  participantId,
  roomCode,
}: UseMultiplayerRoomClientOptions): UseMultiplayerRoomClientResult {
  const roomTransport = useMultiplayerRoomWebSocketTransport({
    diagnosticsEnabled,
    displayName,
    enabled,
    lastSeq,
    onConnectionError,
    onDiagnosticsPingSample,
    onParticipantCapability,
    onParticipantId,
    onSnapshot: (snapshot) => {
      onSnapshot(snapshot, "websocket");
    },
    participantCapability,
    participantId,
    roomCode,
  });
  const {
    sendGameInput,
    sendRoomCommand,
    status,
  } = roomTransport;
  const sendMessage = useCallback(
    async <Game extends GameId, Input = MultiplayerGameInputPayload<Game>>(
      message: PrivateRoomClientMessage<Game, Input>,
    ) => {
      const result = await dispatchMultiplayerRoomClientMessage({
        message,
        roomCode,
        transport: {
          sendGameInput,
          sendRoomCommand,
          status,
        },
      });

      if (result.participantCapability !== undefined) {
        onParticipantCapability?.(result.participantCapability);
      }

      if (result.participantId !== undefined) {
        onParticipantId?.(result.participantId);
      }

      if ("room" in result) {
        onSnapshot(result, "http");
      }

      return result;
    },
    [
      onParticipantId,
      onParticipantCapability,
      onSnapshot,
      roomCode,
      sendGameInput,
      sendRoomCommand,
      status,
    ],
  );

  return {
    sendMessage,
    status,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getDefaultFetcher(fetcher: RoomFetch | undefined) {
  return fetcher ?? fetch;
}

function getRoomMutationApiPath(roomCode: string) {
  const normalizedRoomCode = normalizePrivateRoomCode(roomCode);

  if (normalizedRoomCode === null) {
    throw new MultiplayerRoomRequestError("Room code is not supported.", 400);
  }

  return `${MULTIPLAYER_ROOMS_API_PATH}/${encodeURIComponent(
    normalizedRoomCode,
  )}/${MULTIPLAYER_ROOM_PROTOCOL_PATH_SEGMENT}`;
}

async function readRoomApiPayload(
  response: Response,
  context: string,
): Promise<MultiplayerRoomClientSnapshot> {
  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      isRecord(payload) && typeof payload.error === "string"
        ? payload.error
        : `${context} failed with status ${response.status}.`;

    throw new MultiplayerRoomRequestError(message, response.status);
  }

  if (!isRecord(payload) || !isRecord(payload.room)) {
    throw new MultiplayerRoomRequestError(
      `${context} response did not include a room.`,
      response.status,
    );
  }

  if (typeof payload.seq !== "number") {
    throw new MultiplayerRoomRequestError(
      `${context} response did not include a sequence.`,
      response.status,
    );
  }

  const participantCapabilityValue = payload.participantCapability;

  if (!isMultiplayerRoomSnapshot(payload)) {
    throw new MultiplayerRoomRequestError(
      `${context} response included an invalid room snapshot.`,
      response.status,
    );
  }

  const participantId = payload.participant?.id;
  const participantCapability =
    typeof participantCapabilityValue === "string" &&
    participantCapabilityValue.length > 0 &&
    participantCapabilityValue.length <= 512 &&
    participantCapabilityValue.trim() === participantCapabilityValue
      ? participantCapabilityValue
      : undefined;
  const game = payload.game;

  return participantId === undefined
    ? ({
        ...(game === undefined ? {} : { game }),
        ...(participantCapability === undefined
          ? {}
          : { participantCapability }),
        room: payload.room,
        seq: payload.seq,
      } satisfies MultiplayerRoomClientSnapshot)
    : ({
        ...(game === undefined ? {} : { game }),
        ...(participantCapability === undefined
          ? {}
          : { participantCapability }),
        participantId,
        room: payload.room,
        seq: payload.seq,
      } satisfies MultiplayerRoomClientSnapshot);
}
