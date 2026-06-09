import { describe, expect, it } from "vitest";

import { advanceMinesweeperReplayFrame } from "./minesweeper-replay-player";
import {
  createInitialMinesweeperGame,
  getMinesweeperCellId,
  toggleMinesweeperFlag,
} from "@/lib/minesweeper-game-engine";
import {
  createInitialMinesweeperReplayGame,
  type MinesweeperReplayEvent,
} from "@/lib/minesweeper-replay";

describe("advanceMinesweeperReplayFrame", () => {
  it("skips no-op replay events until the next visible board change", () => {
    const flaggedGame = toggleMinesweeperFlag(
      createInitialMinesweeperGame(),
      getMinesweeperCellId(0, 0),
    );
    const events: MinesweeperReplayEvent[] = [
      {
        cellId: getMinesweeperCellId(0, 0),
        seq: 0,
        tick: 1,
        type: "reveal",
      },
      {
        cellId: getMinesweeperCellId(0, 0),
        seq: 1,
        tick: 2,
        type: "toggleFlag",
      },
      {
        cellId: getMinesweeperCellId(1, 0),
        seq: 2,
        tick: 3,
        type: "reveal",
      },
    ];

    const frame = advanceMinesweeperReplayFrame({
      eventIndex: 0,
      events,
      game: flaggedGame,
      random: () => 0,
    });

    expect(frame.eventIndex).toBe(2);
    expect(frame.game.flagCount).toBe(0);
    expect(frame.isFinished).toBe(false);
  });

  it("finishes playback when only no-op replay events remain", () => {
    const flaggedGame = toggleMinesweeperFlag(
      createInitialMinesweeperGame(),
      getMinesweeperCellId(0, 0),
    );
    const events: MinesweeperReplayEvent[] = [
      {
        cellId: getMinesweeperCellId(0, 0),
        seq: 0,
        tick: 1,
        type: "reveal",
      },
    ];

    const frame = advanceMinesweeperReplayFrame({
      eventIndex: 0,
      events,
      game: flaggedGame,
      random: () => 0,
    });

    expect(frame.eventIndex).toBe(1);
    expect(frame.game).toBe(flaggedGame);
    expect(frame.isFinished).toBe(true);
  });

  it("plays a duplicate-reveal terminal win through to completion", () => {
    const events: MinesweeperReplayEvent[] = [
      { seq: 0, tick: 0, type: "start" },
      { cellId: "4:4", seq: 1, tick: 0, type: "reveal" },
      { cellId: "6:2", seq: 2, tick: 1, type: "toggleFlag" },
      { cellId: "7:3", seq: 3, tick: 2, type: "toggleFlag" },
      { cellId: "7:2", seq: 4, tick: 3, type: "reveal" },
      { cellId: "4:0", seq: 5, tick: 5, type: "toggleFlag" },
      { cellId: "5:0", seq: 6, tick: 6, type: "reveal" },
      { cellId: "5:0", seq: 7, tick: 7, type: "reveal" },
      { cellId: "6:0", seq: 8, tick: 8, type: "reveal" },
      { cellId: "8:3", seq: 9, tick: 11, type: "reveal" },
      { cellId: "8:4", seq: 10, tick: 12, type: "reveal" },
      { cellId: "8:5", seq: 11, tick: 13, type: "reveal" },
      { cellId: "8:6", seq: 12, tick: 14, type: "toggleFlag" },
      { cellId: "7:7", seq: 13, tick: 15, type: "toggleFlag" },
      { cellId: "8:7", seq: 14, tick: 16, type: "reveal" },
      { cellId: "6:8", seq: 15, tick: 18, type: "reveal" },
      { cellId: "7:8", seq: 16, tick: 19, type: "reveal" },
      { cellId: "8:8", seq: 17, tick: 20, type: "toggleFlag" },
      { cellId: "5:8", seq: 18, tick: 21, type: "reveal" },
      { cellId: "4:8", seq: 19, tick: 22, type: "toggleFlag" },
      { cellId: "3:8", seq: 20, tick: 22, type: "reveal" },
      { cellId: "2:5", seq: 21, tick: 24, type: "toggleFlag" },
      { cellId: "0:4", seq: 22, tick: 25, type: "toggleFlag" },
      { cellId: "1:5", seq: 23, tick: 25, type: "reveal" },
      { cellId: "0:5", seq: 24, tick: 27, type: "reveal" },
      { cellId: "0:6", seq: 25, tick: 29, type: "reveal" },
      { cellId: "2:6", seq: 26, tick: 30, type: "reveal" },
      { cellId: "2:7", seq: 27, tick: 31, type: "reveal" },
    ];
    const initialReplay = createInitialMinesweeperReplayGame({
      boardHeight: 9,
      boardWidth: 9,
      mineCount: 10,
      seed: 530633489,
    });
    let eventIndex = 0;
    let game = initialReplay.game;
    let isFinished = false;

    while (!isFinished) {
      const frame = advanceMinesweeperReplayFrame({
        eventIndex,
        events,
        game,
        random: initialReplay.random,
      });

      eventIndex = frame.eventIndex;
      game = frame.game;
      isFinished = frame.isFinished;
    }

    expect(eventIndex).toBe(events.length);
    expect(game).toMatchObject({
      flagCount: 9,
      revealedSafeCellCount: 71,
      status: "won",
    });
  });
});
