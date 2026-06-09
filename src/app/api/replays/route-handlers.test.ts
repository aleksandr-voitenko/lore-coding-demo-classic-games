import { describe, expect, it, vi } from "vitest";

import type {
  BaseGameReplayPayload,
  GameReplayPayloadParser,
} from "@/lib/game-replay";
import type {
  SaveReplayResult,
  SqliteReplayStore,
} from "@/lib/server/sqlite-replay-store";
import type { AuthenticatedUser } from "@/lib/user-profile";

import {
  createGameReplayRouteHandlers,
  createGameReplayRunRouteHandlers,
  type UserSessionLookup,
} from "./route-handlers";

type TestReplayPayload = BaseGameReplayPayload<"snake", 1> & {
  events: [];
};

const signedInUser = {
  displayName: "Ada",
  id: "user-1",
} satisfies AuthenticatedUser;

function createReplayPayload(
  overrides: Partial<TestReplayPayload> = {},
): TestReplayPayload {
  return {
    events: [],
    finalScore: 4,
    finalStatus: "lost",
    finalTick: 0,
    gameId: "snake",
    leaderboardKey: "snake|mode=levels",
    runId: "run-1",
    schemaVersion: 1,
    seed: 1234,
    startedAt: "2026-06-08T12:00:00.000Z",
    ...overrides,
  };
}

function createReplayRequest(
  method: "GET" | "POST",
  {
    body,
    signedIn = true,
  }: {
    body?: string;
    signedIn?: boolean;
  } = {},
) {
  return new Request("http://localhost/api/replays/snake", {
    body,
    headers: signedIn
      ? {
          cookie: "game_user_session=session-token",
        }
      : undefined,
    method,
  });
}

function createRunRequest({ signedIn = true }: { signedIn?: boolean } = {}) {
  return new Request("http://localhost/api/replays/snake/run", {
    headers: signedIn
      ? {
          cookie: "game_user_session=session-token",
        }
      : undefined,
    method: "POST",
  });
}

function createRouteTestContext({
  parsedPayload = createReplayPayload(),
  parserError = null,
  replay = createReplayPayload(),
  saveResult = { success: true } satisfies SaveReplayResult,
  user = signedInUser,
}: {
  parsedPayload?: TestReplayPayload;
  parserError?: string | null;
  replay?: TestReplayPayload | null;
  saveResult?: SaveReplayResult;
  user?: AuthenticatedUser | null;
} = {}) {
  const parsePayload = vi.fn<GameReplayPayloadParser<TestReplayPayload>>(
    () =>
      parserError === null
        ? {
            payload: parsedPayload,
            success: true,
          }
        : {
            error: parserError,
            success: false,
          },
  );
  const getReplay = vi.fn(async () => replay);
  const saveReplay = vi.fn(async () => saveResult);
  const replayStore = {
    getReplay,
    saveReplay,
  } as unknown as Pick<SqliteReplayStore, "getReplay" | "saveReplay">;
  const userStore = {
    getUserBySessionToken: vi.fn(async () => user),
  } satisfies UserSessionLookup;
  const handlers = createGameReplayRouteHandlers(replayStore, userStore, {
    gameId: "snake",
    parsePayload,
    replayLabel: "Test replay",
  });

  return {
    handlers,
    getReplay,
    parsePayload,
    saveReplay,
    userStore,
  };
}

