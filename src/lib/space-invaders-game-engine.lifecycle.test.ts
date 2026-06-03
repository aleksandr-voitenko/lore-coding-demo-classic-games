import { describe, expect, it } from "vitest";

import {
  advanceSpaceInvadersGame,
  createExplosionFixture,
  createInitialSpaceInvadersGame,
  createInvaderShotFixture,
  createPowerUpFixture,
  createRunningGame,
  createScorePopupFixture,
  getSpaceInvadersPlayerSpeed,
  getSpaceInvadersTickDelay,
  moveSpaceInvadersPlayer,
  pauseSpaceInvadersGame,
  SPACE_INVADERS_BOARD_WIDTH,
  SPACE_INVADERS_COLUMNS,
  SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
  SPACE_INVADERS_PLAYER_SHIELD_TICKS,
  SPACE_INVADERS_ROWS,
  SPACE_INVADERS_SCORE_POPUP_TICKS,
  SPACE_INVADERS_STARTING_LIVES,
  startSpaceInvadersGame,
} from "./space-invaders-game-engine.test-helpers";

describe("space invaders lifecycle engine", () => {
  it("starts, pauses, and resumes without replacing the formation", () => {
    const readyGame = createInitialSpaceInvadersGame();
    const runningGame = startSpaceInvadersGame(readyGame);
    const pausedGame = pauseSpaceInvadersGame(runningGame);
    const resumedGame = startSpaceInvadersGame(pausedGame);

    expect(runningGame.status).toBe("running");
    expect(pausedGame.status).toBe("paused");
    expect(resumedGame.status).toBe("running");
    expect(resumedGame.invaders).toBe(pausedGame.invaders);
  });


  it("moves the player within the side walls", () => {
    const readyGame = createInitialSpaceInvadersGame();
    const movedLeft = moveSpaceInvadersPlayer(readyGame, -1_000);
    const movedRight = moveSpaceInvadersPlayer(movedLeft, 1_000);

    expect(movedLeft.player.x).toBe(0);
    expect(movedRight.player.x).toBe(SPACE_INVADERS_BOARD_WIDTH - movedRight.player.width);
  });


  it("uses a smoother tick cadence with scaled per-tick movement", () => {
    const runningGame = createRunningGame();
    const firstInvader = runningGame.invaders[0]!;
    const advancedGame = advanceSpaceInvadersGame(runningGame);
    const movedInvader = advancedGame.invaders.find(
      (invader) => invader.id === firstInvader.id,
    );

    expect(getSpaceInvadersTickDelay()).toBe(34);
    expect(getSpaceInvadersPlayerSpeed()).toBeCloseTo(9.6);
    expect(movedInvader?.x).toBeCloseTo(firstInvader.x + 0.8);
  });


  it("respawns the player only after the explosion expires and then starts a shield", () => {
    const game = createInitialSpaceInvadersGame();
    let advanced = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShots: [
          createInvaderShotFixture({
            height: 20,
            velocityY: 8,
            width: 5,
            x: game.player.x + game.player.width / 2 - 2.5,
            y: game.player.y - 8,
          }),
        ],
      }),
      () => 0,
    );

    for (let tick = 1; tick < SPACE_INVADERS_PLAYER_RESPAWN_TICKS; tick += 1) {
      advanced = advanceSpaceInvadersGame(advanced, () => 0);

      expect(advanced.playerRespawnTicks).toBe(
        SPACE_INVADERS_PLAYER_RESPAWN_TICKS - tick,
      );
      expect(advanced.playerShieldTicks).toBe(0);
      expect(advanced.explosions).toHaveLength(1);
    }

    advanced = advanceSpaceInvadersGame(advanced, () => 0);

    expect(advanced.playerRespawnTicks).toBe(0);
    expect(advanced.playerShieldTicks).toBe(SPACE_INVADERS_PLAYER_SHIELD_TICKS);
    expect(advanced.explosions).toEqual([]);
  });


  it("absorbs player hits while the respawn shield is active", () => {
    const game = createInitialSpaceInvadersGame();
    const runningGame = createRunningGame({
      invaderShotCooldownTicks: 100,
      invaderShots: [
        createInvaderShotFixture({
          height: 20,
          velocityY: 8,
          width: 5,
          x: game.player.x + game.player.width / 2 - 2.5,
          y: game.player.y - 8,
        }),
      ],
      playerShieldTicks: SPACE_INVADERS_PLAYER_SHIELD_TICKS,
    });
    const advanced = advanceSpaceInvadersGame(runningGame, () => 0);

    expect(advanced.lives).toBe(SPACE_INVADERS_STARTING_LIVES);
    expect(advanced.invaderShots).toEqual([]);
    expect(advanced.explosions).toEqual([]);
    expect(advanced.playerRespawnTicks).toBe(0);
    expect(advanced.playerShieldTicks).toBe(SPACE_INVADERS_PLAYER_SHIELD_TICKS - 1);
  });


  it("loses the game when an invader shot hits the player's final life", () => {
    const game = createInitialSpaceInvadersGame();
    const runningGame = createRunningGame({
      invaderShots: [
        createInvaderShotFixture({
          height: 20,
          velocityY: 8,
          width: 5,
          x: game.player.x + game.player.width / 2 - 2.5,
          y: game.player.y - 8,
        }),
      ],
      lives: 1,
    });
    const advanced = advanceSpaceInvadersGame(runningGame, () => 0.99);

    expect(advanced.status).toBe("lost");
    expect(advanced.lives).toBe(0);
    expect(advanced.invaderShots).toEqual([]);
    expect(advanced.playerRespawnTicks).toBe(0);
    expect(advanced.playerShieldTicks).toBe(0);
    expect(advanced.explosions[0]).toMatchObject({
      id: "explosion-0",
      kind: "player",
      variant: 4,
    });
  });


  it("expires explosions on running ticks", () => {
    const expiredExplosion = createExplosionFixture({
      ageTicks: 11,
      id: "explosion-expiring",
      ttlTicks: 1,
    });
    const activeExplosion = createExplosionFixture({
      ageTicks: 4,
      id: "explosion-active",
      kind: "ufo",
      ttlTicks: 2,
    });
    const advanced = advanceSpaceInvadersGame(
      createRunningGame({
        explosions: [expiredExplosion, activeExplosion],
        invaderShotCooldownTicks: 1_000,
        nextExplosionId: 4,
      }),
    );

    expect(advanced.explosions).toEqual([
      {
        ...activeExplosion,
        ageTicks: 5,
        ttlTicks: 1,
      },
    ]);
    expect(advanced.nextExplosionId).toBe(4);
  });


  it("expires score popups after the shortened feedback window", () => {
    const expiredPopup = createScorePopupFixture({
      ageTicks: SPACE_INVADERS_SCORE_POPUP_TICKS - 1,
      id: "score-popup-expiring",
      ttlTicks: 1,
    });
    const activePopup = createScorePopupFixture({
      ageTicks: 12,
      id: "score-popup-active",
      points: 20,
      ttlTicks: 2,
    });
    const advanced = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShotCooldownTicks: 1_000,
        nextScorePopupId: 4,
        scorePopups: [expiredPopup, activePopup],
      }),
    );

    expect(SPACE_INVADERS_SCORE_POPUP_TICKS).toBe(47);
    expect(advanced.scorePopups).toEqual([
      {
        ...activePopup,
        ageTicks: 13,
        ttlTicks: 1,
      },
    ]);
    expect(advanced.nextScorePopupId).toBe(4);
  });


  it("restarts from game over with a fresh running formation", () => {
    const lostGame = {
      ...createInitialSpaceInvadersGame(),
      invaders: [],
      explosions: [createExplosionFixture()],
      hitStreak: 4,
      invaderShotCooldownTicks: 0,
      invaderShots: [createInvaderShotFixture()],
      lives: 0,
      multiKillCombo: {
        destroyedCount: 2,
        height: 23,
        points: 50,
        ticksRemaining: 4,
        width: 60,
        x: 120,
        y: 80,
      },
      nextExplosionId: 1,
      nextInvaderShotId: 1,
      nextPlayerShotId: 1,
      nextPowerUpId: 1,
      nextScorePopupId: 1,
      pendingShotPowerUp: "shotgun-shot" as const,
      playerBurst: {
        cooldownTicks: 2,
        remainingShots: 4,
      },
      playerVolleyHasArmoredHit: true,
      playerShots: [
        {
          height: 14,
          id: "player-shot-test",
          kind: "standard" as const,
          velocityX: 0,
          velocityY: -16,
          width: 4,
          x: 10,
          y: 10,
        },
      ],
      powerUps: [createPowerUpFixture()],
      score: 120,
      scorePopups: [createScorePopupFixture()],
      status: "lost" as const,
      ufo: {
        ...createInitialSpaceInvadersGame().ufo,
        cooldownTicks: 0,
        direction: -1 as const,
        isActive: true,
        points: 200,
        x: 100,
      },
      ufoHitStreak: 3,
    };
    const restarted = startSpaceInvadersGame(lostGame);

    expect(restarted.status).toBe("running");
    expect(restarted.score).toBe(0);
    expect(restarted.lives).toBe(SPACE_INVADERS_STARTING_LIVES);
    expect(restarted.alienFreezeTicks).toBe(0);
    expect(restarted.explosions).toEqual([]);
    expect(restarted.hitStreak).toBe(0);
    expect(restarted.multiKillCombo).toBeNull();
    expect(restarted.nextExplosionId).toBe(0);
    expect(restarted.invaderShots).toEqual([]);
    expect(restarted.nextPlayerShotId).toBe(0);
    expect(restarted.nextPowerUpId).toBe(0);
    expect(restarted.nextScorePopupId).toBe(0);
    expect(restarted.pendingShotPowerUp).toBeNull();
    expect(restarted.playerBurst).toBeNull();
    expect(restarted.playerRespawnTicks).toBe(0);
    expect(restarted.playerShieldTicks).toBe(0);
    expect(restarted.playerVolleyHasArmoredHit).toBe(false);
    expect(restarted.playerShots).toEqual([]);
    expect(restarted.playerVolleyHasScored).toBe(false);
    expect(restarted.playerVolleyHasUnscoredExit).toBe(false);
    expect(restarted.powerUps).toEqual([]);
    expect(restarted.scorePopups).toEqual([]);
    expect(restarted.ufoHitStreak).toBe(0);
    expect(restarted.ufo).toMatchObject({
      direction: 1,
      isActive: false,
      points: 100,
      x: -48,
    });
    expect(restarted.ufo.cooldownTicks).toBeGreaterThan(0);
    expect(restarted.invaders).toHaveLength(SPACE_INVADERS_COLUMNS * SPACE_INVADERS_ROWS);
    expect(restarted.invaders.every((invader) => invader.isActive)).toBe(true);
  });
});
