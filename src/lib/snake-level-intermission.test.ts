import { describe, expect, it } from "vitest";

import { getSnakeLevelIntermissionLevel } from "./snake-level-intermission";

describe("snake level intermission", () => {
  it("detects a running open-door transition to the next level", () => {
    expect(
      getSnakeLevelIntermissionLevel(
        { level: 1, status: "running" },
        { level: 2, status: "running" },
      ),
    ).toBe(2);
  });

  it("does not treat restarts, non-running states, or skipped levels as intermissions", () => {
    expect(
      getSnakeLevelIntermissionLevel(
        { level: 2, status: "lost" },
        { level: 1, status: "running" },
      ),
    ).toBeNull();
    expect(
      getSnakeLevelIntermissionLevel(
        { level: 1, status: "ready" },
        { level: 1, status: "running" },
      ),
    ).toBeNull();
    expect(
      getSnakeLevelIntermissionLevel(
        { level: 1, status: "running" },
        { level: 3, status: "running" },
      ),
    ).toBeNull();
    expect(
      getSnakeLevelIntermissionLevel(
        { level: 1, status: "running" },
        { level: 1, status: "lost" },
      ),
    ).toBeNull();
  });
});
