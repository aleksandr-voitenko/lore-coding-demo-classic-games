import { describe, expect, it } from "vitest";

import {
  advanceBattleCityGame,
  advanceBattleCityMultiplayerGame,
  BATTLE_CITY_BOARD_SIZE,
  BATTLE_CITY_BULLET_IMPACT_TICKS,
  BATTLE_CITY_ENEMY_EXPLOSION_TICKS,
  BATTLE_CITY_ENEMY_SPAWN_INTERVAL_TICKS,
  BATTLE_CITY_FRIENDLY_FIRE_STUN_TICKS,
  BATTLE_CITY_FREEZE_TICKS,
  BATTLE_CITY_GAME_OVER_TRANSITION_TICKS,
  BATTLE_CITY_MAX_ACTIVE_ENEMIES,
  BATTLE_CITY_MULTIPLAYER_MAX_ACTIVE_ENEMIES,
  BATTLE_CITY_MULTIPLAYER_SPAWN_ADVANCE_TICKS,
  BATTLE_CITY_PIXEL_STEP,
  BATTLE_CITY_PLAYER_GAME_OVER_MESSAGE_TICKS,
  BATTLE_CITY_PLAYER_SPAWN_TICKS,
  BATTLE_CITY_STARTING_LIVES,
  BATTLE_CITY_TICK_MS,
  createInitialBattleCityGame,
  createInitialBattleCityMultiplayerGame,
  fireBattleCityMultiplayerPlayer,
  getBattleCityMultiplayerStageResultDisplay,
  moveBattleCityMultiplayerPlayer,
  type BattleCityBullet,
  type BattleCityEnemy,
  type BattleCityFrameInput,
  type BattleCityGameState,
  type BattleCityMultiplayerFrameInput,
  type BattleCityMultiplayerGameState,
  type BattleCityPlayer,
  type BattleCityTerrain,
} from "./battle-city-game-engine";
import {
  BATTLE_CITY_MULTIPLAYER_PROJECTION_MAX_MS,
  cloneBattleCityMultiplayerGame,
  getBattleCityMultiplayerProjectionTicks,
  projectBattleCityMultiplayerGame,
} from "./battle-city-multiplayer";
import { createBattleCityTerrainFragmentGrid } from "./battle-city/terrain-fragments";

const EMPTY_FRAME_INPUT: BattleCityFrameInput = {
  direction: null,
  fireRequested: false,
};

const EMPTY_MULTIPLAYER_INPUT: BattleCityMultiplayerFrameInput = {
  player1: EMPTY_FRAME_INPUT,
  player2: EMPTY_FRAME_INPUT,
};

function emptyTerrain(): BattleCityTerrain[][] {
  return Array.from({ length: BATTLE_CITY_BOARD_SIZE }, () =>
    Array<BattleCityTerrain>(BATTLE_CITY_BOARD_SIZE).fill("empty"),
  );
}

function playerFixture(
  overrides: Partial<BattleCityPlayer> = {},
): BattleCityPlayer {
  return {
    col: 8,
    direction: "up",
    iceSlideDirection: null,
    iceSlideStepsRemaining: 0,
    invulnerabilityTicks: 0,
    movementStunTicks: 0,
    phase: "active",
    phaseTicks: 0,
    powerTier: 0,
    row: 20,
    shieldTicks: 0,
    ...overrides,
  };
}

function enemyFixture(
  overrides: Partial<BattleCityEnemy> = {},
): BattleCityEnemy {
  return {
    col: 10,
    destructionPoints: null,
    direction: "down",
    explosionTicks: 0,
    hasDroppedPowerUp: false,
    hitPoints: 1,
    id: "enemy-test",
    isCarrier: false,
    maxHitPoints: 1,
    moveIntervalTicks: 2,
    movementPauseSteps: 0,
    movementTurnPending: false,
    row: 10,
    score: 100,
    slot: 7,
    spawnOrder: 1,
    spawnTicks: 0,
    type: "basic",
    ...overrides,
  };
}

function bulletFixture(
  overrides: Partial<BattleCityBullet> = {},
): BattleCityBullet {
  const owner = overrides.owner ?? "player";
  return {
    canDestroySteel: false,
    col: 10,
    direction: "up",
    id: "bullet-test",
    impactTicks: 0,
    isNewborn: true,
    owner,
    row: 10,
    slot: owner === "enemy" ? 7 : owner === "player2" ? 1 : 0,
    speed: BATTLE_CITY_PIXEL_STEP * 2,
    strength: 1,
    ...overrides,
  };
}

function runningMultiplayerGame(
  overrides: Partial<BattleCityMultiplayerGameState> = {},
): BattleCityMultiplayerGameState {
  const terrain = overrides.terrain ?? emptyTerrain();
  return {
    ...createInitialBattleCityMultiplayerGame(),
    enemySpawnCooldownTicks: 1_000,
    player: playerFixture({ col: 8 }),
    player2: playerFixture({ col: 16 }),
    stageBattleTicks: 0,
    stageOutcome: null,
    stageResultTicks: 0,
    stageTransitionTicks: 0,
    status: "running",
    terrain,
    terrainFragments:
      overrides.terrainFragments ?? createBattleCityTerrainFragmentGrid(terrain),
    ...overrides,
  };
}

