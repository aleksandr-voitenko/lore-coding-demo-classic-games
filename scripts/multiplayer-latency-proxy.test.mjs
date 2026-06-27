import { describe, expect, it } from "vitest";

import {
  createSeededRandom,
  getForwardableWebSocketCloseCode,
  getLatencyHopDelayMs,
  resolveLatencyProxyConfig,
  shouldDropLatencyFrame,
} from "./multiplayer-latency-proxy.mjs";

describe("multiplayer latency proxy configuration", () => {
  it("resolves named internet-condition profiles", () => {
    expect(
      resolveLatencyProxyConfig({
        MULTIPLAYER_LATENCY_PROXY_PROFILE: "rough",
      }),
    ).toMatchObject({
      dropRate: 0,
      jitterMs: 30,
      profileName: "rough",
      rttMs: 120,
      targetHttpOrigin: "http://127.0.0.1:3001",
      targetWebSocketOrigin: "ws://127.0.0.1:3001",
    });
  });

  it("allows explicit profile overrides", () => {
    expect(
      resolveLatencyProxyConfig({
        MULTIPLAYER_LATENCY_PROXY_DROP_RATE: "0.1",
        MULTIPLAYER_LATENCY_PROXY_JITTER_MS: "8",
        MULTIPLAYER_LATENCY_PROXY_PROFILE: "good",
        MULTIPLAYER_LATENCY_PROXY_RTT_MS: "64",
        MULTIPLAYER_LATENCY_PROXY_TARGET: "https://example.test:4443",
      }),
    ).toMatchObject({
      dropRate: 0.1,
      jitterMs: 8,
      profileName: "good",
      rttMs: 64,
      targetHttpOrigin: "https://example.test:4443",
      targetWebSocketOrigin: "wss://example.test:4443",
    });
  });

  it("rejects unsupported profiles", () => {
    expect(() =>
      resolveLatencyProxyConfig({
        MULTIPLAYER_LATENCY_PROXY_PROFILE: "satellite-ish",
      }),
    ).toThrow(/Unsupported MULTIPLAYER_LATENCY_PROXY_PROFILE/);
  });
});

describe("multiplayer latency proxy shaping helpers", () => {
  it("splits configured RTT into deterministic per-hop delay samples", () => {
    const firstRandom = createSeededRandom("same-seed");
    const secondRandom = createSeededRandom("same-seed");
    const config = {
      jitterMs: 20,
      rttMs: 80,
    };
    const firstSamples = Array.from({ length: 5 }, () =>
      getLatencyHopDelayMs(config, firstRandom),
    );
    const secondSamples = Array.from({ length: 5 }, () =>
      getLatencyHopDelayMs(config, secondRandom),
    );

    expect(firstSamples).toEqual(secondSamples);
    expect(Math.min(...firstSamples)).toBeGreaterThanOrEqual(30);
    expect(Math.max(...firstSamples)).toBeLessThanOrEqual(50);
  });

  it("applies deterministic frame drops when configured", () => {
    expect(shouldDropLatencyFrame(0, () => 0)).toBe(false);
    expect(shouldDropLatencyFrame(1, () => 0.999)).toBe(true);
    expect(shouldDropLatencyFrame(0.5, () => 0.75)).toBe(false);
    expect(shouldDropLatencyFrame(0.5, () => 0.25)).toBe(true);
  });

  it("forwards only WebSocket close codes that peers may send", () => {
    expect(getForwardableWebSocketCloseCode(1000)).toBe(1000);
    expect(getForwardableWebSocketCloseCode(3000)).toBe(3000);
    expect(getForwardableWebSocketCloseCode(4999)).toBe(4999);
    expect(getForwardableWebSocketCloseCode(1005)).toBeUndefined();
    expect(getForwardableWebSocketCloseCode(1006)).toBeUndefined();
    expect(getForwardableWebSocketCloseCode(2000)).toBeUndefined();
    expect(getForwardableWebSocketCloseCode(5000)).toBeUndefined();
  });
});
