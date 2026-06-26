import { describe, expect, it } from "vitest";

import {
  advanceSpaceInvadersGame,
  createCatchablePowerUp,
  createInitialSpaceInvadersGame,
  createPlayerShotAlignedWith,
  createPowerUpFixture,
  createRandomSequence,
  createRunningGame,
  getInvader,
  SPACE_INVADERS_ALIEN_FREEZE_TICKS,
  SPACE_INVADERS_BONUS_SCORE_POINTS,
  SPACE_INVADERS_EXTRA_LIFE_DROP_CHANCE,
  SPACE_INVADERS_POWER_UP_SHIELD_TICKS,
  SPACE_INVADERS_POWER_UP_SIZE,
  SPACE_INVADERS_POWER_UP_SPEED,
  SPACE_INVADERS_ROWS,
  SPACE_INVADERS_SCORE_POPUP_TICKS,
  SPACE_INVADERS_STARTING_LIVES,
} from "./space-invaders-game-engine.test-helpers";
import { advanceSpaceInvadersPlayerPowerUps } from "./space-invaders/player-state";

describe("space invaders power-up and ufo engine", () => {
  it("keeps falling power-ups slower than player lasers", () => {
    const powerUp = createPowerUpFixture();

    expect(SPACE_INVADERS_POWER_UP_SPEED).toBeCloseTo(4.8);
    expect(powerUp.velocityY).toBeCloseTo(SPACE_INVADERS_POWER_UP_SPEED);
  });


  it("spawns UFO bonuses from alternating sides after their cooldown", () => {
    const game = createInitialSpaceInvadersGame();
    const spawned = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShotCooldownTicks: 100,
        ufo: {
          ...game.ufo,
          cooldownTicks: 0,
        },
      }),
    );
    const moved = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShotCooldownTicks: 100,
        ufo: spawned.ufo,
      }),
    );
    const exitedRight = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShotCooldownTicks: 100,
        ufo: {
          ...game.ufo,
          isActive: true,
          x: game.boardWidth - 1,
        },
        ufoHitStreak: 2,
      }),
    );
    const respawnedFromRight = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShotCooldownTicks: 100,
        ufo: {
          ...exitedRight.ufo,
          cooldownTicks: 0,
        },
      }),
    );

    expect(spawned.ufo).toMatchObject({
      direction: 1,
      isActive: true,
      points: 100,
      x: -game.ufo.width,
      y: 34,
    });
    expect(moved.ufo.x).toBeCloseTo(spawned.ufo.x + 2.4);
    expect(exitedRight.ufo).toMatchObject({
      direction: -1,
      isActive: false,
      points: 150,
      x: game.boardWidth,
    });
    expect(exitedRight.ufoHitStreak).toBe(0);
    expect(exitedRight.ufo.cooldownTicks).toBeGreaterThan(0);
    expect(respawnedFromRight.ufo).toMatchObject({
      direction: -1,
      isActive: true,
      points: 150,
      x: game.boardWidth,
    });
  });


  it("drops a random power-up from destroyed diver invaders only", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const diverInvader = game.invaders.find((invader) => invader.kind === "diver")!;
    const standardInvader = getInvader(game, SPACE_INVADERS_ROWS - 1, 0);
    const diverDestroyed = advanceSpaceInvadersGame(
      createRunningGame({
        invaders: game.invaders,
        playerShots: [createPlayerShotAlignedWith(diverInvader)],
      }),
      () => 0.99,
    );
    const standardDestroyed = advanceSpaceInvadersGame(
      createRunningGame({
        invaders: game.invaders,
        playerShots: [createPlayerShotAlignedWith(standardInvader)],
      }),
      () => 0,
    );

    expect(diverDestroyed.powerUps).toHaveLength(1);
    expect(diverDestroyed.powerUps[0]).toMatchObject({
      height: SPACE_INVADERS_POWER_UP_SIZE,
      id: "power-up-0",
      kind: "shotgun-shot",
      velocityY: SPACE_INVADERS_POWER_UP_SPEED,
      width: SPACE_INVADERS_POWER_UP_SIZE,
    });
    expect(diverDestroyed.powerUps[0]!.x + diverDestroyed.powerUps[0]!.width / 2).toBeCloseTo(
      diverInvader.x + diverInvader.width / 2,
    );
    expect(diverDestroyed.powerUps[0]!.y + diverDestroyed.powerUps[0]!.height / 2).toBeCloseTo(
      diverInvader.y + diverInvader.height / 2,
    );
    expect(diverDestroyed.nextPowerUpId).toBe(1);
    expect(standardDestroyed.powerUps).toEqual([]);
  });


  it("uses a five percent drop chance for extra-life power-ups", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const diverInvader = game.invaders.find((invader) => invader.kind === "diver")!;
    const extraLifeDestroyed = advanceSpaceInvadersGame(
      createRunningGame({
        invaders: game.invaders,
        playerShots: [createPlayerShotAlignedWith(diverInvader)],
      }),
      createRandomSequence([0, SPACE_INVADERS_EXTRA_LIFE_DROP_CHANCE - 0.001]),
    );
    const commonDestroyed = advanceSpaceInvadersGame(
      createRunningGame({
        invaders: game.invaders,
        playerShots: [createPlayerShotAlignedWith(diverInvader)],
      }),
      createRandomSequence([0, SPACE_INVADERS_EXTRA_LIFE_DROP_CHANCE]),
    );

    expect(extraLifeDestroyed.powerUps[0]).toMatchObject({
      kind: "extra-life",
    });
    expect(commonDestroyed.powerUps[0]?.kind).not.toBe("extra-life");
  });


  it("awards caught bonus-score power-ups and removes expired drops", () => {
    const game = createInitialSpaceInvadersGame();
    const catchableBonus = createCatchablePowerUp(game, { kind: "bonus-score" });
    const caught = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShotCooldownTicks: 1_000,
        powerUps: [catchableBonus],
        score: 40,
      }),
    );
    const expired = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShotCooldownTicks: 1_000,
        powerUps: [
          createPowerUpFixture({
            y: game.boardHeight + 1,
          }),
        ],
      }),
    );

    expect(caught.score).toBe(40 + SPACE_INVADERS_BONUS_SCORE_POINTS);
    expect(caught.powerUps).toEqual([]);
    expect(caught.scorePopups).toEqual([
      {
        ageTicks: 0,
        height: catchableBonus.height,
        id: "score-popup-0",
        points: SPACE_INVADERS_BONUS_SCORE_POINTS,
        ttlTicks: SPACE_INVADERS_SCORE_POPUP_TICKS,
        width: catchableBonus.width,
        x: catchableBonus.x,
        y: catchableBonus.y + catchableBonus.velocityY,
      },
    ]);
    expect(caught.nextScorePopupId).toBe(1);
    expect(expired.powerUps).toEqual([]);
  });


  it("awards caught extra-life power-ups", () => {
    const game = createInitialSpaceInvadersGame();
    const caught = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShotCooldownTicks: 1_000,
        lives: SPACE_INVADERS_STARTING_LIVES,
        powerUps: [createCatchablePowerUp(game, { kind: "extra-life" })],
      }),
    );

    expect(caught.lives).toBe(SPACE_INVADERS_STARTING_LIVES + 1);
    expect(caught.powerUps).toEqual([]);
  });


  it("keeps catchable power-ups falling while the singleton player respawns", () => {
    const game = createInitialSpaceInvadersGame();
    const catchableFreeze = createCatchablePowerUp(game, { kind: "freeze" });
    const advanced = advanceSpaceInvadersPlayerPowerUps(
      createRunningGame({
        powerUps: [catchableFreeze],
        playerRespawnTicks: 2,
      }),
    );

    expect(advanced.alienFreezeTicks).toBe(0);
    expect(advanced.powerUps).toEqual([
      {
        ...catchableFreeze,
        y: catchableFreeze.y + catchableFreeze.velocityY,
      },
    ]);
  });


  it("freezes aliens after catching a freeze power-up", () => {
    const game = createInitialSpaceInvadersGame();
    const firstInvader = game.invaders[0]!;
    const activeUfo = {
      ...game.ufo,
      isActive: true,
      x: 120,
    };
    const frozen = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShotCooldownTicks: 0,
        powerUps: [createCatchablePowerUp(game, { kind: "freeze" })],
        ufo: activeUfo,
      }),
    );
    const frozenInvader = frozen.invaders.find((invader) => invader.id === firstInvader.id);

    expect(frozen.alienFreezeTicks).toBe(SPACE_INVADERS_ALIEN_FREEZE_TICKS - 1);
    expect(frozenInvader?.x).toBe(firstInvader.x);
    expect(frozen.invaderShotCooldownTicks).toBe(0);
    expect(frozen.invaderShots).toEqual([]);
    expect(frozen.ufo.x).toBe(activeUfo.x);
  });


  it("grants a ten-second shield after catching a shield power-up", () => {
    const game = createInitialSpaceInvadersGame();
    const shielded = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShotCooldownTicks: 1_000,
        playerShieldTicks: 1,
        powerUps: [createCatchablePowerUp(game, { kind: "shield" })],
      }),
    );

    expect(shielded.powerUps).toEqual([]);
    expect(shielded.playerShieldTicks).toBe(SPACE_INVADERS_POWER_UP_SHIELD_TICKS - 1);
  });

});