function runningSoloGame(
  overrides: Partial<BattleCityGameState> = {},
): BattleCityGameState {
  const terrain = overrides.terrain ?? emptyTerrain();
  return {
    ...createInitialBattleCityGame(),
    enemySpawnCooldownTicks: 1_000,
    player: playerFixture(),
    stageBattleTicks: 0,
    stageOutcome: null,
    stageResultTicks: 0,
    stageTransitionTicks: 0,
    status: "running",
    terrain,
    terrainFragments:
      overrides.terrainFragments ?? createBattleCityTerrainFragmentGrid(terrain),
    ...overrides,
  };
}

function advanceMultiplayer(
  game: BattleCityMultiplayerGameState,
  input: BattleCityMultiplayerFrameInput = EMPTY_MULTIPLAYER_INPUT,
): BattleCityMultiplayerGameState {
  return advanceBattleCityMultiplayerGame(
    game,
    BATTLE_CITY_TICK_MS,
    () => 0.99,
    input,
  );
}

describe("Tank Patrol multiplayer state and player rules", () => {
  it("starts both players at the original Stage 1 positions with independent lives", () => {
    const game = createInitialBattleCityMultiplayerGame();

    expect(game).toMatchObject({
      lives: BATTLE_CITY_STARTING_LIVES,
      player2Lives: BATTLE_CITY_STARTING_LIVES,
      player2Score: 0,
      score: 0,
      status: "ready",
    });
    expect(game.player).toMatchObject({
      col: 8,
      phase: "spawning",
      phaseTicks: BATTLE_CITY_PLAYER_SPAWN_TICKS,
      row: 24,
    });
    expect(game.player2).toMatchObject({
      col: 16,
      phase: "spawning",
      phaseTicks: BATTLE_CITY_PLAYER_SPAWN_TICKS,
      row: 24,
    });
    expect(game.player).not.toBe(game.player2);
    expect(game.stageKillCounts).not.toBe(game.player2StageKillCounts);
  });

  it("moves players independently while treating the other tank as a solid body", () => {
    const game = runningMultiplayerGame({
      player: playerFixture({ col: 8, row: 10 }),
      player2: playerFixture({ col: 10, row: 10 }),
    });

    const blocked = moveBattleCityMultiplayerPlayer(game, "player1", "right");
    const moved = moveBattleCityMultiplayerPlayer(game, "player2", "right");

    expect(blocked.player).toMatchObject({ col: 8, direction: "right", row: 10 });
    expect(blocked.player2).toBe(game.player2);
    expect(moved.player).toBe(game.player);
    expect(moved.player2.col).toBe(10 + BATTLE_CITY_PIXEL_STEP);
  });

  it("reserves independent primary and upgraded secondary shell slots", () => {
    let game = runningMultiplayerGame({
      player: playerFixture({ powerTier: 2 }),
      player2: playerFixture({ powerTier: 2 }),
    });

    game = fireBattleCityMultiplayerPlayer(game, "player1");
    game = fireBattleCityMultiplayerPlayer(game, "player2");
    game = fireBattleCityMultiplayerPlayer(game, "player1");
    game = fireBattleCityMultiplayerPlayer(game, "player2");

    expect(
      game.bullets.map(({ owner, slot }) => ({ owner, slot })),
    ).toEqual([
      { owner: "player2", slot: 9 },
      { owner: "player", slot: 8 },
      { owner: "player2", slot: 1 },
      { owner: "player", slot: 0 },
    ]);
  });

  it("stuns a vulnerable teammate without extending an existing stun", () => {
    const target = playerFixture({ col: 12, row: 10 });
    const hit = advanceMultiplayer(
      runningMultiplayerGame({
        bullets: [bulletFixture({ col: target.col, row: target.row })],
        player2: target,
      }),
    );

    expect(hit.player2.movementStunTicks).toBe(
      BATTLE_CITY_FRIENDLY_FIRE_STUN_TICKS,
    );
    expect(hit.bullets[0]).toMatchObject({
      impactTicks: BATTLE_CITY_BULLET_IMPACT_TICKS,
      owner: "player",
    });

    const repeated = advanceMultiplayer(
      runningMultiplayerGame({
        bullets: [
          bulletFixture({ col: target.col, id: "repeat-hit", row: target.row }),
        ],
        player2: { ...target, movementStunTicks: 50 },
        tick: 2,
      }),
    );

    expect(repeated.player2.movementStunTicks).toBe(50);
  });

  it("damages an overlapping enemy before resolving friendly fire", () => {
    const resolved = advanceMultiplayer(
      runningMultiplayerGame({
        bullets: [bulletFixture({ col: 12, row: 11 })],
        enemies: [enemyFixture({ col: 10, row: 10 })],
        freezeTicks: 2,
        player2: playerFixture({ col: 12, row: 10 }),
        spawnedEnemyCount: 20,
      }),
    );

    expect(resolved.enemies[0]).toMatchObject({
      explosionTicks: BATTLE_CITY_ENEMY_EXPLOSION_TICKS,
      hitPoints: 0,
    });
    expect(resolved.player2.movementStunTicks).toBe(0);
    expect(resolved.bullets[0]?.impactTicks).toBe(
      BATTLE_CITY_BULLET_IMPACT_TICKS,
    );
  });

  it("consumes shielded friendly fire without stunning and still lets a stunned player fire", () => {
    const target = playerFixture({ col: 12, row: 10, shieldTicks: 10 });
    const shielded = advanceMultiplayer(
      runningMultiplayerGame({
        bullets: [bulletFixture({ col: target.col, row: target.row })],
        player2: target,
      }),
    );

    expect(shielded.player2).toMatchObject({
      movementStunTicks: 0,
      shieldTicks: 9,
    });
    expect(shielded.bullets).toEqual([]);

    const stunned = runningMultiplayerGame({
      player2: playerFixture({ col: 16, movementStunTicks: 5 }),
    });
    const attemptedMove = moveBattleCityMultiplayerPlayer(
      stunned,
      "player2",
      "left",
    );
    const fired = advanceMultiplayer(stunned, {
      player1: EMPTY_FRAME_INPUT,
      player2: { direction: "left", fireRequested: true },
    });

    expect(attemptedMove).toBe(stunned);
    expect(fired.player2.col).toBe(stunned.player2.col);
    expect(fired.bullets).toContainEqual(
      expect.objectContaining({ owner: "player2", slot: 1 }),
    );
  });

  it("stops a new friendly stun after the first shell in hardware slot order", () => {
    const target = playerFixture({ col: 12, row: 10 });
    const resolved = advanceMultiplayer(
      runningMultiplayerGame({
        bullets: [
          bulletFixture({
            col: target.col,
            id: "secondary-shell",
            row: target.row,
            slot: 8,
          }),
          bulletFixture({
            col: target.col,
            id: "primary-shell",
            row: target.row,
            slot: 0,
          }),
        ],
        player2: target,
      }),
    );

    expect(resolved.player2.movementStunTicks).toBe(
      BATTLE_CITY_FRIENDLY_FIRE_STUN_TICKS,
    );
    expect(resolved.bullets).toEqual([
      expect.objectContaining({
        id: "secondary-shell",
        impactTicks: BATTLE_CITY_BULLET_IMPACT_TICKS,
      }),
      expect.objectContaining({ id: "primary-shell", impactTicks: 0 }),
    ]);
  });

  it("pauses an ice coast during friendly stun and resumes it afterward", () => {
    const terrain = emptyTerrain();
    for (const row of [10, 11]) {
      for (const col of [12, 13, 14]) {
        terrain[row]![col] = "ice";
      }
    }
    const target = playerFixture({
      col: 12,
      iceSlideDirection: "right",
      iceSlideStepsRemaining: 2,
      row: 10,
    });
    let game = advanceMultiplayer(
      runningMultiplayerGame({
        bullets: [bulletFixture({ col: target.col, row: target.row })],
        player2: target,
        terrain,
      }),
    );

    expect(game.player2).toMatchObject({
      iceSlideDirection: "right",
      iceSlideStepsRemaining: 1,
      movementStunTicks: BATTLE_CITY_FRIENDLY_FIRE_STUN_TICKS,
    });
    let stunnedFrames = 0;
    while ((game.player2.movementStunTicks ?? 0) > 0 && stunnedFrames < 400) {
      game = advanceMultiplayer(game);
      stunnedFrames += 1;
    }

    expect(game.player2.movementStunTicks).toBe(0);
    const coastOrigin = game.player2.col;
    const resumed = advanceMultiplayer(game);
    expect(resumed.player2.col).toBeGreaterThan(coastOrigin);
  });
});

