import { describe, expect, it } from "vitest";

import { getInvaderCollisionBounds } from "./space-invaders/hitboxes";
import {
  advanceSpaceInvadersGame,
  createInitialSpaceInvadersGame,
  createInvaderShotFixture,
  createPlayerShotAlignedWith,
  createRunningGame,
  fireSpaceInvadersShot,
  getInvader,
  isSpaceInvaderShielded,
  SPACE_INVADERS_ARMORED_ALIEN_HIT_POINTS,
  SPACE_INVADERS_BOARD_WIDTH,
  SPACE_INVADERS_COLUMNS,
  SPACE_INVADERS_HIT_STREAK_BONUS_STEP,
  SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
  SPACE_INVADERS_PROJECTILE_EXPLOSION_HEIGHT,
  SPACE_INVADERS_PROJECTILE_EXPLOSION_WIDTH,
  SPACE_INVADERS_REVENGE_VOLLEY_TARGET_COUNT,
  SPACE_INVADERS_REVENGE_VOLLEY_WINDUP_TICKS,
  SPACE_INVADERS_ROWS,
  SPACE_INVADERS_SCORE_POPUP_TICKS,
  SPACE_INVADERS_STARTING_LIVES,
  withOnlyActiveInvader,
} from "./space-invaders-game-engine.test-helpers";

