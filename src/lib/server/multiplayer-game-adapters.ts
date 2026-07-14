import type { GameId } from "../game-catalog";
import {
  DEFAULT_MULTIPLAYER_GAME_ID,
  isMultiplayerGameId,
  type MultiplayerGameId,
} from "../multiplayer/game-registry";
import type { MultiplayerServerGameRuntimeAdapter } from "./multiplayer-game-adapter-contract";
import { asteroidsMultiplayerRuntimeAdapter } from "./asteroids-multiplayer-game-adapter";
import { battleCityMultiplayerRuntimeAdapter } from "./battle-city-multiplayer-game-adapter";
import { pongMultiplayerRuntimeAdapter } from "./pong-multiplayer-game-adapter";
import { spaceInvadersMultiplayerRuntimeAdapter } from "./space-invaders-multiplayer-game-adapter";

export type {
  AsteroidsMultiplayerGameSnapshot,
  BattleCityMultiplayerGameSnapshot,
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
  BATTLE_CITY_RUNTIME_CATCH_UP_TICK_LIMIT,
  DEFAULT_BATTLE_CITY_PRIVATE_ROOM_SEATS,
} from "./battle-city-multiplayer-game-adapter";
export {
  DEFAULT_PONG_PRIVATE_ROOM_SEATS,
  PONG_RUNTIME_CATCH_UP_TICK_LIMIT,
} from "./pong-multiplayer-game-adapter";
export { DEFAULT_SPACE_INVADERS_PRIVATE_ROOM_SEATS } from "./space-invaders-multiplayer-game-adapter";

const multiplayerServerGameAdapters: Readonly<
  Record<MultiplayerGameId, MultiplayerServerGameRuntimeAdapter>
> = {
  asteroids: asteroidsMultiplayerRuntimeAdapter,
  "battle-city": battleCityMultiplayerRuntimeAdapter,
  pong: pongMultiplayerRuntimeAdapter,
  "space-invaders": spaceInvadersMultiplayerRuntimeAdapter,
};

export function getDefaultMultiplayerServerGameAdapter() {
  return multiplayerServerGameAdapters[DEFAULT_MULTIPLAYER_GAME_ID];
}

export function getMultiplayerServerGameAdapter(gameId: GameId) {
  return isMultiplayerGameId(gameId) ? multiplayerServerGameAdapters[gameId] : null;
}