describe("Tank Patrol multiplayer shared battlefield rules", () => {
  it("uses six enemy slots and the original 20-frame faster multiplayer spawn cadence", () => {
    let game = runningMultiplayerGame({ enemySpawnCooldownTicks: 0 });
    game = advanceMultiplayer(game);

    expect(game.enemySpawnCooldownTicks).toBe(
      BATTLE_CITY_ENEMY_SPAWN_INTERVAL_TICKS -
        BATTLE_CITY_MULTIPLAYER_SPAWN_ADVANCE_TICKS,
    );

    for (
      let index = 1;
      index < BATTLE_CITY_MULTIPLAYER_MAX_ACTIVE_ENEMIES;
      index += 1
    ) {
      game = advanceMultiplayer({ ...game, enemySpawnCooldownTicks: 0 });
    }

    expect(game.enemies.map(({ slot }) => slot)).toEqual([7, 6, 5, 4, 3, 2]);

    const full = advanceMultiplayer({ ...game, enemySpawnCooldownTicks: 0 });
    expect(full.enemies).toHaveLength(BATTLE_CITY_MULTIPLAYER_MAX_ACTIVE_ENEMIES);
    expect(full.spawnedEnemyCount).toBe(6);
  });

  it("lets opposing player shells cancel without cancelling one player's paired shells", () => {
    const opposing = advanceMultiplayer(
      runningMultiplayerGame({
        bullets: [
          bulletFixture({ id: "player-one", owner: "player", slot: 0 }),
          bulletFixture({ id: "player-two", owner: "player2", slot: 1 }),
        ],
      }),
    );
    const paired = advanceMultiplayer(
      runningMultiplayerGame({
        bullets: [
          bulletFixture({ id: "primary", owner: "player", slot: 0 }),
          bulletFixture({ id: "secondary", owner: "player", slot: 8 }),
        ],
      }),
    );

    expect(opposing.bullets).toEqual([]);
    expect(paired.bullets.map(({ id }) => id)).toEqual([
      "secondary",
      "primary",
    ]);
  });

  it("resolves enemy shells before friendly fire across the whole frame", () => {
    const target = playerFixture({ col: 10, row: 10 });
    const resolved = advanceMultiplayer(
      runningMultiplayerGame({
        bullets: [
          bulletFixture({
            col: 12,
            id: "friendly-secondary",
            owner: "player2",
            row: 11,
            slot: 9,
          }),
          bulletFixture({
            col: 10,
            id: "enemy-seven",
            owner: "enemy",
            row: 11,
            slot: 7,
          }),
        ],
        player: target,
      }),
    );

    expect(resolved.player.phase).toBe("exploding");
    expect(resolved.bullets).toEqual([
      expect.objectContaining({
        id: "friendly-secondary",
        impactTicks: 0,
      }),
      expect.objectContaining({
        id: "enemy-seven",
        impactTicks: BATTLE_CITY_BULLET_IMPACT_TICKS,
      }),
    ]);
  });

  it("keeps the solo engine on its original four enemy slots", () => {
    let game = runningSoloGame({ enemySpawnCooldownTicks: 0 });
    for (let index = 0; index < BATTLE_CITY_MAX_ACTIVE_ENEMIES + 1; index += 1) {
      game = advanceBattleCityGame(
        { ...game, enemySpawnCooldownTicks: 0 },
        () => 0.99,
      );
    }

    expect(game.enemies.map(({ slot }) => slot)).toEqual([5, 4, 3, 2]);
    expect(game.spawnedEnemyCount).toBe(BATTLE_CITY_MAX_ACTIVE_ENEMIES);
  });

  it("gives Player 2 simultaneous pickup priority and keeps player effects individual", () => {
    const player = playerFixture({ col: 10, row: 10 });
    const collected = advanceMultiplayer(
      runningMultiplayerGame({
        activePowerUp: {
          col: 10,
          id: "shared-star",
          row: 10,
          type: "star",
        },
        player,
        player2: { ...player },
      }),
    );

    expect(collected).toMatchObject({
      activePowerUp: null,
      player2Score: 500,
      score: 0,
    });
    expect(collected.player.powerTier).toBe(0);
    expect(collected.player2.powerTier).toBe(1);
  });

  it("credits a global pickup to its collector while applying the effect to the shared world", () => {
    const collected = advanceMultiplayer(
      runningMultiplayerGame({
        activePowerUp: {
          col: 10,
          id: "player-one-clock",
          row: 10,
          type: "clock",
        },
        player: playerFixture({ col: 10, row: 10 }),
        player2: playerFixture({ col: 18, row: 18 }),
      }),
    );

    expect(collected).toMatchObject({
      activePowerUp: null,
      freezeTicks: BATTLE_CITY_FREEZE_TICKS,
      player2Score: 0,
      score: 500,
    });
  });

  it("avoids both players when a Player 2 shell releases a carrier power-up", () => {
    const dropped = advanceBattleCityMultiplayerGame(
      runningMultiplayerGame({
        bullets: [bulletFixture({ owner: "player2" })],
        enemies: [enemyFixture({ isCarrier: true })],
        freezeTicks: 2,
        player: playerFixture({ col: 3, row: 3 }),
        player2: playerFixture({ col: 16, row: 20 }),
        spawnedEnemyCount: 20,
      }),
      BATTLE_CITY_TICK_MS,
      () => 0,
      EMPTY_MULTIPLAYER_INPUT,
    );

    expect(dropped.activePowerUp).toMatchObject({
      col: 9,
      row: 3,
    });
  });

  it("allows a carrier power-up at a stale position when neither player is active", () => {
    const dropped = advanceBattleCityMultiplayerGame(
      runningMultiplayerGame({
        bullets: [bulletFixture()],
        enemies: [enemyFixture({ isCarrier: true })],
        freezeTicks: 2,
        player: playerFixture({ col: 3, phase: "inactive", row: 3 }),
        player2: playerFixture({ col: 9, phase: "exploding", row: 9 }),
        spawnedEnemyCount: 20,
      }),
      BATTLE_CITY_TICK_MS,
      () => 0,
      EMPTY_MULTIPLAYER_INPUT,
    );

    expect(dropped.activePowerUp).toMatchObject({ col: 3, row: 3 });
  });

  it("keeps the battle running after one elimination and loses when both are out", () => {
    const oneEliminated = advanceMultiplayer(
      runningMultiplayerGame({
        lives: 1,
        player: playerFixture({ phase: "exploding", phaseTicks: 1 }),
        player2Lives: 2,
        stageBattleTicks: 95,
        tick: 5,
      }),
    );

    expect(oneEliminated).toMatchObject({
      frameCounterResetPending: true,
      lives: 0,
      player: { phase: "inactive", phaseTicks: 0 },
      playerGameOverMessage: {
        movementPixels: 1,
        playerId: "player1",
        ticksRemaining: BATTLE_CITY_PLAYER_GAME_OVER_MESSAGE_TICKS,
      },
      player2Lives: 2,
      stageOutcome: null,
      stageBattleTicks: 64,
      status: "running",
      tick: 0,
    });

    const rebased = advanceMultiplayer(oneEliminated);
    expect(rebased).toMatchObject({
      frameCounterResetPending: false,
      playerGameOverMessage: {
        movementPixels: 2,
        playerId: "player1",
        ticksRemaining: BATTLE_CITY_PLAYER_GAME_OVER_MESSAGE_TICKS - 1,
      },
      stageBattleTicks: 65,
      tick: 1,
    });

    const bothEliminated = advanceMultiplayer({
      ...oneEliminated,
      player2: playerFixture({ phase: "exploding", phaseTicks: 1 }),
      player2Lives: 1,
      tick: 0,
    });

    expect(bothEliminated).toMatchObject({
      lives: 0,
      playerGameOverMessage: null,
      player2Lives: 0,
      stageOutcome: "lost",
      status: "game-over",
    });
  });

  it("replaces an individual message when headquarters destruction ends the battle", () => {
    const headquartersLost = advanceMultiplayer(
      runningMultiplayerGame({
        baseAlive: false,
        baseExplosionTicks: 1,
        playerGameOverMessage: {
          movementPixels: 20,
          playerId: "player1",
          ticksRemaining: 80,
        },
      }),
    );

    expect(headquartersLost).toMatchObject({
      playerGameOverMessage: null,
      stageOutcome: "lost",
      status: "game-over",
    });
  });

  it("rephases shared and protected-player timers when one player is eliminated", () => {
    const terrain = emptyTerrain();
    terrain[24]![12] = "headquarters";
    terrain[24]![13] = "headquarters";
    terrain[25]![12] = "headquarters";
    terrain[25]![13] = "headquarters";
    terrain[23]![11] = "steel";
    const enemyShot = bulletFixture({
      col: 8,
      direction: "right",
      owner: "enemy",
      row: 20,
      slot: 5,
    });
    const reset = advanceMultiplayer(
      runningMultiplayerGame({
        bullets: [enemyShot],
        fortressTicks: 59,
        freezeTicks: 59,
        player: playerFixture({
          invulnerabilityTicks: 59,
          shieldTicks: 59,
        }),
        player2: playerFixture({ phase: "exploding", phaseTicks: 1 }),
        player2Lives: 1,
        terrain,
        tick: 5,
      }),
    );

    expect(reset).toMatchObject({
      fortressTicks: 0,
      freezeTicks: 64,
      player: {
        invulnerabilityTicks: 0,
        phase: "exploding",
        shieldTicks: 0,
      },
      player2: { phase: "inactive" },
      player2Lives: 0,
      status: "running",
    });
    expect(reset.terrain[23]?.[11]).toBe("brick");
  });

  it("awards a last-shell bonus life after both explosions before deciding game over", () => {
    const lastShellLife = advanceMultiplayer(
      runningMultiplayerGame({
        bullets: [bulletFixture()],
        enemies: [enemyFixture()],
        freezeTicks: 2,
        lives: 1,
        player: playerFixture({ phase: "exploding", phaseTicks: 1 }),
        player2: playerFixture({ phase: "exploding", phaseTicks: 1 }),
        player2Lives: 1,
        score: 19_900,
        spawnedEnemyCount: 20,
        tick: 0,
      }),
    );
    const withoutLastShell = advanceMultiplayer(
      runningMultiplayerGame({
        lives: 1,
        player: playerFixture({ phase: "exploding", phaseTicks: 1 }),
        player2: playerFixture({ phase: "exploding", phaseTicks: 1 }),
        player2Lives: 1,
        tick: 0,
      }),
    );

    expect(lastShellLife).toMatchObject({
      bonusLifeAwarded: true,
      lives: 1,
      player: { phase: "inactive" },
      player2: { phase: "inactive" },
      player2Lives: 0,
      score: 20_000,
      status: "running",
    });
    expect(withoutLastShell).toMatchObject({
      lives: 0,
      player2Lives: 0,
      stageOutcome: "lost",
      status: "game-over",
    });

    const nextStage = advanceMultiplayer({
      ...lastShellLife,
      bullets: [],
      enemies: [],
      stageKillLeaderBonusAwarded: true,
      stageOutcome: "cleared",
      stageResultTicks: 1_000,
      stageTransitionTicks: 1,
      status: "stage-results",
    });
    expect(nextStage).toMatchObject({
      lives: 1,
      player: { phase: "spawning" },
      player2: { phase: "inactive" },
      player2Lives: 0,
      stage: 2,
    });
  });

  it("targets the on-field teammate instead of an inactive player with a late life", () => {
    const randomValues = [0, 0.99];
    const targeted = advanceBattleCityMultiplayerGame(
      runningMultiplayerGame({
        enemies: [
          enemyFixture({
            direction: "down",
            movementTurnPending: true,
            slot: 2,
          }),
        ],
        lives: 1,
        player: playerFixture({ col: 0, phase: "inactive", row: 0 }),
        player2: playerFixture({ col: 16, row: 20 }),
        spawnedEnemyCount: 20,
        stageBattleTicks: 1_344,
        tick: 1,
      }),
      BATTLE_CITY_TICK_MS,
      () => randomValues.shift() ?? 0.99,
      EMPTY_MULTIPLAYER_INPUT,
    );

    expect(targeted.enemies[0]?.direction).toBe("right");
  });

  it("pressures headquarters during the first half of a long clear tail", () => {
    const endingEnemy = enemyFixture({
      col: 12,
      direction: "left",
      movementTurnPending: true,
      row: 10,
      slot: 2,
    });
    const firstHalf = advanceBattleCityMultiplayerGame(
      runningMultiplayerGame({
        enemies: [endingEnemy],
        stageOutcome: "cleared",
        stageTransitionTicks: 200,
        status: "stage-clear",
        tick: 0,
      }),
      BATTLE_CITY_TICK_MS,
      () => 0,
      EMPTY_MULTIPLAYER_INPUT,
    );
    const secondHalf = advanceBattleCityMultiplayerGame(
      runningMultiplayerGame({
        enemies: [endingEnemy],
        stageOutcome: "cleared",
        stageTransitionTicks: 100,
        status: "stage-clear",
        tick: 0,
      }),
      BATTLE_CITY_TICK_MS,
      () => 0,
      EMPTY_MULTIPLAYER_INPUT,
    );

    expect(firstHalf.enemies[0]?.direction).toBe("down");
    expect(secondHalf.enemies[0]?.direction).toBe("up");
  });

  it("uses the longer clear tail when an individual game-over message is active", () => {
    const completed = advanceMultiplayer(
      runningMultiplayerGame({
        destroyedEnemyCount: 20,
        enemies: [],
        playerGameOverMessage: {
          movementPixels: 48,
          playerId: "player1",
          ticksRemaining: 1,
        },
        spawnedEnemyCount: 20,
      }),
    );

    expect(completed).toMatchObject({
      stageTransitionTicks: BATTLE_CITY_GAME_OVER_TRANSITION_TICKS,
      status: "stage-clear",
    });
  });

  it("rephases an individual message without losing its slide position on clear", () => {
    const completed = advanceMultiplayer(
      runningMultiplayerGame({
        destroyedEnemyCount: 20,
        enemies: [],
        playerGameOverMessage: {
          movementPixels: 36,
          playerId: "player1",
          ticksRemaining: 157,
        },
        spawnedEnemyCount: 20,
      }),
    );

    expect(completed).toMatchObject({
      playerGameOverMessage: {
        movementPixels: 37,
        ticksRemaining: 160,
      },
      stageTransitionTicks: BATTLE_CITY_GAME_OVER_TRANSITION_TICKS,
      status: "stage-clear",
    });

    let sliding = completed;
    for (let frame = 0; frame < 15; frame += 1) {
      sliding = advanceMultiplayer(sliding);
    }
    expect(sliding.playerGameOverMessage).toMatchObject({
      movementPixels: 52,
      ticksRemaining: 145,
    });

    sliding = advanceMultiplayer(sliding);
    expect(sliding.playerGameOverMessage).toMatchObject({
      movementPixels: 52,
      ticksRemaining: 144,
    });

    for (let frame = 16; frame < 159; frame += 1) {
      sliding = advanceMultiplayer(sliding);
    }
    expect(sliding.playerGameOverMessage?.ticksRemaining).toBe(1);
    expect(advanceMultiplayer(sliding).playerGameOverMessage).toBeNull();
  });

  it("gives active hardware timers a fresh phase when the ending tail begins", () => {
    const completed = advanceMultiplayer(
      runningMultiplayerGame({
        destroyedEnemyCount: 20,
        enemies: [],
        fortressTicks: 28,
        freezeTicks: 28,
        player: playerFixture({ shieldTicks: 28 }),
        player2: playerFixture({ invulnerabilityTicks: 28, shieldTicks: 28 }),
        spawnedEnemyCount: 20,
        tick: 37,
      }),
    );

    expect(completed).toMatchObject({
      fortressTicks: 64,
      freezeTicks: 64,
      player: { shieldTicks: 64 },
      player2: { invulnerabilityTicks: 64, shieldTicks: 64 },
      status: "stage-clear",
    });

    let tail = completed;
    for (let frame = 0; frame < 29; frame += 1) {
      tail = advanceMultiplayer(tail);
    }
    const protectedHit = advanceMultiplayer({
      ...tail,
      bullets: [
        bulletFixture({
          col: tail.player.col,
          direction: "right",
          owner: "enemy",
          row: tail.player.row,
          slot: 5,
        }),
      ],
    });

    expect(protectedHit.player).toMatchObject({
      phase: "active",
      shieldTicks: 34,
    });
    expect(protectedHit.bullets).toEqual([]);
  });

  it("recovers a cleared tail when a lingering shell restores a life", () => {
    const recovered = advanceMultiplayer(
      runningMultiplayerGame({
        bullets: [bulletFixture()],
        enemies: [enemyFixture()],
        freezeTicks: 2,
        lives: 0,
        player: playerFixture({ phase: "inactive" }),
        player2: playerFixture({ phase: "inactive" }),
        player2Lives: 0,
        score: 19_900,
        spawnedEnemyCount: 20,
        stageOutcome: "lost",
        stageTransitionTicks: 20,
        status: "stage-clear",
      }),
    );

    expect(recovered).toMatchObject({
      bonusLifeAwarded: true,
      lives: 1,
      player: { phase: "inactive" },
      score: 20_000,
      stageOutcome: "cleared",
      status: "stage-clear",
    });
  });

  it("keeps an eliminated player inactive when the teammate reaches the next stage", () => {
    const nextStage = advanceMultiplayer(
      runningMultiplayerGame({
        lives: 0,
        player: playerFixture({ phase: "inactive", phaseTicks: 0 }),
        player2Lives: 2,
        stageKillLeaderBonusAwarded: true,
        stageOutcome: "cleared",
        stageResultTicks: 1_000,
        stageTransitionTicks: 1,
        status: "stage-results",
      }),
    );

    expect(nextStage).toMatchObject({
      lives: 0,
      player: { phase: "inactive", phaseTicks: 0 },
      player2: { phase: "spawning" },
      player2Lives: 2,
      stage: 2,
      status: "stage-intro",
    });
  });

  it("attributes enemy points and kill counts to the firing player", () => {
    const player1Kill = advanceMultiplayer(
      runningMultiplayerGame({
        bullets: [bulletFixture()],
        enemies: [enemyFixture()],
        freezeTicks: 2,
        spawnedEnemyCount: 20,
      }),
    );
    const player2Kill = advanceMultiplayer(
      runningMultiplayerGame({
        bullets: [bulletFixture({ owner: "player2" })],
        enemies: [
          enemyFixture({
            id: "fast-enemy",
            moveIntervalTicks: 1,
            score: 200,
            type: "fast",
          }),
        ],
        freezeTicks: 2,
        spawnedEnemyCount: 20,
      }),
    );

    expect(player1Kill).toMatchObject({
      player2Score: 0,
      score: 100,
      stageKillCounts: { armor: 0, basic: 1, fast: 0, power: 0 },
    });
    expect(player1Kill.enemies[0]).toMatchObject({
      explosionTicks: BATTLE_CITY_ENEMY_EXPLOSION_TICKS,
      hitPoints: 0,
    });
    expect(player2Kill).toMatchObject({
      player2Score: 200,
      player2StageKillCounts: { armor: 0, basic: 0, fast: 1, power: 0 },
      score: 0,
    });
  });

  it("awards the 1,000-point clear bonus only to a surviving strict kill leader", () => {
    const winner = advanceMultiplayer(
      runningMultiplayerGame({
        player2StageKillCounts: { armor: 0, basic: 1, fast: 0, power: 0 },
        stageKillCounts: { armor: 0, basic: 2, fast: 0, power: 0 },
        stageOutcome: "cleared",
        stageResultTicks: 1_000,
        stageTransitionTicks: 2,
        status: "stage-results",
      }),
    );
    const eliminatedLeader = advanceMultiplayer(
      runningMultiplayerGame({
        lives: 0,
        player2StageKillCounts: { armor: 0, basic: 1, fast: 0, power: 0 },
        stageKillCounts: { armor: 0, basic: 2, fast: 0, power: 0 },
        stageOutcome: "cleared",
        stageResultTicks: 1_000,
        stageTransitionTicks: 2,
        status: "stage-results",
      }),
    );

    expect(winner).toMatchObject({
      score: 1_000,
      stageKillLeaderBonusAwarded: true,
    });
    expect(eliminatedLeader).toMatchObject({
      score: 0,
      stageKillLeaderBonusAwarded: true,
    });
  });

  it("waits 15 result frames after totals appear before awarding the kill leader", () => {
    const result = runningMultiplayerGame({
      player2StageKillCounts: { armor: 0, basic: 1, fast: 0, power: 0 },
      stageKillCounts: { armor: 0, basic: 2, fast: 0, power: 0 },
      stageOutcome: "cleared",
      stageResultTicks: 0,
      stageTransitionTicks: 500,
      status: "stage-results",
    });
    let totalRevealTick = 0;
    while (
      !getBattleCityMultiplayerStageResultDisplay({
        ...result,
        stageResultTicks: totalRevealTick,
      }).showTotal
    ) {
      totalRevealTick += 1;
    }
    let waiting = { ...result, stageResultTicks: totalRevealTick };

    for (let frame = 0; frame < 14; frame += 1) {
      waiting = advanceMultiplayer(waiting);
      expect(waiting.score).toBe(0);
      expect(waiting.stageKillLeaderBonusAwarded).toBe(false);
    }

    const awarded = advanceMultiplayer(waiting);
    expect(totalRevealTick).toBe(185);
    expect(awarded).toMatchObject({
      score: 1_000,
      stageKillLeaderBonusAwarded: true,
      stageResultTicks: totalRevealTick + 15,
    });
  });
});

