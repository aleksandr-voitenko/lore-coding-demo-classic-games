import { describe, expect, it } from "vitest";

import type { BattleCityTerrain } from "./types";
import {
  applyBattleCityTerrainBulletImpact,
  battleCityTerrainFragmentsIntersectAabb,
  BATTLE_CITY_EMPTY_TERRAIN_FRAGMENT_MASK,
  BATTLE_CITY_FULL_TERRAIN_FRAGMENT_MASK,
  BATTLE_CITY_TERRAIN_FRAGMENT_BITS,
  createBattleCityTerrainFragmentGrid,
  getBattleCityTerrainFragmentBounds,
  getBattleCityTerrainFragmentImpact,
  getBattleCityTerrainFragmentsIntersectingAabb,
  hasBattleCityTerrainFragments,
} from "./terrain-fragments";

function terrainFixture(): BattleCityTerrain[][] {
  return [
    ["brick", "steel", "empty"],
    ["forest", "water", "ice"],
  ];
}

describe("Battle City terrain fragments", () => {
  it("initializes all four 4x4 fragments for brick and steel cells only", () => {
    expect(createBattleCityTerrainFragmentGrid(terrainFixture())).toEqual([
      [
        BATTLE_CITY_FULL_TERRAIN_FRAGMENT_MASK,
        BATTLE_CITY_FULL_TERRAIN_FRAGMENT_MASK,
        BATTLE_CITY_EMPTY_TERRAIN_FRAGMENT_MASK,
      ],
      [
        BATTLE_CITY_EMPTY_TERRAIN_FRAGMENT_MASK,
        BATTLE_CITY_EMPTY_TERRAIN_FRAGMENT_MASK,
        BATTLE_CITY_EMPTY_TERRAIN_FRAGMENT_MASK,
      ],
    ]);
  });

  it.each([
    ["up", 10, 11, 9, 11, "bottom-left"],
    ["right", 11, 12, 11, 12, "top-left"],
    ["down", 12, 11, 12, 11, "top-left"],
    ["left", 11, 10, 11, 9, "top-right"],
  ] as const)(
    "resolves an exact-edge %s impact into the entered cell and quadrant",
    (direction, row, col, cellRow, cellCol, fragment) => {
      expect(
        getBattleCityTerrainFragmentImpact({ col, row }, direction),
      ).toEqual({
        bit: BATTLE_CITY_TERRAIN_FRAGMENT_BITS[fragment],
        cellCol,
        cellRow,
        fragment,
      });
    },
  );

  it("gates each outer wall probe on its paired inner collision", () => {
    const terrain: BattleCityTerrain[][] = [["brick"]];
    const fragments = createBattleCityTerrainFragmentGrid(terrain);
    const result = applyBattleCityTerrainBulletImpact(fragments, terrain, {
      col: 0.75,
      direction: "down",
      isMaximumPower: false,
      row: 0,
    });

    expect(result).toMatchObject({
      didChange: true,
      didCollide: true,
      impact: { cellCol: 0, cellRow: 0, fragment: "top-right" },
      nextMask:
        BATTLE_CITY_FULL_TERRAIN_FRAGMENT_MASK &
        ~BATTLE_CITY_TERRAIN_FRAGMENT_BITS["top-right"],
      previousMask: BATTLE_CITY_FULL_TERRAIN_FRAGMENT_MASK,
    });
    expect(fragments).toEqual([[BATTLE_CITY_FULL_TERRAIN_FRAGMENT_MASK]]);
  });

  it.each([
    ["up", 2, 1, [[1, 0, 0b0011], [1, 1, 0b0011]]],
    ["right", 1, 1, [[0, 1, 0b1010], [1, 1, 0b1010]]],
    ["down", 1, 1, [[1, 0, 0b1100], [1, 1, 0b1100]]],
    ["left", 1, 1, [[0, 0, 0b0101], [1, 0, 0b0101]]],
  ] as const)(
    "carves the ROM's four-fragment %s-facing impact strip",
    (direction, row, col, expectedCells) => {
      const terrain: BattleCityTerrain[][] = Array.from({ length: 3 }, () =>
        Array<BattleCityTerrain>(3).fill("brick"),
      );
      const result = applyBattleCityTerrainBulletImpact(
        createBattleCityTerrainFragmentGrid(terrain),
        terrain,
        { col, direction, isMaximumPower: false, row },
      );

      expect(result.didCollide).toBe(true);
      for (const [cellRow, cellCol, expectedMask] of expectedCells) {
        expect(result.fragments[cellRow]?.[cellCol]).toBe(expectedMask);
      }
    },
  );

  it("allows a shell through an already empty quadrant", () => {
    const terrain: BattleCityTerrain[][] = [["brick"]];
    const first = applyBattleCityTerrainBulletImpact(
      createBattleCityTerrainFragmentGrid(terrain),
      terrain,
      {
        col: 0.75,
        direction: "down",
        isMaximumPower: false,
        row: 0,
      },
    );
    const repeated = applyBattleCityTerrainBulletImpact(
      first.fragments,
      terrain,
      {
        col: 0.75,
        direction: "down",
        isMaximumPower: false,
        row: 0,
      },
    );

    expect(repeated).toMatchObject({ didChange: false, didCollide: false });
    expect(repeated.fragments).toEqual(first.fragments);
  });

  it("blocks a normal shell on steel without damaging its fragments", () => {
    const terrain: BattleCityTerrain[][] = [["steel"]];
    const fragments = createBattleCityTerrainFragmentGrid(terrain);
    const result = applyBattleCityTerrainBulletImpact(fragments, terrain, {
      col: 0.25,
      direction: "right",
      isMaximumPower: false,
      row: 0.25,
    });

    expect(result).toMatchObject({
      didChange: false,
      didCollide: true,
      nextMask: BATTLE_CITY_FULL_TERRAIN_FRAGMENT_MASK,
    });
    expect(result.fragments).toEqual(fragments);
  });

  it.each(["brick", "steel"] as const)(
    "lets a maximum shell clear every fragment of an impacted %s cell",
    (terrainType) => {
      const terrain: BattleCityTerrain[][] = [[terrainType]];
      const result = applyBattleCityTerrainBulletImpact(
        createBattleCityTerrainFragmentGrid(terrain),
        terrain,
        {
          col: 0.25,
          direction: "right",
          isMaximumPower: true,
          row: 0.75,
        },
      );

      expect(result).toMatchObject({
        didChange: true,
        didCollide: true,
        impact: { fragment: "bottom-left" },
        nextMask: BATTLE_CITY_EMPTY_TERRAIN_FRAGMENT_MASK,
      });
      expect(hasBattleCityTerrainFragments(result.nextMask)).toBe(false);
    },
  );

  it.each([
    ["steel", false, BATTLE_CITY_FULL_TERRAIN_FRAGMENT_MASK],
    ["headquarters", false, BATTLE_CITY_EMPTY_TERRAIN_FRAGMENT_MASK],
    ["brick", true, BATTLE_CITY_EMPTY_TERRAIN_FRAGMENT_MASK],
  ] as const)(
    "stops the paired probe after a %s primary impact",
    (primaryTerrain, isMaximumPower, expectedPrimaryMask) => {
      const terrain: BattleCityTerrain[][] = [[primaryTerrain, "brick"]];
      const result = applyBattleCityTerrainBulletImpact(
        createBattleCityTerrainFragmentGrid(terrain),
        terrain,
        {
          col: 0.75,
          direction: "down",
          isMaximumPower,
          row: 0,
        },
      );

      expect(result.fragments[0]).toEqual([
        expectedPrimaryMask,
        BATTLE_CITY_FULL_TERRAIN_FRAGMENT_MASK,
      ]);
      expect(result.impacts.length).toBeGreaterThan(0);
      expect(
        result.impacts.every(
          ({ cellCol, cellRow }) => cellCol === 0 && cellRow === 0,
        ),
      ).toBe(true);
    },
  );

  it("reports only solid fragments that overlap a tank AABB", () => {
    const mask =
      BATTLE_CITY_TERRAIN_FRAGMENT_BITS["top-left"] |
      BATTLE_CITY_TERRAIN_FRAGMENT_BITS["bottom-right"];
    const crossingAabb = {
      bottom: 5.75,
      left: 7.4,
      right: 7.75,
      top: 5.4,
    };

    expect(
      getBattleCityTerrainFragmentBounds(5, 7, "bottom-right"),
    ).toEqual({ bottom: 6, left: 7.5, right: 8, top: 5.5 });
    expect(
      getBattleCityTerrainFragmentsIntersectingAabb(
        mask,
        5,
        7,
        crossingAabb,
      ),
    ).toEqual(["top-left", "bottom-right"]);
    expect(
      battleCityTerrainFragmentsIntersectAabb(mask, 5, 7, crossingAabb),
    ).toBe(true);
  });

  it("uses half-open bounds so touching an intact fragment edge is not a collision", () => {
    const topLeft = BATTLE_CITY_TERRAIN_FRAGMENT_BITS["top-left"];

    expect(
      battleCityTerrainFragmentsIntersectAabb(topLeft, 5, 7, {
        bottom: 5.5,
        left: 7.5,
        right: 8,
        top: 5,
      }),
    ).toBe(false);
    expect(hasBattleCityTerrainFragments(topLeft)).toBe(true);
  });
});
