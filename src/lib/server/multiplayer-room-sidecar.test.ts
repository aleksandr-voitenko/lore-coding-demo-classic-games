import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";

import {
  DEFAULT_MULTIPLAYER_SIDECAR_HOST,
  DEFAULT_MULTIPLAYER_SIDECAR_PORT,
  DEFAULT_MULTIPLAYER_SIDECAR_WEBSOCKET_PATH,
  MULTIPLAYER_SIDECAR_HEALTH_PATH,
  createMultiplayerRoomSidecar,
  parseMultiplayerRoomSidecarConfig,
  type MultiplayerRoomSidecar,
} from "./multiplayer-room-sidecar";

const cleanupCallbacks: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  const callbacks = cleanupCallbacks.splice(0).reverse();

  await Promise.all(callbacks.map((callback) => Promise.resolve().then(callback)));
});

function createTestConfig(
  overrides: Partial<ReturnType<typeof parseMultiplayerRoomSidecarConfig>> = {},
) {
  return {
    healthPath: MULTIPLAYER_SIDECAR_HEALTH_PATH,
    host: "127.0.0.1",
    port: 0,
    websocketPath: "/rooms",
    ...overrides,
  };
}

function getOrigin(sidecar: MultiplayerRoomSidecar) {
  const address = sidecar.server.address();

  if (address === null || typeof address === "string") {
    throw new Error("Expected the sidecar test server to listen on a TCP port.");
  }

  return `http://127.0.0.1:${(address as AddressInfo).port}`;
}

async function createStartedSidecar(
  config = createTestConfig(),
): Promise<MultiplayerRoomSidecar> {
  const sidecar = createMultiplayerRoomSidecar(config);

  cleanupCallbacks.push(() => sidecar.close());
  await sidecar.start();

  return sidecar;
}

async function connectClient(url: string) {
  const client = new WebSocket(url);

  cleanupCallbacks.push(() => {
    if (
      client.readyState === WebSocket.CONNECTING ||
      client.readyState === WebSocket.OPEN
    ) {
      client.terminate();
    }
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for the WebSocket client to open."));
    }, 1_000);
    const handleOpen = () => {
      cleanup();
      resolve();
    };
    const handleError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timeout);
      client.off("open", handleOpen);
      client.off("error", handleError);
    };

    client.once("open", handleOpen);
    client.once("error", handleError);
  });

  return client;
}

describe("multiplayer room sidecar", () => {
  it("parses safe defaults and environment overrides", () => {
    expect(parseMultiplayerRoomSidecarConfig({})).toEqual({
      healthPath: MULTIPLAYER_SIDECAR_HEALTH_PATH,
      host: DEFAULT_MULTIPLAYER_SIDECAR_HOST,
      port: DEFAULT_MULTIPLAYER_SIDECAR_PORT,
      websocketPath: DEFAULT_MULTIPLAYER_SIDECAR_WEBSOCKET_PATH,
    });

    expect(
      parseMultiplayerRoomSidecarConfig({
        MULTIPLAYER_SIDECAR_HOST: " 0.0.0.0 ",
        MULTIPLAYER_SIDECAR_PORT: "3002",
        MULTIPLAYER_SIDECAR_WEBSOCKET_PATH: " /ws/rooms ",
      }),
    ).toEqual({
      healthPath: MULTIPLAYER_SIDECAR_HEALTH_PATH,
      host: "0.0.0.0",
      port: 3002,
      websocketPath: "/ws/rooms",
    });
  });

  it("rejects invalid sidecar port and WebSocket path configuration", () => {
    expect(() =>
      parseMultiplayerRoomSidecarConfig({
        MULTIPLAYER_SIDECAR_PORT: "not-a-port",
      }),
    ).toThrow("MULTIPLAYER_SIDECAR_PORT must be an integer");

    expect(() =>
      parseMultiplayerRoomSidecarConfig({
        MULTIPLAYER_SIDECAR_WEBSOCKET_PATH: "rooms",
      }),
    ).toThrow('MULTIPLAYER_SIDECAR_WEBSOCKET_PATH must start with "/"');

    expect(() =>
      parseMultiplayerRoomSidecarConfig({
        MULTIPLAYER_SIDECAR_WEBSOCKET_PATH: "/rooms?debug=true",
      }),
    ).toThrow("MULTIPLAYER_SIDECAR_WEBSOCKET_PATH must be a URL path");
  });

  it("serves health JSON and closes the HTTP server", async () => {
    const sidecar = await createStartedSidecar();
    const origin = getOrigin(sidecar);

    const healthResponse = await fetch(`${origin}/healthz`);

    expect(healthResponse.status).toBe(200);
    await expect(healthResponse.json()).resolves.toEqual({
      service: "multiplayer-room-sidecar",
      status: "ok",
      websocketPath: "/rooms",
    });

    const missingResponse = await fetch(`${origin}/missing`);

    expect(missingResponse.status).toBe(404);
    await expect(missingResponse.json()).resolves.toEqual({
      error: "Not found.",
    });

    expect(sidecar.server.listening).toBe(true);
    await sidecar.close();
    expect(sidecar.server.listening).toBe(false);
  });

  it("attaches the room WebSocket gateway to the configured path", async () => {
    const sidecar = await createStartedSidecar();
    const origin = getOrigin(sidecar);
    const client = await connectClient(origin.replace("http://", "ws://") + "/rooms");

    expect(client.readyState).toBe(WebSocket.OPEN);
  });

  it("imports without resolving the Next server-only marker", async () => {
    vi.resetModules();
    vi.doMock("server-only", () => {
      throw new Error("The sidecar entrypoint must not import server-only.");
    });

    try {
      const { createMultiplayerRoomSidecar: createSidecar } = await import(
        "./multiplayer-room-sidecar"
      );
      const sidecar = createSidecar(createTestConfig());

      cleanupCallbacks.push(() => sidecar.close());

      expect(sidecar.gateway.webSocketServer.options.path).toBe("/rooms");
    } finally {
      vi.doUnmock("server-only");
    }
  });
});
