import { describe, expect, it, vi } from "vitest";

import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";

import { createSpaceInvadersReplayRunRouteHandlers } from "./route";

describe("space invaders replay run route", () => {
  it("issues Space Invaders replay runs through the wrapper", async () => {
    const replayStore = {
      createReplayRun: vi.fn(async () => ({ id: "run-1", seed: 1234 })),
    } as unknown as SqliteReplayStore;
    const handlers = createSpaceInvadersReplayRunRouteHandlers(replayStore);
    const response = await handlers.POST(
      new Request("http://localhost/api/replays/space-invaders/run", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(201);
    expect(replayStore.createReplayRun).toHaveBeenCalledWith(
      "space-invaders",
      null,
    );
  });
});
