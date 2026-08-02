import { describe, expect, it, vi } from "vitest";

import type { SqliteSocialStore } from "@/lib/server/sqlite-social-store";

import * as discoveryRoute from "./route";
import { createSocialDiscoveryRouteHandlers } from "./route-handlers";

const USER = { displayName: "Ada", id: "user-1" };

function allowRateLimit() {
  return vi.fn(async () => ({
    allowed: true,
    remaining: 10,
    resetAt: "2026-08-03T10:01:00.000Z",
    retryAfterSeconds: 0,
    success: true as const,
  }));
}

describe("social discovery route", () => {
  it("exports only the supported Next.js route fields", () => {
    expect(Object.keys(discoveryRoute).sort()).toEqual([
      "GET",
      "dynamic",
      "runtime",
    ]);
  });

  it("discovers an exact display name for the authenticated actor", async () => {
    const socialStore = {
      consumeSocialApiRateLimit: allowRateLimit(),
      discoverUser: vi.fn(async () => ({
        discovery: {
          relationship: "none" as const,
          user: { displayName: "Grace Hopper", id: "user-2" },
        },
        success: true as const,
      })),
    } satisfies Pick<
      SqliteSocialStore,
      "consumeSocialApiRateLimit" | "discoverUser"
    >;
    const handlers = createSocialDiscoveryRouteHandlers(socialStore, {
      getUserBySessionToken: vi.fn(async () => USER),
    });
    const response = await handlers.GET(
      new Request(
        "http://localhost/api/social/discovery?displayName=Grace%20Hopper",
        { headers: { cookie: "game_user_session=session-token" } },
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(socialStore.discoverUser).toHaveBeenCalledWith(
      USER.id,
      "Grace Hopper",
    );
    await expect(response.json()).resolves.toEqual({
      discovery: {
        relationship: "none",
        user: { displayName: "Grace Hopper", id: "user-2" },
      },
    });
  });

  it("preserves privacy-safe empty discovery results", async () => {
    const handlers = createSocialDiscoveryRouteHandlers(
      {
        consumeSocialApiRateLimit: allowRateLimit(),
        discoverUser: vi.fn(async () => ({
          discovery: null,
          success: true as const,
        })),
      },
      { getUserBySessionToken: vi.fn(async () => USER) },
    );
    const response = await handlers.GET(
      new Request(
        "http://localhost/api/social/discovery?displayName=Hidden%20User",
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ discovery: null });
  });

  it("requires authentication before discovery", async () => {
    const socialStore = {
      consumeSocialApiRateLimit: vi.fn(),
      discoverUser: vi.fn(),
    } as unknown as Pick<
      SqliteSocialStore,
      "consumeSocialApiRateLimit" | "discoverUser"
    >;
    const handlers = createSocialDiscoveryRouteHandlers(socialStore, {
      getUserBySessionToken: vi.fn(async () => null),
    });
    const response = await handlers.GET(
      new Request("http://localhost/api/social/discovery?displayName=Grace"),
    );

    expect(response.status).toBe(401);
    expect(socialStore.discoverUser).not.toHaveBeenCalled();
  });

  it("maps missing query values through durable validation", async () => {
    const socialStore = {
      consumeSocialApiRateLimit: allowRateLimit(),
      discoverUser: vi.fn(async () => ({
        reason: "invalid-display-name" as const,
        success: false as const,
      })),
    } satisfies Pick<
      SqliteSocialStore,
      "consumeSocialApiRateLimit" | "discoverUser"
    >;
    const handlers = createSocialDiscoveryRouteHandlers(socialStore, {
      getUserBySessionToken: vi.fn(async () => USER),
    });
    const response = await handlers.GET(
      new Request("http://localhost/api/social/discovery"),
    );

    expect(socialStore.discoverUser).toHaveBeenCalledWith(USER.id, null);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "invalid-display-name",
    });
  });

  it("returns retry guidance without querying names after the lookup limit", async () => {
    const discoverUser = vi.fn();
    const handlers = createSocialDiscoveryRouteHandlers(
      {
        consumeSocialApiRateLimit: vi.fn(async () => ({
          allowed: false,
          remaining: 0,
          resetAt: "2026-08-03T10:01:00.000Z",
          retryAfterSeconds: 37,
          success: true as const,
        })),
        discoverUser,
      },
      { getUserBySessionToken: vi.fn(async () => USER) },
    );
    const response = await handlers.GET(
      new Request(
        "http://localhost/api/social/discovery?displayName=Grace%20Hopper",
      ),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("37");
    await expect(response.json()).resolves.toEqual({
      code: "rate-limit-reached",
      error: "Too many social requests. Try again shortly.",
    });
    expect(discoverUser).not.toHaveBeenCalled();
  });
});
