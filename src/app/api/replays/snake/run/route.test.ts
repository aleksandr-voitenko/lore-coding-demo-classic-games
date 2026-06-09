import { describe, expect, it, vi } from "vitest";

import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";
import type { SqliteUserProfileStore } from "@/lib/server/sqlite-user-profile-store";

import { createSnakeReplayRunRouteHandlers } from "./route";

describe("snake replay run route", () => {
  it("issues server replay runs and links a signed-in user when available", async () => {
    const user = { displayName: "Ada", id: "user-1" };
    const replayStore = {
      createSnakeReplayRun: vi.fn(async () => ({ id: "run-1", seed: 1234 })),
    } as unknown as SqliteReplayStore;
    const userStore = {
      getUserBySessionToken: vi.fn(async () => user),
    } as unknown as SqliteUserProfileStore;
    const handlers = createSnakeReplayRunRouteHandlers(replayStore, userStore);
    const response = await handlers.POST(
      new Request("http://localhost/api/replays/snake/run", {
        headers: {
          cookie: "game_user_session=session-token",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(201);
    expect(userStore.getUserBySessionToken).toHaveBeenCalledWith("session-token");
    expect(replayStore.createSnakeReplayRun).toHaveBeenCalledWith(user);
    await expect(response.json()).resolves.toEqual({ id: "run-1", seed: 1234 });
  });

  it("still issues replay runs for guests", async () => {
    const replayStore = {
      createSnakeReplayRun: vi.fn(async () => ({ id: "run-1", seed: 1234 })),
    } as unknown as SqliteReplayStore;
    const handlers = createSnakeReplayRunRouteHandlers(replayStore);
    const response = await handlers.POST(
      new Request("http://localhost/api/replays/snake/run", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(201);
    expect(replayStore.createSnakeReplayRun).toHaveBeenCalledWith(null);
  });
});
