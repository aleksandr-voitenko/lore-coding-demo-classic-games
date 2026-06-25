import "server-only";

import {
  MULTIPLAYER_ROOM_SERVICE_CLIENT_BEARER_TOKEN_ENV,
  MULTIPLAYER_ROOM_SERVICE_URL_ENV,
  MultiplayerRoomServiceClient,
  getOptionalServiceString,
} from "./multiplayer-room-service-client";
import { InProcessMultiplayerRoomStore } from "./multiplayer-room-runtime";

export {
  DEFAULT_PONG_PRIVATE_ROOM_SEATS,
  InProcessMultiplayerRoomStore,
  PONG_RUNTIME_CATCH_UP_TICK_LIMIT,
} from "./multiplayer-room-runtime";
export type {
  CreateMultiplayerRoomOptions,
  MultiplayerRoomGameSnapshot,
  MultiplayerRoomStoreOperationResult,
  MultiplayerRoomParticipantIdFactoryContext,
  MultiplayerRoomSnapshot,
  MultiplayerRoomStore,
  MultiplayerRoomStoreCommand,
  MultiplayerRoomStoreErrorCode,
  MultiplayerRoomStoreResult,
  PongMultiplayerInput,
} from "./multiplayer-room-runtime";
export { getMultiplayerRoomStoreErrorStatus } from "./multiplayer-room-runtime";

type MultiplayerRoomStoreEnv = Readonly<Record<string, string | undefined>>;

let defaultLocalMultiplayerRoomStore: InProcessMultiplayerRoomStore | null = null;
let defaultServiceMultiplayerRoomStore:
  | {
      cacheKey: string;
      store: MultiplayerRoomServiceClient;
    }
  | null = null;

export function getMultiplayerRoomStore(env: MultiplayerRoomStoreEnv = process.env) {
  const serviceUrl = getOptionalServiceString(env[MULTIPLAYER_ROOM_SERVICE_URL_ENV]);

  if (serviceUrl !== undefined) {
    const bearerToken = getOptionalServiceString(
      env[MULTIPLAYER_ROOM_SERVICE_CLIENT_BEARER_TOKEN_ENV],
    );
    const cacheKey = `${serviceUrl}\n${bearerToken ?? ""}`;

    if (defaultServiceMultiplayerRoomStore?.cacheKey !== cacheKey) {
      defaultServiceMultiplayerRoomStore = {
        cacheKey,
        store: new MultiplayerRoomServiceClient({
          baseUrl: serviceUrl,
          ...(bearerToken === undefined ? {} : { bearerToken }),
        }),
      };
    }

    return defaultServiceMultiplayerRoomStore.store;
  }

  // Keep the Next API singleton behind the server-only facade while the
  // process-local runtime stays importable by the standalone realtime sidecar.
  defaultLocalMultiplayerRoomStore ??= new InProcessMultiplayerRoomStore();

  return defaultLocalMultiplayerRoomStore;
}
