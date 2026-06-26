import type { GameId } from "../game-catalog";
import type {
  PrivateRoom,
  PrivateRoomErrorCode,
  PrivateRoomParticipant,
  PrivateRoomSettings,
} from "./room";

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
      userId?: string | null;
    }
  | {
      participantId: string;
      requestId?: string;
      seatId: string;
      type: "room.claimSeat";
    }
  | {
      participantId: string;
      requestId?: string;
      seatId: string;
      type: "room.releaseSeat";
    }
  | {
      command: PrivateRoomLifecycleCommand;
      participantId: string;
      requestId?: string;
      type: "room.lifecycle";
    }
  | {
      participantId: string;
      requestId?: string;
      settings: PrivateRoomSettings;
      type: "room.updateSettings";
    };

export type MultiplayerRealtimeConnectionCursor = {
  game?: number;
  room?: number;
};

export type MultiplayerRealtimeConnectionMessage =
  | {
      displayName?: string;
      participantId?: string;
      requestId?: string;
      roomCode: string;
      type: "connection.hello";
    }
  | {
      displayName?: string;
      lastSeq?: MultiplayerRealtimeConnectionCursor;
      participantId?: string;
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
  | "room-not-found"
  | "unsupported-game";

export type MultiplayerRealtimeRoomEvent<
  Event extends string = string,
  Payload = unknown,
> = {
  gameId?: string;
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
