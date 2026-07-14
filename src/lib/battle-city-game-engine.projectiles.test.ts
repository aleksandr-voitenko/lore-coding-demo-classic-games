import { describe, expect, it } from "vitest";

import {
  advanceBattleCityGame,
  BATTLE_CITY_BULLET_IMPACT_TICKS,
  BATTLE_CITY_ENEMY_EXPLOSION_TICKS,
  BATTLE_CITY_FULL_TERRAIN_FRAGMENT_MASK,
  BATTLE_CITY_GAME_OVER_TRANSITION_TICKS,
  BATTLE_CITY_HEADQUARTERS_EXPLOSION_TICKS,
  BATTLE_CITY_PLAYER_EXPLOSION_TICKS,
  BATTLE_CITY_PLAYER_INVULNERABILITY_TICKS,
  BATTLE_CITY_PLAYER_SPAWN_TICKS,
  BATTLE_CITY_STAGE_TRANSITION_TICKS,
  BATTLE_CITY_TERRAIN_FRAGMENT_BITS,
  bulletFixture,
  createBattleCityTerrainFragmentGrid,
  emptyTerrain,
  enemyFixture,
  fireBattleCityPlayer,
  moveBattleCityPlayer,
  playerFixture,
  powerUpGame,
  runningGame,
  type BattleCityBullet,
  type BattleCityGameState,
} from "./battle-city-game-engine.test-helpers";

