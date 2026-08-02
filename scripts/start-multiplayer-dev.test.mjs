import { describe, expect, it } from "vitest";

import {
  createMultiplayerDevProcessSpecs,
  getLanIPv4Candidates,
  resolveMultiplayerDevConfig,
} from "./start-multiplayer-dev.mjs";

const invalidPublicHosts = [
  ["bare wildcard", "*"],
  ["wildcard IPv4 pattern", "10.*.*.*"],
  ["protocol", "http://192.168.1.50"],
  ["port", "192.168.1.50:3000"],
  ["path", "192.168.1.50/app"],
  ["hostname", "arcade.local"],
  ["raw IPv6", "fe80::1"],
  ["bracketed IPv6", "[fe80::1]"],
  ["out-of-range octet", "192.168.1.999"],
  ["noncanonical octet", "192.168.001.50"],
];

describe("start multiplayer dev wrapper", () => {
  it("prefers private LAN IPv4 addresses for browser-reachable URLs", () => {
    const config = resolveMultiplayerDevConfig(
      {},
      {
        lo0: [
          {
            address: "127.0.0.1",
            family: "IPv4",
            internal: true,
          },
        ],
        utun1: [
          {
            address: "100.64.0.4",
            family: "IPv4",
            internal: false,
          },
        ],
        en0: [
          {
            address: "10.125.3.39",
            family: "IPv4",
            internal: false,
          },
        ],
      },
    );

    expect(config.publicHost).toBe("10.125.3.39");
    expect(config.roomServiceUrl).toBe(
      "http://127.0.0.1:3001/_internal/multiplayer/rooms",
    );
    expect(config.webSocketUrl).toBe(
      "ws://10.125.3.39:3001/multiplayer/rooms",
    );
  });

  it("keeps non-private IPv4 candidates as a fallback when no LAN address exists", () => {
    expect(
      getLanIPv4Candidates({
        utun1: [
          {
            address: "100.64.0.4",
            family: "IPv4",
            internal: false,
          },
        ],
      }),
    ).toEqual([
      {
        address: "100.64.0.4",
        name: "utun1",
        private: false,
      },
    ]);
  });

  it("ignores malformed or noncanonical IPv4 interface entries", () => {
    expect(
      getLanIPv4Candidates({
        en0: [
          {
            address: "192.168.1.999",
            family: "IPv4",
            internal: false,
          },
          {
            address: "192.168.001.50",
            family: "IPv4",
            internal: false,
          },
        ],
      }),
    ).toEqual([]);
  });

  it("allows explicit public host, port, and snapshot overrides", () => {
    const config = resolveMultiplayerDevConfig(
      {
        MULTIPLAYER_DEV_NEXT_PORT: "3100",
        MULTIPLAYER_DEV_PUBLIC_HOST: "192.168.1.50",
        MULTIPLAYER_DEV_SIDECAR_PORT: "3101",
        MULTIPLAYER_DEV_SNAPSHOT_INTERVAL_MS: "50",
      },
      {},
    );

    expect(config).toMatchObject({
      nextPort: 3100,
      publicHost: "192.168.1.50",
      roomServiceUrl: "http://127.0.0.1:3101/_internal/multiplayer/rooms",
      sidecarPort: 3101,
      snapshotIntervalMs: 50,
      webSocketUrl: "ws://192.168.1.50:3101/multiplayer/rooms",
    });
  });

  it("falls back to a discovered address for a whitespace-only public host", () => {
    const config = resolveMultiplayerDevConfig(
      {
        MULTIPLAYER_DEV_PUBLIC_HOST: "   ",
      },
      {
        en0: [
          {
            address: "192.168.1.50",
            family: "IPv4",
            internal: false,
          },
        ],
      },
    );

    expect(config.publicHost).toBe("192.168.1.50");
  });

  it.each(invalidPublicHosts)(
    "rejects an explicit public host containing a %s",
    (_label, publicHost) => {
      expect(() =>
        resolveMultiplayerDevConfig(
          {
            MULTIPLAYER_DEV_PUBLIC_HOST: publicHost,
          },
          {},
        ),
      ).toThrow("MULTIPLAYER_DEV_PUBLIC_HOST must be an exact IPv4 address");
    },
  );

  it("validates the legacy public-host fallback with the same IPv4 boundary", () => {
    expect(() =>
      resolveMultiplayerDevConfig(
        {
          NEXT_PUBLIC_MULTIPLAYER_HOST: "arcade.local",
        },
        {},
      ),
    ).toThrow("NEXT_PUBLIC_MULTIPLAYER_HOST must be an exact IPv4 address");
  });

  it("passes resolved multiplayer env into sidecar and Next commands", () => {
    const config = resolveMultiplayerDevConfig(
      {
        MULTIPLAYER_DEV_PUBLIC_HOST: "192.168.50.9",
      },
      {},
    );
    const specs = createMultiplayerDevProcessSpecs(
      config,
      {
        PATH: "/usr/bin",
      },
      () => "generated-dev-secret",
    );

    expect(specs).toMatchObject([
      {
        args: ["run", "start:sidecar"],
        env: {
          MULTIPLAYER_SIDECAR_HOST: "0.0.0.0",
          MULTIPLAYER_SIDECAR_PORT: "3001",
          MULTIPLAYER_SIDECAR_ROOM_SERVICE_BEARER_TOKEN:
            "generated-dev-secret",
          MULTIPLAYER_SIDECAR_SNAPSHOT_INTERVAL_MS: "33",
          PATH: "/usr/bin",
        },
        label: "sidecar",
      },
      {
        args: [
          "run",
          "dev",
          "--",
          "--hostname",
          "0.0.0.0",
          "--port",
          "3000",
        ],
        env: {
          MULTIPLAYER_DEV_PUBLIC_HOST: "192.168.50.9",
          MULTIPLAYER_ROOM_SERVICE_URL:
            "http://127.0.0.1:3001/_internal/multiplayer/rooms",
          MULTIPLAYER_ROOM_SERVICE_CLIENT_BEARER_TOKEN:
            "generated-dev-secret",
          NEXT_PUBLIC_MULTIPLAYER_WEBSOCKET_URL:
            "ws://192.168.50.9:3001/multiplayer/rooms",
          PATH: "/usr/bin",
        },
        label: "next",
      },
    ]);
  });

  it("rejects mismatched room-service bearer secrets", () => {
    const config = resolveMultiplayerDevConfig({}, {});

    expect(() =>
      createMultiplayerDevProcessSpecs(config, {
        MULTIPLAYER_ROOM_SERVICE_CLIENT_BEARER_TOKEN: "next-secret",
        MULTIPLAYER_SIDECAR_ROOM_SERVICE_BEARER_TOKEN: "sidecar-secret",
      }),
    ).toThrow(
      "MULTIPLAYER_SIDECAR_ROOM_SERVICE_BEARER_TOKEN and MULTIPLAYER_ROOM_SERVICE_CLIENT_BEARER_TOKEN must match.",
    );
  });
});
