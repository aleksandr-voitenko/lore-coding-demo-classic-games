import { describe, expect, it } from "vitest";

import {
  BATTLE_CITY_POWER_UP_POSITIONS,
  BATTLE_CITY_WEIGHTED_POWER_UP_TYPES,
  selectBattleCityPowerUp,
  selectBattleCityPowerUpPosition,
  selectBattleCityPowerUpType,
} from "./power-ups";

describe("canonical Battle City power-up selection", () => {
  it("exports the ROM's 4x4 position grid and weighted type table", () => {
    const coordinates = [3, 9, 15, 21];

    expect(BATTLE_CITY_POWER_UP_POSITIONS).toEqual(
      coordinates.flatMap((row) =>
        coordinates.map((col) => ({ col, row })),
      ),
    );
    expect(BATTLE_CITY_WEIGHTED_POWER_UP_TYPES).toEqual([
      "helmet",
      "clock",
      "shovel",
      "star",
      "grenade",
      "tank",
      "grenade",
      "star",
    ]);
  });

  it.each([
    [0, "helmet"],
    [0.125, "clock"],
    [0.25, "shovel"],
    [0.375, "star"],
    [0.5, "grenade"],
    [0.625, "tank"],
    [0.75, "grenade"],
    [0.875, "star"],
    [1, "star"],
  ] as const)("maps random value %s to %s", (value, type) => {
    expect(selectBattleCityPowerUpType(() => value)).toBe(type);
  });

  it("rerolls a position overlapping the player before selecting the type", () => {
    const values = [0, 0, 0.25, 0.25, 0.625];
    let calls = 0;
    const selection = selectBattleCityPowerUp({ col: 3, row: 3 }, () => {
      calls += 1;
      return values.shift() ?? 0;
    });

    expect(selection).toEqual({ col: 9, row: 9, type: "tank" });
    expect(calls).toBe(5);
  });

  it("allows a drop exactly 12 pixels from the player center", () => {
    let calls = 0;
    const position = selectBattleCityPowerUpPosition(
      { col: 4.5, row: 4.5 },
      () => {
        calls += 1;
        return 0;
      },
    );

    expect(position).toEqual({ col: 3, row: 3 });
    expect(calls).toBe(2);
  });

  it("falls back deterministically when a pathological RNG repeats an overlap", () => {
    let calls = 0;
    const position = selectBattleCityPowerUpPosition(
      { col: 3, row: 3 },
      () => {
        calls += 1;
        return 0;
      },
    );

    expect(position).toEqual({ col: 9, row: 3 });
    expect(calls).toBe(BATTLE_CITY_POWER_UP_POSITIONS.length * 2);
  });
});
