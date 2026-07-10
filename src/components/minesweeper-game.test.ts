import { describe, expect, it } from "vitest";

import {
  createMinesweeperElapsedClock,
  createMinesweeperTimingController,
  getMinesweeperElapsedSeconds,
  pauseMinesweeperElapsedClock,
  resumeMinesweeperElapsedClock,
} from "./minesweeper-game";

describe("Minesweeper elapsed clock", () => {
  it("derives complete elapsed seconds when the display refresh callback is delayed", () => {
    const clock = createMinesweeperElapsedClock();

    resumeMinesweeperElapsedClock(clock, 1_000);

    expect(getMinesweeperElapsedSeconds(clock, 4_750)).toBe(3);
  });

  it("excludes Help time while preserving accumulated active duration", () => {
    const clock = createMinesweeperElapsedClock();

    resumeMinesweeperElapsedClock(clock, 1_000);
    pauseMinesweeperElapsedClock(clock, 4_750);

    expect(getMinesweeperElapsedSeconds(clock, 14_750)).toBe(3);

    resumeMinesweeperElapsedClock(clock, 14_750);

    expect(getMinesweeperElapsedSeconds(clock, 16_250)).toBe(5);
  });

  it("freezes the same whole-second value used by terminal scoring", () => {
    const clock = createMinesweeperElapsedClock();

    resumeMinesweeperElapsedClock(clock, 2_000);

    expect(pauseMinesweeperElapsedClock(clock, 8_900)).toBe(6);
    expect(getMinesweeperElapsedSeconds(clock, 20_000)).toBe(6);
  });

  it("keeps an async first reveal paused when its replay installs behind Help", () => {
    const controller = createMinesweeperTimingController();
    let installedReplayStatus: "cleared" | "paused" | "running" = "cleared";
    let pendingReplayStatus: "cleared" | "paused" | "running" = "running";

    controller.openHelp(
      1_000,
      () => {
        pendingReplayStatus = "paused";
      },
      true,
    );

    expect(pendingReplayStatus).toBe("paused");

    pendingReplayStatus = "cleared";
    installedReplayStatus = "running";
    controller.keepReplayPaused(() => {
      installedReplayStatus = "paused";
    });

    expect(installedReplayStatus).toBe("paused");
    expect(controller.transitionStatus("ready", "running", 2_500)).toBe(0);
    expect(controller.getElapsedSeconds(7_000)).toBe(0);

    controller.closeHelp("running", 7_000, () => {
      installedReplayStatus = "running";
    });

    expect(installedReplayStatus).toBe("running");
    expect(controller.getElapsedSeconds(9_900)).toBe(2);

    const finalElapsedSeconds = controller.transitionStatus("running", "won", 9_900);

    expect({
      leaderboardScore: finalElapsedSeconds,
      replayFinalScore: finalElapsedSeconds,
      replayFinalTick: finalElapsedSeconds,
    }).toEqual({
      leaderboardScore: 2,
      replayFinalScore: 2,
      replayFinalTick: 2,
    });
    expect(controller.getElapsedSeconds(20_000)).toBe(2);

    expect(
      controller.reset(() => {
        installedReplayStatus = "cleared";
        pendingReplayStatus = "cleared";
      }),
    ).toBe(0);
    expect(installedReplayStatus).toBe("cleared");
    expect(pendingReplayStatus).toBe("cleared");
    expect(controller.transitionStatus("won", "ready", 21_000)).toBe(0);
    expect(controller.getElapsedSeconds(30_000)).toBe(0);

    let passiveResumeCount = 0;

    controller.openHelp(31_000, () => {
      throw new Error("Inactive Help should not pause replay timing.");
    }, false);
    controller.closeHelp("ready", 32_000, () => {
      passiveResumeCount += 1;
    });

    expect(passiveResumeCount).toBe(0);
  });
});
