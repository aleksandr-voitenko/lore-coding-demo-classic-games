import { describe, expect, it, vi } from "vitest";

import type { MultiplayerAccountPartyAuthority } from "@/lib/server/multiplayer-account-party";

import * as presenceRoute from "./route";
import { createSocialPresenceRouteHandlers } from "./route-handlers";

const USER = { displayName: "Ada", id: "user-1" };
const CLIENT_ID = "browser-client-123";

function createRequest(
  method: "DELETE" | "POST",
  body: unknown,
  signedIn = true,
) {
  return new Request("http://localhost/api/social/presence", {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      ...(signedIn
        ? { cookie: "game_user_session=session-token" }
        : {}),
    },
    method,
  });
}

function createHarness(availability: "available" | "busy" | "in-party" | "offline") {
  const accountAuthority = {
    applyAccountCommand: vi.fn(async () => ({
      availability,
      changed: true,
      outcome: "presence" as const,
      success: true as const,
    })),
  } satisfies Pick<
    MultiplayerAccountPartyAuthority,
    "applyAccountCommand"
  >;
  const userStore = {
    getUserBySessionToken: vi.fn(async () => USER),
  };

  return {
    accountAuthority,
    handlers: createSocialPresenceRouteHandlers(
      userStore,
      accountAuthority,
    ),
    userStore,
  };
}

describe("social presence route", () => {
  it("exports only the supported Next.js route fields", () => {
    expect(Object.keys(presenceRoute).sort()).toEqual([
      "DELETE",
      "POST",
      "dynamic",
      "runtime",
    ]);
  });

  it("renews available presence for the session user", async () => {
    const { accountAuthority, handlers, userStore } =
      createHarness("available");
    const response = await handlers.POST(
      createRequest("POST", {
        clientId: CLIENT_ID,
        state: "available",
        userId: "forged-user",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(userStore.getUserBySessionToken).toHaveBeenCalledWith(
      "session-token",
    );
    expect(accountAuthority.applyAccountCommand).toHaveBeenCalledWith({
      clientId: CLIENT_ID,
      state: "available",
      type: "presence.renew",
      userId: USER.id,
    });
    await expect(response.json()).resolves.toEqual({
      availability: "available",
      changed: true,
    });
  });

  it.each(["busy", "in-party", "offline"] as const)(
    "reports %s presence without mutating durable invitations",
    async (availability) => {
      const { handlers } = createHarness(availability);
      const response = await handlers.POST(
        createRequest("POST", { clientId: CLIENT_ID, state: "busy" }),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ availability });
    },
  );

  it("releases only the authenticated user's browser lease", async () => {
    const { accountAuthority, handlers } = createHarness("offline");
    const response = await handlers.DELETE(
      createRequest("DELETE", {
        clientId: CLIENT_ID,
        userId: "forged-user",
      }),
    );

    expect(response.status).toBe(200);
    expect(accountAuthority.applyAccountCommand).toHaveBeenCalledWith({
      clientId: CLIENT_ID,
      type: "presence.release",
      userId: USER.id,
    });
  });

  it("requires authentication before reading or forwarding the mutation", async () => {
    const accountAuthority = {
      applyAccountCommand: vi.fn(),
    } as unknown as Pick<
      MultiplayerAccountPartyAuthority,
      "applyAccountCommand"
    >;
    const handlers = createSocialPresenceRouteHandlers(
      { getUserBySessionToken: vi.fn(async () => null) },
      accountAuthority,
    );
    const response = await handlers.POST(
      createRequest(
        "POST",
        { clientId: CLIENT_ID, state: "available" },
        false,
      ),
    );

    expect(response.status).toBe(401);
    expect(accountAuthority.applyAccountCommand).not.toHaveBeenCalled();
  });

  it("maps account authority failures", async () => {
    const handlers = createSocialPresenceRouteHandlers(
      { getUserBySessionToken: vi.fn(async () => USER) },
      {
        applyAccountCommand: vi.fn(async () => ({
          code: "lease-capacity-reached" as const,
          error: "Too many leases.",
          success: false as const,
        })),
      },
    );
    const response = await handlers.POST(
      createRequest("POST", { clientId: CLIENT_ID, state: "available" }),
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      code: "lease-capacity-reached",
      error: "Too many leases.",
    });
  });

  it("fails closed on an unexpected account authority outcome", async () => {
    const handlers = createSocialPresenceRouteHandlers(
      { getUserBySessionToken: vi.fn(async () => USER) },
      {
        applyAccountCommand: vi.fn(async () => ({
          availabilities: [],
          outcome: "availability" as const,
          success: true as const,
        })),
      },
    );
    const response = await handlers.POST(
      createRequest("POST", { clientId: CLIENT_ID, state: "available" }),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      code: "room-service-invalid-response",
    });
  });
});
