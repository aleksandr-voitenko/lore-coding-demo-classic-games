import { afterEach, describe, expect, it, vi } from "vitest";

import type { SqliteUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

import { createLoginRouteHandlers } from "./route";

describe("login route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates a session cookie for valid credentials", async () => {
    const store = {
      authenticateUser: vi.fn(async () => ({
        session: {
          expiresAt: "2026-07-27T10:00:00.000Z",
          sessionToken: "next-token",
          user: { displayName: "Grace", id: "user-2" },
        },
        success: true,
      })),
    } as unknown as SqliteUserProfileStore;
    const handlers = createLoginRouteHandlers(store);
    const request = new Request("http://localhost/api/auth/login", {
      body: JSON.stringify({ displayName: "  Grace  ", password: "password123" }),
      method: "POST",
    });
    const response = await handlers.POST(request);

    expect(response.status).toBe(200);
    expect(store.authenticateUser).toHaveBeenCalledWith("Grace", "password123");
    expect(response.headers.get("set-cookie")).toContain("game_user_session=next-token");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).not.toContain("Secure");
    await expect(response.json()).resolves.toEqual({
      user: { displayName: "Grace", id: "user-2" },
    });
  });

  it("marks session cookies as Secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const store = {
      authenticateUser: vi.fn(async () => ({
        session: {
          expiresAt: "2026-07-27T10:00:00.000Z",
          sessionToken: "next-token",
          user: { displayName: "Grace", id: "user-2" },
        },
        success: true,
      })),
    } as unknown as SqliteUserProfileStore;
    const handlers = createLoginRouteHandlers(store);
    const request = new Request("https://example.com/api/auth/login", {
      body: JSON.stringify({ displayName: "Grace", password: "password123" }),
      method: "POST",
    });
    const response = await handlers.POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("game_user_session=next-token");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });

  it("returns field errors for missing login fields", async () => {
    const store = {
      authenticateUser: vi.fn(),
    } as unknown as SqliteUserProfileStore;
    const handlers = createLoginRouteHandlers(store);
    const request = new Request("http://localhost/api/auth/login", {
      body: JSON.stringify({ displayName: "   ", password: "" }),
      method: "POST",
    });
    const response = await handlers.POST(request);

    expect(response.status).toBe(400);
    expect(store.authenticateUser).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: "Log in details are incomplete.",
      fieldErrors: {
        displayName: "User name is required.",
        password: "Password is required.",
      },
    });
  });

  it("returns a generic credential error for invalid login attempts", async () => {
    const store = {
      authenticateUser: vi.fn(async () => ({
        reason: "invalid-credentials",
        success: false,
      })),
    } as unknown as SqliteUserProfileStore;
    const handlers = createLoginRouteHandlers(store);
    const request = new Request("http://localhost/api/auth/login", {
      body: JSON.stringify({ displayName: "Ada", password: "password123" }),
      method: "POST",
    });
    const response = await handlers.POST(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "User name or password is incorrect.",
      fieldErrors: {
        password: "User name or password is incorrect.",
      },
    });
  });
});
