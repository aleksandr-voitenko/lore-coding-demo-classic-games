import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo, Server as HttpServer } from "node:net";

import {
  createMultiplayerRoomWebSocketGateway,
  type MultiplayerRoomWebSocketGateway,
} from "./multiplayer-room-websocket";

export const DEFAULT_MULTIPLAYER_SIDECAR_HOST = "127.0.0.1";
export const DEFAULT_MULTIPLAYER_SIDECAR_PORT = 3001;
export const DEFAULT_MULTIPLAYER_SIDECAR_WEBSOCKET_PATH = "/multiplayer/rooms";
export const MULTIPLAYER_SIDECAR_HEALTH_PATH = "/healthz";

const MULTIPLAYER_SIDECAR_SERVICE_NAME = "multiplayer-room-sidecar";

export type MultiplayerRoomSidecarConfig = {
  healthPath: string;
  host: string;
  port: number;
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
  return {
    healthPath: MULTIPLAYER_SIDECAR_HEALTH_PATH,
    host:
      getOptionalEnvString(env.MULTIPLAYER_SIDECAR_HOST) ??
      DEFAULT_MULTIPLAYER_SIDECAR_HOST,
    port: parsePortEnv(
      env.MULTIPLAYER_SIDECAR_PORT,
      "MULTIPLAYER_SIDECAR_PORT",
      DEFAULT_MULTIPLAYER_SIDECAR_PORT,
    ),
    websocketPath: parsePathEnv(
      env.MULTIPLAYER_SIDECAR_WEBSOCKET_PATH,
      "MULTIPLAYER_SIDECAR_WEBSOCKET_PATH",
      DEFAULT_MULTIPLAYER_SIDECAR_WEBSOCKET_PATH,
    ),
  };
}

export function createMultiplayerRoomSidecar(
  config: MultiplayerRoomSidecarConfig = parseMultiplayerRoomSidecarConfig(),
): MultiplayerRoomSidecar {
  const server = createServer((request, response) => {
    handleHttpRequest(config, request, response);
  });
  const gateway = createMultiplayerRoomWebSocketGateway({
    path: config.websocketPath,
    server,
  });
  let closePromise: Promise<void> | null = null;

  return {
    close: () => {
      closePromise ??= closeSidecar(server, gateway);

      return closePromise;
    },
    config,
    gateway,
    server,
    start: () => listen(server, config),
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
    )} with WebSocket path ${sidecar.config.websocketPath}`,
  );

  return sidecar;
}

function handleHttpRequest(
  config: MultiplayerRoomSidecarConfig,
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
        service: MULTIPLAYER_SIDECAR_SERVICE_NAME,
        status: "ok",
        websocketPath: config.websocketPath,
      },
    );
    return;
  }

  sendJson(request, response, 404, {
    error: "Not found.",
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
) {
  const body = JSON.stringify(payload);

  response.writeHead(statusCode, {
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body),
    "content-type": "application/json; charset=utf-8",
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  response.end(body);
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
