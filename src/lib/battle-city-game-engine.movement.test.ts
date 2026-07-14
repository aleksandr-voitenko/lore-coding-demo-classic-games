import { describe, expect, it } from "vitest";

import {
  advanceBattleCityGame,
  BATTLE_CITY_BOARD_SIZE,
  BATTLE_CITY_ICE_SLIDE_STEPS,
  BATTLE_CITY_TERRAIN_FRAGMENT_BITS,
  BATTLE_CITY_TICK_MS,
  bulletFixture,
  createBattleCityTerrainFragmentGrid,
  emptyTerrain,
  enemyFixture,
  fireBattleCityPlayer,
  moveBattleCityPlayer,
  pauseBattleCityGame,
  playerFixture,
  runningGame,
  type BattleCityGameState,
  type BattleCityTerrain,
} from "./battle-city-game-engine.test-helpers";

describe("Battle City movement and firing", () => {
  it.each(["spawning", "exploding"] as const)(
    "blocks movement and firing while the player is %s",
    (phase) => {
      const game = runningGame({
        player: playerFixture({ phase, phaseTicks: 10 }),
      });

      expect(moveBattleCityPlayer(game, "up")).toBe(game);
      expect(fireBattleCityPlayer(game)).toBe(game);
    },
  );

  it("moves the player in one-pixel subcell steps", () => {
    const game = runningGame({
      player: playerFixture({ col: 10, row: 10 }),
    });

    const movedOnce = moveBattleCityPlayer(game, "up");
    const movedEightTimes = Array.from({ length: 8 }).reduce<BattleCityGameState>(
      (current) => moveBattleCityPlayer(current, "up"),
      game,
    );

    expect(movedOnce.player.row).toBe(9.875);
    expect(movedOnce.player.col).toBe(10);
    expect(movedEightTimes.player.row).toBe(9);
  });

  it("applies the original three-of-four-frame player movement cadence", () => {
    const positions: number[] = [];
    let game = runningGame({ player: playerFixture({ col: 10, row: 10 }) });

    for (let frame = 0; frame < 4; frame += 1) {
      game = advanceBattleCityGame(
        game,
        BATTLE_CITY_TICK_MS,
        () => 0.99,
        { direction: "up", fireRequested: false },
      );
      positions.push(game.player.row);
    }

    expect(positions).toEqual([9.875, 9.75, 9.75, 9.625]);
  });

  it("moves before creating a shell requested on the same frame", () => {
    const advanced = advanceBattleCityGame(
      runningGame({
        player: playerFixture({ col: 10, direction: "up", row: 10 }),
      }),
      BATTLE_CITY_TICK_MS,
      () => 0.99,
      { direction: "up", fireRequested: true },
    );

    expect(advanced.player).toMatchObject({ col: 10, row: 9.875 });
    expect(advanced.bullets[0]).toMatchObject({
      col: 11,
      direction: "up",
      row: 9.875,
    });
  });

  it("snaps perpendicular turns to the nearest terrain lane", () => {
    const game = runningGame({
      player: playerFixture({
        col: 10,
        direction: "up",
        row: 10.375,
      }),
    });

    expect(moveBattleCityPlayer(game, "right").player).toMatchObject({
      col: 10.125,
      direction: "right",
      row: 10,
    });
  });

  it("does not leave the current lane when a perpendicular snap is blocked", () => {
    const game = runningGame({
      enemies: [enemyFixture({ col: 10, row: 8.125 })],
      player: playerFixture({
        col: 10,
        direction: "up",
        row: 10.375,
      }),
    });

    const firstAttempt = moveBattleCityPlayer(game, "right");
    const heldAttempt = moveBattleCityPlayer(firstAttempt, "right");

    expect(firstAttempt.player).toMatchObject({
      col: 10,
      direction: "right",
      row: 10.375,
    });
    expect(heldAttempt.player).toMatchObject({
      col: 10,
      direction: "right",
      row: 10.375,
    });
  });

  it("turns downward beside a surviving half-brick wall without lane-locking", () => {
    const terrain = emptyTerrain();
    terrain[10]![12] = "brick";
    terrain[11]![12] = "brick";
    const terrainFragments = createBattleCityTerrainFragmentGrid(terrain);
    const rightHalfMask =
      BATTLE_CITY_TERRAIN_FRAGMENT_BITS["top-right"] |
      BATTLE_CITY_TERRAIN_FRAGMENT_BITS["bottom-right"];
    terrainFragments[10]![12] = rightHalfMask;
    terrainFragments[11]![12] = rightHalfMask;
    let game = runningGame({
      player: playerFixture({ col: 10, direction: "right", row: 10 }),
      terrain,
      terrainFragments,
    });
    for (let step = 0; step < 4; step += 1) {
      game = moveBattleCityPlayer(game, "right");
    }

    expect(moveBattleCityPlayer(game, "down").player).toMatchObject({
      col: 10,
      direction: "down",
      row: 10.125,
    });
  });

  it.each([
    ["left", 9.875],
    ["right", 10.125],
  ] as const)(
    "turns %s above a surviving half-brick wall without lane-locking",
    (direction, expectedCol) => {
      const terrain = emptyTerrain();
      terrain[12]![10] = "brick";
      terrain[12]![11] = "brick";
      const terrainFragments = createBattleCityTerrainFragmentGrid(terrain);
      const bottomHalfMask =
        BATTLE_CITY_TERRAIN_FRAGMENT_BITS["bottom-left"] |
        BATTLE_CITY_TERRAIN_FRAGMENT_BITS["bottom-right"];
      terrainFragments[12]![10] = bottomHalfMask;
      terrainFragments[12]![11] = bottomHalfMask;
      let game = runningGame({
        player: playerFixture({ col: 10, direction: "down", row: 10 }),
        terrain,
        terrainFragments,
      });
      for (let step = 0; step < 4; step += 1) {
        game = moveBattleCityPlayer(game, "down");
      }

      expect(moveBattleCityPlayer(game, direction).player).toMatchObject({
        col: expectedCol,
        direction,
        row: 10,
      });
    },
  );

  it("does not penetrate a terrain cell during a fractional step", () => {
    const terrain = emptyTerrain();
    terrain[9]![10] = "brick";
    const game = runningGame({
      player: playerFixture({ col: 10, direction: "right", row: 10 }),
      terrain,
    });

    expect(moveBattleCityPlayer(game, "up").player).toMatchObject({
      col: 10,
      direction: "up",
      row: 10,
    });
  });

  it("moves a 2x2 player through forest and onto sliding ice", () => {
    const terrain = emptyTerrain();
    terrain[9]![10] = "forest";
    terrain[9]![11] = "ice";
    terrain[10]![10] = "ice";
    terrain[10]![11] = "ice";
    const game = runningGame({
      player: playerFixture({ col: 10, row: 10 }),
      terrain,
    });
    const moved = moveBattleCityPlayer(game, "up");
    const slid = advanceBattleCityGame(moved, () => 0.99);

    expect(moved.player).toMatchObject({
      iceSlideDirection: "up",
      iceSlideStepsRemaining: BATTLE_CITY_ICE_SLIDE_STEPS,
      row: 9.875,
    });
    expect(slid.player.row).toBe(9.75);
    expect(game.player.row).toBe(10);
  });

  it("stops an unsteered ice coast after 28 one-pixel movement steps", () => {
    const terrain = Array.from({ length: BATTLE_CITY_BOARD_SIZE }, () =>
      Array<BattleCityTerrain>(BATTLE_CITY_BOARD_SIZE).fill("ice"),
    );
    let game = runningGame({
      player: playerFixture({
        iceSlideDirection: "up",
        iceSlideStepsRemaining: BATTLE_CITY_ICE_SLIDE_STEPS,
      }),
      terrain,
    });

    for (let frame = 0; frame < 37; frame += 1) {
      game = advanceBattleCityGame(game, () => 0.99);
    }

    expect(game.player).toMatchObject({
      iceSlideDirection: null,
      iceSlideStepsRemaining: 0,
      row: 16.5,
    });

    const stoppedRow = game.player.row;
    for (let frame = 0; frame < 20; frame += 1) {
      game = advanceBattleCityGame(game, () => 0.99);
    }
    expect(game.player.row).toBe(stoppedRow);
  });

  it.each(["brick", "steel", "water", "headquarters"] as const)(
    "blocks player movement through %s",
    (terrainType) => {
      const terrain = emptyTerrain();
      terrain[9]![10] = terrainType;
      const game = runningGame({
        player: playerFixture({ col: 10, direction: "right", row: 10 }),
        terrain,
      });
      const moved = moveBattleCityPlayer(game, "up");

      expect(moved.player).toMatchObject({ col: 10, direction: "up", row: 10 });
    },
  );

  it("blocks board edges and other tank bodies", () => {
    const edge = runningGame({ player: playerFixture({ col: 0, row: 0 }) });
    const occupied = runningGame({
      enemies: [enemyFixture({ col: 10, row: 8 })],
      player: playerFixture({ col: 10, row: 10 }),
    });

    expect(moveBattleCityPlayer(edge, "up")).toBe(edge);
    expect(moveBattleCityPlayer(occupied, "up").player.row).toBe(10);
    expect(moveBattleCityPlayer(pauseBattleCityGame(edge), "down").status).toBe(
      "paused",
    );
  });

  it("limits the default player to one shell and tier two to two shells", () => {
    const game = runningGame();
    const fired = fireBattleCityPlayer(game);
    const blocked = fireBattleCityPlayer(fired);
    const upgraded = fireBattleCityPlayer({
      ...fired,
      player: { ...fired.player, powerTier: 2 },
    });

    expect(fired.bullets).toHaveLength(1);
    expect(fired.bullets[0]).toMatchObject({
      canDestroySteel: false,
      owner: "player",
      slot: 0,
      speed: 0.25,
      strength: 1,
    });
    expect(blocked).toBe(fired);
    expect(upgraded.bullets).toHaveLength(2);
    expect(upgraded.bullets).toMatchObject([
      { id: "bullet-0", slot: 8, speed: 0.25 },
      { id: "bullet-1", slot: 0, speed: 0.5 },
    ]);
    expect(fireBattleCityPlayer(pauseBattleCityGame(game))).toEqual(
      pauseBattleCityGame(game),
    );
  });

  it("reuses the primary slot while a migrated secondary shell remains", () => {
    const game = runningGame({
      bullets: [bulletFixture({ id: "secondary", slot: 8 })],
    });
    const fired = fireBattleCityPlayer(game);

    expect(fired.bullets).toMatchObject([
      { id: "secondary", slot: 8 },
      { id: "bullet-0", slot: 0 },
    ]);
  });

  it.each([
    ["up", 10.375, 11.625],
    ["right", 11.375, 12.625],
    ["down", 12.375, 11.625],
    ["left", 11.375, 10.625],
  ] as const)(
    "fires %s from the center of the tank's leading edge",
    (direction, expectedRow, expectedCol) => {
      const game = runningGame({
        player: playerFixture({
          col: 10.625,
          direction,
          row: 10.375,
        }),
      });

      expect(fireBattleCityPlayer(game).bullets[0]).toMatchObject({
        col: expectedCol,
        row: expectedRow,
      });
    },
  );

  it("collision-checks a newborn shell at its muzzle before moving it", () => {
    const fired = fireBattleCityPlayer(
      runningGame({
        player: playerFixture({ col: 10, direction: "up", row: 10 }),
      }),
    );
    const birthFrame = advanceBattleCityGame(fired, () => 0.99);
    const nextFrame = advanceBattleCityGame(birthFrame, () => 0.99);

    expect(fired.bullets[0]).toMatchObject({
      col: 11,
      isNewborn: true,
      row: 10,
    });
    expect(birthFrame.bullets[0]).toMatchObject({
      col: 11,
      isNewborn: false,
      row: 10,
    });
    expect(nextFrame.bullets[0]?.row).toBe(9.75);
  });

  it.each([
    ["up", 0, 10, 0, 11],
    ["right", 10, 24, 11, 26],
    ["down", 24, 10, 26, 11],
    ["left", 10, 0, 11, 0],
  ] as const)(
    "fires %s outward from a tank touching the board edge",
    (direction, row, col, expectedRow, expectedCol) => {
      const game = runningGame({
        player: playerFixture({ col, direction, row }),
      });

      expect(fireBattleCityPlayer(game).bullets[0]).toMatchObject({
        col: expectedCol,
        direction,
        row: expectedRow,
      });
    },
  );

  it("marks maximum-tier shells as strong and steel-destroying", () => {
    const game = runningGame({
      player: playerFixture({ powerTier: 3 }),
    });
    expect(fireBattleCityPlayer(game).bullets[0]).toMatchObject({
      canDestroySteel: true,
      speed: 0.5,
      strength: 2,
    });
  });
});
