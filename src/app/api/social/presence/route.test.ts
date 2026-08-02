import { describe, expect, it, vi } from "vitest";

import type { MultiplayerAccountPartyAuthority } from "@/lib/server/multiplayer-account-party";

import * as presenceRoute from "./route";
import { createSocialPresenceRouteHandlers } from "./route-handlers";

const USER = { displayName: "Ada", id: "user-1" };
const CLIENT_ID = "browser-client-123";
const OPERATION_GENERATION = 7;

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
        operationGeneration: OPERATION_GENERATION,
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
      operationGeneration: OPERATION_GENERATION,
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
        createRequest("POST", {
          clientId: CLIENT_ID,
          operationGeneration: OPERATION_GENERATION,
          state: "busy",
        }),
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
        operationGeneration: OPERATION_GENERATION,
        userId: "forged-user",
      }),
    );

    expect(response.status).toBe(200);
    expect(accountAuthority.applyAccountCommand).toHaveBeenCalledWith({
      clientId: CLIENT_ID,
      operationGeneration: OPERATION_GENERATION,
      type: "presence.release",
      userId: USER.id,
    });
  });

  it.each(["DELETE", "POST"] as const)(
    "forwards a missing generation on legacy %s presence",
    async (method) => {
      const { accountAuthority, handlers } = createHarness(
        method === "DELETE" ? "offline" : "available",
      );
      const response = await handlers[method](
        createRequest(method, {
          clientId: CLIENT_ID,
          ...(method === "POST" ? { state: "available" } : {}),
        }),
      );

      expect(response.status).toBe(200);
      expect(accountAuthority.applyAccountCommand).toHaveBeenCalledWith({
        clientId: CLIENT_ID,
        operationGeneration: undefined,
        ...(method === "POST" ? { state: "available" } : {}),
        type: method === "POST" ? "presence.renew" : "presence.release",
        userId: USER.id,
      });
    },
  );

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
        {
          clientId: CLIENT_ID,
          operationGeneration: OPERATION_GENERATION,
          state: "available",
        },
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
      createRequest("POST", {
        clientId: CLIENT_ID,
        operationGeneration: OPERATION_GENERATION,
        state: "available",
      }),
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
      createRequest("POST", {
        clientId: CLIENT_ID,
        operationGeneration: OPERATION_GENERATION,
        state: "available",
      }),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      code: "room-service-invalid-response",
    });
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["fractional", 1.5],
    ["unsafe", Number.MAX_SAFE_INTEGER + 1],
    ["string", "1"],
  ])(
    "forwards a raw %s operation generation for authority validation",
    async (_name, operationGeneration) => {
      const applyAccountCommand = vi.fn(async () => ({
        code: "invalid-presence-operation-generation" as const,
        error: "Presence operation generation is not supported.",
        success: false as const,
      }));
      const handlers = createSocialPresenceRouteHandlers(
        { getUserBySessionToken: vi.fn(async () => USER) },
        { applyAccountCommand },
      );
      const response = await handlers.POST(
        createRequest("POST", {
          clientId: CLIENT_ID,
          operationGeneration,
          state: "available",
        }),
      );

      expect(applyAccountCommand).toHaveBeenCalledWith({
        clientId: CLIENT_ID,
        operationGeneration,
        state: "available",
        type: "presence.renew",
        userId: USER.id,
      });
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        code: "invalid-presence-operation-generation",
        error: "Presence operation generation is not supported.",
      });
    },
  );
});
