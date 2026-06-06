import { describe, expect, it } from "vitest";

import {
  advanceSpaceInvadersGame,
  advanceSpaceInvadersTicks,
  centerPlayerUnderInvader,
  createCatchablePowerUp,
  createInitialSpaceInvadersGame,
  createInvaderShotFixture,
  createRunningGame,
  fireFromOnlyInvader,
  fireSpaceInvadersShot,
  getInvader,
  getSpaceInvadersTickDelay,
  moveSpaceInvadersPlayer,
  SPACE_INVADERS_BASE_Y,
  SPACE_INVADERS_PLAYER_BURST_SHOT_COUNT,
  SPACE_INVADERS_PLAYER_BURST_SHOT_DELAY_TICKS,
  SPACE_INVADERS_ROWS,
  withOnlyActiveInvader,
} from "./space-invaders-game-engine.test-helpers";

describe("space invaders projectile engine", () => {
  it("fires one player shot while running", () => {
    const runningGame = createRunningGame();
    const firedGame = fireSpaceInvadersShot(runningGame);
    const secondFireGame = fireSpaceInvadersShot(firedGame);
    const firedShot = firedGame.playerShots[0]!;

    expect(firedGame.playerShots).toHaveLength(1);
    expect(firedShot).toMatchObject({
      id: "player-shot-0",
      kind: "standard",
      velocityX: 0,
      velocityY: expect.any(Number),
    });
    expect(firedShot.x).toBe(
      firedGame.player.x + firedGame.player.width / 2 - firedShot.width / 2,
    );
    expect(firedShot.y).toBeLessThan(firedGame.player.y);
    expect(firedGame.nextPlayerShotId).toBe(1);
    expect(secondFireGame.playerShots).toBe(firedGame.playerShots);
  });


  it("uses a caught burst power-up on the next shot with a delayed five-shot cadence", () => {
    const game = createInitialSpaceInvadersGame();
    const caughtPowerUp = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShotCooldownTicks: 1_000,
        powerUps: [createCatchablePowerUp(game, { kind: "burst-shot" })],
      }),
    );
    const fired = fireSpaceInvadersShot(caughtPowerUp);
    const beforeSecondShot = advanceSpaceInvadersTicks(
      fired,
      SPACE_INVADERS_PLAYER_BURST_SHOT_DELAY_TICKS,
    );
    const secondShot = advanceSpaceInvadersGame(beforeSecondShot);

    expect(caughtPowerUp.pendingShotPowerUp).toBe("burst-shot");
    expect(caughtPowerUp.powerUps).toEqual([]);
    expect(fired.pendingShotPowerUp).toBeNull();
    expect(fired.playerShots).toHaveLength(1);
    expect(fired.playerShots[0]).toMatchObject({
      id: "player-shot-0",
      kind: "burst",
      velocityX: 0,
    });
    expect(fired.playerBurst).toEqual({
      cooldownTicks: SPACE_INVADERS_PLAYER_BURST_SHOT_DELAY_TICKS,
      remainingShots: SPACE_INVADERS_PLAYER_BURST_SHOT_COUNT - 1,
    });
    expect(beforeSecondShot.playerShots).toHaveLength(1);
    expect(secondShot.playerShots).toHaveLength(2);
    expect(secondShot.playerShots[1]).toMatchObject({
      id: "player-shot-1",
      kind: "burst",
      velocityX: 0,
    });
    expect(secondShot.playerBurst).toEqual({
      cooldownTicks: SPACE_INVADERS_PLAYER_BURST_SHOT_DELAY_TICKS,
      remainingShots: SPACE_INVADERS_PLAYER_BURST_SHOT_COUNT - 2,
    });
  });


  it("uses a shotgun power-up on the next shot as a five-bullet cone", () => {
    const fired = fireSpaceInvadersShot(
      createRunningGame({
        pendingShotPowerUp: "shotgun-shot",
      }),
    );

    expect(fired.pendingShotPowerUp).toBeNull();
    expect(fired.playerBurst).toBeNull();
    expect(fired.nextPlayerShotId).toBe(5);
    expect(fired.playerShots.map((shot) => shot.kind)).toEqual([
      "shotgun",
      "shotgun",
      "shotgun",
      "shotgun",
      "shotgun",
    ]);
    expect(fired.playerShots.map((shot) => shot.velocityX)).toEqual([
      -2.4,
      -1.2,
      0,
      1.2,
      2.4,
    ]);
  });


  it("uses a piercing laser power-up on the next shot", () => {
    const fired = fireSpaceInvadersShot(
      createRunningGame({
        pendingShotPowerUp: "piercing-laser",
      }),
    );

    expect(fired.pendingShotPowerUp).toBeNull();
    expect(fired.playerShots).toHaveLength(1);
    expect(fired.playerShots[0]).toMatchObject({
      id: "player-shot-0",
      kind: "piercing",
      velocityX: 0,
    });
  });


  it("does not move or fire while the player is waiting to respawn", () => {
    const respawningGame = createRunningGame({
      playerRespawnTicks: 3,
    });

    expect(moveSpaceInvadersPlayer(respawningGame, 40)).toBe(respawningGame);
    expect(fireSpaceInvadersShot(respawningGame)).toBe(respawningGame);
  });


  it("fires invader shots from the lowest active invader in the nearest column", () => {
    const game = createInitialSpaceInvadersGame();
    const shooter = getInvader(game, SPACE_INVADERS_ROWS - 1, 5);
    const coveredInvader = getInvader(game, 0, shooter.column);
    const runningGame = createRunningGame({
      invaderShotCooldownTicks: 0,
      player: centerPlayerUnderInvader(game, shooter),
    });
    const advanced = advanceSpaceInvadersGame(runningGame, () => 0);
    const shot = advanced.invaderShots[0]!;

    expect(advanced.invaderShots).toHaveLength(1);
    expect(shot).toMatchObject({
      id: "invader-shot-0",
      kind: "standard",
      sourceColumn: shooter.column,
      sourceInvaderId: shooter.id,
      sourceRow: shooter.row,
      velocityY: expect.any(Number),
    });
    expect(shot.sourceInvaderId).not.toBe(coveredInvader.id);
    expect(shot.x).toBeCloseTo(shooter.x + shooter.width / 2 - shot.width / 2);
    expect(shot.y).toBeCloseTo(shooter.y + shooter.height + 1);
    expect(advanced.nextInvaderShotId).toBe(1);
    expect(advanced.invaderShotCooldownTicks).toBeGreaterThan(0);
  });


  it("lets the next lowest invader in a column fire after the bottom invader is cleared", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const bottomInvader = getInvader(game, SPACE_INVADERS_ROWS - 1, 5);
    const nextShooter = {
      ...getInvader(game, SPACE_INVADERS_ROWS - 2, bottomInvader.column),
      kind: "standard" as const,
    };
    const runningGame = createRunningGame({
      invaderShotCooldownTicks: 0,
      invaders: game.invaders.map((invader) => {
        if (invader.id === bottomInvader.id) {
          return { ...invader, isActive: false };
        }

        if (invader.id === nextShooter.id) {
          return nextShooter;
        }

        return invader;
      }),
      player: centerPlayerUnderInvader(game, nextShooter),
    });
    const advanced = advanceSpaceInvadersGame(runningGame, () => 0);

    expect(advanced.invaderShots[0]).toMatchObject({
      kind: "needle",
      sourceColumn: nextShooter.column,
      sourceInvaderId: nextShooter.id,
      sourceRow: nextShooter.row,
    });
  });


  it("assigns each standard invader row its own shot variant and cooldown", () => {
    const commander = fireFromOnlyInvader(0).advanced;
    const burst = fireFromOnlyInvader(1).advanced;
    const scatter = fireFromOnlyInvader(2).advanced;
    const needle = fireFromOnlyInvader(3).advanced;
    const standard = fireFromOnlyInvader(4).advanced;

    expect(commander.invaderShots[0]).toMatchObject({
      height: 24,
      kind: "commander",
      sourceRow: 0,
      velocityX: 0,
      velocityY: 2.35,
      width: 8,
    });
    expect(burst.invaderShots[0]).toMatchObject({
      height: 18,
      kind: "burst",
      sourceRow: 1,
      velocityX: 0,
      velocityY: 3.45,
      width: 7,
    });
    expect(burst.invaderBurst).toMatchObject({
      remainingShots: 2,
    });
    expect(needle.invaderShots[0]).toMatchObject({
      height: 24,
      kind: "needle",
      sourceRow: 3,
      velocityX: 0,
      velocityY: 4.9,
      width: 3,
    });
    expect(scatter.invaderShots).toHaveLength(3);
    expect(scatter.invaderShots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "scatter",
          sourceRow: 2,
          ttlTicks: 96,
          velocityX: -1.25,
          velocityY: 2.8,
        }),
        expect.objectContaining({
          kind: "scatter",
          sourceRow: 2,
          ttlTicks: 96,
          velocityX: 0,
          velocityY: 2.8,
        }),
        expect.objectContaining({
          kind: "scatter",
          sourceRow: 2,
          ttlTicks: 96,
          velocityX: 1.25,
          velocityY: 2.8,
        }),
      ]),
    );
    expect(standard.invaderShots[0]).toMatchObject({
      height: 20,
      kind: "standard",
      sourceRow: 4,
      velocityX: 0,
      velocityY: 3.2,
      width: 5,
    });
    expect(commander.invaderShotCooldownTicks).toBeGreaterThan(
      standard.invaderShotCooldownTicks,
    );
    expect(needle.invaderShotCooldownTicks).toBeLessThan(
      standard.invaderShotCooldownTicks,
    );
    expect(scatter.nextInvaderShotId).toBe(3);
  });


  it("fires bottom-row standard shots from non-revenge special invader kinds", () => {
    const specialKinds = [
      "diver",
      "shield-bearer",
      "splitter",
      "splitter-fragment",
      "armored",
    ] as const;
    const bottomRowCooldown = fireFromOnlyInvader(SPACE_INVADERS_ROWS - 1).advanced
      .invaderShotCooldownTicks;

    for (const kind of specialKinds) {
      const game = createInitialSpaceInvadersGame({ random: () => 0 });
      const shooter = {
        ...getInvader(game, 1, 5),
        kind,
      };
      const runningGame = withOnlyActiveInvader(
        createRunningGame({
          invaderShotCooldownTicks: 0,
          player: centerPlayerUnderInvader(game, shooter),
        }),
        shooter,
      );
      const advanced = advanceSpaceInvadersGame(runningGame, () => 0);

      expect(advanced.invaderShots).toHaveLength(1);
      expect(advanced.invaderShots[0]).toMatchObject({
        height: 20,
        kind: "standard",
        sourceInvaderId: shooter.id,
        sourceRow: shooter.row,
        velocityX: 0,
        velocityY: 3.2,
        width: 5,
      });
      expect(advanced.invaderBurst).toBeNull();
      expect(advanced.nextInvaderShotId).toBe(1);
      expect(advanced.invaderShotCooldownTicks).toBe(bottomRowCooldown);
    }
  });


  it("fires revenge counterfire toward the player's current horizontal position after a windup", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const shooter = {
      ...getInvader(game, 1, 5),
      kind: "revenge" as const,
    };
    const player = {
      ...game.player,
      x: shooter.x + shooter.width / 2 + 90 - game.player.width / 2,
    };
    const fired = advanceSpaceInvadersGame(
      withOnlyActiveInvader(
        createRunningGame({
          invaderShotCooldownTicks: 0,
          player,
        }),
        shooter,
      ),
      () => 0,
    );
    const shot = fired.invaderShots[0]!;
    const firstWindupTick = advanceSpaceInvadersGame(fired, () => 0);
    const secondWindupTick = advanceSpaceInvadersGame(firstWindupTick, () => 0);
    const armedTick = advanceSpaceInvadersGame(secondWindupTick, () => 0);

    expect(fired.invaderShots).toHaveLength(1);
    expect(shot).toMatchObject({
      ageTicks: 0,
      height: 7,
      kind: "counterfire",
      sourceInvaderId: shooter.id,
      sourceRow: shooter.row,
      ttlTicks: null,
      velocityY: 5.3,
      width: 16,
    });
    expect(shot.velocityX).toBeGreaterThan(0);
    expect(shot.x).toBeCloseTo(shooter.x + shooter.width / 2 - shot.width / 2);
    expect(shot.y).toBeCloseTo(shooter.y + shooter.height + 1);
    expect(fired.invaderBurst).toBeNull();
    expect(fired.invaderShotCooldownTicks).toBeLessThan(
      fireFromOnlyInvader(SPACE_INVADERS_ROWS - 1).advanced.invaderShotCooldownTicks,
    );
    expect(firstWindupTick.invaderShots[0]).toMatchObject({
      ageTicks: 1,
      x: shot.x,
      y: shot.y,
    });
    expect(secondWindupTick.invaderShots[0]).toMatchObject({
      ageTicks: 2,
      x: shot.x,
      y: shot.y,
    });
    expect(armedTick.invaderShots[0]?.ageTicks).toBe(3);
    expect(armedTick.invaderShots[0]?.x).toBeCloseTo(shot.x + shot.velocityX);
    expect(armedTick.invaderShots[0]?.y).toBeCloseTo(shot.y + shot.velocityY);
  });


  it("keeps revenge counterfire harmless during its windup", () => {
    const game = createInitialSpaceInvadersGame();
    const telegraphShot = createInvaderShotFixture({
      ageTicks: 0,
      height: 6,
      kind: "counterfire",
      velocityX: 0,
      velocityY: 0,
      width: 6,
      x: game.player.x + 4,
      y: game.player.y + 4,
    });
    const windupGame = createRunningGame({
      invaderShotCooldownTicks: 1_000,
      invaderShots: [telegraphShot],
      player: game.player,
    });
    const firstWindupTick = advanceSpaceInvadersGame(windupGame, () => 0);
    const secondWindupTick = advanceSpaceInvadersGame(firstWindupTick, () => 0);
    const armedTick = advanceSpaceInvadersGame(secondWindupTick, () => 0);

    expect(firstWindupTick.lives).toBe(windupGame.lives);
    expect(firstWindupTick.invaderShots[0]).toMatchObject({
      ageTicks: 1,
      x: telegraphShot.x,
      y: telegraphShot.y,
    });
    expect(secondWindupTick.lives).toBe(windupGame.lives);
    expect(secondWindupTick.invaderShots[0]).toMatchObject({
      ageTicks: 2,
      x: telegraphShot.x,
      y: telegraphShot.y,
    });
    expect(armedTick.lives).toBe(windupGame.lives - 1);
    expect(armedTick.invaderShots).toEqual([]);
  });


  it("fires burst-row shots one second apart from the same invader", () => {
    const { advanced: firstShot, shooter } = fireFromOnlyInvader(1);
    const burstDelayTicks = Math.round(1_000 / getSpaceInvadersTickDelay());
    const beforeSecondShot = advanceSpaceInvadersTicks(firstShot, burstDelayTicks - 1);
    const secondShot = advanceSpaceInvadersGame(beforeSecondShot, () => 0);
    const beforeThirdShot = advanceSpaceInvadersTicks(secondShot, burstDelayTicks - 1);
    const thirdShot = advanceSpaceInvadersGame(beforeThirdShot, () => 0);

    expect(firstShot.invaderShots).toHaveLength(1);
    expect(firstShot.invaderBurst).toEqual({
      remainingShots: 2,
      sourceInvaderId: shooter.id,
    });
    expect(beforeSecondShot.invaderShots).toHaveLength(1);
    expect(secondShot.invaderShots).toHaveLength(2);
    expect(secondShot.invaderShots[1]).toMatchObject({
      id: "invader-shot-1",
      kind: "burst",
      sourceInvaderId: shooter.id,
      sourceRow: shooter.row,
      velocityX: 0,
      velocityY: 3.45,
    });
    expect(secondShot.invaderBurst).toEqual({
      remainingShots: 1,
      sourceInvaderId: shooter.id,
    });
    expect(beforeThirdShot.invaderShots).toHaveLength(2);
    expect(thirdShot.invaderShots).toHaveLength(3);
    expect(thirdShot.invaderShots[2]).toMatchObject({
      id: "invader-shot-2",
      kind: "burst",
      sourceInvaderId: shooter.id,
      sourceRow: shooter.row,
    });
    expect(thirdShot.invaderBurst).toBeNull();
    expect(thirdShot.invaderShotCooldownTicks).toBeGreaterThan(burstDelayTicks);
  });


  it("cancels a pending burst when its source invader is destroyed", () => {
    const { advanced: firstShot, shooter } = fireFromOnlyInvader(1);
    const sourceDestroyed = {
      ...firstShot,
      invaderShotCooldownTicks: 0,
      invaders: firstShot.invaders.map((invader) =>
        invader.id === shooter.id ? { ...invader, isActive: false } : invader,
      ),
    };
    const advanced = advanceSpaceInvadersGame(sourceDestroyed, () => 0);

    expect(advanced.invaderShots).toHaveLength(1);
    expect(advanced.invaderShots[0]?.id).toBe("invader-shot-0");
    expect(advanced.invaderBurst).toBeNull();
    expect(advanced.invaderShotCooldownTicks).toBeGreaterThan(0);
  });


  it("moves the player shot upward and clears it after it leaves the board", () => {
    const movingShotGame = fireSpaceInvadersShot(createRunningGame());
    const movingShot = movingShotGame.playerShots[0]!;
    const clearedShotGame = createRunningGame({
      playerShots: [
        {
          ...movingShot,
          y: -movingShot.height + movingShot.velocityY - 1,
        },
      ],
    });

    expect(advanceSpaceInvadersGame(movingShotGame).playerShots[0]?.y).toBeCloseTo(
      movingShot.y + movingShot.velocityY,
    );
    expect(advanceSpaceInvadersGame(clearedShotGame).playerShots).toEqual([]);
  });


  it("moves invader shots downward and clears them after they leave the board", () => {
    const shot = createInvaderShotFixture({ y: 120 });
    const movingShotGame = createRunningGame({
      invaderShotCooldownTicks: 100,
      invaderShots: [shot],
    });
    const clearedShotGame = createRunningGame({
      invaderShotCooldownTicks: 100,
      invaderShots: [
        createInvaderShotFixture({
          y: SPACE_INVADERS_BASE_Y + 100,
        }),
      ],
    });

    expect(advanceSpaceInvadersGame(movingShotGame).invaderShots[0]?.y).toBeCloseTo(
      shot.y + shot.velocityY,
    );
    expect(advanceSpaceInvadersGame(clearedShotGame).invaderShots).toEqual([]);
  });


  it("moves commander, burst, and scatter shots with their row behavior", () => {
    const game = createInitialSpaceInvadersGame();
    const commander = createInvaderShotFixture({
      height: 24,
      id: "commander-shot",
      kind: "commander",
      sourceRow: 0,
      velocityX: 0,
      velocityY: 2.35,
      width: 8,
      x: 120,
      y: 120,
    });
    const burst = createInvaderShotFixture({
      id: "burst-shot",
      kind: "burst",
      sourceRow: 1,
      velocityX: 0,
      velocityY: 3.45,
      x: 160,
      y: 120,
    });
    const expiredScatter = createInvaderShotFixture({
      id: "expired-scatter",
      kind: "scatter",
      sourceRow: 4,
      ttlTicks: 1,
      velocityX: 1.25,
      velocityY: 2.8,
      x: 240,
      y: 120,
    });
    const advanced = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShotCooldownTicks: 100,
        invaderShots: [commander, burst, expiredScatter],
        player: {
          ...game.player,
          x: 260,
        },
      }),
    );
    const movedCommander = advanced.invaderShots.find(
      (shot) => shot.id === commander.id,
    );
    const movedBurst = advanced.invaderShots.find((shot) => shot.id === burst.id);

    expect(movedCommander?.velocityX).toBeGreaterThan(0);
    expect(movedCommander?.x).toBeGreaterThan(commander.x);
    expect(movedCommander?.y).toBeCloseTo(commander.y + commander.velocityY);
    expect(movedBurst?.x).toBeCloseTo(burst.x);
    expect(movedBurst?.y).toBeCloseTo(burst.y + burst.velocityY);
    expect(advanced.invaderShots.find((shot) => shot.id === expiredScatter.id)).toBe(
      undefined,
    );
  });

});