describe("Battle City projectile collisions", () => {
  it.each([
    ["up", 9, 11, 0b0011],
    ["right", 11, 12, 0b1010],
    ["down", 12, 11, 0b1100],
    ["left", 11, 9, 0b0101],
  ] as const)(
    "carves the centered four-fragment brick strip when firing %s",
    (direction, targetRow, targetCol, expectedMask) => {
      const terrain = emptyTerrain();
      terrain[targetRow]![targetCol] = "brick";
      const fired = fireBattleCityPlayer(
        runningGame({
          player: playerFixture({ col: 10, direction, row: 10 }),
          terrain,
          tick: 1,
        }),
      );

      const advanced = advanceBattleCityGame(fired, () => 0.99);

      expect(advanced.terrain[targetRow]?.[targetCol]).toBe("brick");
      expect(advanced.terrainFragments[targetRow]?.[targetCol]).toBe(expectedMask);
      expect(advanced.bullets).toEqual([
        expect.objectContaining({ impactTicks: BATTLE_CITY_BULLET_IMPACT_TICKS }),
      ]);
    },
  );

  it("carves a four-fragment face while a maximum shell clears both face cells", () => {
    const terrain = emptyTerrain();
    terrain[9]![10] = "brick";
    terrain[10]![10] = "brick";
    terrain[10]![11] = "brick";
    const ordinary = advanceBattleCityGame(
      runningGame({ bullets: [bulletFixture()], terrain, tick: 1 }),
      () => 0.99,
    );
    const strong = advanceBattleCityGame(
      runningGame({
        bullets: [bulletFixture({ canDestroySteel: true, strength: 2 })],
        terrain,
      }),
      () => 0.99,
    );

    expect(ordinary.terrain[9]?.[10]).toBe("brick");
    expect(ordinary.terrain[10]?.slice(10, 12)).toEqual(["brick", "brick"]);
    expect(ordinary.terrainFragments[9]?.[10]).toBe(0b1010);
    expect(ordinary.terrainFragments[10]?.[10]).toBe(
      0b1010,
    );
    expect(strong.terrain[9]?.[10]).toBe("empty");
    expect(strong.terrain[10]?.slice(10, 12)).toEqual(["empty", "brick"]);
    expect(strong.terrainFragments[9]?.[10]).toBe(0);
    expect(strong.terrainFragments[10]?.slice(10, 12)).toEqual([
      0,
      BATTLE_CITY_FULL_TERRAIN_FRAGMENT_MASK,
    ]);
    expect(terrain[9]?.[10]).toBe("brick");
    expect(terrain[10]?.slice(10, 12)).toEqual(["brick", "brick"]);
  });

  it("holds a firing slot through the nine-frame shell impact lifecycle", () => {
    const terrain = emptyTerrain();
    terrain[10]![10] = "brick";
    let game = advanceBattleCityGame(
      runningGame({ bullets: [bulletFixture()], terrain, tick: 1 }),
      () => 0.99,
    );

    expect(game.bullets).toEqual([
      expect.objectContaining({
        id: "bullet-test",
        impactTicks: BATTLE_CITY_BULLET_IMPACT_TICKS,
      }),
    ]);
    expect(fireBattleCityPlayer(game)).toBe(game);

    for (let frame = 0; frame < BATTLE_CITY_BULLET_IMPACT_TICKS - 1; frame += 1) {
      game = advanceBattleCityGame(game, () => 0.99);
    }
    expect(game.bullets[0]).toMatchObject({ impactTicks: 1 });

    game = advanceBattleCityGame(game, () => 0.99);
    expect(game.bullets).toEqual([]);
    expect(fireBattleCityPlayer(game).bullets).toHaveLength(1);
  });

  it("lets tanks pass through cleared wall fragments while intact quadrants still block", () => {
    const terrain = emptyTerrain();
    terrain[9]![10] = "brick";
    const terrainFragments = createBattleCityTerrainFragmentGrid(terrain);
    terrainFragments[9]![10] =
      BATTLE_CITY_TERRAIN_FRAGMENT_BITS["top-left"] |
      BATTLE_CITY_TERRAIN_FRAGMENT_BITS["top-right"];
    const game = runningGame({
      player: playerFixture({ col: 10, row: 10 }),
      terrain,
      terrainFragments,
    });

    expect(moveBattleCityPlayer(game, "up").player.row).toBe(9.875);
  });

  it("only lets maximum-tier player shells destroy steel", () => {
    const terrain = emptyTerrain();
    terrain[10]![10] = "steel";
    const blocked = advanceBattleCityGame(
      runningGame({ bullets: [bulletFixture()], terrain, tick: 1 }),
      () => 0.99,
    );
    const destroyed = advanceBattleCityGame(
      runningGame({
        bullets: [bulletFixture({ canDestroySteel: true, strength: 2 })],
        terrain,
      }),
      () => 0.99,
    );

    expect(blocked.terrain[10]?.[10]).toBe("steel");
    expect(destroyed.terrain[10]?.[10]).toBe("empty");
    expect(destroyed.terrainFragments[10]?.[10]).toBe(0);
  });

  it("keeps play active for the 39-frame headquarters explosion before game over", () => {
    for (const owner of ["player", "enemy"] as const) {
      const terrain = emptyTerrain();
      terrain[10]![10] = "headquarters";
      const slot = owner === "player" ? 0 : 5;
      const tick = owner === "player" ? 1 : 0;
      let advanced = advanceBattleCityGame(
        runningGame({
          bullets: [bulletFixture({ owner, slot })],
          terrain,
          tick,
        }),
        () => 0.99,
      );
      expect(advanced).toMatchObject({
        baseAlive: false,
        baseExplosionTicks: BATTLE_CITY_HEADQUARTERS_EXPLOSION_TICKS,
        stageOutcome: "lost",
        stageTransitionTicks: 0,
        status: "running",
      });

      for (
        let frame = 0;
        frame < BATTLE_CITY_HEADQUARTERS_EXPLOSION_TICKS - 1;
        frame += 1
      ) {
        advanced = advanceBattleCityGame(advanced, () => 0.99);
      }
      expect(advanced).toMatchObject({
        baseExplosionTicks: 1,
        status: "running",
      });

      advanced = advanceBattleCityGame(advanced, () => 0.99);
      expect(advanced).toMatchObject({
        baseExplosionTicks: 0,
        stageTransitionTicks: BATTLE_CITY_GAME_OVER_TRANSITION_TICKS,
        status: "game-over",
      });
    }
  });

  it("resolves a headquarters impact before overlapping shells cancel", () => {
    const terrain = emptyTerrain();
    terrain[10]![10] = "headquarters";
    const advanced = advanceBattleCityGame(
      runningGame({
        bullets: [
          bulletFixture({
            col: 10,
            id: "player",
            isNewborn: true,
            slot: 0,
            speed: 0.5,
          }),
          bulletFixture({
            col: 10.25,
            direction: "left",
            id: "enemy",
            isNewborn: true,
            owner: "enemy",
            slot: 5,
            speed: 0.5,
          }),
        ],
        terrain,
      }),
      () => 0.99,
    );

    expect(advanced.baseAlive).toBe(false);
    expect(advanced.baseExplosionTicks).toBe(
      BATTLE_CITY_HEADQUARTERS_EXPLOSION_TICKS,
    );
    expect(advanced.bullets).toEqual([
      expect.objectContaining({
        id: "enemy",
        impactTicks: BATTLE_CITY_BULLET_IMPACT_TICKS,
      }),
      expect.objectContaining({
        id: "player",
        impactTicks: BATTLE_CITY_BULLET_IMPACT_TICKS,
      }),
    ]);
  });

  it("moves shells their full frame distance before collision passes", () => {
    const terrain = emptyTerrain();
    terrain[10]![10] = "brick";
    const advanced = advanceBattleCityGame(
      runningGame({
        bullets: [
          bulletFixture({ col: 9.5, id: "player", slot: 0, speed: 0.5 }),
          bulletFixture({
            col: 9.5,
            id: "enemy",
            owner: "enemy",
            slot: 5,
            speed: 0.5,
          }),
        ],
        terrain,
      }),
      () => 0.99,
    );

    expect(advanced.terrainFragments[10]?.[10]).toBe(0b1010);
    expect(advanced.bullets).toEqual([
      expect.objectContaining({
        id: "enemy",
        impactTicks: BATTLE_CITY_BULLET_IMPACT_TICKS,
        slot: 5,
      }),
      expect.objectContaining({
        col: 10,
        id: "player",
        impactTicks: 0,
        slot: 0,
      }),
    ]);
  });

  it("resolves simultaneous terrain impacts by slot regardless of array order", () => {
    const player = bulletFixture({
      col: 10,
      id: "player",
      isNewborn: true,
      slot: 0,
      speed: 0.5,
    });
    const enemy = bulletFixture({
      col: 10,
      id: "enemy",
      isNewborn: true,
      owner: "enemy",
      slot: 5,
      speed: 0.5,
    });
    const resolve = (bullets: BattleCityBullet[]) => {
      const terrain = emptyTerrain();
      terrain[10]![10] = "brick";
      return advanceBattleCityGame(
        runningGame({ bullets, terrain }),
        () => 0.99,
      );
    };

    for (const advanced of [resolve([player, enemy]), resolve([enemy, player])]) {
      expect(advanced.terrainFragments[10]?.[10]).toBe(0b1010);
      expect(advanced.bullets).toEqual([
        expect.objectContaining({
          id: "enemy",
          impactTicks: BATTLE_CITY_BULLET_IMPACT_TICKS,
          slot: 5,
        }),
        expect.objectContaining({
          id: "player",
          impactTicks: 0,
          slot: 0,
        }),
      ]);
    }
  });

  it("gates ordinary terrain probes by slot parity while fast shells always probe", () => {
    const resolve = (
      bullet: BattleCityBullet,
      tick: number,
    ): BattleCityGameState => {
      const terrain = emptyTerrain();
      terrain[10]![10] = "brick";
      return advanceBattleCityGame(
        runningGame({ bullets: [bullet], terrain, tick }),
        () => 0.99,
      );
    };
    const playerOrdinary = bulletFixture({ col: 9.75, slot: 0 });
    const enemyOrdinary = bulletFixture({
      col: 9.75,
      owner: "enemy",
      slot: 5,
    });
    const playerFast = bulletFixture({ col: 9.5, slot: 0, speed: 0.5 });

    const skippedPlayer = resolve(playerOrdinary, 0);
    const probingPlayer = resolve(playerOrdinary, 1);
    const probingEnemy = resolve(enemyOrdinary, 0);
    const skippedEnemy = resolve(enemyOrdinary, 1);
    const probingFast = resolve(playerFast, 0);

    expect(skippedPlayer.terrainFragments[10]?.[10]).toBe(0b1111);
    expect(skippedPlayer.bullets[0]).toMatchObject({ col: 10, impactTicks: 0 });
    expect(probingPlayer.terrainFragments[10]?.[10]).toBe(0b1010);
    expect(probingEnemy.terrainFragments[10]?.[10]).toBe(0b1010);
    expect(skippedEnemy.terrainFragments[10]?.[10]).toBe(0b1111);
    expect(probingFast.terrainFragments[10]?.[10]).toBe(0b1010);
  });

  it("checks shell and tank collisions only after each full-frame move", () => {
    const separatingShells = advanceBattleCityGame(
      runningGame({
        bullets: [
          bulletFixture({
            col: 10,
            direction: "left",
            id: "player",
            slot: 0,
            speed: 0.5,
          }),
          bulletFixture({
            col: 10.125,
            direction: "right",
            id: "enemy",
            owner: "enemy",
            slot: 5,
            speed: 0.5,
          }),
        ],
      }),
      () => 0.99,
    );
    const passingTank = advanceBattleCityGame(
      runningGame({
        bullets: [
          bulletFixture({
            col: 12,
            direction: "right",
            row: 11,
            slot: 0,
            speed: 0.5,
          }),
        ],
        enemies: [enemyFixture({ col: 10, row: 10 })],
        freezeTicks: 2,
        spawnedEnemyCount: 20,
      }),
      () => 0.99,
    );

    expect(separatingShells.bullets).toMatchObject([
      { col: 10.625, id: "enemy", slot: 5 },
      { col: 9.5, id: "player", slot: 0 },
    ]);
    expect(passingTank.enemies[0]).toMatchObject({ hitPoints: 1 });
    expect(passingTank.bullets[0]).toMatchObject({ col: 12.5, impactTicks: 0 });
  });

  it("resolves every wall and headquarters probe across one impact face", () => {
    const terrain = emptyTerrain();
    terrain[9]![10] = "brick";
    terrain[10]![10] = "headquarters";
    const advanced = advanceBattleCityGame(
      runningGame({ bullets: [bulletFixture()], terrain, tick: 1 }),
      () => 0.99,
    );

    expect(advanced.terrainFragments[9]?.[10]).toBe(0b1010);
    expect(advanced.baseAlive).toBe(false);
    expect(advanced.bullets[0]).toMatchObject({
      impactTicks: BATTLE_CITY_BULLET_IMPACT_TICKS,
    });
  });

  it("cancels opposing shells in the same cell and when they cross", () => {
    const sameCell = advanceBattleCityGame(
      runningGame({
        bullets: [
          bulletFixture({ col: 9.75, id: "player" }),
          bulletFixture({
            col: 10.25,
            direction: "left",
            id: "enemy",
            owner: "enemy",
          }),
        ],
      }),
      () => 0.99,
    );
    const crossed = advanceBattleCityGame(
      runningGame({
        bullets: [
          bulletFixture({ col: 9.95, id: "player" }),
          bulletFixture({
            col: 10.05,
            direction: "left",
            id: "enemy",
            owner: "enemy",
          }),
        ],
      }),
      () => 0.99,
    );

    expect(sameCell.bullets).toEqual([]);
    expect(crossed.bullets).toEqual([]);
  });

  it("uses player-shell slot precedence for overlapping collision clusters", () => {
    const makeStationary = (
      id: string,
      slot: number,
      owner: "player" | "enemy",
    ) =>
      bulletFixture({
        col: 10,
        id,
        isNewborn: true,
        owner,
        row: 10,
        slot,
      });
    const twoPlayerShells = advanceBattleCityGame(
      runningGame({
        bullets: [
          makeStationary("player-secondary", 8, "player"),
          makeStationary("enemy", 5, "enemy"),
          makeStationary("player-primary", 0, "player"),
        ],
      }),
      () => 0.99,
    );
    const twoEnemyShells = advanceBattleCityGame(
      runningGame({
        bullets: [
          makeStationary("enemy-high", 5, "enemy"),
          makeStationary("enemy-low", 4, "enemy"),
          makeStationary("player", 0, "player"),
        ],
      }),
      () => 0.99,
    );

    expect(twoPlayerShells.bullets).toEqual([
      expect.objectContaining({ id: "player-primary", slot: 0 }),
    ]);
    expect(twoEnemyShells.bullets).toEqual([]);
  });

  it("cancels shells whose centers enter the original six-pixel envelope", () => {
    const near = advanceBattleCityGame(
      runningGame({
        bullets: [
          bulletFixture({ col: 10, id: "player", speed: 0.125 }),
          bulletFixture({
            col: 10.875,
            direction: "left",
            id: "enemy",
            owner: "enemy",
            row: 10.625,
            speed: 0.125,
          }),
        ],
      }),
      () => 0.99,
    );
    const boundary = advanceBattleCityGame(
      runningGame({
        bullets: [
          bulletFixture({ col: 10, id: "player", speed: 0.125 }),
          bulletFixture({
            col: 10.875,
            direction: "left",
            id: "enemy",
            owner: "enemy",
            row: 10.75,
            speed: 0.125,
          }),
        ],
      }),
      () => 0.99,
    );

    expect(near.bullets).toEqual([]);
    expect(boundary.bullets).toHaveLength(2);
  });

  it("does not run shell collision checks between enemy slots", () => {
    const advanced = advanceBattleCityGame(
      runningGame({
        bullets: [
          bulletFixture({
            col: 10,
            id: "slot-five",
            owner: "enemy",
            slot: 5,
            speed: 0.125,
          }),
          bulletFixture({
            col: 10.875,
            direction: "left",
            id: "slot-four",
            owner: "enemy",
            row: 10.625,
            slot: 4,
            speed: 0.125,
          }),
        ],
      }),
      () => 0.99,
    );

    expect(advanced.bullets).toHaveLength(2);
  });

  it("hits tank grazes inside ten pixels and misses at the boundary", () => {
    const enemy = enemyFixture({ col: 10, row: 10 });
    const graze = advanceBattleCityGame(
      runningGame({
        bullets: [
          bulletFixture({
            col: 12.25,
            direction: "left",
            row: 11,
            speed: 0.125,
          }),
        ],
        enemies: [enemy],
        freezeTicks: 2,
        spawnedEnemyCount: 20,
      }),
      () => 0.99,
    );
    const boundary = advanceBattleCityGame(
      runningGame({
        bullets: [
          bulletFixture({
            col: 12.375,
            direction: "left",
            row: 11,
            speed: 0.125,
          }),
        ],
        enemies: [enemy],
        freezeTicks: 2,
        spawnedEnemyCount: 20,
      }),
      () => 0.99,
    );

    expect(graze.enemies[0]).toMatchObject({ hitPoints: 0 });
    expect(boundary.enemies[0]).toMatchObject({ hitPoints: 1 });
  });

  it("damages armor, drops a 2x2-safe carrier power-up on first hit, then scores kills", () => {
    const armor = enemyFixture({
      hitPoints: 4,
      isCarrier: true,
      maxHitPoints: 4,
      score: 400,
      type: "armor",
    });
    const hit = advanceBattleCityGame(
      runningGame({
        bullets: [bulletFixture()],
        enemies: [armor],
        freezeTicks: 2,
        powerUpScorePopup: { col: 3, row: 4, ticks: 12 },
        spawnedEnemyCount: 20,
      }),
      () => 0.999,
    );

    expect(hit.enemies[0]).toMatchObject({
      hasDroppedPowerUp: true,
      hitPoints: 3,
    });
    expect(hit.activePowerUp).toMatchObject({ col: 21, row: 21, type: "star" });
    expect(hit.powerUpScorePopup).toBeNull();
    expect(hit.activePowerUp!.row + 1).toBeLessThan(26);
    expect(hit.activePowerUp!.col + 1).toBeLessThan(26);

    const killed = advanceBattleCityGame(
      runningGame({
        bullets: [bulletFixture()],
        enemies: [enemyFixture()],
        freezeTicks: 2,
        score: 19_900,
        spawnedEnemyCount: 20,
      }),
      () => 0.99,
    );
    expect(killed).toMatchObject({
      bonusLifeAwarded: true,
      destroyedEnemyCount: 0,
      lives: 4,
      score: 20_000,
    });
    expect(killed.enemies[0]).toMatchObject({
      destructionPoints: 100,
      explosionTicks: BATTLE_CITY_ENEMY_EXPLOSION_TICKS,
      hitPoints: 0,
    });
    expect(killed.stageKillCounts.basic).toBe(1);
  });

  it("keeps scoring but suppresses the threshold life after headquarters loss", () => {
    const defeatedByKill = advanceBattleCityGame(
      runningGame({
        baseAlive: false,
        baseExplosionTicks: 10,
        bullets: [bulletFixture()],
        enemies: [enemyFixture()],
        freezeTicks: 2,
        score: 19_900,
        spawnedEnemyCount: 20,
      }),
      () => 0.99,
    );
    const defeatedByPickup = advanceBattleCityGame(
      powerUpGame("star", {
        baseAlive: false,
        baseExplosionTicks: 10,
        score: 19_500,
      }),
      () => 0.99,
    );

    expect(defeatedByKill).toMatchObject({
      bonusLifeAwarded: false,
      lives: 3,
      score: 20_000,
    });
    expect(defeatedByPickup).toMatchObject({
      bonusLifeAwarded: false,
      lives: 3,
      score: 20_000,
    });
  });

  it("holds a destroyed enemy slot through its explosion before completing the stage", () => {
    const hit = advanceBattleCityGame(
      runningGame({
        bullets: [bulletFixture()],
        enemies: [enemyFixture()],
        freezeTicks: 2,
        spawnedEnemyCount: 1,
        totalEnemyCount: 1,
      }),
      () => 0.99,
    );
    const completed = advanceBattleCityGame(
      {
        ...hit,
        enemies: [{ ...hit.enemies[0]!, explosionTicks: 1 }],
        tick: 2,
      },
      () => 0.99,
    );

    expect(hit).toMatchObject({ destroyedEnemyCount: 0, status: "running" });
    expect(hit.enemies[0]?.explosionTicks).toBe(
      BATTLE_CITY_ENEMY_EXPLOSION_TICKS,
    );
    expect(completed).toMatchObject({
      destroyedEnemyCount: 1,
      stageOutcome: "cleared",
      stageTransitionTicks: BATTLE_CITY_STAGE_TRANSITION_TICKS,
      status: "stage-clear",
    });
    expect(completed.enemies).toEqual([]);
  });

  it("starts the result tail when the last enemy expires during the HQ explosion", () => {
    const completed = advanceBattleCityGame(
      runningGame({
        baseAlive: false,
        baseExplosionTicks: 10,
        destroyedEnemyCount: 19,
        enemies: [
          enemyFixture({
            explosionTicks: 1,
            hitPoints: 0,
            moveIntervalTicks: 1,
          }),
        ],
        spawnedEnemyCount: 20,
        totalEnemyCount: 20,
      }),
      () => 0.99,
    );

    expect(completed).toMatchObject({
      baseAlive: false,
      baseExplosionTicks: 9,
      destroyedEnemyCount: 20,
      stageOutcome: "lost",
      stageTransitionTicks: BATTLE_CITY_STAGE_TRANSITION_TICKS,
      status: "stage-clear",
    });
    expect(completed.enemies).toEqual([]);
  });

  it("plays the death explosion before consuming a life and spawning again", () => {
    const enemyShot = bulletFixture({
      col: 7.75,
      direction: "right",
      id: "fatal-shot",
      owner: "enemy",
      row: 20,
      slot: 5,
    });
    const otherShot = bulletFixture({
      col: 2,
      direction: "down",
      id: "other-shot",
      owner: "enemy",
      row: 2,
      slot: 4,
    });
    const hit = advanceBattleCityGame(
      runningGame({
        bullets: [enemyShot, otherShot],
        lives: 2,
        player: playerFixture({ powerTier: 3 }),
      }),
      () => 0.99,
    );
    const spawning = advanceBattleCityGame(
      {
        ...hit,
        player: { ...hit.player, phaseTicks: 1 },
      },
      () => 0.99,
    );
    const skippedSpawnFrame = advanceBattleCityGame(
      {
        ...spawning,
        player: { ...spawning.player, phaseTicks: 1 },
      },
      () => 0.99,
    );
    const active = advanceBattleCityGame(skippedSpawnFrame, () => 0.99);

    expect(hit).toMatchObject({ lives: 2, status: "running" });
    expect(hit.player).toMatchObject({
      phase: "exploding",
      phaseTicks: BATTLE_CITY_PLAYER_EXPLOSION_TICKS,
      powerTier: 0,
    });
    expect(hit.bullets).toEqual([
      expect.objectContaining({
        id: "fatal-shot",
        impactTicks: BATTLE_CITY_BULLET_IMPACT_TICKS,
      }),
      expect.objectContaining({ id: "other-shot", impactTicks: 0 }),
    ]);
    expect(spawning).toMatchObject({ lives: 1, status: "running" });
    expect(spawning.player).toMatchObject({
      col: 8,
      invulnerabilityTicks: 0,
      phase: "spawning",
      phaseTicks: BATTLE_CITY_PLAYER_SPAWN_TICKS,
      powerTier: 0,
      row: 24,
    });
    expect(active.player).toMatchObject({ phase: "active", phaseTicks: 0 });
    expect(active.player.invulnerabilityTicks).toBeGreaterThanOrEqual(128);
    expect(active.player.invulnerabilityTicks).toBeLessThanOrEqual(
      BATTLE_CITY_PLAYER_INVULNERABILITY_TICKS - 1,
    );
  });

  it.each([
    [0, 128],
    [1, 191],
  ] as const)(
    "starts respawn protection on clock phase %i with %i ticks",
    (tick, expectedShieldTicks) => {
      const active = advanceBattleCityGame(
        runningGame({
          player: playerFixture({
            phase: "spawning",
            phaseTicks: 1,
          }),
          tick,
        }),
        () => 0.99,
      );

      expect(active.player).toMatchObject({
        invulnerabilityTicks: expectedShieldTicks,
        phase: "active",
      });
    },
  );

  it.each([
    [1, 32],
    [2, 32],
    [3, 31],
    [4, 32],
  ] as const)(
    "runs the 24-update player explosion for %s-start timing in %s video frames",
    (startingTick, expectedFrames) => {
      let game = runningGame({
        player: playerFixture({
          phase: "exploding",
          phaseTicks: BATTLE_CITY_PLAYER_EXPLOSION_TICKS,
        }),
        tick: startingTick,
      });
      let frames = 0;

      while (game.player.phase === "exploding" && frames < 40) {
        game = advanceBattleCityGame(game, () => 0.99);
        frames += 1;
      }

      expect(frames).toBe(expectedFrames);
      expect(game.player.phase).toBe("spawning");
    },
  );

  it.each([
    ["fast", 1, 5, 24],
    ["slow odd slot", 2, 5, 47],
    ["slow even slot", 2, 4, 48],
  ] as const)(
    "runs a %s explosion on its object-slot cadence",
    (_label, moveIntervalTicks, slot, expectedFrames) => {
      let game = runningGame({
        enemies: [
          enemyFixture({
            explosionTicks: BATTLE_CITY_ENEMY_EXPLOSION_TICKS,
            hitPoints: 0,
            moveIntervalTicks,
            slot,
          }),
        ],
        spawnedEnemyCount: 20,
      });
      let frames = 0;

      while (game.enemies.length > 0 && frames < 60) {
        game = advanceBattleCityGame(game, () => 0.99);
        frames += 1;
      }

      expect(frames).toBe(expectedFrames);
      expect(game.destroyedEnemyCount).toBe(1);
    },
  );

  it("keeps the battlefield alive through a final tank explosion before game over", () => {
    const enemyShot = bulletFixture({
      col: 7.75,
      direction: "right",
      owner: "enemy",
      row: 20,
      slot: 5,
    });
    const hit = advanceBattleCityGame(
      runningGame({ bullets: [enemyShot], lives: 1 }),
      () => 0.99,
    );
    const ended = advanceBattleCityGame(
      { ...hit, player: { ...hit.player, phaseTicks: 1 } },
      () => 0.99,
    );

    expect(hit).toMatchObject({ lives: 1, status: "running" });
    expect(hit.player.phase).toBe("exploding");
    expect(ended).toMatchObject({
      lives: 0,
      stageOutcome: "lost",
      stageTransitionTicks: BATTLE_CITY_GAME_OVER_TRANSITION_TICKS,
      status: "game-over",
    });
  });

  it("absorbs protected hits without disturbing other shells", () => {
    const hit = bulletFixture({
      col: 7.75,
      direction: "right",
      id: "hit",
      owner: "enemy",
      row: 20,
      slot: 5,
    });
    const other = bulletFixture({
      col: 2,
      direction: "down",
      id: "other",
      owner: "enemy",
      row: 2,
      slot: 4,
    });
    const shielded = advanceBattleCityGame(
      runningGame({
        bullets: [hit, other],
        player: playerFixture({ shieldTicks: 2 }),
      }),
      () => 0.99,
    );

    expect(shielded.lives).toBe(3);
    expect(shielded.player.phase).toBe("active");
    expect(shielded.bullets).toEqual([
      expect.objectContaining({ id: "other", impactTicks: 0 }),
    ]);
  });

  it("resolves an incoming shell before a same-frame helmet pickup", () => {
    const enemyShot = bulletFixture({
      col: 7.75,
      direction: "right",
      owner: "enemy",
      row: 20,
      slot: 5,
    });
    const protectedPlayer = advanceBattleCityGame(
      powerUpGame("helmet", {
        bullets: [enemyShot],
        lives: 2,
      }),
      () => 0.99,
    );

    expect(protectedPlayer).toMatchObject({
      activePowerUp: { type: "helmet" },
      bullets: [
        expect.objectContaining({
          impactTicks: BATTLE_CITY_BULLET_IMPACT_TICKS,
        }),
      ],
      lives: 2,
      score: 0,
    });
    expect(protectedPlayer.player).toMatchObject({
      phase: "exploding",
      phaseTicks: BATTLE_CITY_PLAYER_EXPLOSION_TICKS,
      shieldTicks: 0,
    });
  });

  it("never deletes or scores an enemy occupying the player spawn", () => {
    const spawnBlocker = enemyFixture({
      col: 7,
      id: "spawn-blocker",
      row: 24,
    });
    const enemyShot = bulletFixture({
      col: 7.75,
      direction: "right",
      owner: "enemy",
      row: 20,
      slot: 5,
    });
    const hit = advanceBattleCityGame(
      runningGame({
        bullets: [enemyShot],
        destroyedEnemyCount: 5,
        enemies: [spawnBlocker],
        lives: 2,
        player: playerFixture({ powerTier: 3 }),
        score: 1_000,
        spawnedEnemyCount: 20,
      }),
      () => 0.99,
    );

    const respawned = advanceBattleCityGame(
      { ...hit, player: { ...hit.player, phaseTicks: 1 } },
      () => 0.99,
    );

    expect(respawned).toMatchObject({
      destroyedEnemyCount: 5,
      lives: 1,
      score: 1_000,
      status: "running",
    });
    expect(respawned.enemies).toEqual([
      expect.objectContaining({ id: "spawn-blocker" }),
    ]);
    expect(respawned.player).toMatchObject({
      col: 8,
      phase: "spawning",
      powerTier: 0,
      row: 24,
    });
    const active = {
      ...respawned,
      player: { ...respawned.player, phase: "active" as const, phaseTicks: 0 },
    };
    expect(moveBattleCityPlayer(active, "right").player.col).toBe(8.125);
  });
});
