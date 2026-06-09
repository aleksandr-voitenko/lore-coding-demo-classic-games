import { describe, expect, it, vi } from "vitest";

import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";

import { createTetrisReplayRunRouteHandlers } from "./route";

describe("tetris replay run route", () => {
  it("issues Tetris replay runs through the wrapper", async () => {
    const replayStore = {
      createReplayRun: vi.fn(async () => ({ id: "run-1", seed: 1234 })),
    } as unknown as SqliteReplayStore;
    const handlers = createTetrisReplayRunRouteHandlers(replayStore);
    const response = await handlers.POST(
      new Request("http://localhost/api/replays/tetris/run", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(201);
    expect(replayStore.createReplayRun).toHaveBeenCalledWith("tetris", null);
  });
});
