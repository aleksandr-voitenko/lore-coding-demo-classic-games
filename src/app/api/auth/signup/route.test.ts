import { describe, expect, it, vi } from "vitest";

import type { SqliteUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

import { createSignupRouteHandlers } from "./route";

describe("signup route", () => {
  it("registers a user and sets an HTTP-only session cookie", async () => {
    const store = {
      registerUser: vi.fn(async () => ({
        session: {
          expiresAt: "2026-07-27T10:00:00.000Z",
          sessionToken: "next-token",
          user: { displayName: "Grace", id: "user-2" },
        },
        success: true,
      })),
    } as unknown as SqliteUserProfileStore;
    const handlers = createSignupRouteHandlers(store);
    const request = new Request("http://localhost/api/auth/signup", {
      body: JSON.stringify({
        displayName: "  Grace  ",
        password: "password123",
        passwordConfirmation: "password123",
      }),
      method: "POST",
    });
    const response = await handlers.POST(request);

    expect(response.status).toBe(201);
    expect(store.registerUser).toHaveBeenCalledWith("Grace", "password123");
    expect(response.headers.get("set-cookie")).toContain("game_user_session=next-token");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    await expect(response.json()).resolves.toEqual({
      user: { displayName: "Grace", id: "user-2" },
    });
  });

  it("returns field errors before registering invalid signup details", async () => {
    const store = {
      registerUser: vi.fn(),
    } as unknown as SqliteUserProfileStore;
    const handlers = createSignupRouteHandlers(store);
    const request = new Request("http://localhost/api/auth/signup", {
      body: JSON.stringify({
        displayName: "   ",
        password: "short",
        passwordConfirmation: "different",
      }),
      method: "POST",
    });
    const response = await handlers.POST(request);

    expect(response.status).toBe(400);
    expect(store.registerUser).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: "Sign up details need attention.",
      fieldErrors: {
        displayName: "User name is required.",
        password: "Password must be at least 8 characters.",
        passwordConfirmation: "Passwords must match.",
      },
    });
  });

  it("returns duplicate user-name errors next to the name field", async () => {
    const store = {
      registerUser: vi.fn(async () => ({
        reason: "display-name-taken",
        success: false,
      })),
    } as unknown as SqliteUserProfileStore;
    const handlers = createSignupRouteHandlers(store);
    const request = new Request("http://localhost/api/auth/signup", {
      body: JSON.stringify({
        displayName: "Ada",
        password: "password123",
        passwordConfirmation: "password123",
      }),
      method: "POST",
    });
    const response = await handlers.POST(request);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "User name is already taken.",
      fieldErrors: {
        displayName: "User name is already taken.",
      },
    });
  });
});
