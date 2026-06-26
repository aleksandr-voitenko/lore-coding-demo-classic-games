import type { GameId } from "../game-catalog";
import type { MultiplayerServerGameRuntimeAdapter } from "./multiplayer-game-adapter-contract";
import { asteroidsMultiplayerRuntimeAdapter } from "./asteroids-multiplayer-game-adapter";
import { pongMultiplayerRuntimeAdapter } from "./pong-multiplayer-game-adapter";
import { spaceInvadersMultiplayerRuntimeAdapter } from "./space-invaders-multiplayer-game-adapter";

export type {
  AsteroidsMultiplayerGameSnapshot,
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
export { DEFAULT_ASTEROIDS_PRIVATE_ROOM_SEATS } from "./asteroids-multiplayer-game-adapter";
export {
  DEFAULT_PONG_PRIVATE_ROOM_SEATS,
  PONG_RUNTIME_CATCH_UP_TICK_LIMIT,
} from "./pong-multiplayer-game-adapter";
export { DEFAULT_SPACE_INVADERS_PRIVATE_ROOM_SEATS } from "./space-invaders-multiplayer-game-adapter";

const defaultMultiplayerServerGameAdapter = pongMultiplayerRuntimeAdapter;
const multiplayerServerGameAdapters: Partial<
  Record<GameId, MultiplayerServerGameRuntimeAdapter>
> = {
  asteroids: asteroidsMultiplayerRuntimeAdapter,
  pong: pongMultiplayerRuntimeAdapter,
  "space-invaders": spaceInvadersMultiplayerRuntimeAdapter,
};

export function getDefaultMultiplayerServerGameAdapter() {
  return defaultMultiplayerServerGameAdapter;
}

export function getMultiplayerServerGameAdapter(gameId: GameId) {
  return multiplayerServerGameAdapters[gameId] ?? null;
}
