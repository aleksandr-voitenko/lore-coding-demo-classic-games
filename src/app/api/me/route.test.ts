import { afterEach, describe, expect, it, vi } from "vitest";

import type { SqliteUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

import { createCurrentUserRouteHandlers } from "./route";

describe("current user route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

  it("clears production session cookies with the Secure attribute", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const store = {
      deleteUserSession: vi.fn(async () => {}),
    } as unknown as SqliteUserProfileStore;
    const handlers = createCurrentUserRouteHandlers(store);
    const request = new Request("https://example.com/api/me", {
      headers: {
        cookie: "game_user_session=session-token",
      },
      method: "DELETE",
    });
    const response = await handlers.DELETE(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });
});
