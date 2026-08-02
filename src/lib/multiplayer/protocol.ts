import type { GameId } from "../game-catalog";
import type {
  PrivateRoom,
  PrivateRoomErrorCode,
  PrivateRoomParticipant,
  PrivateRoomSettings,
} from "./room";

export const MULTIPLAYER_ROOM_PROTOCOL_VERSION = 4 as const;
export const MULTIPLAYER_ROOM_PROTOCOL_PATH_SEGMENT =
  `v${MULTIPLAYER_ROOM_PROTOCOL_VERSION}`;
export const MULTIPLAYER_ROOM_PROTOCOL_VERSION_HEADER =
  "x-multiplayer-room-protocol-version";

export type PrivateRoomLifecycleCommand =
  | "finish"
  | "pause"
  | "restart"
  | "resume"
  | "start";

export type MultiplayerGenericGamePayload = {
  readonly [key: string]: unknown;
  type: string;
};

export type MultiplayerGameInputPayload<Game extends string = string> =
  Game extends string ? MultiplayerGenericGamePayload : never;

export type MultiplayerRealtimeGameInputMessage<
  Game extends string = GameId,
  Input = MultiplayerGameInputPayload<Game>,
> = {
  gameId: Game;
  input: Input;
  matchId: number;
  participantId: string;
  requestId?: string;
  roomCode: string;
  type: "game.input";
};

export type PrivateRoomGameInputMessage<
  Game extends string = GameId,
  Input = MultiplayerGameInputPayload<Game>,
> = Omit<MultiplayerRealtimeGameInputMessage<Game, Input>, "roomCode">;

export type MultiplayerRealtimeGameSnapshot<
  Game extends string = GameId,
  Snapshot = unknown,
  Extras extends object = object,
> = {
  gameId: Game;
  matchId: number;
  seq: number;
  serverTimeMs: number;
  snapshot: Snapshot;
} & Extras;

export type MultiplayerRoomGameSnapshot<
  Game extends string = GameId,
  Snapshot = unknown,
  Extras extends object = object,
> = MultiplayerRealtimeGameSnapshot<Game, Snapshot, Extras>;

export type MultiplayerTerminalSummaryParticipant = Pick<
  PrivateRoomParticipant,
  "displayName" | "id" | "role" | "userId"
>;

export type MultiplayerTerminalSummarySeat = {
  id: string;
  label: string;
  participant: MultiplayerTerminalSummaryParticipant | null;
};

export type MultiplayerTerminalSummary<
  Status extends string = string,
  Outcome extends object = Record<string, unknown>,
> = {
  key: string;
  mode: "private-room";
  outcome: Outcome;
  seats: readonly MultiplayerTerminalSummarySeat[];
  settings: PrivateRoomSettings;
  status: Status;
};

export type MultiplayerRealtimeRoomSnapshot<GameSnapshot = MultiplayerRealtimeGameSnapshot> = {
  game?: GameSnapshot;
  participant?: PrivateRoomParticipant;
  room: PrivateRoom;
  seq: number;
};

export type MultiplayerRoomSnapshot<
  GameSnapshot = MultiplayerRoomGameSnapshot,
> = MultiplayerRealtimeRoomSnapshot<GameSnapshot>;

export type PrivateRoomCommandMessage =
  | {
      displayName: string;
      participantId?: string;
      requestId?: string;
      type: "room.joinObserver";
    }
  | {
      displayName: string;
      participantId?: string;
      requestId?: string;
      type: "room.joinPlayer";
    }
  | {
      matchId: number;
      participantId: string;
      requestId?: string;
      seatId: string;
      type: "room.claimSeat";
    }
  | {
      matchId: number;
      participantId: string;
      requestId?: string;
      seatId: string;
      type: "room.releaseSeat";
    }
  | {
      command: PrivateRoomLifecycleCommand;
      matchId: number;
      participantId: string;
      requestId?: string;
      type: "room.lifecycle";
    }
  | {
      matchId: number;
      participantId: string;
      requestId?: string;
      settings: PrivateRoomSettings;
      type: "room.updateSettings";
    }
  | {
      matchId: number;
      participantId: string;
      requestId?: string;
      settings: PrivateRoomSettings;
      type: "room.replaceMatch";
    };

