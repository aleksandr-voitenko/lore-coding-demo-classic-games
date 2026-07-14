import { describe, expect, it, vi } from "vitest";

import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";

import { createBattleCityReplayRunRouteHandlers } from "../route-handlers";

describe("Tank Patrol replay run route", () => {
  it("issues Tank Patrol replay runs through the wrapper", async () => {
    const replayStore = {
      createReplayRun: vi.fn(async () => ({ id: "run-1", seed: 1234 })),
    } as unknown as SqliteReplayStore;
    const handlers = createBattleCityReplayRunRouteHandlers(replayStore);
    const response = await handlers.POST(
      new Request("http://localhost/api/replays/battle-city/run", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(201);
    expect(replayStore.createReplayRun).toHaveBeenCalledWith(
      "battle-city",
      null,
    );
  });
});
