import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo, Server as HttpServer } from "node:net";

import {
  MULTIPLAYER_ROOM_PROTOCOL_PATH_SEGMENT,
  MULTIPLAYER_ROOM_PROTOCOL_VERSION,
  MULTIPLAYER_ROOM_PROTOCOL_VERSION_HEADER,
} from "../multiplayer/protocol";
import {
  DEFAULT_MULTIPLAYER_ROOM_SNAPSHOT_INTERVAL_MS,
  createMultiplayerRoomWebSocketGateway,
  type MultiplayerRoomWebSocketGateway,
} from "./multiplayer-room-websocket";
import {
  DEFAULT_MULTIPLAYER_ROOM_MAX_ROOMS,
  DEFAULT_MULTIPLAYER_ROOM_RETENTION_POLICY,
  InProcessMultiplayerRoomStore,
  getMultiplayerRoomStoreErrorStatus,
  type CreateMultiplayerRoomOptions,
  type MultiplayerRoomStore,
  type MultiplayerRoomStoreCommand,
  type MultiplayerRoomStoreResult,
} from "./multiplayer-room-runtime";

export const DEFAULT_MULTIPLAYER_SIDECAR_HOST = "127.0.0.1";
export const DEFAULT_MULTIPLAYER_SIDECAR_PORT = 3001;
export const DEFAULT_MULTIPLAYER_SIDECAR_WEBSOCKET_PATH = "/multiplayer/rooms";
export const DEFAULT_MULTIPLAYER_SIDECAR_ROOM_SERVICE_PATH =
  "/_internal/multiplayer/rooms";
export const DEFAULT_MULTIPLAYER_SIDECAR_SNAPSHOT_INTERVAL_MS =
  DEFAULT_MULTIPLAYER_ROOM_SNAPSHOT_INTERVAL_MS;
export const DEFAULT_MULTIPLAYER_SIDECAR_MAX_ROOMS =
  DEFAULT_MULTIPLAYER_ROOM_MAX_ROOMS;
export const DEFAULT_MULTIPLAYER_SIDECAR_READINESS_PATH = "/readyz";
export const MULTIPLAYER_SIDECAR_HEALTH_PATH = "/healthz";
export const MULTIPLAYER_SIDECAR_ROOM_SERVICE_BEARER_TOKEN_ENV =
  "MULTIPLAYER_SIDECAR_ROOM_SERVICE_BEARER_TOKEN";
export const MULTIPLAYER_SIDECAR_ROOM_SERVICE_PATH_ENV =
  "MULTIPLAYER_SIDECAR_ROOM_SERVICE_PATH";
export const MULTIPLAYER_SIDECAR_MAX_ROOMS_ENV =
  "MULTIPLAYER_SIDECAR_MAX_ROOMS";
export const MULTIPLAYER_SIDECAR_SNAPSHOT_INTERVAL_MS_ENV =
  "MULTIPLAYER_SIDECAR_SNAPSHOT_INTERVAL_MS";

const MULTIPLAYER_SIDECAR_SERVICE_NAME = "multiplayer-room-sidecar";
const MAX_ROOM_SERVICE_JSON_BODY_BYTES = 64 * 1024;

export type MultiplayerRoomSidecarConfig = {
  healthPath: string;
  host: string;
  maxRooms: number;
  port: number;
  readinessPath: string;
  roomServiceBearerToken?: string;
  roomServicePath: string;
  snapshotIntervalMs: number;
  websocketPath: string;
};

export type MultiplayerRoomSidecarEnv = Readonly<
  Record<string, string | undefined>
>;

export type MultiplayerRoomSidecar = {
  close: () => Promise<void>;
  config: MultiplayerRoomSidecarConfig;
  gateway: MultiplayerRoomWebSocketGateway;
  server: HttpServer;
  start: () => Promise<void>;
};