describe("Tank Patrol multiplayer rendering helpers", () => {
  it("deep-clones mutable gameplay state without sharing nested objects", () => {
    const terrain = emptyTerrain();
    terrain[0]![0] = "brick";
    const game = runningMultiplayerGame({
      activePowerUp: { col: 3, id: "clone-star", row: 4, type: "star" },
      bullets: [bulletFixture()],
      enemies: [enemyFixture()],
      player2StageKillCounts: { armor: 0, basic: 1, fast: 0, power: 0 },
      playerGameOverMessage: {
        movementPixels: 10,
        playerId: "player2",
        ticksRemaining: 17,
      },
      powerUpScorePopup: { col: 3, row: 4, ticks: 20 },
      terrain,
      terrainFragments: createBattleCityTerrainFragmentGrid(terrain),
    });
    const cloned = cloneBattleCityMultiplayerGame(game);

    cloned.player.row = 1;
    cloned.player2.col = 1;
    cloned.playerGameOverMessage!.movementPixels = 1;
    cloned.playerGameOverMessage!.ticksRemaining = 1;
    cloned.bullets[0]!.col = 1;
    cloned.enemies[0]!.row = 1;
    cloned.activePowerUp!.row = 1;
    cloned.powerUpScorePopup!.ticks = 1;
    cloned.stageKillCounts.basic = 8;
    cloned.player2StageKillCounts.basic = 8;
    cloned.terrain[0]![0] = "steel";
    cloned.terrainFragments[0]![0] = 0;

    expect(game.player.row).toBe(20);
    expect(game.player2.col).toBe(16);
    expect(game.playerGameOverMessage?.movementPixels).toBe(10);
    expect(game.playerGameOverMessage?.ticksRemaining).toBe(17);
    expect(game.bullets[0]?.col).toBe(10);
    expect(game.enemies[0]?.row).toBe(10);
    expect(game.activePowerUp?.row).toBe(4);
    expect(game.powerUpScorePopup?.ticks).toBe(20);
    expect(game.stageKillCounts.basic).toBe(0);
    expect(game.player2StageKillCounts.basic).toBe(1);
    expect(game.terrain[0]?.[0]).toBe("brick");
    expect(game.terrainFragments[0]?.[0]).not.toBe(0);
  });

  it("bounds visual projection and changes only projected player motion and clock", () => {
    const game = runningMultiplayerGame({
      activePowerUp: { col: 3, id: "projection-star", row: 4, type: "star" },
      bullets: [bulletFixture({ col: 2, row: 2 })],
      enemies: [enemyFixture({ col: 20, row: 2 })],
      player: playerFixture({ col: 5, row: 5 }),
      player2: playerFixture({ col: 15, row: 15 }),
      score: 700,
      tick: 0,
    });
    const elapsedMs = BATTLE_CITY_MULTIPLAYER_PROJECTION_MAX_MS * 10;
    const projected = projectBattleCityMultiplayerGame(
      game,
      {
        "player-1": { direction: "right", fireRequested: true },
        "player-2": { direction: null },
      },
      elapsedMs,
    );

    expect(getBattleCityMultiplayerProjectionTicks(elapsedMs)).toBe(7);
    expect(projected.tick).toBe(7);
    expect(projected.player.col).toBe(5 + BATTLE_CITY_PIXEL_STEP * 5);
    expect(projected.player2).toEqual(game.player2);
    expect(projected.bullets).toEqual(game.bullets);
    expect(projected.enemies).toEqual(game.enemies);
    expect(projected.activePowerUp).toEqual(game.activePowerUp);
    expect(projected.score).toBe(game.score);
    expect(game).toMatchObject({
      nextBulletId: 0,
      player: { col: 5 },
      tick: 0,
    });
  });

  it("uses the authoritative pre-handler clock phase while projecting a clear tail", () => {
    const game = runningMultiplayerGame({
      player: playerFixture({ col: 5, row: 5 }),
      stageOutcome: "cleared",
      stageTransitionTicks: 100,
      status: "stage-clear",
      tick: 1,
    });
    const input = {
      player1: { direction: "right", fireRequested: false },
      player2: EMPTY_FRAME_INPUT,
    } satisfies BattleCityMultiplayerFrameInput;
    const authoritative = advanceMultiplayer(game, input);
    const projected = projectBattleCityMultiplayerGame(
      game,
      { "player-1": { direction: "right" } },
      BATTLE_CITY_TICK_MS,
    );

    expect(projected.player.col).toBe(authoritative.player.col);
    expect(projected.tick).toBe(authoritative.tick);
    expect(projected.player.col).toBe(game.player.col);
  });
});
