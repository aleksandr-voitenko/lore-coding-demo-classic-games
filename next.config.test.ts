import { afterEach, describe, expect, it, vi } from "vitest";
import { isCsrfOriginAllowed } from "next/dist/server/app-render/csrf-protection";

const originalPublicHost = process.env.MULTIPLAYER_DEV_PUBLIC_HOST;
const invalidPublicHosts = [
  ["bare wildcard", "*"],
  ["wildcard IPv4 pattern", "10.*.*.*"],
  ["protocol", "http://192.168.50.9"],
  ["port", "192.168.50.9:3000"],
  ["path", "192.168.50.9/app"],
  ["hostname", "arcade.local"],
  ["raw IPv6", "fe80::1"],
  ["bracketed IPv6", "[fe80::1]"],
  ["out-of-range octet", "192.168.50.999"],
  ["noncanonical octet", "192.168.050.9"],
] as const;

async function loadNextConfig() {
  vi.resetModules();
  return (await import("./next.config")).default;
}

afterEach(() => {
  if (originalPublicHost === undefined) {
    delete process.env.MULTIPLAYER_DEV_PUBLIC_HOST;
  } else {
    process.env.MULTIPLAYER_DEV_PUBLIC_HOST = originalPublicHost;
  }

  vi.resetModules();
});

describe("Next development origins", () => {
  it("does not add a custom LAN origin outside the multiplayer wrapper", async () => {
    delete process.env.MULTIPLAYER_DEV_PUBLIC_HOST;

    const nextConfig = await loadNextConfig();

    expect(nextConfig.allowedDevOrigins).toBeUndefined();
  });

  it("treats a whitespace-only forwarded host as absent", async () => {
    process.env.MULTIPLAYER_DEV_PUBLIC_HOST = "   ";

    const nextConfig = await loadNextConfig();

    expect(nextConfig.allowedDevOrigins).toBeUndefined();
  });

  it("allows only the exact LAN host resolved by the multiplayer wrapper", async () => {
    process.env.MULTIPLAYER_DEV_PUBLIC_HOST = "192.168.50.9";

    const nextConfig = await loadNextConfig();

    expect(nextConfig.allowedDevOrigins).toEqual(["192.168.50.9"]);
    expect(
      isCsrfOriginAllowed("192.168.50.9", nextConfig.allowedDevOrigins),
    ).toBe(true);
    expect(
      isCsrfOriginAllowed("192.168.50.10", nextConfig.allowedDevOrigins),
    ).toBe(false);
  });

  it.each(invalidPublicHosts)(
    "rejects a forwarded host containing a %s",
    async (_label, publicHost) => {
      process.env.MULTIPLAYER_DEV_PUBLIC_HOST = publicHost;

      await expect(loadNextConfig()).rejects.toThrow(
        "MULTIPLAYER_DEV_PUBLIC_HOST must be an exact IPv4 address",
      );
    },
  );
});