export function parseMultiplayerRoomSidecarConfig(
  env: MultiplayerRoomSidecarEnv = process.env,
): MultiplayerRoomSidecarConfig {
  const websocketPath = parsePathEnv(
    env.MULTIPLAYER_SIDECAR_WEBSOCKET_PATH,
    "MULTIPLAYER_SIDECAR_WEBSOCKET_PATH",
    DEFAULT_MULTIPLAYER_SIDECAR_WEBSOCKET_PATH,
  );
  const roomServiceBearerToken = getOptionalEnvString(
    env[MULTIPLAYER_SIDECAR_ROOM_SERVICE_BEARER_TOKEN_ENV],
  );
  const roomServicePath = parsePathEnv(
    env[MULTIPLAYER_SIDECAR_ROOM_SERVICE_PATH_ENV],
    MULTIPLAYER_SIDECAR_ROOM_SERVICE_PATH_ENV,
    DEFAULT_MULTIPLAYER_SIDECAR_ROOM_SERVICE_PATH,
  );

  return {
    healthPath: MULTIPLAYER_SIDECAR_HEALTH_PATH,
    host:
      getOptionalEnvString(env.MULTIPLAYER_SIDECAR_HOST) ??
      DEFAULT_MULTIPLAYER_SIDECAR_HOST,
    maxRooms: parsePositiveIntegerEnv(
      env[MULTIPLAYER_SIDECAR_MAX_ROOMS_ENV],
      MULTIPLAYER_SIDECAR_MAX_ROOMS_ENV,
      DEFAULT_MULTIPLAYER_SIDECAR_MAX_ROOMS,
    ),
    port: parsePortEnv(
      env.MULTIPLAYER_SIDECAR_PORT,
      "MULTIPLAYER_SIDECAR_PORT",
      DEFAULT_MULTIPLAYER_SIDECAR_PORT,
    ),
    ...(roomServiceBearerToken === undefined ? {} : { roomServiceBearerToken }),
    readinessPath: DEFAULT_MULTIPLAYER_SIDECAR_READINESS_PATH,
    roomServicePath,
    snapshotIntervalMs: parsePositiveIntegerEnv(
      env[MULTIPLAYER_SIDECAR_SNAPSHOT_INTERVAL_MS_ENV],
      MULTIPLAYER_SIDECAR_SNAPSHOT_INTERVAL_MS_ENV,
      DEFAULT_MULTIPLAYER_SIDECAR_SNAPSHOT_INTERVAL_MS,
    ),
    websocketPath,
  };
}

export function createMultiplayerRoomSidecar(
  config: MultiplayerRoomSidecarConfig = parseMultiplayerRoomSidecarConfig(),
): MultiplayerRoomSidecar {
  const store = new InProcessMultiplayerRoomStore({
    maxRooms: config.maxRooms,
  });
  const server = createServer((request, response) => {
    void handleHttpRequest(config, store, gateway, request, response).catch(
      (error: unknown) => {
        sendUnhandledError(request, response, error);
      },
    );
  });
  const gateway = createMultiplayerRoomWebSocketGateway({
    path: config.websocketPath,
    server,
    snapshotIntervalMs: config.snapshotIntervalMs,
    store,
  });
  let closePromise: Promise<void> | null = null;
  let roomSweepIntervalId: ReturnType<typeof setInterval> | null = null;

  function stopRoomSweepTimer() {
    if (roomSweepIntervalId === null) {
      return;
    }

    clearInterval(roomSweepIntervalId);
    roomSweepIntervalId = null;
  }

  return {
    close: () => {
      stopRoomSweepTimer();
      closePromise ??= closeSidecar(server, gateway);

      return closePromise;
    },
    config,
    gateway,
    server,
    start: async () => {
      await listen(server, config);

      if (roomSweepIntervalId === null) {
        roomSweepIntervalId = setInterval(
          () => store.sweepExpiredRooms(),
          DEFAULT_MULTIPLAYER_ROOM_RETENTION_POLICY.sweepIntervalMs,
        );
        roomSweepIntervalId.unref?.();
      }
    },
  };
}

