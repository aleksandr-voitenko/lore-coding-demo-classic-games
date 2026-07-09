import { describe, expect, it } from "vitest";

import {
  clampMinesweeperBoardFocusPosition,
  getMinesweeperBoardFocusCellId,
  getMinesweeperBoardFocusNavigationTarget,
} from "./minesweeper-board-focus";

describe("Minesweeper board focus", () => {
  it("clamps a remembered Hard coordinate when the board becomes smaller", () => {
    const position = clampMinesweeperBoardFocusPosition({ x: 29, y: 15 }, 9, 9);

    expect(position).toEqual({ x: 8, y: 8 });
    expect(getMinesweeperBoardFocusCellId(position)).toBe("8:8");
  });

  it.each([
    ["ArrowLeft", { x: 0, y: 1 }],
    ["ArrowRight", { x: 2, y: 1 }],
    ["ArrowUp", { x: 1, y: 0 }],
    ["ArrowDown", { x: 1, y: 2 }],
    ["Home", { x: 0, y: 1 }],
    ["End", { x: 2, y: 1 }],
  ])("moves %s within a three-by-three board", (key, expectedPosition) => {
    expect(
      getMinesweeperBoardFocusNavigationTarget({
        ctrlKey: false,
        height: 3,
        key,
        position: { x: 1, y: 1 },
        width: 3,
      }),
    ).toEqual(expectedPosition);
  });

  it("uses Control+Home and Control+End for whole-board boundaries", () => {
    expect(
      getMinesweeperBoardFocusNavigationTarget({
        ctrlKey: true,
        height: 16,
        key: "Home",
        position: { x: 12, y: 8 },
        width: 30,
      }),
    ).toEqual({ x: 0, y: 0 });
    expect(
      getMinesweeperBoardFocusNavigationTarget({
        ctrlKey: true,
        height: 16,
        key: "End",
        position: { x: 12, y: 8 },
        width: 30,
      }),
    ).toEqual({ x: 29, y: 15 });
  });

  it("clamps arrow navigation at board edges and ignores action keys", () => {
    expect(
      getMinesweeperBoardFocusNavigationTarget({
        ctrlKey: false,
        height: 16,
        key: "ArrowRight",
        position: { x: 29, y: 15 },
        width: 30,
      }),
    ).toEqual({ x: 29, y: 15 });
    expect(
      getMinesweeperBoardFocusNavigationTarget({
        ctrlKey: false,
        height: 16,
        key: "f",
        position: { x: 29, y: 15 },
        width: 30,
      }),
    ).toBeNull();
  });
});
