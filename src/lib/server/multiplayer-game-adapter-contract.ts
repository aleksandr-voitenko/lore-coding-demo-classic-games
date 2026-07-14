import type { MultiplayerGameId } from "../multiplayer/game-registry";
import type { PrivateRoomLifecycleCommand } from "../multiplayer/protocol";
import type {
  PrivateRoom,
  PrivateRoomErrorCode,
  PrivateRoomSeatInput,
  PrivateRoomSettings,
} from "../multiplayer/room";
import type { PongMultiplayerGameSnapshot } from "../pong-multiplayer";
import type { AsteroidsMultiplayerGameSnapshot } from "../asteroids-multiplayer";
import type { BattleCityMultiplayerGameSnapshot } from "../battle-city-multiplayer";
import type {
  SpaceInvadersMultiplayerGameSnapshot,
  SpaceInvadersMultiplayerHeldInputs,
} from "../space-invaders-multiplayer";

export type { AsteroidsMultiplayerGameSnapshot } from "../asteroids-multiplayer";
export type { BattleCityMultiplayerGameSnapshot } from "../battle-city-multiplayer";

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

type DefineMultiplayerServerGameSnapshots<
  Snapshots extends {
    [Game in MultiplayerGameId]: { gameId: Game };
  },
> = Snapshots;

type MultiplayerServerGameSnapshotsById =
  DefineMultiplayerServerGameSnapshots<{
    asteroids: AsteroidsMultiplayerGameSnapshot;
    "battle-city": BattleCityMultiplayerGameSnapshot;
    pong: PongMultiplayerGameSnapshot;
    "space-invaders": SpaceInvadersMultiplayerServerGameSnapshot;
  }>;

export type MultiplayerServerGameSnapshot =
  MultiplayerServerGameSnapshotsById[MultiplayerGameId];

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
  gameId: MultiplayerGameId;
  isActive: (options: {
    room: PrivateRoom;
    runtime: unknown;
  }) => boolean;
  /**
   * Distinguishes game-over state from ready, paused, or otherwise inactive state.
   */
  isTerminal: (options: {
    room: PrivateRoom;
    runtime: unknown;
  }) => boolean;
  shouldAdvanceSnapshot: (options: {
    room: PrivateRoom;
    snapshot: MultiplayerServerGameSnapshot;
  }) => boolean;
};