export async function runMultiplayerRoomSidecarFromEnv(
  env: MultiplayerRoomSidecarEnv = process.env,
) {
  const sidecar = createMultiplayerRoomSidecar(
    parseMultiplayerRoomSidecarConfig(env),
  );

  await sidecar.start();
  registerShutdownHandlers(sidecar);
  console.log(
    `${MULTIPLAYER_SIDECAR_SERVICE_NAME} listening on ${formatServerAddress(
      sidecar.server,
      sidecar.config,
    )} with WebSocket path ${sidecar.config.websocketPath} and room service path ${
      sidecar.config.roomServicePath
    }, room capacity ${sidecar.config.maxRooms}, and snapshot interval ${
      sidecar.config.snapshotIntervalMs
    }ms`,
  );

  return sidecar;
}

async function handleHttpRequest(
  config: MultiplayerRoomSidecarConfig,
  roomStore: MultiplayerRoomStore,
  gateway: MultiplayerRoomWebSocketGateway,
  request: IncomingMessage,
  response: ServerResponse,
) {
  const pathname = getRequestPathname(request.url);

  if (pathname === config.healthPath) {
    sendJson(
      request,
      response,
      200,
      {
        readinessPath: config.readinessPath,
        service: MULTIPLAYER_SIDECAR_SERVICE_NAME,
        status: "ok",
        websocketPath: config.websocketPath,
      },
    );
    return;
  }

  if (pathname === config.readinessPath) {
    sendJson(
      request,
      response,
      200,
      {
        checks: {
          http: "ok",
          roomStore: "ok",
          websocket: "ok",
        },
        roomServicePath: config.roomServicePath,
        roomState: "volatile-memory",
        service: MULTIPLAYER_SIDECAR_SERVICE_NAME,
        snapshotIntervalMs: config.snapshotIntervalMs,
        status: "ready",
        websocketPath: config.websocketPath,
      },
    );
    return;
  }

  const roomServiceRoute = getRoomServiceRoute(config, pathname);

  if (roomServiceRoute !== null) {
    return handleRoomServiceRequest(
      config,
      roomStore,
      gateway,
      roomServiceRoute,
      request,
      response,
    );
  }

  sendJson(request, response, 404, {
    error: "Not found.",
  });
}

type RoomServiceRoute =
  | {
      kind: "collection";
    }
  | {
      kind: "mutation-collection";
    }
  | {
      kind: "room";
      roomCode: string;
    }
  | {
      kind: "mutation-room";
      roomCode: string;
    };

type ReadJsonRequestBodyResult =
  | {
      success: true;
      value: unknown;
    }
  | {
      error: string;
      statusCode: number;
      success: false;
    };

