import { describe, expect, it, vi } from "vitest";

import type { SqliteReplayStore } from "@/lib/server/sqlite-replay-store";

import { createMinesweeperReplayRunRouteHandlers } from "./route";

describe("minesweeper replay run route", () => {
  it("issues Minesweeper replay runs through the wrapper", async () => {
    const replayStore = {
      createReplayRun: vi.fn(async () => ({ id: "run-1", seed: 1234 })),
    } as unknown as SqliteReplayStore;
    const handlers = createMinesweeperReplayRunRouteHandlers(replayStore);
    const response = await handlers.POST(
      new Request("http://localhost/api/replays/minesweeper/run", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(201);
    expect(replayStore.createReplayRun).toHaveBeenCalledWith("minesweeper", null);
  });
});
