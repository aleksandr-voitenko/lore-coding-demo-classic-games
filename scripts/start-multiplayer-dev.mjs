#!/usr/bin/env node

import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const DEFAULT_NEXT_HOST = "0.0.0.0";
const DEFAULT_NEXT_PORT = 3000;
const DEFAULT_PUBLIC_HOST = "127.0.0.1";
const DEFAULT_SIDECAR_HOST = "0.0.0.0";
const DEFAULT_SIDECAR_INTERNAL_HOST = "127.0.0.1";
const DEFAULT_SIDECAR_PORT = 3001;
const DEFAULT_SNAPSHOT_INTERVAL_MS = 33;
const ROOM_SERVICE_PATH = "/_internal/multiplayer/rooms";
const WEBSOCKET_PATH = "/multiplayer/rooms";

export function getLanIPv4Candidates(networkInterfaces = os.networkInterfaces()) {
  return Object.entries(networkInterfaces)
    .flatMap(([name, addresses]) =>
      (addresses ?? []).map((address) => ({
        address,
        name,
      })),
    )
    .filter(({ address }) => isUsableIPv4Address(address))
    .map(({ address, name }) => ({
      address: address.address,
      name,
      private: isPrivateIPv4Address(address.address),
    }))
    .sort((first, second) => Number(second.private) - Number(first.private));
}

export function resolveMultiplayerDevConfig(
  env = process.env,
  networkInterfaces = os.networkInterfaces(),
) {
  const lanCandidates = getLanIPv4Candidates(networkInterfaces);
  const publicHost =
    getOptionalEnvString(env.MULTIPLAYER_DEV_PUBLIC_HOST) ??
    getOptionalEnvString(env.NEXT_PUBLIC_MULTIPLAYER_HOST) ??
    lanCandidates[0]?.address ??
    DEFAULT_PUBLIC_HOST;
  const sidecarPort = readIntegerEnv(
    env.MULTIPLAYER_DEV_SIDECAR_PORT ?? env.MULTIPLAYER_SIDECAR_PORT,
    DEFAULT_SIDECAR_PORT,
    { min: 1, name: "MULTIPLAYER_DEV_SIDECAR_PORT" },
  );
  const sidecarInternalHost =
    getOptionalEnvString(env.MULTIPLAYER_DEV_SIDECAR_INTERNAL_HOST) ??
    DEFAULT_SIDECAR_INTERNAL_HOST;
  const sidecarRoomServicePath =
    getOptionalEnvString(env.MULTIPLAYER_SIDECAR_ROOM_SERVICE_PATH) ??
    ROOM_SERVICE_PATH;
  const sidecarWebSocketPath =
    getOptionalEnvString(env.MULTIPLAYER_SIDECAR_WEBSOCKET_PATH) ??
    WEBSOCKET_PATH;

  return {
    lanCandidates,
    nextHost:
      getOptionalEnvString(env.MULTIPLAYER_DEV_NEXT_HOST) ?? DEFAULT_NEXT_HOST,
    nextPort: readIntegerEnv(env.MULTIPLAYER_DEV_NEXT_PORT, DEFAULT_NEXT_PORT, {
      min: 1,
      name: "MULTIPLAYER_DEV_NEXT_PORT",
    }),
    publicHost,
    roomServiceUrl:
      getOptionalEnvString(env.MULTIPLAYER_ROOM_SERVICE_URL) ??
      `http://${sidecarInternalHost}:${sidecarPort}${sidecarRoomServicePath}`,
    sidecarHost:
      getOptionalEnvString(env.MULTIPLAYER_DEV_SIDECAR_HOST) ??
      getOptionalEnvString(env.MULTIPLAYER_SIDECAR_HOST) ??
      DEFAULT_SIDECAR_HOST,
    sidecarPort,
    snapshotIntervalMs: readIntegerEnv(
      env.MULTIPLAYER_DEV_SNAPSHOT_INTERVAL_MS ??
        env.MULTIPLAYER_SIDECAR_SNAPSHOT_INTERVAL_MS,
      DEFAULT_SNAPSHOT_INTERVAL_MS,
      { min: 1, name: "MULTIPLAYER_DEV_SNAPSHOT_INTERVAL_MS" },
    ),
    webSocketUrl:
      getOptionalEnvString(env.NEXT_PUBLIC_MULTIPLAYER_WEBSOCKET_URL) ??
      `ws://${publicHost}:${sidecarPort}${sidecarWebSocketPath}`,
  };
}

