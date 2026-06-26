import type { GameId } from "../game-catalog";
import type { MultiplayerServerGameRuntimeAdapter } from "./multiplayer-game-adapter-contract";
import { pongMultiplayerRuntimeAdapter } from "./pong-multiplayer-game-adapter";
import { spaceInvadersMultiplayerRuntimeAdapter } from "./space-invaders-multiplayer-game-adapter";

export type {
  MultiplayerServerGameInputCommand,
  MultiplayerServerGameLifecycleCommand,
  MultiplayerServerGameReleaseSeatCommand,
  MultiplayerServerGameRuntimeAdapter,
  MultiplayerServerGameRuntimeCreateResult,
  MultiplayerServerGameRuntimeErrorCode,
  MultiplayerServerGameRuntimeFailure,
  MultiplayerServerGameRuntimeInputResult,
  MultiplayerServerGameRuntimeLifecycleResult,
  MultiplayerServerGameSnapshot,
  SpaceInvadersMultiplayerServerGameSnapshot,
} from "./multiplayer-game-adapter-contract";
export {
  DEFAULT_PONG_PRIVATE_ROOM_SEATS,
  PONG_RUNTIME_CATCH_UP_TICK_LIMIT,
} from "./pong-multiplayer-game-adapter";
export { DEFAULT_SPACE_INVADERS_PRIVATE_ROOM_SEATS } from "./space-invaders-multiplayer-game-adapter";

const defaultMultiplayerServerGameAdapter = pongMultiplayerRuntimeAdapter;
const multiplayerServerGameAdapters: Partial<
  Record<GameId, MultiplayerServerGameRuntimeAdapter>
> = {
  pong: pongMultiplayerRuntimeAdapter,
  "space-invaders": spaceInvadersMultiplayerRuntimeAdapter,
};

export function getDefaultMultiplayerServerGameAdapter() {
  return defaultMultiplayerServerGameAdapter;
}

export function getMultiplayerServerGameAdapter(gameId: GameId) {
  return multiplayerServerGameAdapters[gameId] ?? null;
}