async function handleRoomServiceRequest(
  config: MultiplayerRoomSidecarConfig,
  roomStore: MultiplayerRoomStore,
  gateway: MultiplayerRoomWebSocketGateway,
  route: RoomServiceRoute,
  request: IncomingMessage,
  response: ServerResponse,
) {
  if (!isAuthorizedRoomServiceRequest(config, request)) {
    sendJson(request, response, 401, {
      error: "Unauthorized.",
    });
    return;
  }

  if (route.kind === "collection") {
    if (request.method === "GET") {
      sendJson(request, response, 200, {
        mutationPathSegment: MULTIPLAYER_ROOM_PROTOCOL_PATH_SEGMENT,
        participantCapabilities: true,
        protocolVersion: MULTIPLAYER_ROOM_PROTOCOL_VERSION,
      });
      return;
    }

    if (request.method === "POST") {
      sendRoomServiceProtocolMismatch(request, response);
      return;
    }

    sendMethodNotAllowed(request, response, ["GET"]);
    return;
  }

  if (route.kind === "room") {
    if (request.method === "GET") {
      sendStoreResult(request, response, await roomStore.getRoom(route.roomCode));
      return;
    }

    if (request.method === "POST") {
      sendRoomServiceProtocolMismatch(request, response);
      return;
    }

    sendMethodNotAllowed(request, response, ["GET"]);
    return;
  }

  if (request.method !== "POST") {
    sendMethodNotAllowed(request, response, ["POST"]);
    return;
  }

  if (!hasSupportedRoomServiceProtocol(request)) {
    sendRoomServiceProtocolMismatch(request, response);
    return;
  }

  const body = await readJsonRequestBody(request);

  if (!body.success) {
    sendRoomServiceFailure(
      request,
      response,
      body.statusCode,
      body.error,
    );
    return;
  }

  if (route.kind === "mutation-collection") {
    const createOptions = parseCreateRoomOptions(body.value);

    if (!createOptions.success) {
      sendRoomServiceFailure(request, response, 400, createOptions.error);
      return;
    }

    sendStoreResult(
      request,
      response,
      await roomStore.createRoom(createOptions.options),
      201,
    );
    return;
  }

  const command = parseRoomServiceCommand(body.value);

  if (!command.success) {
    sendRoomServiceFailure(request, response, 400, command.error);
    return;
  }

  const result = await roomStore.applyCommand(route.roomCode, command.command);

  if (result.success) {
    gateway.broadcastSnapshot(result.snapshot);
  }

  sendStoreResult(request, response, result);
}

function getRoomServiceRoute(
  config: MultiplayerRoomSidecarConfig,
  pathname: string,
): RoomServiceRoute | null {
  const basePath = config.roomServicePath;

  if (pathname === basePath) {
    return {
      kind: "collection",
    };
  }

  const mutationBasePath = `${basePath}/${MULTIPLAYER_ROOM_PROTOCOL_PATH_SEGMENT}`;

  if (pathname === mutationBasePath) {
    return {
      kind: "mutation-collection",
    };
  }

  const mutationRoomPathPrefix = `${mutationBasePath}/`;

  if (pathname.startsWith(mutationRoomPathPrefix)) {
    const encodedRoomCode = pathname.slice(mutationRoomPathPrefix.length);

    if (encodedRoomCode.length === 0 || encodedRoomCode.includes("/")) {
      return null;
    }

    try {
      return {
        kind: "mutation-room",
        roomCode: decodeURIComponent(encodedRoomCode),
      };
    } catch {
      return null;
    }
  }

  const roomPathPrefix = basePath.endsWith("/") ? basePath : `${basePath}/`;

  if (!pathname.startsWith(roomPathPrefix)) {
    return null;
  }

  const encodedRoomCode = pathname.slice(roomPathPrefix.length);

  if (encodedRoomCode.length === 0 || encodedRoomCode.includes("/")) {
    return null;
  }

  try {
    return {
      kind: "room",
      roomCode: decodeURIComponent(encodedRoomCode),
    };
  } catch {
    return null;
  }
}

async function readJsonRequestBody(
  request: IncomingMessage,
): Promise<ReadJsonRequestBodyResult> {
  const chunks: Buffer[] = [];
  let bodyLength = 0;

  for await (const chunk of request) {
    const buffer = Buffer.from(chunk as Buffer);
    bodyLength += buffer.byteLength;

    if (bodyLength > MAX_ROOM_SERVICE_JSON_BODY_BYTES) {
      return {
        error: "Request body is too large.",
        statusCode: 413,
        success: false,
      };
    }

    chunks.push(buffer);
  }

  try {
    return {
      success: true,
      value: JSON.parse(Buffer.concat(chunks).toString("utf8")),
    };
  } catch {
    return {
      error: "Request body must be valid JSON.",
      statusCode: 400,
      success: false,
    };
  }
}