export type MultiplayerRealtimeConnectionCursor = {
  game?: {
    matchId: number;
    seq: number;
  };
  room?: number;
};

export type MultiplayerRealtimeConnectionMessage =
  | {
      displayName?: string;
      participantCapability?: string;
      participantId?: string;
      protocolVersion: typeof MULTIPLAYER_ROOM_PROTOCOL_VERSION;
      requestId?: string;
      roomCode: string;
      type: "connection.hello";
    }
  | {
      clientTimeMs: number;
      requestId?: string;
      roomCode: string;
      type: "connection.ping";
    }
  | {
      displayName?: string;
      lastSeq?: MultiplayerRealtimeConnectionCursor;
      participantCapability?: string;
      participantId?: string;
      protocolVersion: typeof MULTIPLAYER_ROOM_PROTOCOL_VERSION;
      requestId?: string;
      roomCode: string;
      type: "connection.resume";
    }
  | {
      clientTimeMs?: number;
      nonce?: string;
      requestId?: string;
      roomCode?: string;
      type: "connection.pong";
    };

export type MultiplayerRealtimeRoomCommandMessage = {
  command: PrivateRoomCommandMessage;
  requestId?: string;
  roomCode: string;
  type: "room.command";
};

export type MultiplayerRealtimeClientMessage =
  | MultiplayerRealtimeConnectionMessage
  | MultiplayerRealtimeGameInputMessage
  | MultiplayerRealtimeRoomCommandMessage;

export type PrivateRoomClientMessage<
  Game extends string = GameId,
  Input = MultiplayerGameInputPayload<Game>,
> =
  | PrivateRoomCommandMessage
  | PrivateRoomGameInputMessage<Game, Input>;

export type MultiplayerRealtimeRejectionCode =
  | PrivateRoomErrorCode
  | "duplicate-room"
  | "invalid-command"
  | "invalid-message"
  | "participant-unauthorized"
  | "protocol-version-mismatch"
  | "room-expired"
  | "room-not-found"
  | "stale-match"
  | "unsupported-game";

export type MultiplayerRealtimeRoomEvent<
  Event extends string = string,
  Payload = unknown,
> = {
  gameId?: string;
  matchId?: number;
  gameSeq?: number;
  payload: Payload;
  seq: number;
  type: Event;
};

export type MultiplayerRealtimeServerMessage<
  GameSnapshot = MultiplayerRealtimeGameSnapshot,
> =
  | {
      displayName?: string;
      participantId?: string;
      protocolVersion: typeof MULTIPLAYER_ROOM_PROTOCOL_VERSION;
      requestId?: string;
      roomCode: string;
      snapshot: MultiplayerRealtimeRoomSnapshot<GameSnapshot>;
      type: "connection.bootstrap";
    }
  | {
      requestId?: string;
      roomCode: string;
      snapshot: MultiplayerRealtimeRoomSnapshot<GameSnapshot>;
      type: "room.snapshot";
    }
  | {
      event: MultiplayerRealtimeRoomEvent;
      roomCode: string;
      type: "room.event";
    }
  | {
      gameSeq?: number;
      matchId: number;
      participantCapability?: string;
      participantId?: string;
      requestId?: string;
      roomCode: string;
      seq: number;
      type: "room.commandAck";
    }
  | {
      code: MultiplayerRealtimeRejectionCode;
      error: string;
      requestId?: string;
      roomCode?: string;
      type: "room.commandRejected";
    }
  | {
      nonce?: string;
      serverTimeMs: number;
      type: "connection.ping";
    }
  | {
      clientTimeMs: number;
      requestId?: string;
      roomCode?: string;
      serverTimeMs: number;
      type: "connection.pong";
    };

export type PrivateRoomServerMessage<GameSnapshot = MultiplayerRoomGameSnapshot> =
  | {
      game?: GameSnapshot;
      room: PrivateRoom;
      seq: number;
      type: "room.snapshot";
    }
  | {
      code: PrivateRoomErrorCode;
      error: string;
      requestId?: string;
      type: "room.commandRejected";
    };
