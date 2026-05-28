import { describe, expect, it, vi } from "vitest";

import type { SqliteUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

import { createCurrentUserRouteHandlers } from "./route";

describe("current user route", () => {
  it("returns the user for the session cookie", async () => {
    const store = {
      getUserBySessionToken: vi.fn(async () => ({ displayName: "Ada", id: "user-1" })),
    } as unknown as SqliteUserProfileStore;
    const handlers = createCurrentUserRouteHandlers(store);
    const request = new Request("http://localhost/api/me", {
      headers: {
        cookie: "game_user_session=session-token",
      },
    });
    const response = await handlers.GET(request);

    expect(response.status).toBe(200);
    expect(store.getUserBySessionToken).toHaveBeenCalledWith("session-token");
    await expect(response.json()).resolves.toEqual({
      user: { displayName: "Ada", id: "user-1" },
    });
  });

  it("creates a user session and sets an HTTP-only session cookie", async () => {
    const store = {
      createUserSession: vi.fn(async () => ({
        expiresAt: "2026-07-27T10:00:00.000Z",
        sessionToken: "next-token",
        user: { displayName: "Grace", id: "user-2" },
      })),
    } as unknown as SqliteUserProfileStore;
    const handlers = createCurrentUserRouteHandlers(store);
    const request = new Request("http://localhost/api/me", {
      body: JSON.stringify({ displayName: "  Grace  " }),
      method: "POST",
    });
    const response = await handlers.POST(request);

    expect(response.status).toBe(201);
    expect(store.createUserSession).toHaveBeenCalledWith("Grace");
    expect(response.headers.get("set-cookie")).toContain("game_user_session=next-token");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    await expect(response.json()).resolves.toEqual({
      user: { displayName: "Grace", id: "user-2" },
    });
  });

  it("rejects empty display names before creating a session", async () => {
    const store = {
      createUserSession: vi.fn(),
    } as unknown as SqliteUserProfileStore;
    const handlers = createCurrentUserRouteHandlers(store);
    const request = new Request("http://localhost/api/me", {
      body: JSON.stringify({ displayName: "   " }),
      method: "POST",
    });
    const response = await handlers.POST(request);

    expect(response.status).toBe(400);
    expect(store.createUserSession).not.toHaveBeenCalled();
  });

  it("deletes the current session and clears the session cookie", async () => {
    const store = {
      deleteUserSession: vi.fn(async () => {}),
    } as unknown as SqliteUserProfileStore;
    const handlers = createCurrentUserRouteHandlers(store);
    const request = new Request("http://localhost/api/me", {
      headers: {
        cookie: "game_user_session=session-token",
      },
      method: "DELETE",
    });
    const response = await handlers.DELETE(request);

    expect(response.status).toBe(200);
    expect(store.deleteUserSession).toHaveBeenCalledWith("session-token");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    await expect(response.json()).resolves.toEqual({ user: null });
  });
});
