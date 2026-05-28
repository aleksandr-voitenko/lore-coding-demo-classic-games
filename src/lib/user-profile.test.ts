import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CURRENT_USER_API_PATH,
  GAME_SESSIONS_API_PATH,
  createUserDisplayNameKey,
  fetchCurrentUser,
  MAX_USER_DISPLAY_NAME_LENGTH,
  normalizeGameId,
  normalizeGameSessionId,
  normalizeUserDisplayName,
  signInUser,
  signOutUser,
  submitGameSession,
} from "./user-profile";

describe("user profile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes user display names and stable display-name keys", () => {
    expect(normalizeUserDisplayName("  Ada   Lovelace  ")).toBe("Ada Lovelace");
    expect(normalizeUserDisplayName("x".repeat(MAX_USER_DISPLAY_NAME_LENGTH + 1))).toHaveLength(
      MAX_USER_DISPLAY_NAME_LENGTH,
    );
    expect(normalizeUserDisplayName(null)).toBe("");
    expect(createUserDisplayNameKey("  ADA   Lovelace  ")).toBe("ada lovelace");
  });

  it("validates game ids and game session ids accepted by the APIs", () => {
    expect(normalizeGameId("space-invaders")).toBe("space-invaders");
    expect(normalizeGameId("bad game")).toBeNull();
    expect(normalizeGameSessionId("session-123")).toBe("session-123");
    expect(normalizeGameSessionId("bad session")).toBeNull();
  });

  it("fetches, signs in, signs out, and records sessions through the user APIs", async () => {
    const fetchStub = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ user: { displayName: "Ada", id: "user-1" } }))
      .mockResolvedValueOnce(Response.json({ user: { displayName: "Grace", id: "user-2" } }))
      .mockResolvedValueOnce(Response.json({ user: null }))
      .mockResolvedValueOnce(Response.json({ id: "session-1" }, { status: 201 }));

    vi.stubGlobal("fetch", fetchStub);

    await expect(fetchCurrentUser()).resolves.toEqual({ displayName: "Ada", id: "user-1" });
    await expect(signInUser("Grace")).resolves.toEqual({ displayName: "Grace", id: "user-2" });
    await expect(signOutUser()).resolves.toBeUndefined();
    await expect(
      submitGameSession({
        activeDurationMs: 1200,
        finalScore: 9,
        gameId: "snake",
        leaderboardKey: "snake|board=19",
        result: "won",
      }),
    ).resolves.toEqual({ id: "session-1" });

    expect(fetchStub).toHaveBeenNthCalledWith(1, CURRENT_USER_API_PATH, {
      cache: "no-store",
    });
    expect(fetchStub).toHaveBeenNthCalledWith(2, CURRENT_USER_API_PATH, {
      body: JSON.stringify({ displayName: "Grace" }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    expect(fetchStub).toHaveBeenNthCalledWith(3, CURRENT_USER_API_PATH, {
      method: "DELETE",
    });
    expect(fetchStub).toHaveBeenNthCalledWith(4, GAME_SESSIONS_API_PATH, {
      body: JSON.stringify({
        activeDurationMs: 1200,
        finalScore: 9,
        gameId: "snake",
        leaderboardKey: "snake|board=19",
        result: "won",
      }),
      headers: {
        "Content-Type": "application/json",
      },
      keepalive: false,
      method: "POST",
    });
  });
});