describe("space invaders collision engine", () => {
  it("loses a life and clears active shots when an invader shot hits the player", () => {
    const game = createInitialSpaceInvadersGame();
    const hitPlayer = game.player;
    const playerShot = fireSpaceInvadersShot(createRunningGame()).playerShots[0]!;
    const runningGame = createRunningGame({
      invaderBurst: {
        remainingShots: 2,
        sourceInvaderId: "1:5",
      },
      hitStreak: 3,
      invaderShots: [
        createInvaderShotFixture({
          height: 20,
          velocityY: 8,
          width: 5,
          x: game.player.x + game.player.width / 2 - 2.5,
          y: game.player.y - 8,
        }),
      ],
      playerBurst: {
        cooldownTicks: 2,
        remainingShots: 3,
      },
      playerVolleyHasArmoredHit: true,
      playerShots: [playerShot],
    });
    const advanced = advanceSpaceInvadersGame(runningGame, () => 0);

    expect(advanced.status).toBe("running");
    expect(advanced.lives).toBe(SPACE_INVADERS_STARTING_LIVES - 1);
    expect(advanced.explosions).toHaveLength(1);
    expect(advanced.explosions[0]).toMatchObject({
      ageTicks: 0,
      id: "explosion-0",
      kind: "player",
      ttlTicks: 12,
      variant: 1,
    });
    expect(advanced.explosions[0]!.x + advanced.explosions[0]!.width / 2).toBeCloseTo(
      hitPlayer.x + hitPlayer.width / 2,
    );
    expect(advanced.explosions[0]!.y + advanced.explosions[0]!.height / 2).toBeCloseTo(
      hitPlayer.y + hitPlayer.height / 2,
    );
    expect(advanced.nextExplosionId).toBe(1);
    expect(advanced.invaderBurst).toBeNull();
    expect(advanced.invaderShots).toEqual([]);
    expect(advanced.hitStreak).toBe(0);
    expect(advanced.playerBurst).toBeNull();
    expect(advanced.playerShots).toEqual([]);
    expect(advanced.playerVolleyHasArmoredHit).toBe(false);
    expect(advanced.playerRespawnTicks).toBe(SPACE_INVADERS_PLAYER_RESPAWN_TICKS);
    expect(advanced.playerShieldTicks).toBe(0);
    expect(advanced.player.x + advanced.player.width / 2).toBe(
      SPACE_INVADERS_BOARD_WIDTH / 2,
    );
    expect(advanced.invaderShotCooldownTicks).toBeGreaterThan(0);
  });


  it("lets near-edge invader shots pass the smaller player hitbox", () => {
    const game = createInitialSpaceInvadersGame();
    const runningGame = createRunningGame({
      invaderShotCooldownTicks: 100,
      invaderShots: [
        createInvaderShotFixture({
          height: 20,
          velocityY: 8,
          width: 5,
          x: game.player.x - 5,
          y: game.player.y - 8,
        }),
      ],
    });
    const advanced = advanceSpaceInvadersGame(runningGame, () => 0);

    expect(advanced.status).toBe("running");
    expect(advanced.lives).toBe(SPACE_INVADERS_STARTING_LIVES);
    expect(advanced.explosions).toEqual([]);
    expect(advanced.invaderShots).toHaveLength(1);
    expect(advanced.invaderShots[0]).toMatchObject({
      x: game.player.x - 5,
      y: game.player.y,
    });
  });


  it("destroys colliding player and invader shots without resetting the streak", () => {
    const playerShot = fireSpaceInvadersShot(createRunningGame()).playerShots[0]!;
    const invaderShot = createInvaderShotFixture({ x: 180 });
    const collisionY = 300;
    const collisionCenterX = invaderShot.x + invaderShot.width / 2;
    const collisionCenterY = collisionY + invaderShot.height / 2;
    const runningGame = createRunningGame({
      hitStreak: 4,
      invaderShotCooldownTicks: 1_000,
      invaderShots: [
        {
          ...invaderShot,
          y: collisionY - invaderShot.velocityY,
        },
      ],
      playerShots: [
        {
          ...playerShot,
          x: invaderShot.x,
          y: collisionY - playerShot.velocityY,
        },
      ],
      playerVolleyHasArmoredHit: true,
      playerVolleyHasScored: true,
      playerVolleyHasUnscoredExit: true,
    });
    const advanced = advanceSpaceInvadersGame(runningGame, () => 0);

    expect(advanced.lives).toBe(SPACE_INVADERS_STARTING_LIVES);
    expect(advanced.explosions).toEqual([
      {
        ageTicks: 0,
        height: SPACE_INVADERS_PROJECTILE_EXPLOSION_HEIGHT,
        id: "explosion-0",
        kind: "projectile",
        ttlTicks: 12,
        variant: 1,
        width: SPACE_INVADERS_PROJECTILE_EXPLOSION_WIDTH,
        x: collisionCenterX - SPACE_INVADERS_PROJECTILE_EXPLOSION_WIDTH / 2,
        y: collisionCenterY - SPACE_INVADERS_PROJECTILE_EXPLOSION_HEIGHT / 2,
      },
    ]);
    expect(advanced.playerShots).toEqual([]);
    expect(advanced.invaderShots).toEqual([]);
    expect(advanced.hitStreak).toBe(4);
    expect(advanced.playerVolleyHasArmoredHit).toBe(false);
    expect(advanced.playerVolleyHasScored).toBe(false);
    expect(advanced.playerVolleyHasUnscoredExit).toBe(false);
  });


  it("splits commander shots into smaller chasing shards when intercepted", () => {
    const game = createInitialSpaceInvadersGame();
    const playerShot = fireSpaceInvadersShot(createRunningGame()).playerShots[0]!;
    const commanderShot = createInvaderShotFixture({
      height: 24,
      id: "commander-shot-test",
      kind: "commander",
      sourceColumn: 6,
      sourceInvaderId: "0:6",
      sourceRow: 0,
      velocityY: 2.35,
      width: 8,
      x: 180,
    });
    const collisionY = 300;
    const runningGame = createRunningGame({
      hitStreak: 4,
      invaderShotCooldownTicks: 1_000,
      invaderShots: [
        {
          ...commanderShot,
          y: collisionY - commanderShot.velocityY,
        },
      ],
      nextInvaderShotId: 9,
      player: {
        ...game.player,
        x: commanderShot.x + commanderShot.width / 2 - game.player.width / 2,
      },
      playerShots: [
        {
          ...playerShot,
          x: commanderShot.x + commanderShot.width / 2 - playerShot.width / 2,
          y: collisionY - playerShot.velocityY,
        },
      ],
      playerVolleyHasArmoredHit: true,
      playerVolleyHasScored: true,
      playerVolleyHasUnscoredExit: true,
    });
    const advanced = advanceSpaceInvadersGame(runningGame, () => 0);
    const [leftShard, rightShard] = advanced.invaderShots;

    expect(advanced.playerShots).toEqual([]);
    expect(advanced.invaderShots.map((shot) => shot.kind)).toEqual([
      "commander-shard",
      "commander-shard",
    ]);
    expect(advanced.invaderShots.map((shot) => shot.id)).toEqual([
      "invader-shot-9",
      "invader-shot-10",
    ]);
    expect(advanced.invaderShots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ageTicks: 0,
          height: 12,
          sourceColumn: commanderShot.sourceColumn,
          sourceInvaderId: commanderShot.sourceInvaderId,
          sourceRow: commanderShot.sourceRow,
          ttlTicks: null,
          velocityY: 2.35 * 0.8,
          width: 4,
        }),
      ]),
    );
    expect(leftShard?.velocityX).toBeLessThan(0);
    expect(rightShard?.velocityX).toBeGreaterThan(0);
    expect(leftShard?.targetOffsetX).toBeLessThan(0);
    expect(rightShard?.targetOffsetX).toBeGreaterThan(0);
    expect(leftShard?.x).toBeLessThan(commanderShot.x);
    expect(rightShard?.x).toBeGreaterThan(commanderShot.x + commanderShot.width / 2);
    expect((leftShard?.x ?? 0) + (leftShard?.width ?? 0)).toBeLessThan(
      rightShard?.x ?? 0,
    );
    expect(leftShard?.y).toBeCloseTo(collisionY + commanderShot.height / 2 - 6);
    expect(rightShard?.y).toBeCloseTo(leftShard?.y ?? 0);
    expect(advanced.nextInvaderShotId).toBe(11);
    expect(advanced.explosions).toEqual([
      expect.objectContaining({
        kind: "projectile",
        height: SPACE_INVADERS_PROJECTILE_EXPLOSION_HEIGHT,
        width: SPACE_INVADERS_PROJECTILE_EXPLOSION_WIDTH,
      }),
    ]);
    expect(advanced.hitStreak).toBe(4);
    expect(advanced.playerVolleyHasArmoredHit).toBe(false);
    expect(advanced.playerVolleyHasScored).toBe(false);
    expect(advanced.playerVolleyHasUnscoredExit).toBe(false);
  });


  it("destroys intercepted commander shards without splitting them again", () => {
    const playerShot = fireSpaceInvadersShot(createRunningGame()).playerShots[0]!;
    const commanderShard = createInvaderShotFixture({
      height: 12,
      id: "commander-shard-test",
      kind: "commander-shard",
      sourceColumn: 6,
      sourceInvaderId: "0:6",
      sourceRow: 0,
      velocityX: -0.45,
      velocityY: 2.35 * 0.8,
      width: 4,
      x: 180,
    });
    const collisionY = 300;
    const runningGame = createRunningGame({
      hitStreak: 4,
      invaderShotCooldownTicks: 1_000,
      invaderShots: [
        {
          ...commanderShard,
          y: collisionY - commanderShard.velocityY,
        },
      ],
      nextInvaderShotId: 9,
      playerShots: [
        {
          ...playerShot,
          x: commanderShard.x + commanderShard.width / 2 - playerShot.width / 2,
          y: collisionY - playerShot.velocityY,
        },
      ],
    });
    const advanced = advanceSpaceInvadersGame(runningGame, () => 0);

    expect(advanced.playerShots).toEqual([]);
    expect(advanced.invaderShots).toEqual([]);
    expect(advanced.nextInvaderShotId).toBe(9);
    expect(advanced.explosions).toEqual([
      expect.objectContaining({
        kind: "projectile",
        height: SPACE_INVADERS_PROJECTILE_EXPLOSION_HEIGHT,
        width: SPACE_INVADERS_PROJECTILE_EXPLOSION_WIDTH,
      }),
    ]);
    expect(advanced.hitStreak).toBe(4);
  });


  it("keeps piercing shots active when they collide with invader shots", () => {
    const piercingShot = fireSpaceInvadersShot(
      createRunningGame({
        pendingShotPowerUp: "piercing-laser",
      }),
    ).playerShots[0]!;
    const invaderShot = createInvaderShotFixture({ x: 180 });
    const collisionY = 300;
    const runningGame = createRunningGame({
      hitStreak: 4,
      invaderShotCooldownTicks: 1_000,
      invaderShots: [
        {
          ...invaderShot,
          y: collisionY - invaderShot.velocityY,
        },
      ],
      playerShots: [
        {
          ...piercingShot,
          x: invaderShot.x,
          y: collisionY - piercingShot.velocityY,
        },
      ],
    });
    const advanced = advanceSpaceInvadersGame(runningGame, () => 0);

    expect(advanced.playerShots).toHaveLength(1);
    expect(advanced.playerShots[0]).toMatchObject({
      id: piercingShot.id,
      kind: "piercing",
      x: invaderShot.x,
      y: collisionY,
    });
    expect(advanced.invaderShots).toEqual([]);
    expect(advanced.explosions).toEqual([
      expect.objectContaining({
        kind: "projectile",
        height: SPACE_INVADERS_PROJECTILE_EXPLOSION_HEIGHT,
        width: SPACE_INVADERS_PROJECTILE_EXPLOSION_WIDTH,
      }),
    ]);
    expect(advanced.hitStreak).toBe(4);
  });


  it("keeps noncolliding shots active when one projectile pair collides", () => {
    const playerShot = fireSpaceInvadersShot(createRunningGame()).playerShots[0]!;
    const collisionY = 300;
    const collidingInvaderShot = createInvaderShotFixture({
      id: "invader-shot-colliding",
      x: 180,
    });
    const remainingInvaderShot = createInvaderShotFixture({
      id: "invader-shot-remaining",
      x: 320,
      y: 340,
    });
    const remainingPlayerShot = {
      ...playerShot,
      id: "player-shot-remaining",
      x: 240,
      y: 360,
    };
    const runningGame = createRunningGame({
      hitStreak: 2,
      invaderShotCooldownTicks: 1_000,
      invaderShots: [
        {
          ...collidingInvaderShot,
          y: collisionY - collidingInvaderShot.velocityY,
        },
        remainingInvaderShot,
      ],
      playerShots: [
        {
          ...playerShot,
          id: "player-shot-colliding",
          x: collidingInvaderShot.x,
          y: collisionY - playerShot.velocityY,
        },
        remainingPlayerShot,
      ],
    });
    const advanced = advanceSpaceInvadersGame(runningGame, () => 0);

    expect(advanced.playerShots).toHaveLength(1);
    expect(advanced.playerShots[0]).toMatchObject({
      id: remainingPlayerShot.id,
      x: remainingPlayerShot.x,
      y: remainingPlayerShot.y + remainingPlayerShot.velocityY,
    });
    expect(advanced.invaderShots).toHaveLength(1);
    expect(advanced.invaderShots[0]).toMatchObject({
      id: remainingInvaderShot.id,
      x: remainingInvaderShot.x,
      y: remainingInvaderShot.y + remainingInvaderShot.velocityY,
    });
    expect(advanced.explosions).toEqual([
      expect.objectContaining({
        height: SPACE_INVADERS_PROJECTILE_EXPLOSION_HEIGHT,
        kind: "projectile",
        width: SPACE_INVADERS_PROJECTILE_EXPLOSION_WIDTH,
      }),
    ]);
    expect(advanced.hitStreak).toBe(2);
  });


  it("keeps armor-wave shots active when they collide with player shots", () => {
    const playerShot = fireSpaceInvadersShot(createRunningGame()).playerShots[0]!;
    const armorWave = createInvaderShotFixture({
      height: 14,
      id: "armor-wave-test",
      kind: "armor-wave",
      velocityY: 2,
      width: 56,
      x: 160,
    });
    const collisionY = 260;
    const runningGame = createRunningGame({
      hitStreak: 5,
      invaderShotCooldownTicks: 1_000,
      invaderShots: [
        {
          ...armorWave,
          y: collisionY - armorWave.velocityY,
        },
      ],
      playerShots: [
        {
          ...playerShot,
          x: armorWave.x + armorWave.width / 2 - playerShot.width / 2,
          y: collisionY - playerShot.velocityY,
        },
      ],
    });
    const advanced = advanceSpaceInvadersGame(runningGame, () => 0);

    expect(advanced.playerShots).toEqual([]);
    expect(advanced.invaderShots).toEqual([
      {
        ...armorWave,
        ageTicks: armorWave.ageTicks + 1,
        y: collisionY,
      },
    ]);
    expect(advanced.explosions).toEqual([
      expect.objectContaining({
        kind: "projectile",
        height: SPACE_INVADERS_PROJECTILE_EXPLOSION_HEIGHT,
        width: SPACE_INVADERS_PROJECTILE_EXPLOSION_WIDTH,
      }),
    ]);
    expect(advanced.hitStreak).toBe(5);
  });


  it("keeps piercing shots and armor waves active when they collide", () => {
    const piercingShot = fireSpaceInvadersShot(
      createRunningGame({
        pendingShotPowerUp: "piercing-laser",
      }),
    ).playerShots[0]!;
    const armorWave = createInvaderShotFixture({
      height: 14,
      id: "armor-wave-test",
      kind: "armor-wave",
      velocityY: 2,
      width: 56,
      x: 160,
    });
    const collisionY = 260;
    const playerShotX = armorWave.x + armorWave.width / 2 - piercingShot.width / 2;
    const runningGame = createRunningGame({
      hitStreak: 5,
      invaderShotCooldownTicks: 1_000,
      invaderShots: [
        {
          ...armorWave,
          y: collisionY - armorWave.velocityY,
        },
      ],
      playerShots: [
        {
          ...piercingShot,
          x: playerShotX,
          y: collisionY - piercingShot.velocityY,
        },
      ],
    });
    const advanced = advanceSpaceInvadersGame(runningGame, () => 0);

    expect(advanced.playerShots).toHaveLength(1);
    expect(advanced.playerShots[0]).toMatchObject({
      id: piercingShot.id,
      kind: "piercing",
      x: playerShotX,
      y: collisionY,
    });
    expect(advanced.invaderShots).toEqual([
      {
        ...armorWave,
        ageTicks: armorWave.ageTicks + 1,
        y: collisionY,
      },
    ]);
    expect(advanced.explosions).toEqual([
      expect.objectContaining({
        kind: "projectile",
        height: SPACE_INVADERS_PROJECTILE_EXPLOSION_HEIGHT,
        width: SPACE_INVADERS_PROJECTILE_EXPLOSION_WIDTH,
      }),
    ]);
    expect(advanced.hitStreak).toBe(5);
  });


  it("removes a hit invader, clears the shot, and adds the invader score", () => {
    const game = createInitialSpaceInvadersGame();
    const targetInvader = game.invaders[0]!;
    const runningGame = createRunningGame({
      invaders: game.invaders,
      playerShots: [createPlayerShotAlignedWith(targetInvader)],
    });
    const advanced = advanceSpaceInvadersGame(runningGame, () => 0.62);
    const hitInvader = advanced.invaders.find((invader) => invader.id === targetInvader.id);

    expect(hitInvader?.isActive).toBe(false);
    expect(advanced.playerShots).toEqual([]);
    expect(advanced.score).toBe(targetInvader.points);
    expect(advanced.hitStreak).toBe(1);
    expect(advanced.explosions).toHaveLength(1);
    expect(advanced.explosions[0]).toMatchObject({
      ageTicks: 0,
      id: "explosion-0",
      kind: "invader",
      ttlTicks: 12,
      variant: 3,
    });
    expect(advanced.explosions[0]!.x + advanced.explosions[0]!.width / 2).toBeCloseTo(
      targetInvader.x + targetInvader.width / 2,
    );
    expect(advanced.explosions[0]!.y + advanced.explosions[0]!.height / 2).toBeCloseTo(
      targetInvader.y + targetInvader.height / 2,
    );
    expect(advanced.nextExplosionId).toBe(1);
    expect(advanced.scorePopups).toEqual([
      {
        ageTicks: 0,
        height: targetInvader.height,
        id: "score-popup-0",
        points: targetInvader.points,
        ttlTicks: SPACE_INVADERS_SCORE_POPUP_TICKS,
        width: targetInvader.width,
        x: targetInvader.x,
        y: targetInvader.y,
      },
    ]);
    expect(advanced.nextScorePopupId).toBe(1);
  });


  it("lets player shots pass transparent padding around alien sprites", () => {
    const game = createInitialSpaceInvadersGame();
    const targetInvader = getInvader(game, SPACE_INVADERS_ROWS - 1, 5);
    const baseShot = fireSpaceInvadersShot(createRunningGame()).playerShots[0]!;
    const occupiedBottomY = targetInvader.y + targetInvader.height * ((11 + 83) / 112);
    const movedShotY = occupiedBottomY + 0.01;
    const runningGame = withOnlyActiveInvader(
      createRunningGame({
        alienFreezeTicks: 1,
        invaderShotCooldownTicks: 1_000,
        playerShots: [
          {
            ...baseShot,
            x: targetInvader.x + targetInvader.width / 2 - baseShot.width / 2,
            y: movedShotY - baseShot.velocityY,
          },
        ],
      }),
      targetInvader,
    );
    const advanced = advanceSpaceInvadersGame(runningGame, () => 0);
    const activeInvader = advanced.invaders.find(
      (invader) => invader.id === targetInvader.id,
    );

    expect(targetInvader).toMatchObject({
      kind: "standard",
      row: SPACE_INVADERS_ROWS - 1,
    });
    expect(activeInvader).toMatchObject({
      isActive: true,
    });
    expect(advanced.playerShots).toHaveLength(1);
    expect(advanced.playerShots[0]).toMatchObject({
      hasScored: false,
      x: targetInvader.x + targetInvader.width / 2 - baseShot.width / 2,
    });
    expect(advanced.playerShots[0]!.y).toBeCloseTo(movedShotY);
    expect(advanced.score).toBe(0);
    expect(advanced.hitStreak).toBe(0);
    expect(advanced.explosions).toEqual([]);
    expect(advanced.scorePopups).toEqual([]);
  });


  it("requires three shots to destroy Armored Aliens while preserving clean streaks", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const armoredAlien = game.invaders.find((invader) => invader.kind === "armored")!;
    const firstHit = advanceSpaceInvadersGame(
      withOnlyActiveInvader(
        createRunningGame({
          hitStreak: 4,
          invaderShotCooldownTicks: 1_000,
          invaders: game.invaders,
          playerShots: [createPlayerShotAlignedWith(armoredAlien)],
          score: 100,
        }),
        armoredAlien,
      ),
      () => 0,
    );
    const armoredAfterFirstHit = firstHit.invaders.find(
      (invader) => invader.id === armoredAlien.id,
    )!;
    const secondHit = advanceSpaceInvadersGame(
      {
        ...firstHit,
        invaderShotCooldownTicks: 1_000,
        playerShots: [createPlayerShotAlignedWith(armoredAfterFirstHit, firstHit)],
      },
      () => 0,
    );
    const armoredAfterSecondHit = secondHit.invaders.find(
      (invader) => invader.id === armoredAlien.id,
    )!;
    const finalHit = advanceSpaceInvadersGame(
      {
        ...secondHit,
        invaderShotCooldownTicks: 1_000,
        playerShots: [createPlayerShotAlignedWith(armoredAfterSecondHit, secondHit)],
      },
      () => 0,
    );
    const destroyedArmoredAlien = finalHit.invaders.find(
      (invader) => invader.id === armoredAlien.id,
    )!;
    const expectedFinalStreakBonus = SPACE_INVADERS_HIT_STREAK_BONUS_STEP * 4;

    expect(armoredAlien).toMatchObject({
      hitPoints: SPACE_INVADERS_ARMORED_ALIEN_HIT_POINTS,
      kind: "armored",
    });
    expect(armoredAfterFirstHit).toMatchObject({
      hitPoints: 2,
      isActive: true,
    });
    expect(firstHit.playerShots).toEqual([]);
    expect(firstHit.hitStreak).toBe(4);
    expect(firstHit.score).toBe(100);
    expect(firstHit.explosions).toEqual([]);
    expect(firstHit.scorePopups).toEqual([]);
    expect(firstHit.playerVolleyHasArmoredHit).toBe(false);
    expect(firstHit.playerVolleyHasScored).toBe(false);
    expect(firstHit.playerVolleyHasUnscoredExit).toBe(false);
    expect(armoredAfterSecondHit).toMatchObject({
      hitPoints: 1,
      isActive: true,
    });
    expect(secondHit.hitStreak).toBe(4);
    expect(secondHit.score).toBe(100);
    expect(destroyedArmoredAlien).toMatchObject({
      hitPoints: 0,
      isActive: false,
    });
    expect(finalHit.status).toBe("won");
    expect(finalHit.hitStreak).toBe(5);
    expect(finalHit.score).toBe(100 + armoredAlien.points + expectedFinalStreakBonus);
    expect(finalHit.explosions).toHaveLength(1);
    expect(finalHit.scorePopups).toEqual([
      expect.objectContaining({
        points: armoredAlien.points + expectedFinalStreakBonus,
        scoreScale: 1.32,
      }),
    ]);
  });


  it("damages an Armored Alien only once per piercing laser", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const armoredAlien = game.invaders.find((invader) => invader.kind === "armored")!;
    const firstHit = advanceSpaceInvadersGame(
      withOnlyActiveInvader(
        createRunningGame({
          alienFreezeTicks: 2,
          invaderShotCooldownTicks: 1_000,
          invaders: game.invaders,
          playerShots: [
            {
              ...createPlayerShotAlignedWith(armoredAlien),
              kind: "piercing",
            },
          ],
        }),
        armoredAlien,
      ),
      () => 0,
    );
    const secondTick = advanceSpaceInvadersGame(
      {
        ...firstHit,
        invaderShotCooldownTicks: 1_000,
      },
      () => 0,
    );
    const armoredAfterFirstHit = firstHit.invaders.find(
      (invader) => invader.id === armoredAlien.id,
    )!;
    const armoredAfterSecondTick = secondTick.invaders.find(
      (invader) => invader.id === armoredAlien.id,
    )!;

    expect(armoredAfterFirstHit).toMatchObject({
      hitPoints: 2,
      isActive: true,
    });
    expect(firstHit.playerShots).toHaveLength(1);
    expect(firstHit.playerShots[0]).toMatchObject({
      damagedInvaderIds: [armoredAlien.id],
      hasScored: false,
      kind: "piercing",
    });
    expect(firstHit.playerVolleyHasArmoredHit).toBe(true);
    expect(firstHit.playerVolleyHasScored).toBe(false);
    expect(armoredAfterSecondTick).toMatchObject({
      hitPoints: 2,
      isActive: true,
    });
    expect(secondTick.playerShots[0]).toMatchObject({
      damagedInvaderIds: [armoredAlien.id],
      kind: "piercing",
    });
    expect(secondTick.score).toBe(0);
    expect(secondTick.explosions).toEqual([]);
    expect(secondTick.playerVolleyHasArmoredHit).toBe(true);
    expect(secondTick.playerVolleyHasScored).toBe(false);
  });


  it("lets armor-preserved volleys still earn hit-streak bonuses on later kills", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const armoredAlien = game.invaders.find((invader) => invader.kind === "armored")!;
    const standardInvader = getInvader(game, SPACE_INVADERS_ROWS - 1, 0);
    const activeInvaderIds = new Set([armoredAlien.id, standardInvader.id]);
    const armorShot = {
      ...createPlayerShotAlignedWith(armoredAlien),
      id: "armor-shot",
      kind: "shotgun" as const,
    };
    const scoringShot = {
      ...createPlayerShotAlignedWith(standardInvader),
      id: "scoring-shot",
      kind: "shotgun" as const,
    };
    const advanced = advanceSpaceInvadersGame(
      createRunningGame({
        hitStreak: 4,
        invaderShotCooldownTicks: 1_000,
        invaders: game.invaders.map((invader) => ({
          ...invader,
          isActive: activeInvaderIds.has(invader.id),
        })),
        playerShots: [armorShot, scoringShot],
        score: 100,
      }),
      () => 0,
    );
    const armoredAfterHit = advanced.invaders.find(
      (invader) => invader.id === armoredAlien.id,
    )!;

    expect(armoredAfterHit).toMatchObject({
      hitPoints: SPACE_INVADERS_ARMORED_ALIEN_HIT_POINTS - 1,
      isActive: true,
    });
    expect(
      advanced.invaders.find((invader) => invader.id === standardInvader.id)?.isActive,
    ).toBe(false);
    expect(advanced.hitStreak).toBe(5);
    expect(advanced.score).toBe(
      100 + standardInvader.points + SPACE_INVADERS_HIT_STREAK_BONUS_STEP * 4,
    );
    expect(advanced.playerVolleyHasArmoredHit).toBe(false);
    expect(advanced.playerVolleyHasScored).toBe(false);
    expect(advanced.playerVolleyHasUnscoredExit).toBe(false);
  });


  it("splits destroyed Splitter Aliens into two smaller active fragments", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const splitterAlien = game.invaders.find((invader) => invader.kind === "splitter")!;
    const remainingInvader = getInvader(
      game,
      SPACE_INVADERS_ROWS - 1,
      SPACE_INVADERS_COLUMNS - 1,
    );
    const activeInvaderIds = new Set([splitterAlien.id, remainingInvader.id]);
    const runningGame = createRunningGame({
      invaderShotCooldownTicks: 1_000,
      invaders: game.invaders.map((invader) => ({
        ...invader,
        isActive: activeInvaderIds.has(invader.id),
      })),
      playerShots: [createPlayerShotAlignedWith(splitterAlien)],
    });
    const advanced = advanceSpaceInvadersGame(runningGame, () => 0);
    const inactiveParent = advanced.invaders.find(
      (invader) => invader.id === splitterAlien.id,
    );
    const splitterFragments = advanced.invaders.filter(
      (invader) => invader.kind === "splitter-fragment" && invader.isActive,
    );

    expect(inactiveParent).toMatchObject({
      isActive: false,
      kind: "splitter",
    });
    expect(splitterFragments).toHaveLength(2);
    expect(splitterFragments.map((fragment) => fragment.id)).toEqual([
      `${splitterAlien.id}:split-left`,
      `${splitterAlien.id}:split-right`,
    ]);
    expect(splitterFragments.map((fragment) => fragment.direction)).toEqual([-1, 1]);
    expect(splitterFragments.every((fragment) => fragment.isDiving)).toBe(true);
    expect(
      splitterFragments.every(
        (fragment) =>
          fragment.height === splitterAlien.height * 0.7 &&
          fragment.width === splitterAlien.width * 0.7 &&
          fragment.points === Math.floor(splitterAlien.points / 2),
      ),
    ).toBe(true);
    expect(
      advanced.invaders.filter((invader) => invader.isActive).map((invader) => invader.id),
    ).toEqual([
      remainingInvader.id,
      `${splitterAlien.id}:split-left`,
      `${splitterAlien.id}:split-right`,
    ]);
    expect(advanced.status).toBe("running");
    expect(advanced.score).toBe(splitterAlien.points);
    expect(advanced.powerUps).toEqual([]);
    expect(advanced.explosions).toHaveLength(1);
    expect(advanced.scorePopups).toEqual([
      expect.objectContaining({
        points: splitterAlien.points,
      }),
    ]);
  });


  it("requires spawned Splitter fragments to be cleared before winning", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const splitterAlien = game.invaders.find((invader) => invader.kind === "splitter")!;
    const parentDestroyed = advanceSpaceInvadersGame(
      withOnlyActiveInvader(
        createRunningGame({
          invaderShotCooldownTicks: 1_000,
          invaders: game.invaders,
          playerShots: [createPlayerShotAlignedWith(splitterAlien)],
        }),
        splitterAlien,
      ),
      () => 0,
    );
    const fragmentsAfterParent = parentDestroyed.invaders.filter(
      (invader) => invader.kind === "splitter-fragment" && invader.isActive,
    );
    const firstFragmentDestroyed = advanceSpaceInvadersGame(
      {
        ...parentDestroyed,
        invaderShotCooldownTicks: 1_000,
        playerShots: [createPlayerShotAlignedWith(fragmentsAfterParent[0]!, parentDestroyed)],
      },
      () => 0,
    );
    const remainingFragment = firstFragmentDestroyed.invaders.find(
      (invader) => invader.kind === "splitter-fragment" && invader.isActive,
    )!;
    const allFragmentsDestroyed = advanceSpaceInvadersGame(
      {
        ...firstFragmentDestroyed,
        invaderShotCooldownTicks: 1_000,
        playerShots: [
          createPlayerShotAlignedWith(remainingFragment, firstFragmentDestroyed),
        ],
      },
      () => 0,
    );

    expect(parentDestroyed.status).toBe("running");
    expect(fragmentsAfterParent).toHaveLength(2);
    expect(
      firstFragmentDestroyed.invaders.filter(
        (invader) => invader.kind === "splitter-fragment" && invader.isActive,
      ),
    ).toHaveLength(1);
    expect(firstFragmentDestroyed.status).toBe("running");
    expect(allFragmentsDestroyed.status).toBe("won");
    expect(allFragmentsDestroyed.invaders.some((invader) => invader.isActive)).toBe(false);
  });


  it("releases new Splitter fragments as divers even when lower invaders block their lanes", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const splitterAlien = getInvader(game, 1, 4);
    const blockingInvader = getInvader(game, 2, 4);
    const activeInvaderIds = new Set([splitterAlien.id, blockingInvader.id]);
    const parentDestroyed = advanceSpaceInvadersGame(
      createRunningGame({
        alienFreezeTicks: 1,
        invaderShotCooldownTicks: 1_000,
        invaders: game.invaders.map((invader) => ({
          ...invader,
          isActive: activeInvaderIds.has(invader.id),
        })),
        playerShots: [createPlayerShotAlignedWith(splitterAlien)],
      }),
      () => 0,
    );
    const fragmentsBeforeMove = parentDestroyed.invaders.filter(
      (invader) => invader.kind === "splitter-fragment" && invader.isActive,
    );
    const blockingBeforeMove = parentDestroyed.invaders.find(
      (invader) => invader.id === blockingInvader.id,
    )!;
    const moved = advanceSpaceInvadersGame(
      {
        ...parentDestroyed,
        invaderShotCooldownTicks: 1_000,
      },
      () => 0,
    );
    const movedFragments = fragmentsBeforeMove.map(
      (fragment) => moved.invaders.find((invader) => invader.id === fragment.id)!,
    );
    const movedBlockingInvader = moved.invaders.find(
      (invader) => invader.id === blockingInvader.id,
    )!;
    const blockingDeltaX = movedBlockingInvader.x - blockingBeforeMove.x;
    const [leftFragment, rightFragment] = fragmentsBeforeMove;
    const [movedLeftFragment, movedRightFragment] = movedFragments;

    expect(splitterAlien.kind).toBe("splitter");
    expect(fragmentsBeforeMove).toHaveLength(2);
    expect(
      fragmentsBeforeMove.every(
        (fragment) =>
          blockingBeforeMove.y > fragment.y &&
          fragment.x < blockingBeforeMove.x + blockingBeforeMove.width &&
          blockingBeforeMove.x < fragment.x + fragment.width,
      ),
    ).toBe(true);
    expect(parentDestroyed.alienFreezeTicks).toBe(0);
    expect(movedFragments.every((fragment) => fragment.isDiving)).toBe(true);
    expect(movedLeftFragment.x - leftFragment!.x).toBeLessThan(0);
    expect(movedRightFragment.x - rightFragment!.x).toBeGreaterThan(blockingDeltaX);
    expect(blockingDeltaX).toBeGreaterThan(0);
  });


  it("moves Splitter fragments apart with diver bounce behavior after they split", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const baseDiver = game.invaders.find((invader) => invader.kind === "diver")!;
    const baseLeftFragment = getInvader(game, 1, 4);
    const baseRightFragment = getInvader(game, 1, 5);
    const baseBouncingFragment = getInvader(game, 1, 6);
    const diver = {
      ...baseDiver,
      id: "moving-diver",
      isActive: true,
      isDiving: true,
      kind: "diver" as const,
      x: 90,
      y: 140,
    };
    const leftFragment = {
      ...baseLeftFragment,
      direction: -1 as const,
      height: baseLeftFragment.height * 0.7,
      id: "moving-splitter-fragment-left",
      isActive: true,
      isDiving: true,
      kind: "splitter-fragment" as const,
      width: baseLeftFragment.width * 0.7,
      x: 180,
      y: 140,
    };
    const rightFragment = {
      ...baseRightFragment,
      direction: 1 as const,
      height: baseRightFragment.height * 0.7,
      id: "moving-splitter-fragment-right",
      isActive: true,
      isDiving: true,
      kind: "splitter-fragment" as const,
      width: baseRightFragment.width * 0.7,
      x: 220,
      y: 140,
    };
    const bouncingFragment = {
      ...baseBouncingFragment,
      direction: -1 as const,
      height: baseBouncingFragment.height * 0.7,
      id: "bouncing-splitter-fragment",
      isActive: true,
      isDiving: true,
      kind: "splitter-fragment" as const,
      width: baseBouncingFragment.width * 0.7,
      x: 0,
      y: 170,
    };
    const advanced = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShotCooldownTicks: 1_000,
        invaders: game.invaders.map((invader) => {
          if (invader.id === baseDiver.id) {
            return diver;
          }

          if (invader.id === baseLeftFragment.id) {
            return leftFragment;
          }

          if (invader.id === baseRightFragment.id) {
            return rightFragment;
          }

          if (invader.id === baseBouncingFragment.id) {
            return bouncingFragment;
          }

          return {
            ...invader,
            isActive: false,
          };
        }),
      }),
      () => 0,
    );
    const movedDiver = advanced.invaders.find((invader) => invader.id === diver.id)!;
    const movedLeftFragment = advanced.invaders.find(
      (invader) => invader.id === leftFragment.id,
    )!;
    const movedRightFragment = advanced.invaders.find(
      (invader) => invader.id === rightFragment.id,
    )!;
    const movedBouncingFragment = advanced.invaders.find(
      (invader) => invader.id === bouncingFragment.id,
    )!;
    const diverDeltaX = movedDiver.x - diver.x;
    const leftFragmentDeltaX = movedLeftFragment.x - leftFragment.x;
    const rightFragmentDeltaX = movedRightFragment.x - rightFragment.x;

    expect(movedDiver.isDiving).toBe(true);
    expect(movedLeftFragment.isDiving).toBe(true);
    expect(movedRightFragment.isDiving).toBe(true);
    expect(leftFragmentDeltaX).toBeCloseTo(-diverDeltaX);
    expect(rightFragmentDeltaX).toBeCloseTo(diverDeltaX);
    expect(movedBouncingFragment).toMatchObject({
      direction: 1,
      isDiving: true,
      x: 0,
      y: bouncingFragment.y + 16,
    });
  });


  it("does not drop power-ups from destroyed Splitter fragments", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const baseFragment = getInvader(game, 1, 4);
    const fragment = {
      ...baseFragment,
      height: baseFragment.height * 0.7,
      id: "splitter-fragment-test",
      isActive: true,
      kind: "splitter-fragment" as const,
      points: 10,
      width: baseFragment.width * 0.7,
      x: 180,
      y: 180,
    };
    const remainingInvader = getInvader(
      game,
      SPACE_INVADERS_ROWS - 1,
      SPACE_INVADERS_COLUMNS - 1,
    );
    const advanced = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShotCooldownTicks: 1_000,
        invaders: game.invaders.map((invader) => {
          if (invader.id === baseFragment.id) {
            return fragment;
          }

          return {
            ...invader,
            isActive: invader.id === remainingInvader.id,
          };
        }),
        playerShots: [createPlayerShotAlignedWith(fragment)],
      }),
      () => 0.99,
    );

    expect(
      advanced.invaders.find((invader) => invader.id === fragment.id)?.isActive,
    ).toBe(false);
    expect(advanced.powerUps).toEqual([]);
    expect(advanced.status).toBe("running");
  });


  it("absorbs normal hits against aliens protected by an active shield bearer", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const shieldBearer = getInvader(game, 1, 3);
    const protectedInvader = {
      ...getInvader(game, 1, 4),
      kind: "standard" as const,
    };
    const shieldedShot = createPlayerShotAlignedWith(protectedInvader);
    const runningGame = createRunningGame({
      hitStreak: 3,
      invaderShotCooldownTicks: 1_000,
      invaders: game.invaders.map((invader) => {
        if (invader.id === protectedInvader.id) {
          return protectedInvader;
        }

        return {
          ...invader,
          isActive: invader.id === shieldBearer.id,
        };
      }),
      playerShots: [shieldedShot],
    });
    const movedShieldedShot = {
      ...shieldedShot,
      x: shieldedShot.x + shieldedShot.velocityX,
      y: shieldedShot.y + shieldedShot.velocityY,
    };
    const protectedInvaderHitbox = getInvaderCollisionBounds(protectedInvader);
    const expectedCollisionCenterX =
      (Math.max(movedShieldedShot.x, protectedInvaderHitbox.x) +
        Math.min(
          movedShieldedShot.x + movedShieldedShot.width,
          protectedInvaderHitbox.x + protectedInvaderHitbox.width,
        )) /
      2;
    const expectedCollisionCenterY =
      (Math.max(movedShieldedShot.y, protectedInvaderHitbox.y) +
        Math.min(
          movedShieldedShot.y + movedShieldedShot.height,
          protectedInvaderHitbox.y + protectedInvaderHitbox.height,
        )) /
      2;
    const advanced = advanceSpaceInvadersGame(runningGame, () => 0);

    expect(shieldBearer.kind).toBe("shield-bearer");
    expect(protectedInvader.kind).toBe("standard");
    expect(isSpaceInvaderShielded(protectedInvader, runningGame.invaders)).toBe(true);
    expect(
      advanced.invaders.find((invader) => invader.id === protectedInvader.id)?.isActive,
    ).toBe(true);
    expect(
      advanced.invaders.find((invader) => invader.id === shieldBearer.id)?.isActive,
    ).toBe(true);
    expect(advanced.playerShots).toEqual([]);
    expect(advanced.score).toBe(0);
    expect(advanced.hitStreak).toBe(0);
    expect(advanced.explosions).toHaveLength(1);
    expect(advanced.explosions[0]).toMatchObject({
      ageTicks: 0,
      height: SPACE_INVADERS_PROJECTILE_EXPLOSION_HEIGHT,
      id: "explosion-0",
      kind: "shield",
      ttlTicks: 12,
      variant: 1,
      width: SPACE_INVADERS_PROJECTILE_EXPLOSION_WIDTH,
    });
    expect(advanced.explosions[0]!.x + advanced.explosions[0]!.width / 2).toBeCloseTo(
      expectedCollisionCenterX,
    );
    expect(advanced.explosions[0]!.y + advanced.explosions[0]!.height / 2).toBeCloseTo(
      expectedCollisionCenterY,
    );
    expect(advanced.nextExplosionId).toBe(1);
    expect(advanced.scorePopups).toEqual([]);
    expect(advanced.playerVolleyHasScored).toBe(false);
    expect(advanced.playerVolleyHasUnscoredExit).toBe(false);
  });


  it("lets players destroy shield bearers and then their formerly protected neighbors", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const shieldBearer = getInvader(game, 1, 3);
    const protectedInvader = {
      ...getInvader(game, 1, 4),
      kind: "standard" as const,
    };
    const shieldBearerDestroyed = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShotCooldownTicks: 1_000,
        invaders: game.invaders.map((invader) => {
          if (invader.id === protectedInvader.id) {
            return protectedInvader;
          }

          return {
            ...invader,
            isActive: invader.id === shieldBearer.id,
          };
        }),
        playerShots: [createPlayerShotAlignedWith(shieldBearer)],
      }),
      () => 0,
    );
    const exposedInvaderDestroyed = advanceSpaceInvadersGame(
      {
        ...shieldBearerDestroyed,
        invaderShotCooldownTicks: 1_000,
        playerShots: [createPlayerShotAlignedWith(protectedInvader)],
      },
      () => 0,
    );

    expect(shieldBearer.kind).toBe("shield-bearer");
    expect(
      shieldBearerDestroyed.invaders.find((invader) => invader.id === shieldBearer.id)
        ?.isActive,
    ).toBe(false);
    expect(
      shieldBearerDestroyed.invaders.find((invader) => invader.id === protectedInvader.id)
        ?.isActive,
    ).toBe(true);
    expect(
      isSpaceInvaderShielded(
        protectedInvader,
        shieldBearerDestroyed.invaders,
      ),
    ).toBe(false);
    expect(
      exposedInvaderDestroyed.invaders.find(
        (invader) => invader.id === protectedInvader.id,
      )?.isActive,
    ).toBe(false);
    expect(exposedInvaderDestroyed.score).toBe(
      shieldBearer.points + protectedInvader.points + SPACE_INVADERS_HIT_STREAK_BONUS_STEP,
    );
    expect(exposedInvaderDestroyed.explosions).toHaveLength(2);
  });


  it("lets piercing lasers punch through shield-bearer protection", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const shieldBearer = getInvader(game, 1, 3);
    const protectedInvader = {
      ...getInvader(game, 1, 4),
      kind: "standard" as const,
    };
    const remainingInvader = getInvader(
      game,
      SPACE_INVADERS_ROWS - 1,
      SPACE_INVADERS_COLUMNS - 1,
    );
    const advanced = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShotCooldownTicks: 1_000,
        invaders: game.invaders.map((invader) => {
          if (invader.id === protectedInvader.id) {
            return protectedInvader;
          }

          return {
            ...invader,
            isActive:
              invader.id === shieldBearer.id || invader.id === remainingInvader.id,
          };
        }),
        playerShots: [
          {
            ...createPlayerShotAlignedWith(protectedInvader),
            kind: "piercing",
          },
        ],
      }),
      () => 0,
    );

    expect(isSpaceInvaderShielded(protectedInvader, game.invaders)).toBe(true);
    expect(
      advanced.invaders.find((invader) => invader.id === protectedInvader.id)?.isActive,
    ).toBe(false);
    expect(
      advanced.invaders.find((invader) => invader.id === shieldBearer.id)?.isActive,
    ).toBe(true);
    expect(advanced.status).toBe("running");
    expect(advanced.score).toBe(protectedInvader.points);
    expect(advanced.hitStreak).toBe(1);
    expect(advanced.playerShots).toHaveLength(1);
    expect(advanced.playerShots[0]).toMatchObject({
      hasScored: true,
      kind: "piercing",
    });
  });


  it("marks five random formation aliens after a revenge alien is destroyed and fires after the aura", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const revengeAlien = getInvader(game, 1, 5);
    const expectedSelectedIds = game.invaders
      .filter(
        (invader) =>
          invader.isActive &&
          invader.kind !== "splitter-fragment" &&
          invader.id !== revengeAlien.id,
      )
      .slice(0, SPACE_INVADERS_REVENGE_VOLLEY_TARGET_COUNT)
      .map((invader) => invader.id);
    const primed = advanceSpaceInvadersGame(
      createRunningGame({
        alienFreezeTicks: SPACE_INVADERS_REVENGE_VOLLEY_WINDUP_TICKS + 10,
        invaderShotCooldownTicks: 1_000,
        playerShots: [createPlayerShotAlignedWith(revengeAlien)],
      }),
      () => 0,
    );

    expect(revengeAlien.kind).toBe("revenge");
    expect(
      primed.invaders.find((invader) => invader.id === revengeAlien.id)?.isActive,
    ).toBe(false);
    expect(primed.invaderShots).toEqual([]);
    expect(primed.revengeVolleys).toEqual([
      {
        invaderIds: expectedSelectedIds,
        ticksRemaining: SPACE_INVADERS_REVENGE_VOLLEY_WINDUP_TICKS,
      },
    ]);

    let ticking = primed;

    for (let tick = 0; tick < SPACE_INVADERS_REVENGE_VOLLEY_WINDUP_TICKS - 1; tick += 1) {
      ticking = advanceSpaceInvadersGame(ticking, () => 0);
    }

    expect(ticking.invaderShots).toEqual([]);
    expect(ticking.revengeVolleys[0]).toMatchObject({
      invaderIds: expectedSelectedIds,
      ticksRemaining: 1,
    });

    const fired = advanceSpaceInvadersGame(ticking, () => 0);

    expect(fired.revengeVolleys).toEqual([]);
    expect(fired.invaderShots.map((shot) => shot.sourceInvaderId)).toEqual(
      expectedSelectedIds,
    );
    expect(
      fired.invaderShots.map(({ id, sourceColumn, sourceRow }) => ({
        id,
        sourceColumn,
        sourceRow,
      })),
    ).toEqual(
      expectedSelectedIds.map((sourceInvaderId, index) => {
        const invader = game.invaders.find(
          (candidate) => candidate.id === sourceInvaderId,
        )!;

        return {
          id: `invader-shot-${index}`,
          sourceColumn: invader.column,
          sourceRow: invader.row,
        };
      }),
    );
    expect(fired.nextInvaderShotId).toBe(SPACE_INVADERS_REVENGE_VOLLEY_TARGET_COUNT);
  });


  it("fires delayed revenge shots below five targets even when frozen and the active shot limit is full", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const revengeAlien = getInvader(game, 1, 5);
    const leftNeighbor = getInvader(game, 1, 4);
    const scatterSource = {
      ...getInvader(game, 2, 5),
      kind: "standard" as const,
    };
    const primed = advanceSpaceInvadersGame(
      createRunningGame({
        alienFreezeTicks: SPACE_INVADERS_REVENGE_VOLLEY_WINDUP_TICKS + 10,
        invaderShotCooldownTicks: 1_000,
        invaderShots: [
          createInvaderShotFixture({
            id: "existing-shot-0",
            sourceColumn: 0,
            sourceInvaderId: "4:0",
            x: 20,
          }),
          createInvaderShotFixture({
            id: "existing-shot-1",
            sourceColumn: 1,
            sourceInvaderId: "4:1",
            x: 40,
          }),
          createInvaderShotFixture({
            id: "existing-shot-2",
            sourceColumn: 2,
            sourceInvaderId: "4:2",
            x: 60,
          }),
        ],
        invaders: game.invaders.map((invader) => ({
          ...invader,
          ...(invader.id === scatterSource.id ? scatterSource : {}),
          isActive:
            invader.id === revengeAlien.id ||
            invader.id === leftNeighbor.id ||
            invader.id === scatterSource.id,
        })),
        nextInvaderShotId: 5,
        playerShots: [createPlayerShotAlignedWith(revengeAlien)],
      }),
      () => 0,
    );

    expect(primed.invaderShots).toHaveLength(3);
    expect(primed.revengeVolleys).toEqual([
      {
        invaderIds: [leftNeighbor.id, scatterSource.id],
        ticksRemaining: SPACE_INVADERS_REVENGE_VOLLEY_WINDUP_TICKS,
      },
    ]);

    let ticking = primed;

    for (let tick = 0; tick < SPACE_INVADERS_REVENGE_VOLLEY_WINDUP_TICKS; tick += 1) {
      ticking = advanceSpaceInvadersGame(ticking, () => 0);
    }

    expect(ticking.revengeVolleys).toEqual([]);
    expect(ticking.invaderShots).toHaveLength(5);
    expect(ticking.invaderShots.map((shot) => shot.sourceInvaderId)).toEqual([
      "4:0",
      "4:1",
      "4:2",
      leftNeighbor.id,
      scatterSource.id,
    ]);
    expect(ticking.invaderShots[3]).toMatchObject({
      id: "invader-shot-5",
      kind: "splitter-fork",
      sourceInvaderId: leftNeighbor.id,
    });
    expect(ticking.invaderShots[4]).toMatchObject({
      id: "invader-shot-6",
      kind: "scatter",
      sourceInvaderId: scatterSource.id,
      velocityX: 0,
    });
    expect(ticking.nextInvaderShotId).toBe(7);
  });

});
