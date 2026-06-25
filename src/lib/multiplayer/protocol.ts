import type {
  PrivateRoom,
  PrivateRoomErrorCode,
  PrivateRoomSettings,
} from "./room";

export type PrivateRoomLifecycleCommand =
  | "finish"
  | "pause"
  | "restart"
  | "resume"
  | "start";

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
    };

export type PrivateRoomServerMessage =
  | {
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
