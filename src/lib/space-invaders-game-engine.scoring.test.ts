import { describe, expect, it } from "vitest";

import {
  advanceSpaceInvadersGame,
  createInitialSpaceInvadersGame,
  createPlayerShotAlignedWith,
  createRunningGame,
  fireSpaceInvadersShot,
  getInvader,
  SPACE_INVADERS_HIT_STREAK_BONUS_CAP,
  SPACE_INVADERS_HIT_STREAK_BONUS_STEP,
  SPACE_INVADERS_HIT_STREAK_POPUP_SCALE_CAP,
  SPACE_INVADERS_HIT_STREAK_POPUP_SCALE_STEP,
  SPACE_INVADERS_MULTI_KILL_BONUSES,
  SPACE_INVADERS_MULTI_KILL_COMBO_TICKS,
  SPACE_INVADERS_ROWS,
  SPACE_INVADERS_SCORE_POPUP_TICKS,
  SPACE_INVADERS_UFO_CHAIN_BONUS_CAP,
  SPACE_INVADERS_UFO_CHAIN_BONUS_STEP,
} from "./space-invaders-game-engine.test-helpers";

describe("space invaders scoring engine", () => {
  it("adds hit-streak bonus points after consecutive clean hits", () => {
    const game = createInitialSpaceInvadersGame();
    const targetInvader = getInvader(game, SPACE_INVADERS_ROWS - 1, 0);
    const runningGame = createRunningGame({
      hitStreak: 1,
      invaderShotCooldownTicks: 1_000,
      invaders: game.invaders,
      playerShots: [createPlayerShotAlignedWith(targetInvader)],
      score: 100,
    });
    const advanced = advanceSpaceInvadersGame(runningGame, () => 0.62);

    expect(SPACE_INVADERS_HIT_STREAK_BONUS_STEP).toBe(5);
    expect(SPACE_INVADERS_HIT_STREAK_BONUS_CAP).toBe(30);
    expect(SPACE_INVADERS_HIT_STREAK_POPUP_SCALE_STEP).toBe(0.08);
    expect(advanced.hitStreak).toBe(2);
    expect(advanced.score).toBe(
      100 + targetInvader.points + SPACE_INVADERS_HIT_STREAK_BONUS_STEP,
    );
    expect(advanced.scorePopups).toEqual([
      expect.objectContaining({
        points: targetInvader.points + SPACE_INVADERS_HIT_STREAK_BONUS_STEP,
        scoreScale: 1.08,
      }),
    ]);
    expect(advanced.scorePopups[0]).not.toHaveProperty("label");
  });


  it("caps hit-streak popup scale with the hit-streak bonus", () => {
    const game = createInitialSpaceInvadersGame();
    const targetInvader = getInvader(game, SPACE_INVADERS_ROWS - 1, 0);
    const runningGame = createRunningGame({
      hitStreak: 8,
      invaderShotCooldownTicks: 1_000,
      invaders: game.invaders,
      playerShots: [createPlayerShotAlignedWith(targetInvader)],
    });
    const advanced = advanceSpaceInvadersGame(runningGame, () => 0.62);

    expect(SPACE_INVADERS_HIT_STREAK_POPUP_SCALE_CAP).toBe(1.48);
    expect(advanced.hitStreak).toBe(9);
    expect(advanced.scorePopups).toEqual([
      expect.objectContaining({
        points: targetInvader.points + SPACE_INVADERS_HIT_STREAK_BONUS_CAP,
        scoreScale: SPACE_INVADERS_HIT_STREAK_POPUP_SCALE_CAP,
      }),
    ]);
    expect(advanced.scorePopups[0]).not.toHaveProperty("label");
  });


  it("resets hit streaks only when player shots leave the board without scoring", () => {
    const missedShot = fireSpaceInvadersShot(createRunningGame()).playerShots[0]!;
    const missed = advanceSpaceInvadersGame(
      createRunningGame({
        hitStreak: 4,
        invaderShotCooldownTicks: 1_000,
        playerShots: [
          {
            ...missedShot,
            y: -missedShot.height + missedShot.velocityY - 1,
          },
        ],
      }),
    );
    const scoredShot = fireSpaceInvadersShot(createRunningGame()).playerShots[0]!;
    const scoredThenExited = advanceSpaceInvadersGame(
      createRunningGame({
        hitStreak: 4,
        invaderShotCooldownTicks: 1_000,
        playerShots: [
          {
            ...scoredShot,
            hasScored: true,
            kind: "piercing",
            y: -scoredShot.height + scoredShot.velocityY - 1,
          },
        ],
      }),
    );

    expect(missed.playerShots).toEqual([]);
    expect(missed.hitStreak).toBe(0);
    expect(scoredThenExited.playerShots).toEqual([]);
    expect(scoredThenExited.hitStreak).toBe(4);
  });


  it("keeps hit streaks when a power-up volley scores after an early bullet exits", () => {
    const game = createInitialSpaceInvadersGame();
    const targetInvader = game.invaders.find((invader) => invader.kind === "standard")!;
    const fired = fireSpaceInvadersShot(
      createRunningGame({
        pendingShotPowerUp: "shotgun-shot",
      }),
    );
    const missedShot = fired.playerShots[0]!;
    const stillFlyingShot = fired.playerShots[1]!;
    const volleyWithEarlyMiss = advanceSpaceInvadersGame(
      createRunningGame({
        hitStreak: 4,
        invaderShotCooldownTicks: 1_000,
        invaders: game.invaders,
        playerShots: [
          {
            ...missedShot,
            y: -missedShot.height + missedShot.velocityY - 1,
          },
          {
            ...stillFlyingShot,
            x: 12,
            y: 300,
          },
        ],
      }),
      () => 0.62,
    );
    const scoringShot = {
      ...volleyWithEarlyMiss.playerShots[0]!,
      x: targetInvader.x + targetInvader.width / 2 - stillFlyingShot.width / 2,
      y: targetInvader.y + targetInvader.height + 2,
    };
    const scoredVolley = advanceSpaceInvadersGame(
      {
        ...volleyWithEarlyMiss,
        invaderShotCooldownTicks: 1_000,
        playerShots: [scoringShot],
      },
      () => 0.62,
    );

    expect(volleyWithEarlyMiss.hitStreak).toBe(4);
    expect(volleyWithEarlyMiss.playerVolleyHasScored).toBe(false);
    expect(volleyWithEarlyMiss.playerVolleyHasUnscoredExit).toBe(true);
    expect(scoredVolley.hitStreak).toBe(5);
    expect(scoredVolley.playerShots).toEqual([]);
    expect(scoredVolley.playerVolleyHasScored).toBe(false);
    expect(scoredVolley.playerVolleyHasUnscoredExit).toBe(false);
  });


  it("keeps piercing lasers active after clearing intersected invaders", () => {
    const game = createInitialSpaceInvadersGame();
    const firstTarget = {
      ...getInvader(game, SPACE_INVADERS_ROWS - 1, 4),
      kind: "standard" as const,
      x: 180,
      y: 220,
    };
    const secondTarget = {
      ...getInvader(game, SPACE_INVADERS_ROWS - 2, 4),
      kind: "standard" as const,
      x: firstTarget.x,
      y: firstTarget.y,
    };
    const remainingInvader = getInvader(game, 0, 0);
    const runningGame = createRunningGame({
      invaderShotCooldownTicks: 1_000,
      invaders: game.invaders.map((invader) => {
        if (invader.id === firstTarget.id) {
          return firstTarget;
        }

        if (invader.id === secondTarget.id) {
          return secondTarget;
        }

        return {
          ...invader,
          isActive: invader.id === remainingInvader.id,
        };
      }),
      playerShots: [
        {
          ...createPlayerShotAlignedWith(firstTarget),
          kind: "piercing",
        },
      ],
    });
    const advanced = advanceSpaceInvadersGame(runningGame, () => 0);

    expect(advanced.status).toBe("running");
    expect(advanced.playerShots).toHaveLength(1);
    expect(advanced.playerShots[0]).toMatchObject({
      kind: "piercing",
    });
    expect(
      advanced.invaders.find((invader) => invader.id === firstTarget.id)?.isActive,
    ).toBe(false);
    expect(
      advanced.invaders.find((invader) => invader.id === secondTarget.id)?.isActive,
    ).toBe(false);
    expect(
      advanced.invaders.find((invader) => invader.id === remainingInvader.id)?.isActive,
    ).toBe(true);
    expect(advanced.score).toBe(firstTarget.points + secondTarget.points);
    expect(advanced.multiKillCombo).toEqual(
      expect.objectContaining({
        destroyedCount: 2,
        points: firstTarget.points + secondTarget.points,
        ticksRemaining: SPACE_INVADERS_MULTI_KILL_COMBO_TICKS,
      }),
    );
    expect(advanced.scorePopups).toEqual([]);

    const finalized = advanceSpaceInvadersGame(
      {
        ...advanced,
        playerShots: [],
      },
      () => 0,
    );

    expect(finalized.score).toBe(
      firstTarget.points +
        secondTarget.points +
        SPACE_INVADERS_MULTI_KILL_BONUSES[2],
    );
    expect(finalized.multiKillCombo).toBeNull();
    expect(finalized.scorePopups).toEqual([
      expect.objectContaining({
        label: "DOUBLE",
        points:
          firstTarget.points +
          secondTarget.points +
          SPACE_INVADERS_MULTI_KILL_BONUSES[2],
      }),
    ]);
    expect(finalized.nextScorePopupId).toBe(1);
  });


  it("combines piercing-laser kills that land within the volley window", () => {
    const game = createInitialSpaceInvadersGame();
    const firstTarget = {
      ...getInvader(game, SPACE_INVADERS_ROWS - 1, 4),
      kind: "standard" as const,
      x: 180,
      y: 250,
    };
    const secondTarget = {
      ...getInvader(game, SPACE_INVADERS_ROWS - 2, 4),
      kind: "standard" as const,
      x: firstTarget.x,
      y: firstTarget.y - firstTarget.height - 14,
    };
    const remainingInvader = getInvader(game, 0, 0);
    const runningGame = createRunningGame({
      alienFreezeTicks: 100,
      invaderShotCooldownTicks: 1_000,
      invaders: game.invaders.map((invader) => {
        if (invader.id === firstTarget.id) {
          return firstTarget;
        }

        if (invader.id === secondTarget.id) {
          return secondTarget;
        }

        return {
          ...invader,
          isActive: invader.id === remainingInvader.id,
        };
      }),
      playerShots: [
        {
          ...createPlayerShotAlignedWith(firstTarget),
          kind: "piercing",
        },
      ],
    });
    const firstHit = advanceSpaceInvadersGame(runningGame, () => 0);
    let secondHit = firstHit;

    for (let tick = 0; tick < SPACE_INVADERS_MULTI_KILL_COMBO_TICKS; tick += 1) {
      secondHit = advanceSpaceInvadersGame(secondHit, () => 0);

      if (secondHit.multiKillCombo?.destroyedCount === 2) {
        break;
      }
    }

    expect(firstHit.multiKillCombo).toEqual(
      expect.objectContaining({
        destroyedCount: 1,
        points: firstTarget.points,
      }),
    );
    expect(
      secondHit.invaders.find((invader) => invader.id === firstTarget.id)?.isActive,
    ).toBe(false);
    expect(
      secondHit.invaders.find((invader) => invader.id === secondTarget.id)?.isActive,
    ).toBe(false);
    expect(secondHit.multiKillCombo).toEqual(
      expect.objectContaining({
        destroyedCount: 2,
        points: firstTarget.points + secondTarget.points,
        ticksRemaining: SPACE_INVADERS_MULTI_KILL_COMBO_TICKS,
      }),
    );
    expect(secondHit.score).toBe(firstTarget.points + secondTarget.points);
    expect(secondHit.scorePopups).toEqual([]);

    const finalized = advanceSpaceInvadersGame(
      {
        ...secondHit,
        playerShots: [],
      },
      () => 0,
    );

    expect(finalized.score).toBe(
      firstTarget.points +
        secondTarget.points +
        SPACE_INVADERS_MULTI_KILL_BONUSES[2],
    );
    expect(finalized.multiKillCombo).toBeNull();
    expect(finalized.scorePopups).toEqual([
      expect.objectContaining({
        label: "DOUBLE",
        points:
          firstTarget.points +
          secondTarget.points +
          SPACE_INVADERS_MULTI_KILL_BONUSES[2],
      }),
    ]);
  });


  it("uses the largest multi-kill bonus for four or more invaders in one volley", () => {
    const game = createInitialSpaceInvadersGame();
    const stackedTargets = [
      getInvader(game, 0, 0),
      getInvader(game, 1, 0),
      getInvader(game, 2, 0),
      getInvader(game, 3, 0),
    ].map((invader) => ({
      ...invader,
      isActive: true,
      kind: "standard" as const,
      x: 180,
      y: 220,
    }));
    const targetIds = new Set(stackedTargets.map((invader) => invader.id));
    const runningGame = createRunningGame({
      invaderShotCooldownTicks: 1_000,
      invaders: game.invaders.map((invader) => {
        const stackedTarget = stackedTargets.find((target) => target.id === invader.id);

        if (stackedTarget !== undefined) {
          return stackedTarget;
        }

        return {
          ...invader,
          isActive: invader.id === getInvader(game, SPACE_INVADERS_ROWS - 1, 10).id,
        };
      }),
      playerShots: [
        {
          ...createPlayerShotAlignedWith(stackedTargets[0]!),
          kind: "piercing",
        },
      ],
    });
    const advanced = advanceSpaceInvadersGame(runningGame, () => 0);
    const baseScore = stackedTargets.reduce((score, invader) => score + invader.points, 0);

    expect(SPACE_INVADERS_MULTI_KILL_BONUSES[4]).toBe(100);
    expect(advanced.status).toBe("running");
    expect(advanced.score).toBe(baseScore);
    expect(
      advanced.invaders
        .filter((invader) => targetIds.has(invader.id))
        .every((invader) => !invader.isActive),
    ).toBe(true);
    expect(advanced.multiKillCombo).toEqual(
      expect.objectContaining({
        destroyedCount: 4,
        points: baseScore,
        ticksRemaining: SPACE_INVADERS_MULTI_KILL_COMBO_TICKS,
      }),
    );
    expect(advanced.scorePopups).toEqual([]);

    const finalized = advanceSpaceInvadersGame(
      {
        ...advanced,
        playerShots: [],
      },
      () => 0,
    );

    expect(finalized.score).toBe(baseScore + SPACE_INVADERS_MULTI_KILL_BONUSES[4]);
    expect(finalized.multiKillCombo).toBeNull();
    expect(finalized.scorePopups).toEqual([
      expect.objectContaining({
        label: "MULTI",
        points: baseScore + SPACE_INVADERS_MULTI_KILL_BONUSES[4],
      }),
    ]);
  });


  it("awards the UFO bonus, clears the shot, and leaves invaders intact", () => {
    const game = createInitialSpaceInvadersGame();
    const activeUfo = {
      ...game.ufo,
      isActive: true,
      points: 100,
      x: 180,
    };
    const runningGame = createRunningGame({
      invaderShotCooldownTicks: 100,
      playerShots: [createPlayerShotAlignedWith(activeUfo)],
      score: 40,
      ufo: activeUfo,
    });
    const advanced = advanceSpaceInvadersGame(runningGame, () => 0.3);

    expect(advanced.score).toBe(140);
    expect(advanced.hitStreak).toBe(1);
    expect(advanced.ufoHitStreak).toBe(1);
    expect(advanced.playerShots).toEqual([]);
    expect(advanced.explosions).toHaveLength(1);
    expect(advanced.explosions[0]).toMatchObject({
      id: "explosion-0",
      kind: "ufo",
      ttlTicks: 12,
      variant: 2,
    });
    expect(advanced.explosions[0]!.x + advanced.explosions[0]!.width / 2).toBeCloseTo(
      activeUfo.x + activeUfo.width / 2,
    );
    expect(advanced.explosions[0]!.y + advanced.explosions[0]!.height / 2).toBeCloseTo(
      activeUfo.y + activeUfo.height / 2,
    );
    expect(advanced.scorePopups).toEqual([
      {
        ageTicks: 0,
        height: activeUfo.height,
        id: "score-popup-0",
        points: activeUfo.points,
        ttlTicks: SPACE_INVADERS_SCORE_POPUP_TICKS,
        width: activeUfo.width,
        x: activeUfo.x,
        y: activeUfo.y,
      },
    ]);
    expect(advanced.nextScorePopupId).toBe(1);
    expect(advanced.invaders.filter((invader) => invader.isActive)).toHaveLength(
      game.invaders.length,
    );
    expect(advanced.ufo).toMatchObject({
      direction: -1,
      isActive: false,
      points: 150,
      x: game.boardWidth,
    });
    expect(advanced.ufo.cooldownTicks).toBeGreaterThan(0);
  });


  it("adds UFO-chain bonus points after consecutive UFO hits", () => {
    const game = createInitialSpaceInvadersGame();
    const activeUfo = {
      ...game.ufo,
      isActive: true,
      points: 200,
      x: 180,
    };
    const runningGame = createRunningGame({
      invaderShotCooldownTicks: 100,
      playerShots: [createPlayerShotAlignedWith(activeUfo)],
      ufo: activeUfo,
      ufoHitStreak: 1,
    });
    const advanced = advanceSpaceInvadersGame(runningGame, () => 0.3);

    expect(SPACE_INVADERS_UFO_CHAIN_BONUS_STEP).toBe(50);
    expect(SPACE_INVADERS_UFO_CHAIN_BONUS_CAP).toBe(150);
    expect(advanced.ufoHitStreak).toBe(2);
    expect(advanced.score).toBe(
      activeUfo.points + SPACE_INVADERS_UFO_CHAIN_BONUS_STEP,
    );
    expect(advanced.scorePopups).toEqual([
      expect.objectContaining({
        label: "UFO CHAIN",
        points: activeUfo.points + SPACE_INVADERS_UFO_CHAIN_BONUS_STEP,
      }),
    ]);
  });


  it("caps UFO-chain bonus points after later consecutive UFO hits", () => {
    const game = createInitialSpaceInvadersGame();
    const activeUfo = {
      ...game.ufo,
      isActive: true,
      points: 300,
      x: 180,
    };
    const advanced = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShotCooldownTicks: 100,
        playerShots: [createPlayerShotAlignedWith(activeUfo)],
        ufo: activeUfo,
        ufoHitStreak: 4,
      }),
      () => 0.3,
    );

    expect(advanced.ufoHitStreak).toBe(5);
    expect(advanced.score).toBe(
      activeUfo.points + SPACE_INVADERS_UFO_CHAIN_BONUS_CAP,
    );
    expect(advanced.scorePopups).toEqual([
      expect.objectContaining({
        label: "UFO CHAIN",
        points: activeUfo.points + SPACE_INVADERS_UFO_CHAIN_BONUS_CAP,
      }),
    ]);
  });

});
