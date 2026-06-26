import type { GameId } from "../game-catalog";
import type { PrivateRoomLifecycleCommand } from "../multiplayer/protocol";
import type {
  PrivateRoom,
  PrivateRoomErrorCode,
  PrivateRoomSeatInput,
  PrivateRoomSettings,
} from "../multiplayer/room";
import type { PongMultiplayerGameSnapshot } from "../pong-multiplayer";
import type { AsteroidsMultiplayerGameSnapshot } from "../asteroids-multiplayer";
import type {
  SpaceInvadersMultiplayerGameSnapshot,
  SpaceInvadersMultiplayerHeldInputs,
} from "../space-invaders-multiplayer";

export type { AsteroidsMultiplayerGameSnapshot } from "../asteroids-multiplayer";

export type MultiplayerServerGameInputCommand<Input = unknown> = {
  gameId?: unknown;
  input: Input;
  participantId: unknown;
  type: "game.input";
};

export type MultiplayerServerGameLifecycleCommand = {
  command: PrivateRoomLifecycleCommand;
  participantId: unknown;
  type: "room.lifecycle";
};

export type MultiplayerServerGameReleaseSeatCommand = {
  participantId: unknown;
  seatId: unknown;
  type: "room.releaseSeat";
};

export type SpaceInvadersMultiplayerServerGameSnapshot =
  SpaceInvadersMultiplayerGameSnapshot & {
    heldInputs: SpaceInvadersMultiplayerHeldInputs;
  };

export type MultiplayerServerGameSnapshot =
  | AsteroidsMultiplayerGameSnapshot
  | PongMultiplayerGameSnapshot
  | SpaceInvadersMultiplayerServerGameSnapshot;

export type MultiplayerServerGameRuntimeErrorCode =
  | PrivateRoomErrorCode
  | "invalid-command";

export type MultiplayerServerGameRuntimeFailure = {
  code: MultiplayerServerGameRuntimeErrorCode;
  error: string;
  success: false;
};

export type MultiplayerServerGameRuntimeCreateResult =
  | {
      runtime: unknown;
      success: true;
    }
  | MultiplayerServerGameRuntimeFailure;

export type MultiplayerServerGameRuntimeLifecycleResult =
  | {
      runtime?: unknown;
      success: true;
    }
  | MultiplayerServerGameRuntimeFailure;

export type MultiplayerServerGameRuntimeInputResult =
  | {
      participantId?: string;
      success: true;
    }
  | MultiplayerServerGameRuntimeFailure;

export type MultiplayerServerGameRuntimeAdapter = {
  advanceRuntimeTo: (options: {
    nowMs: number;
    room: PrivateRoom;
    runtime: unknown;
  }) => boolean;
  applyInputCommand: (options: {
    command: MultiplayerServerGameInputCommand;
    nowMs: number;
    room: PrivateRoom;
    runtime: unknown | undefined;
  }) => MultiplayerServerGameRuntimeInputResult;
  applyLifecycleCommand: (options: {
    command: MultiplayerServerGameLifecycleCommand;
    nowMs: number;
    room: PrivateRoom;
    runtime: unknown | undefined;
  }) => MultiplayerServerGameRuntimeLifecycleResult;
  clearInputForReleasedSeat: (options: {
    command: MultiplayerServerGameReleaseSeatCommand;
    runtime: unknown;
  }) => void;
  createRuntime: (options: {
    nowMs: number;
    room: PrivateRoom;
  }) => MultiplayerServerGameRuntimeCreateResult;
  createSnapshot: (options: {
    room: PrivateRoom;
    runtime: unknown;
    serverTimeMs: number;
  }) => MultiplayerServerGameSnapshot;
  defaultSeats: readonly PrivateRoomSeatInput[];
  defaultSettings: PrivateRoomSettings;
  gameId: GameId;
  isActive: (options: {
    room: PrivateRoom;
    runtime: unknown;
  }) => boolean;
  shouldAdvanceSnapshot: (options: {
    room: PrivateRoom;
    snapshot: MultiplayerServerGameSnapshot;
  }) => boolean;
};