function parseCreateRoomOptions(value: unknown):
  | {
      options: CreateMultiplayerRoomOptions;
      success: true;
    }
  | {
      error: string;
      success: false;
    } {
  if (!isRecord(value) || !isRecord(value.host)) {
    return {
      error: "Create room body must include a host.",
      success: false,
    };
  }

  if (
    typeof value.host.displayName !== "string" ||
    typeof value.host.id !== "string"
  ) {
    return {
      error: "Create room host must include displayName and id.",
      success: false,
    };
  }

  if (value.settings !== undefined && !isRecord(value.settings)) {
    return {
      error: "Create room settings must be a JSON object.",
      success: false,
    };
  }

  return {
    options: value as CreateMultiplayerRoomOptions,
    success: true,
  };
}

function parseRoomServiceCommand(value: unknown):
  | {
      command: MultiplayerRoomStoreCommand;
      success: true;
    }
  | {
      error: string;
      success: false;
    } {
  if (!isRecord(value)) {
    return {
      error: "Room command must be a JSON object.",
      success: false,
    };
  }

  if (
    value.type === "room.joinObserver" ||
    value.type === "room.joinPlayer" ||
    value.type === "room.claimSeat" ||
    value.type === "room.releaseSeat" ||
    value.type === "game.input"
  ) {
    return {
      command: value as MultiplayerRoomStoreCommand,
      success: true,
    };
  }

  if (value.type === "room.lifecycle") {
    if (!isLifecycleCommand(value.command)) {
      return {
        error: "Room lifecycle command is not supported.",
        success: false,
      };
    }

    return {
      command: value as MultiplayerRoomStoreCommand,
      success: true,
    };
  }

  if (
    value.type === "room.replaceMatch" ||
    value.type === "room.updateSettings"
  ) {
    if (!isRecord(value.settings)) {
      return {
        error: "Room settings must be a supported JSON object.",
        success: false,
      };
    }

    return {
      command: value as MultiplayerRoomStoreCommand,
      success: true,
    };
  }

  return {
    error: "Room command type is not supported.",
    success: false,
  };
}

function isLifecycleCommand(value: unknown) {
  return (
    value === "finish" ||
    value === "pause" ||
    value === "restart" ||
    value === "resume" ||
    value === "start"
  );
}

function sendStoreResult(
  request: IncomingMessage,
  response: ServerResponse,
  result: MultiplayerRoomStoreResult,
  successStatusCode = 200,
) {
  sendJson(
    request,
    response,
    result.success
      ? successStatusCode
      : getMultiplayerRoomStoreErrorStatus(result.code),
    result,
  );
}

function sendRoomServiceFailure(
  request: IncomingMessage,
  response: ServerResponse,
  statusCode: number,
  error: string,
) {
  sendJson(request, response, statusCode, {
    code: "invalid-command",
    error,
    success: false,
  } satisfies MultiplayerRoomStoreResult);
}

function sendMethodNotAllowed(
  request: IncomingMessage,
  response: ServerResponse,
  allowedMethods: readonly string[],
) {
  sendJson(
    request,
    response,
    405,
    {
      error: "Method not allowed.",
    },
    {
      allow: allowedMethods.join(", "),
    },
  );
}

function isAuthorizedRoomServiceRequest(
  config: MultiplayerRoomSidecarConfig,
  request: IncomingMessage,
) {
  if (config.roomServiceBearerToken === undefined) {
    return true;
  }

  return (
    request.headers.authorization ===
    `Bearer ${config.roomServiceBearerToken}`
  );
}

function hasSupportedRoomServiceProtocol(request: IncomingMessage) {
  return (
    request.headers[MULTIPLAYER_ROOM_PROTOCOL_VERSION_HEADER] ===
    String(MULTIPLAYER_ROOM_PROTOCOL_VERSION)
  );
}

function sendRoomServiceProtocolMismatch(
  request: IncomingMessage,
  response: ServerResponse,
) {
  sendJson(request, response, 426, {
    error: "Room service protocol version is not supported.",
  });
}

function getRequestPathname(url: string | undefined) {
  try {
    return new URL(url ?? "/", "http://multiplayer-sidecar.local").pathname;
  } catch {
    return "/";
  }
}

