import { describe, expect, it, vi } from "vitest";

import type { SocialPartyInvitationRecord } from "@/lib/server/sqlite-social-store";

import {
  authenticateSocialRequest,
  createMultiplayerAccountPartyFailureResponse,
  createSocialStoreFailureResponse,
  getSocialStoreFailureStatus,
  MAX_SOCIAL_JSON_BODY_BYTES,
  readSocialJsonMutation,
  redactSocialPartyInvitation,
} from "./shared";

describe("social API shared helpers", () => {
  it("authenticates from the session cookie without trusting request data", async () => {
    const user = { displayName: "Ada", id: "user-1" };
    const userStore = {
      getUserBySessionToken: vi.fn(async () => user),
    };
    const result = await authenticateSocialRequest(
      new Request("http://localhost/api/social", {
        headers: { cookie: "game_user_session=session-token" },
      }),
      userStore,
    );

    expect(result).toEqual({ success: true, user });
    expect(userStore.getUserBySessionToken).toHaveBeenCalledWith(
      "session-token",
    );
  });

  it("returns a no-store authentication error for signed-out requests", async () => {
    const result = await authenticateSocialRequest(
      new Request("http://localhost/api/social"),
      { getUserBySessionToken: vi.fn(async () => null) },
    );

    expect(result.success).toBe(false);

    if (result.success) {
      throw new Error("Expected authentication to fail.");
    }

    expect(result.response.status).toBe(401);
    expect(result.response.headers.get("cache-control")).toBe("no-store");
    await expect(result.response.json()).resolves.toEqual({
      code: "authentication-required",
      error: "Sign in to use friends and party invitations.",
    });
  });

  it("reads same-origin JSON mutations with charset parameters", async () => {
    const result = await readSocialJsonMutation(
      new Request("https://games.example/api/social/presence", {
        body: JSON.stringify({ clientId: "browser-client-1" }),
        headers: {
          "content-type": "Application/JSON; charset=utf-8",
          origin: "https://games.example",
        },
        method: "POST",
      }),
    );

    expect(result).toEqual({
      payload: { clientId: "browser-client-1" },
      success: true,
    });
  });

  it.each([
    {
      expectedCode: "cross-origin-request",
      expectedStatus: 403,
      headers: new Headers({
        "content-type": "application/json",
        origin: "https://other.example",
      }),
      name: "cross-origin",
      payload: "{}",
    },
    {
      expectedCode: "unsupported-media-type",
      expectedStatus: 415,
      headers: new Headers({ "content-type": "text/plain" }),
      name: "non-JSON",
      payload: "{}",
    },
    {
      expectedCode: "invalid-json",
      expectedStatus: 400,
      headers: new Headers({ "content-type": "application/json" }),
      name: "malformed JSON",
      payload: "{",
    },
  ])(
    "rejects $name mutations",
    async ({ expectedCode, expectedStatus, headers, payload }) => {
      const result = await readSocialJsonMutation(
        new Request("https://games.example/api/social/presence", {
          body: payload,
          headers,
          method: "POST",
        }),
      );

      expect(result.success).toBe(false);

      if (result.success) {
        throw new Error("Expected JSON mutation validation to fail.");
      }

      expect(result.response.status).toBe(expectedStatus);
      expect(result.response.headers.get("cache-control")).toBe("no-store");
      await expect(result.response.json()).resolves.toMatchObject({
        code: expectedCode,
      });
    },
  );

  it.each([
    {
      body: "{}",
      headers: new Headers({
        "content-length": String(MAX_SOCIAL_JSON_BODY_BYTES + 1),
        "content-type": "application/json",
      }),
      name: "declared",
    },
    {
      body: JSON.stringify({
        value: "x".repeat(MAX_SOCIAL_JSON_BODY_BYTES),
      }),
      headers: new Headers({ "content-type": "application/json" }),
      name: "streamed",
    },
  ])("rejects $name oversized JSON mutations", async ({ body, headers }) => {
    const result = await readSocialJsonMutation(
      new Request("https://games.example/api/social/presence", {
        body,
        headers,
        method: "POST",
      }),
    );

    expect(result.success).toBe(false);

    if (result.success) {
      throw new Error("Expected oversized JSON mutation validation to fail.");
    }

    expect(result.response.status).toBe(413);
    expect(result.response.headers.get("cache-control")).toBe("no-store");
    await expect(result.response.json()).resolves.toEqual({
      code: "payload-too-large",
      error: "Social request body is too large.",
    });
  });

  it("maps durable and volatile social failures to stable responses", async () => {
    expect(getSocialStoreFailureStatus("invalid-user-id")).toBe(400);
    expect(getSocialStoreFailureStatus("friend-request-not-found")).toBe(404);
    expect(getSocialStoreFailureStatus("party-invitation-expired")).toBe(410);
    expect(getSocialStoreFailureStatus("party-invitation-id-conflict")).toBe(
      500,
    );
    expect(
      getSocialStoreFailureStatus("party-invitation-limit-reached"),
    ).toBe(429);
    expect(getSocialStoreFailureStatus("blocked")).toBe(404);

    const durableResponse = createSocialStoreFailureResponse({
      reason: "blocked",
      success: false,
    });
    const authorityResponse = createMultiplayerAccountPartyFailureResponse({
      code: "recipient-unavailable",
      error: "Recipient is not available.",
      success: false,
    });
    const unavailableResponse = createMultiplayerAccountPartyFailureResponse({
      code: "room-service-unavailable",
      error:
        "Room service at http://internal-sidecar:3001 failed: connect ECONNREFUSED.",
      success: false,
    });

    expect(durableResponse.status).toBe(404);
    await expect(durableResponse.json()).resolves.toEqual({
      code: "user-not-found",
      error: "Player was not found.",
    });
    expect(authorityResponse.status).toBe(409);
    await expect(authorityResponse.json()).resolves.toEqual({
      code: "recipient-unavailable",
      error: "Recipient is not available.",
    });
    expect(unavailableResponse.status).toBe(502);
    await expect(unavailableResponse.json()).resolves.toEqual({
      code: "room-service-unavailable",
      error: "The multiplayer service is temporarily unavailable.",
    });
  });

  it("redacts the bearer-like party code from invitation responses", () => {
    const invitation = {
      createdAt: "2026-08-03T10:00:00.000Z",
      expiresAt: "2026-08-03T10:05:00.000Z",
      id: "invite-1",
      intent: "watch",
      inviter: { displayName: "Ada", id: "user-1" },
      partyCode: "SECRET-PARTY",
      recipient: { displayName: "Grace", id: "user-2" },
      resolvedAt: null,
      status: "pending",
      updatedAt: "2026-08-03T10:00:00.000Z",
    } satisfies SocialPartyInvitationRecord;

    expect(redactSocialPartyInvitation(invitation)).toEqual({
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
      id: invitation.id,
      intent: "watch",
      inviter: invitation.inviter,
      recipient: invitation.recipient,
      resolvedAt: null,
      status: "pending",
      updatedAt: invitation.updatedAt,
    });
    expect(redactSocialPartyInvitation(invitation)).not.toHaveProperty(
      "partyCode",
    );
  });
});
