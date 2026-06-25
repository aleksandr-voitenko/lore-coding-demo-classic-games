import type {
  PrivateRoom,
  PrivateRoomErrorCode,
  PrivateRoomParticipant,
  PrivateRoomSettings,
} from "./room";
import type {
  PongGameState,
  PongPaddleMoveDirection,
} from "../pong-game-engine";
import type { PongMultiplayerHeldInputs } from "../pong-multiplayer";

export type PrivateRoomLifecycleCommand =
  | "finish"
  | "pause"
  | "restart"
  | "resume"
  | "start";

export type PongMultiplayerClientInput =
  | {
      direction: PongPaddleMoveDirection | null;
      type: "pong.setPaddleDirection";
    }
  | {
      type: "pong.serve";
    };

export type MultiplayerRoomGameSnapshot = {
  gameId: "pong";
  heldInputs: PongMultiplayerHeldInputs;
  seq: number;
  serverTimeMs: number;
  snapshot: PongGameState;
};

export type MultiplayerRoomSnapshot = {
  game?: MultiplayerRoomGameSnapshot;
  participant?: PrivateRoomParticipant;
  room: PrivateRoom;
  seq: number;
};

export type PrivateRoomClientMessage =
  | {
      displayName: string;
      participantId: string;
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
    }
  | {
      input: PongMultiplayerClientInput;
      participantId: string;
      requestId?: string;
      type: "game.input";
    };

export type PrivateRoomServerMessage =
  | {
      game?: MultiplayerRoomGameSnapshot;
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