function sendJson(
  request: IncomingMessage,
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
  headers: Readonly<Record<string, string>> = {},
) {
  const body = JSON.stringify(payload);

  response.writeHead(statusCode, {
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body),
    "content-type": "application/json; charset=utf-8",
    ...headers,
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  response.end(body);
}

function sendUnhandledError(
  request: IncomingMessage,
  response: ServerResponse,
  error: unknown,
) {
  if (response.headersSent) {
    response.destroy();
    return;
  }

  sendJson(request, response, 500, {
    error:
      error instanceof Error
        ? `Room service request failed: ${error.message}`
        : "Room service request failed.",
  });
}

function listen(server: HttpServer, config: MultiplayerRoomSidecarConfig) {
  if (server.listening) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const handleError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const handleListening = () => {
      cleanup();
      resolve();
    };
    const cleanup = () => {
      server.off("error", handleError);
      server.off("listening", handleListening);
    };

    server.once("error", handleError);
    server.once("listening", handleListening);
    server.listen(config.port, config.host);
  });
}

async function closeSidecar(
  server: HttpServer,
  gateway: MultiplayerRoomWebSocketGateway,
) {
  await Promise.all([gateway.close(), closeHttpServer(server)]);
}

function closeHttpServer(server: HttpServer) {
  if (!server.listening) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) {
        resolve();
      } else {
        reject(error);
      }
    });
  });
}

function registerShutdownHandlers(sidecar: MultiplayerRoomSidecar) {
  let isShuttingDown = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    void sidecar.close().catch((error: unknown) => {
      process.exitCode = 1;
      console.error(
        `${MULTIPLAYER_SIDECAR_SERVICE_NAME} failed to shut down after ${signal}:`,
        error,
      );
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

function formatServerAddress(
  server: HttpServer,
  config: MultiplayerRoomSidecarConfig,
) {
  const address = server.address();

  if (address === null) {
    return `${config.host}:${config.port}`;
  }

  if (typeof address === "string") {
    return address;
  }

  return `${formatHostForAddress(address)}:${address.port}`;
}

function formatHostForAddress(address: AddressInfo) {
  return address.family === "IPv6" ? `[${address.address}]` : address.address;
}

function parsePortEnv(
  value: string | undefined,
  envName: string,
  fallback: number,
) {
  const trimmedValue = getOptionalEnvString(value);

  if (trimmedValue === undefined) {
    return fallback;
  }

  const port = Number(trimmedValue);

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`${envName} must be an integer from 0 through 65535.`);
  }

  return port;
}

function parsePositiveIntegerEnv(
  value: string | undefined,
  envName: string,
  fallback: number,
) {
  const trimmedValue = getOptionalEnvString(value);

  if (trimmedValue === undefined) {
    return fallback;
  }

  const integer = Number(trimmedValue);

  if (!Number.isSafeInteger(integer) || integer <= 0) {
    throw new Error(`${envName} must be a positive integer.`);
  }

  return integer;
}

function parsePathEnv(
  value: string | undefined,
  envName: string,
  fallback: string,
) {
  const path = getOptionalEnvString(value) ?? fallback;

  if (!path.startsWith("/")) {
    throw new Error(`${envName} must start with "/".`);
  }

  if (path.includes("?") || path.includes("#")) {
    throw new Error(`${envName} must be a URL path without query or fragment.`);
  }

  return path;
}

function getOptionalEnvString(value: string | undefined) {
  const trimmedValue = value?.trim();

  return trimmedValue === undefined || trimmedValue.length === 0
    ? undefined
    : trimmedValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

if (
  typeof require !== "undefined" &&
  typeof module !== "undefined" &&
  require.main === module
) {
  void runMultiplayerRoomSidecarFromEnv().catch((error: unknown) => {
    process.exitCode = 1;
    console.error(`${MULTIPLAYER_SIDECAR_SERVICE_NAME} failed to start:`, error);
  });
}
