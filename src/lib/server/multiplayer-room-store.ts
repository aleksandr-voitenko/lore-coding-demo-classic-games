import "server-only";

import { InProcessMultiplayerRoomStore } from "./multiplayer-room-runtime";

export {
  DEFAULT_PONG_PRIVATE_ROOM_SEATS,
  InProcessMultiplayerRoomStore,
  PONG_RUNTIME_CATCH_UP_TICK_LIMIT,
} from "./multiplayer-room-runtime";
export type {
  CreateMultiplayerRoomOptions,
  MultiplayerRoomGameSnapshot,
  MultiplayerRoomParticipantIdFactoryContext,
  MultiplayerRoomSnapshot,
  MultiplayerRoomStore,
  MultiplayerRoomStoreCommand,
  MultiplayerRoomStoreErrorCode,
  MultiplayerRoomStoreResult,
  PongMultiplayerInput,
} from "./multiplayer-room-runtime";

let defaultMultiplayerRoomStore: InProcessMultiplayerRoomStore | null = null;

export function getMultiplayerRoomStore() {
  // Keep the Next API singleton behind the server-only facade while the
  // process-local runtime stays importable by the standalone realtime sidecar.
  defaultMultiplayerRoomStore ??= new InProcessMultiplayerRoomStore();

  return defaultMultiplayerRoomStore;
}
