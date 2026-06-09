import { describe, expect, it, vi } from "vitest";

import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";

import { createTwentyFortyEightReplayRunRouteHandlers } from "./route";

describe("2048 replay run route", () => {
  it("issues 2048 replay runs through the wrapper", async () => {
    const replayStore = {
      createReplayRun: vi.fn(async () => ({ id: "run-1", seed: 1234 })),
    } as unknown as SqliteReplayStore;
    const handlers = createTwentyFortyEightReplayRunRouteHandlers(replayStore);
    const response = await handlers.POST(
      new Request("http://localhost/api/replays/twenty-forty-eight/run", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(201);
    expect(replayStore.createReplayRun).toHaveBeenCalledWith(
      "twenty-forty-eight",
      null,
    );
  });
});
