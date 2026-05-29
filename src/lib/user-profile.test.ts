import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AUTH_LOGIN_API_PATH,
  AUTH_SIGNUP_API_PATH,
  CURRENT_USER_API_PATH,
  GAME_SESSIONS_API_PATH,
  createUserDisplayNameKey,
  fetchCurrentUser,
  getUserPasswordValidationError,
  logInUser,
  MAX_USER_DISPLAY_NAME_LENGTH,
  MAX_USER_PASSWORD_LENGTH,
  MIN_USER_PASSWORD_LENGTH,
  normalizeGameId,
  normalizeGameSessionId,
  normalizeUserDisplayName,
  signOutUser,
  signUpUser,
  submitGameSession,
  UserAuthError,
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

  it("validates account passwords without normalizing their contents", () => {
    expect(getUserPasswordValidationError("hunter2!")).toBeNull();
    expect(getUserPasswordValidationError("")).toBe("Password is required.");
    expect(getUserPasswordValidationError(null)).toBe("Password is required.");
    expect(getUserPasswordValidationError("x".repeat(MIN_USER_PASSWORD_LENGTH - 1))).toBe(
      `Password must be at least ${MIN_USER_PASSWORD_LENGTH} characters.`,
    );
    expect(getUserPasswordValidationError("x".repeat(MAX_USER_PASSWORD_LENGTH + 1))).toBe(
      `Password must be at most ${MAX_USER_PASSWORD_LENGTH} characters.`,
    );
  });

  it("validates game ids and game session ids accepted by the APIs", () => {
    expect(normalizeGameId("space-invaders")).toBe("space-invaders");
    expect(normalizeGameId("bad game")).toBeNull();
    expect(normalizeGameSessionId("session-123")).toBe("session-123");
    expect(normalizeGameSessionId("bad session")).toBeNull();
  });

  it("fetches, authenticates, signs out, and records sessions through the user APIs", async () => {
    const fetchStub = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ user: { displayName: "Ada", id: "user-1" } }))
      .mockResolvedValueOnce(Response.json({ user: { displayName: "Grace", id: "user-2" } }))
      .mockResolvedValueOnce(Response.json({ user: { displayName: "Katherine", id: "user-3" } }))
      .mockResolvedValueOnce(Response.json({ user: null }))
      .mockResolvedValueOnce(Response.json({ id: "session-1" }, { status: 201 }));

    vi.stubGlobal("fetch", fetchStub);

    await expect(fetchCurrentUser()).resolves.toEqual({ displayName: "Ada", id: "user-1" });
    await expect(logInUser("Grace", "password123")).resolves.toEqual({
      displayName: "Grace",
      id: "user-2",
    });
    await expect(signUpUser("Katherine", "password123", "password123")).resolves.toEqual({
      displayName: "Katherine",
      id: "user-3",
    });
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
    expect(fetchStub).toHaveBeenNthCalledWith(2, AUTH_LOGIN_API_PATH, {
      body: JSON.stringify({ displayName: "Grace", password: "password123" }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    expect(fetchStub).toHaveBeenNthCalledWith(3, AUTH_SIGNUP_API_PATH, {
      body: JSON.stringify({
        displayName: "Katherine",
        password: "password123",
        passwordConfirmation: "password123",
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    expect(fetchStub).toHaveBeenNthCalledWith(4, CURRENT_USER_API_PATH, {
      method: "DELETE",
    });
    expect(fetchStub).toHaveBeenNthCalledWith(5, GAME_SESSIONS_API_PATH, {
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

  it("surfaces field errors from authentication responses", async () => {
    const fetchStub = vi.fn().mockResolvedValueOnce(
      Response.json(
        {
          error: "User name is already taken.",
          fieldErrors: {
            displayName: "User name is already taken.",
          },
        },
        { status: 409 },
      ),
    );

    vi.stubGlobal("fetch", fetchStub);

    await expect(signUpUser("Ada", "password123", "password123")).rejects.toMatchObject({
      fieldErrors: {
        displayName: "User name is already taken.",
      },
      message: "User name is already taken.",
      status: 409,
    } satisfies Partial<UserAuthError>);
  });
});