export function createMultiplayerDevProcessSpecs(config, env = process.env) {
  return [
    {
      args: ["run", "start:sidecar"],
      env: {
        ...env,
        MULTIPLAYER_SIDECAR_HOST: config.sidecarHost,
        MULTIPLAYER_SIDECAR_PORT: String(config.sidecarPort),
        MULTIPLAYER_SIDECAR_SNAPSHOT_INTERVAL_MS: String(
          config.snapshotIntervalMs,
        ),
      },
      label: "sidecar",
    },
    {
      args: [
        "run",
        "dev",
        "--",
        "--hostname",
        config.nextHost,
        "--port",
        String(config.nextPort),
      ],
      env: {
        ...env,
        MULTIPLAYER_ROOM_SERVICE_URL: config.roomServiceUrl,
        NEXT_PUBLIC_MULTIPLAYER_WEBSOCKET_URL: config.webSocketUrl,
      },
      label: "next",
    },
  ];
}

function startMultiplayerDev() {
  const config = resolveMultiplayerDevConfig();
  const specs = createMultiplayerDevProcessSpecs(config);
  const children = new Map();
  let isShuttingDown = false;

  printStartupSummary(config);

  for (const spec of specs) {
    const child = spawn(getNpmCommand(), spec.args, {
      env: spec.env,
      stdio: "inherit",
    });

    children.set(spec.label, child);

    child.on("error", (error) => {
      if (isShuttingDown) {
        return;
      }

      console.error(`Failed to start ${spec.label}:`, error);
      isShuttingDown = true;
      children.delete(spec.label);
      terminateChildren(children, "SIGTERM");
      process.exitCode = 1;
    });

    child.on("exit", (code, signal) => {
      children.delete(spec.label);

      if (isShuttingDown) {
        return;
      }

      isShuttingDown = true;
      terminateChildren(children, signal ?? "SIGTERM");
      process.exitCode = code ?? (signal === null ? 1 : 0);
    });
  }

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      if (isShuttingDown) {
        return;
      }

      isShuttingDown = true;
      terminateChildren(children, signal);
    });
  }
}

function printStartupSummary(config) {
  console.info("Starting multiplayer dev environment");
  console.info(`  App:       http://${config.publicHost}:${config.nextPort}`);
  console.info(`  WebSocket: ${config.webSocketUrl}`);
  console.info(`  Service:   ${config.roomServiceUrl}`);
  console.info(
    `  Sidecar:   ${config.sidecarHost}:${config.sidecarPort}, snapshots ${config.snapshotIntervalMs}ms`,
  );

  if (config.lanCandidates.length > 1) {
    console.info(
      `  LAN IPs:    ${config.lanCandidates
        .map((candidate) => `${candidate.address} (${candidate.name})`)
        .join(", ")}`,
    );
    console.info(
      "  Override:  MULTIPLAYER_DEV_PUBLIC_HOST=<ip> npm run dev:multiplayer",
    );
  }
}

function terminateChildren(children, signal) {
  for (const child of children.values()) {
    child.kill(signal);
  }
}

function getNpmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function isUsableIPv4Address(address) {
  return (
    !address.internal &&
    (address.family === "IPv4" || address.family === 4) &&
    address.address !== "0.0.0.0"
  );
}

function isPrivateIPv4Address(address) {
  const octets = address.split(".").map(Number);

  if (octets.length !== 4 || octets.some((octet) => Number.isNaN(octet))) {
    return false;
  }

  const [first, second] = octets;

  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function getOptionalEnvString(value) {
  if (value === undefined) {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length === 0 ? undefined : trimmedValue;
}

function readIntegerEnv(value, fallback, { min, name }) {
  if (value === undefined || value.trim().length === 0) {
    return fallback;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < min) {
    throw new Error(`${name} must be an integer greater than or equal to ${min}.`);
  }

  return parsedValue;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startMultiplayerDev();
}