describe("game replay route handlers", () => {
  it("requires a signed-in user before saving or downloading replays", async () => {
    const { getReplay, handlers, parsePayload, saveReplay } = createRouteTestContext({
      user: null,
    });
    const getResponse = await handlers.GET(
      createReplayRequest("GET", {
        signedIn: false,
      }),
    );
    const postResponse = await handlers.POST(
      createReplayRequest("POST", {
        body: JSON.stringify(createReplayPayload()),
        signedIn: false,
      }),
    );

    expect(getResponse.status).toBe(401);
    await expect(getResponse.json()).resolves.toEqual({
      error: "Sign in before downloading replays.",
    });
    expect(postResponse.status).toBe(401);
    await expect(postResponse.json()).resolves.toEqual({
      error: "Sign in before saving replays.",
    });
    expect(parsePayload).not.toHaveBeenCalled();
    expect(getReplay).not.toHaveBeenCalled();
    expect(saveReplay).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON replay save requests", async () => {
    const { handlers, parsePayload, saveReplay } = createRouteTestContext();
    const response = await handlers.POST(
      createReplayRequest("POST", {
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Request body must be valid JSON.",
    });
    expect(parsePayload).not.toHaveBeenCalled();
    expect(saveReplay).not.toHaveBeenCalled();
  });

  it("rejects parser failures before saving", async () => {
    const { handlers, saveReplay } = createRouteTestContext({
      parserError: "Test replay events are not supported.",
    });
    const response = await handlers.POST(
      createReplayRequest("POST", {
        body: JSON.stringify(createReplayPayload()),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Test replay events are not supported.",
    });
    expect(saveReplay).not.toHaveBeenCalled();
  });

  it("rejects parser-approved payloads with unsupported leaderboard keys", async () => {
    const { handlers, saveReplay } = createRouteTestContext({
      parsedPayload: createReplayPayload({
        leaderboardKey: "not supported",
      }),
    });
    const response = await handlers.POST(
      createReplayRequest("POST", {
        body: JSON.stringify(createReplayPayload()),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Test replay leaderboard key is not supported.",
    });
    expect(saveReplay).not.toHaveBeenCalled();
  });

  it("saves parser-approved replay uploads for the signed-in user", async () => {
    const replay = createReplayPayload();
    const { handlers, saveReplay, userStore } = createRouteTestContext({
      parsedPayload: replay,
    });
    const response = await handlers.POST(
      createReplayRequest("POST", {
        body: JSON.stringify(replay),
      }),
    );

    expect(response.status).toBe(201);
    expect(userStore.getUserBySessionToken).toHaveBeenCalledWith("session-token");
    expect(saveReplay).toHaveBeenCalledWith(signedInUser, replay);
    await expect(response.json()).resolves.toEqual({ saved: true });
  });

  it.each([
    [
      { reason: "run-user-mismatch", success: false } satisfies SaveReplayResult,
      403,
      "Test replay run belongs to another user.",
    ],
    [
      { reason: "run-seed-mismatch", success: false } satisfies SaveReplayResult,
      400,
      "Test replay seed does not match the issued run.",
    ],
    [
      { reason: "unsupported-game", success: false } satisfies SaveReplayResult,
      400,
      "Test replay game is not supported.",
    ],
    [
      { reason: "run-not-found", success: false } satisfies SaveReplayResult,
      400,
      "Test replay run was not found.",
    ],
  ])(
    "maps %s save failures to status %i",
    async (saveResult, status, error) => {
      const { handlers } = createRouteTestContext({
        saveResult,
      });
      const response = await handlers.POST(
        createReplayRequest("POST", {
          body: JSON.stringify(createReplayPayload()),
        }),
      );

      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toEqual({ error });
    },
  );

  it("returns not found when the signed-in user has no saved replay", async () => {
    const { getReplay, handlers } = createRouteTestContext({
      replay: null,
    });
    const response = await handlers.GET(createReplayRequest("GET"));

    expect(response.status).toBe(404);
    expect(getReplay).toHaveBeenCalledWith(
      signedInUser,
      "snake",
      expect.any(Function),
    );
    await expect(response.json()).resolves.toEqual({
      error: "No Test replay saved.",
    });
  });

  it("downloads the signed-in user's saved replay", async () => {
    const replay = createReplayPayload();
    const { getReplay, handlers } = createRouteTestContext({
      replay,
    });
    const response = await handlers.GET(createReplayRequest("GET"));

    expect(response.status).toBe(200);
    expect(getReplay).toHaveBeenCalledWith(
      signedInUser,
      "snake",
      expect.any(Function),
    );
    await expect(response.json()).resolves.toEqual({ replay });
  });
});

describe("game replay run route handlers", () => {
  it("issues server replay runs and links a signed-in user when available", async () => {
    const replayStore = {
      createReplayRun: vi.fn(async () => ({ id: "run-1", seed: 1234 })),
    } satisfies Pick<SqliteReplayStore, "createReplayRun">;
    const userStore = {
      getUserBySessionToken: vi.fn(async () => signedInUser),
    } satisfies UserSessionLookup;
    const handlers = createGameReplayRunRouteHandlers(replayStore, userStore, {
      gameId: "snake",
    });
    const response = await handlers.POST(createRunRequest());

    expect(response.status).toBe(201);
    expect(userStore.getUserBySessionToken).toHaveBeenCalledWith("session-token");
    expect(replayStore.createReplayRun).toHaveBeenCalledWith("snake", signedInUser);
    await expect(response.json()).resolves.toEqual({ id: "run-1", seed: 1234 });
  });

  it("issues guest replay runs with no linked user", async () => {
    const replayStore = {
      createReplayRun: vi.fn(async () => ({ id: "run-1", seed: 1234 })),
    } satisfies Pick<SqliteReplayStore, "createReplayRun">;
    const userStore = {
      getUserBySessionToken: vi.fn(async () => null),
    } satisfies UserSessionLookup;
    const handlers = createGameReplayRunRouteHandlers(replayStore, userStore, {
      gameId: "snake",
    });
    const response = await handlers.POST(
      createRunRequest({
        signedIn: false,
      }),
    );

    expect(response.status).toBe(201);
    expect(userStore.getUserBySessionToken).toHaveBeenCalledWith(null);
    expect(replayStore.createReplayRun).toHaveBeenCalledWith("snake", null);
    await expect(response.json()).resolves.toEqual({ id: "run-1", seed: 1234 });
  });
});
