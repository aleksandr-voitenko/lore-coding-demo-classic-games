import { describe, expect, it } from "vitest";

import {
  advanceSpaceInvadersGame,
  createInitialSpaceInvadersGame,
  fireSpaceInvadersShot,
  getSpaceInvadersPlayerSpeed,
  getSpaceInvadersTickDelay,
  isSpaceInvaderShielded,
  moveSpaceInvadersPlayer,
  pauseSpaceInvadersGame,
  restartSpaceInvadersGame,
  SPACE_INVADERS_ALIEN_FREEZE_TICKS,
  SPACE_INVADERS_BASE_Y,
  SPACE_INVADERS_BONUS_SCORE_POINTS,
  SPACE_INVADERS_BOARD_WIDTH,
  SPACE_INVADERS_COLUMNS,
  SPACE_INVADERS_EXTRA_LIFE_DROP_CHANCE,
  SPACE_INVADERS_HIT_STREAK_BONUS_CAP,
  SPACE_INVADERS_HIT_STREAK_BONUS_STEP,
  SPACE_INVADERS_HIT_STREAK_POPUP_SCALE_CAP,
  SPACE_INVADERS_HIT_STREAK_POPUP_SCALE_STEP,
  SPACE_INVADERS_MULTI_KILL_BONUSES,
  SPACE_INVADERS_MULTI_KILL_COMBO_TICKS,
  SPACE_INVADERS_PLAYER_BURST_SHOT_COUNT,
  SPACE_INVADERS_PLAYER_BURST_SHOT_DELAY_TICKS,
  SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
  SPACE_INVADERS_PLAYER_SHIELD_TICKS,
  SPACE_INVADERS_POWER_UP_SHIELD_TICKS,
  SPACE_INVADERS_POWER_UP_SIZE,
  SPACE_INVADERS_POWER_UP_SPEED,
  SPACE_INVADERS_ROWS,
  SPACE_INVADERS_SCORE_POPUP_TICKS,
  SPACE_INVADERS_REVENGE_ALIEN_COUNT,
  SPACE_INVADERS_SHIELD_BEARER_COUNT,
  SPACE_INVADERS_STARTING_LIVES,
  SPACE_INVADERS_UFO_CHAIN_BONUS_CAP,
  SPACE_INVADERS_UFO_CHAIN_BONUS_STEP,
  startSpaceInvadersGame,
  type SpaceInvader,
  type SpaceInvadersExplosion,
  type SpaceInvadersGameState,
  type SpaceInvadersInvaderShot,
  type SpaceInvadersPowerUp,
  type SpaceInvadersScorePopup,
} from "./space-invaders-game-engine";

function createRunningGame(
  overrides: Partial<SpaceInvadersGameState> = {},
): SpaceInvadersGameState {
  return {
    ...createInitialSpaceInvadersGame({ random: () => 0 }),
    status: "running",
    ...overrides,
  };
}

function getDiverIds(game: SpaceInvadersGameState) {
  return game.invaders
    .filter((invader) => invader.kind === "diver")
    .map((invader) => invader.id);
}

function getShieldBearerIds(game: SpaceInvadersGameState) {
  return game.invaders
    .filter((invader) => invader.kind === "shield-bearer")
    .map((invader) => invader.id);
}

function getRevengeAlienIds(game: SpaceInvadersGameState) {
  return game.invaders
    .filter((invader) => invader.kind === "revenge")
    .map((invader) => invader.id);
}

function withOnlyActiveInvader(game: SpaceInvadersGameState, activeInvader: SpaceInvader) {
  return {
    ...game,
    invaders: game.invaders.map((invader) => ({
      ...invader,
      isActive: invader.id === activeInvader.id,
    })),
  };
}

function createInvaderShotFixture(
  overrides: Partial<SpaceInvadersInvaderShot> = {},
): SpaceInvadersInvaderShot {
  return {
    ageTicks: 0,
    height: 20,
    id: "invader-shot-test",
    kind: "standard",
    sourceColumn: 0,
    sourceInvaderId: "4:0",
    sourceRow: 4,
    ttlTicks: null,
    velocityX: 0,
    velocityY: 3.2,
    width: 5,
    x: 100,
    y: 100,
    ...overrides,
  };
}

function createExplosionFixture(
  overrides: Partial<SpaceInvadersExplosion> = {},
): SpaceInvadersExplosion {
  return {
    ageTicks: 0,
    height: 46,
    id: "explosion-test",
    kind: "invader",
    ttlTicks: 12,
    variant: 1,
    width: 46,
    x: 100,
    y: 100,
    ...overrides,
  };
}

function createScorePopupFixture(
  overrides: Partial<SpaceInvadersScorePopup> = {},
): SpaceInvadersScorePopup {
  return {
    ageTicks: 0,
    height: 22,
    id: "score-popup-test",
    points: 30,
    ttlTicks: SPACE_INVADERS_SCORE_POPUP_TICKS,
    width: 32,
    x: 100,
    y: 100,
    ...overrides,
  };
}

function createPowerUpFixture(
  overrides: Partial<SpaceInvadersPowerUp> = {},
): SpaceInvadersPowerUp {
  return {
    height: SPACE_INVADERS_POWER_UP_SIZE,
    id: "power-up-test",
    kind: "bonus-score",
    velocityY: SPACE_INVADERS_POWER_UP_SPEED,
    width: SPACE_INVADERS_POWER_UP_SIZE,
    x: 100,
    y: 100,
    ...overrides,
  };
}

function createRandomSequence(values: number[]): () => number {
  let index = 0;

  return () => {
    const value = values[index] ?? values[values.length - 1] ?? 0;
    index += 1;
    return value;
  };
}

function createCatchablePowerUp(
  game: SpaceInvadersGameState,
  overrides: Partial<SpaceInvadersPowerUp> = {},
): SpaceInvadersPowerUp {
  const width = overrides.width ?? 18;

  return createPowerUpFixture({
    x: game.player.x + game.player.width / 2 - width / 2,
    y: game.player.y - SPACE_INVADERS_POWER_UP_SPEED,
    width,
    ...overrides,
  });
}

function getInvader(
  game: SpaceInvadersGameState,
  row: number,
  column: number,
): SpaceInvader {
  const invader = game.invaders.find(
    (candidate) => candidate.row === row && candidate.column === column,
  );

  if (invader === undefined) {
    throw new Error(`Missing invader at row ${row}, column ${column}`);
  }

  return invader;
}

function centerPlayerUnderInvader(game: SpaceInvadersGameState, invader: SpaceInvader) {
  return {
    ...game.player,
    x: invader.x + invader.width / 2 - game.player.width / 2,
  };
}

function createPlayerShotAlignedWith(
  target: { height: number; width: number; x: number; y: number },
  game = createRunningGame(),
) {
  const shot = fireSpaceInvadersShot(game).playerShots[0]!;

  return {
    ...shot,
    x: target.x + target.width / 2 - shot.width / 2,
    y: target.y + target.height + 2,
  };
}

function fireFromOnlyInvader(row: number, column = 5) {
  const game = createInitialSpaceInvadersGame();
  const shooter = getInvader(game, row, column);
  const runningGame = withOnlyActiveInvader(
    createRunningGame({
      invaderShotCooldownTicks: 0,
      player: centerPlayerUnderInvader(game, shooter),
    }),
    shooter,
  );

  return {
    advanced: advanceSpaceInvadersGame(runningGame),
    shooter,
  };
}

function advanceSpaceInvadersTicks(game: SpaceInvadersGameState, ticks: number) {
  let advanced = game;

  for (let tick = 0; tick < ticks; tick += 1) {
    advanced = advanceSpaceInvadersGame(advanced, () => 0);
  }

  return advanced;
}

describe("space invaders game engine", () => {
  it("creates a ready formation with a centered player cannon", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const diverInvaders = game.invaders.filter((invader) => invader.kind === "diver");
    const shieldBearerInvaders = game.invaders.filter(
      (invader) => invader.kind === "shield-bearer",
    );
    const revengeAlienInvaders = game.invaders.filter(
      (invader) => invader.kind === "revenge",
    );
    const bottomRowInvaders = game.invaders.filter(
      (invader) => invader.row === SPACE_INVADERS_ROWS - 1,
    );

    expect(game.status).toBe("ready");
    expect(game.score).toBe(0);
    expect(game.lives).toBe(SPACE_INVADERS_STARTING_LIVES);
    expect(game.player.height).toBe(40);
    expect(game.player.width).toBeCloseTo(49.6);
    expect(game.player.x + game.player.width / 2).toBe(SPACE_INVADERS_BOARD_WIDTH / 2);
    expect(game.alienFreezeTicks).toBe(0);
    expect(game.explosions).toEqual([]);
    expect(game.hitStreak).toBe(0);
    expect(game.invaderBurst).toBeNull();
    expect(game.invaderShots).toEqual([]);
    expect(game.invaderShotCooldownTicks).toBeGreaterThan(0);
    expect(game.nextExplosionId).toBe(0);
    expect(game.nextInvaderShotId).toBe(0);
    expect(game.nextPlayerShotId).toBe(0);
    expect(game.nextPowerUpId).toBe(0);
    expect(game.nextScorePopupId).toBe(0);
    expect(game.multiKillCombo).toBeNull();
    expect(game.pendingShotPowerUp).toBeNull();
    expect(game.playerBurst).toBeNull();
    expect(game.playerRespawnTicks).toBe(0);
    expect(game.playerShieldTicks).toBe(0);
    expect(game.playerShots).toEqual([]);
    expect(game.playerVolleyHasScored).toBe(false);
    expect(game.playerVolleyHasUnscoredExit).toBe(false);
    expect(game.powerUps).toEqual([]);
    expect(game.scorePopups).toEqual([]);
    expect(game.marchDirection).toBe(1);
    expect(game.ufoHitStreak).toBe(0);
    expect(game.invaders.every((invader) => invader.direction === 1)).toBe(true);
    expect(game.ufo).toMatchObject({
      direction: 1,
      height: 18,
      isActive: false,
      points: 100,
      width: 48,
      x: -48,
      y: 34,
    });
    expect(game.ufo.cooldownTicks).toBeGreaterThan(0);
    expect(game.invaders).toHaveLength(SPACE_INVADERS_COLUMNS * SPACE_INVADERS_ROWS);
    expect(game.invaders.every((invader) => invader.isActive)).toBe(true);
    expect(diverInvaders).toHaveLength(10);
    expect(diverInvaders.every((invader) => invader.row < SPACE_INVADERS_ROWS - 1)).toBe(true);
    expect(shieldBearerInvaders).toHaveLength(SPACE_INVADERS_SHIELD_BEARER_COUNT);
    expect(revengeAlienInvaders).toHaveLength(SPACE_INVADERS_REVENGE_ALIEN_COUNT);
    expect(
      shieldBearerInvaders.every(
        (invader) => invader.row > 0 && invader.row < SPACE_INVADERS_ROWS - 1,
      ),
    ).toBe(true);
    expect(
      revengeAlienInvaders.every(
        (invader) => invader.row > 0 && invader.row < SPACE_INVADERS_ROWS - 1,
      ),
    ).toBe(true);
    expect(
      shieldBearerInvaders.every(
        (invader) =>
          !diverInvaders.some((diverInvader) => diverInvader.id === invader.id),
      ),
    ).toBe(true);
    expect(
      revengeAlienInvaders.every(
        (invader) =>
          !diverInvaders.some((diverInvader) => diverInvader.id === invader.id) &&
          !shieldBearerInvaders.some(
            (shieldBearerInvader) => shieldBearerInvader.id === invader.id,
          ),
      ),
    ).toBe(true);
    expect(bottomRowInvaders.every((invader) => invader.kind === "standard")).toBe(true);
    expect(game.invaders[0]).toMatchObject({
      column: 0,
      kind: "diver",
      points: 30,
      row: 0,
    });
    expect(getInvader(game, 0, 9)).toMatchObject({
      kind: "diver",
      points: 30,
    });
    expect(getInvader(game, 0, 10)).toMatchObject({
      kind: "standard",
      points: 30,
    });
    expect(getInvader(game, 1, 0)).toMatchObject({
      kind: "shield-bearer",
      points: 20,
    });
    expect(isSpaceInvaderShielded(getInvader(game, 1, 4), game.invaders)).toBe(true);
    expect(getInvader(game, 1, 5)).toMatchObject({
      kind: "revenge",
      points: 20,
    });
    expect(game.invaders.at(-1)).toMatchObject({
      column: SPACE_INVADERS_COLUMNS - 1,
      kind: "standard",
      points: 10,
      row: SPACE_INVADERS_ROWS - 1,
    });
  });

  it("uses the random source to choose divers and shield bearers from safe rows", () => {
    const firstSelection = createInitialSpaceInvadersGame({ random: () => 0 });
    const lastSelection = createInitialSpaceInvadersGame({ random: () => 1 });
    const firstDiverIds = getDiverIds(firstSelection);
    const lastDiverIds = getDiverIds(lastSelection);
    const firstShieldBearerIds = getShieldBearerIds(firstSelection);
    const lastShieldBearerIds = getShieldBearerIds(lastSelection);
    const firstRevengeAlienIds = getRevengeAlienIds(firstSelection);
    const lastRevengeAlienIds = getRevengeAlienIds(lastSelection);
    const firstDivers = firstSelection.invaders.filter((invader) => invader.kind === "diver");
    const lastDivers = lastSelection.invaders.filter((invader) => invader.kind === "diver");
    const firstShieldBearers = firstSelection.invaders.filter(
      (invader) => invader.kind === "shield-bearer",
    );
    const lastShieldBearers = lastSelection.invaders.filter(
      (invader) => invader.kind === "shield-bearer",
    );
    const firstRevengeAliens = firstSelection.invaders.filter(
      (invader) => invader.kind === "revenge",
    );
    const lastRevengeAliens = lastSelection.invaders.filter(
      (invader) => invader.kind === "revenge",
    );
    const firstBottomRowInvaders = firstSelection.invaders.filter(
      (invader) => invader.row === SPACE_INVADERS_ROWS - 1,
    );
    const lastBottomRowInvaders = lastSelection.invaders.filter(
      (invader) => invader.row === SPACE_INVADERS_ROWS - 1,
    );

    expect(firstDiverIds).toHaveLength(10);
    expect(lastDiverIds).toHaveLength(10);
    expect(firstShieldBearerIds).toHaveLength(SPACE_INVADERS_SHIELD_BEARER_COUNT);
    expect(lastShieldBearerIds).toHaveLength(SPACE_INVADERS_SHIELD_BEARER_COUNT);
    expect(firstRevengeAlienIds).toHaveLength(SPACE_INVADERS_REVENGE_ALIEN_COUNT);
    expect(lastRevengeAlienIds).toHaveLength(SPACE_INVADERS_REVENGE_ALIEN_COUNT);
    expect(firstDiverIds).not.toEqual(lastDiverIds);
    expect(firstShieldBearerIds).not.toEqual(lastShieldBearerIds);
    expect(firstRevengeAlienIds).not.toEqual(lastRevengeAlienIds);
    expect(firstDivers.every((invader) => invader.row < SPACE_INVADERS_ROWS - 1)).toBe(true);
    expect(lastDivers.every((invader) => invader.row < SPACE_INVADERS_ROWS - 1)).toBe(true);
    expect(
      firstShieldBearers.every(
        (invader) => invader.row > 0 && invader.row < SPACE_INVADERS_ROWS - 1,
      ),
    ).toBe(true);
    expect(
      lastShieldBearers.every(
        (invader) => invader.row > 0 && invader.row < SPACE_INVADERS_ROWS - 1,
      ),
    ).toBe(true);
    expect(
      firstRevengeAliens.every(
        (invader) => invader.row > 0 && invader.row < SPACE_INVADERS_ROWS - 1,
      ),
    ).toBe(true);
    expect(
      lastRevengeAliens.every(
        (invader) => invader.row > 0 && invader.row < SPACE_INVADERS_ROWS - 1,
      ),
    ).toBe(true);
    expect(firstShieldBearerIds.every((id) => !firstDiverIds.includes(id))).toBe(true);
    expect(lastShieldBearerIds.every((id) => !lastDiverIds.includes(id))).toBe(true);
    expect(
      firstRevengeAlienIds.every(
        (id) => !firstDiverIds.includes(id) && !firstShieldBearerIds.includes(id),
      ),
    ).toBe(true);
    expect(
      lastRevengeAlienIds.every(
        (id) => !lastDiverIds.includes(id) && !lastShieldBearerIds.includes(id),
      ),
    ).toBe(true);
    expect(firstBottomRowInvaders.every((invader) => invader.kind === "standard")).toBe(true);
    expect(lastBottomRowInvaders.every((invader) => invader.kind === "standard")).toBe(true);
  });

  it("creates configurable board sizes and alien counts", () => {
    const game = createInitialSpaceInvadersGame({
      alienCount: 24,
      boardHeight: 640,
      boardWidth: 480,
    });
    const restarted = restartSpaceInvadersGame(game);
    const expectedSmallPresetRevengeAlienCount = 2;

    expect(game.alienCount).toBe(24);
    expect(game.boardHeight).toBe(640);
    expect(game.boardWidth).toBe(480);
    expect(game.baseY).toBe(572);
    expect(game.invaders).toHaveLength(24);
    expect(game.invaders.filter((invader) => invader.kind === "diver")).toHaveLength(10);
    expect(game.invaders.filter((invader) => invader.kind === "shield-bearer")).toHaveLength(
      SPACE_INVADERS_SHIELD_BEARER_COUNT,
    );
    expect(game.invaders.filter((invader) => invader.kind === "revenge")).toHaveLength(
      expectedSmallPresetRevengeAlienCount,
    );
    expect(game.player.x + game.player.width / 2).toBe(240);
    expect(restarted.alienCount).toBe(24);
    expect(restarted.boardHeight).toBe(640);
    expect(restarted.boardWidth).toBe(480);
    expect(restarted.invaders).toHaveLength(24);
    expect(restarted.invaders.filter((invader) => invader.kind === "diver")).toHaveLength(10);
    expect(
      restarted.invaders.filter((invader) => invader.kind === "shield-bearer"),
    ).toHaveLength(SPACE_INVADERS_SHIELD_BEARER_COUNT);
    expect(restarted.invaders.filter((invader) => invader.kind === "revenge")).toHaveLength(
      expectedSmallPresetRevengeAlienCount,
    );
    expect(restarted.status).toBe("running");
  });

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

  it("keeps falling power-ups slower than player lasers", () => {
    const powerUp = createPowerUpFixture();

    expect(SPACE_INVADERS_POWER_UP_SPEED).toBeCloseTo(4.8);
    expect(powerUp.velocityY).toBeCloseTo(SPACE_INVADERS_POWER_UP_SPEED);
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
    const game = createInitialSpaceInvadersGame();
    const bottomInvader = getInvader(game, SPACE_INVADERS_ROWS - 1, 5);
    const nextShooter = getInvader(game, SPACE_INVADERS_ROWS - 2, bottomInvader.column);
    const runningGame = createRunningGame({
      invaderShotCooldownTicks: 0,
      invaders: game.invaders.map((invader) =>
        invader.id === bottomInvader.id ? { ...invader, isActive: false } : invader,
      ),
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

  it("assigns each invader row its own shot variant and cooldown", () => {
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

  it("absorbs normal hits against aliens protected by an active shield bearer", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const shieldBearer = getInvader(game, 1, 3);
    const protectedInvader = getInvader(game, 1, 4);
    const runningGame = createRunningGame({
      hitStreak: 3,
      invaderShotCooldownTicks: 1_000,
      invaders: game.invaders.map((invader) => ({
        ...invader,
        isActive: invader.id === shieldBearer.id || invader.id === protectedInvader.id,
      })),
      playerShots: [createPlayerShotAlignedWith(protectedInvader)],
    });
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
    expect(advanced.explosions).toEqual([]);
    expect(advanced.scorePopups).toEqual([]);
    expect(advanced.playerVolleyHasScored).toBe(false);
    expect(advanced.playerVolleyHasUnscoredExit).toBe(false);
  });

  it("lets players destroy shield bearers and then their formerly protected neighbors", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const shieldBearer = getInvader(game, 1, 3);
    const protectedInvader = getInvader(game, 1, 4);
    const shieldBearerDestroyed = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShotCooldownTicks: 1_000,
        invaders: game.invaders.map((invader) => ({
          ...invader,
          isActive:
            invader.id === shieldBearer.id || invader.id === protectedInvader.id,
        })),
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
    const protectedInvader = getInvader(game, 1, 4);
    const remainingInvader = getInvader(game, SPACE_INVADERS_ROWS - 1, 10);
    const advanced = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShotCooldownTicks: 1_000,
        invaders: game.invaders.map((invader) => ({
          ...invader,
          isActive:
            invader.id === shieldBearer.id ||
            invader.id === protectedInvader.id ||
            invader.id === remainingInvader.id,
        })),
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

  it("fires immediate shots from every adjacent alien when a revenge alien is destroyed", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const revengeAlien = getInvader(game, 1, 5);
    const adjacentInvaders = [
      getInvader(game, 0, 4),
      getInvader(game, 0, 5),
      getInvader(game, 0, 6),
      getInvader(game, 1, 4),
      getInvader(game, 1, 6),
      getInvader(game, 2, 4),
      getInvader(game, 2, 5),
      getInvader(game, 2, 6),
    ];
    const activeInvaderIds = new Set([
      revengeAlien.id,
      ...adjacentInvaders.map((invader) => invader.id),
    ]);
    const advanced = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShotCooldownTicks: 1_000,
        invaders: game.invaders.map((invader) => ({
          ...invader,
          isActive: activeInvaderIds.has(invader.id),
        })),
        playerShots: [createPlayerShotAlignedWith(revengeAlien)],
      }),
      () => 0,
    );

    expect(revengeAlien.kind).toBe("revenge");
    expect(
      advanced.invaders.find((invader) => invader.id === revengeAlien.id)?.isActive,
    ).toBe(false);
    expect(
      advanced.invaders
        .filter((invader) => adjacentInvaders.some((source) => source.id === invader.id))
        .every((invader) => invader.isActive),
    ).toBe(true);
    expect(advanced.invaderShots.map((shot) => shot.sourceInvaderId)).toEqual([
      adjacentInvaders[0]!.id,
      adjacentInvaders[1]!.id,
      adjacentInvaders[2]!.id,
      adjacentInvaders[3]!.id,
      adjacentInvaders[4]!.id,
      adjacentInvaders[5]!.id,
      adjacentInvaders[5]!.id,
      adjacentInvaders[5]!.id,
      adjacentInvaders[6]!.id,
      adjacentInvaders[6]!.id,
      adjacentInvaders[6]!.id,
      adjacentInvaders[7]!.id,
      adjacentInvaders[7]!.id,
      adjacentInvaders[7]!.id,
    ]);
    expect(
      advanced.invaderShots.map(({ id, kind, sourceColumn, sourceRow, velocityX }) => ({
        id,
        kind,
        sourceColumn,
        sourceRow,
        velocityX,
      })),
    ).toEqual([
      {
        id: "invader-shot-0",
        kind: "commander",
        sourceColumn: 4,
        sourceRow: 0,
        velocityX: expect.any(Number),
      },
      {
        id: "invader-shot-1",
        kind: "commander",
        sourceColumn: 5,
        sourceRow: 0,
        velocityX: expect.any(Number),
      },
      {
        id: "invader-shot-2",
        kind: "commander",
        sourceColumn: 6,
        sourceRow: 0,
        velocityX: expect.any(Number),
      },
      {
        id: "invader-shot-3",
        kind: "burst",
        sourceColumn: 4,
        sourceRow: 1,
        velocityX: 0,
      },
      {
        id: "invader-shot-4",
        kind: "burst",
        sourceColumn: 6,
        sourceRow: 1,
        velocityX: 0,
      },
      {
        id: "invader-shot-5",
        kind: "scatter",
        sourceColumn: 4,
        sourceRow: 2,
        velocityX: -1.25,
      },
      {
        id: "invader-shot-6",
        kind: "scatter",
        sourceColumn: 4,
        sourceRow: 2,
        velocityX: 0,
      },
      {
        id: "invader-shot-7",
        kind: "scatter",
        sourceColumn: 4,
        sourceRow: 2,
        velocityX: 1.25,
      },
      {
        id: "invader-shot-8",
        kind: "scatter",
        sourceColumn: 5,
        sourceRow: 2,
        velocityX: -1.25,
      },
      {
        id: "invader-shot-9",
        kind: "scatter",
        sourceColumn: 5,
        sourceRow: 2,
        velocityX: 0,
      },
      {
        id: "invader-shot-10",
        kind: "scatter",
        sourceColumn: 5,
        sourceRow: 2,
        velocityX: 1.25,
      },
      {
        id: "invader-shot-11",
        kind: "scatter",
        sourceColumn: 6,
        sourceRow: 2,
        velocityX: -1.25,
      },
      {
        id: "invader-shot-12",
        kind: "scatter",
        sourceColumn: 6,
        sourceRow: 2,
        velocityX: 0,
      },
      {
        id: "invader-shot-13",
        kind: "scatter",
        sourceColumn: 6,
        sourceRow: 2,
        velocityX: 1.25,
      },
    ]);
    expect(advanced.nextInvaderShotId).toBe(14);
  });

  it("forces revenge shots even when the active invader shot limit is full", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const revengeAlien = getInvader(game, 1, 5);
    const leftNeighbor = getInvader(game, 1, 4);
    const advanced = advanceSpaceInvadersGame(
      createRunningGame({
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
          isActive: invader.id === revengeAlien.id || invader.id === leftNeighbor.id,
        })),
        nextInvaderShotId: 5,
        playerShots: [createPlayerShotAlignedWith(revengeAlien)],
      }),
      () => 0,
    );

    expect(advanced.invaderShots).toHaveLength(4);
    expect(advanced.invaderShots.map((shot) => shot.sourceInvaderId)).toEqual([
      "4:0",
      "4:1",
      "4:2",
      leftNeighbor.id,
    ]);
    expect(advanced.invaderShots[3]).toMatchObject({
      id: "invader-shot-5",
      kind: "burst",
      sourceInvaderId: leftNeighbor.id,
    });
    expect(advanced.nextInvaderShotId).toBe(6);
  });

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

  it("marches invaders horizontally until they hit an edge, then drops and reverses", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const standardEdgeInvader = getInvader(game, SPACE_INVADERS_ROWS - 1, 0);
    const targetInvader = {
      ...standardEdgeInvader,
      x: SPACE_INVADERS_BOARD_WIDTH - standardEdgeInvader.width - 0.1,
      y: 100,
    };
    const runningGame = withOnlyActiveInvader(
      createRunningGame({
        invaders: game.invaders.map((invader) =>
          invader.id === targetInvader.id ? targetInvader : invader,
        ),
        marchDirection: 1,
      }),
      targetInvader,
    );
    const advanced = advanceSpaceInvadersGame(runningGame);
    const marchedInvader = advanced.invaders.find((invader) => invader.id === targetInvader.id);

    expect(marchedInvader).toMatchObject({
      x: targetInvader.x,
    });
    expect(marchedInvader?.y).toBeCloseTo(targetInvader.y + 4);
    expect(advanced.marchDirection).toBe(-1);
  });

  it("keeps covered divers in formation until lower invaders leave their lane", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const coveredDiver = {
      ...getInvader(game, 2, Math.floor(SPACE_INVADERS_COLUMNS / 2) - 1),
      kind: "diver" as const,
    };
    const lowerInvader = getInvader(game, 3, coveredDiver.column);
    const advanced = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShotCooldownTicks: 1_000,
        invaders: game.invaders.map((invader) =>
          invader.id === coveredDiver.id ? coveredDiver : invader,
        ),
      }),
    );
    const movedDiver = advanced.invaders.find((invader) => invader.id === coveredDiver.id);

    expect(coveredDiver.kind).toBe("diver");
    expect(lowerInvader.isActive).toBe(true);
    expect(movedDiver?.x).toBeCloseTo(coveredDiver.x + 0.8);
    expect(movedDiver?.isDiving).toBe(false);
  });

  it("accelerates divers when their current screen lane is clear", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const laneDiver = {
      ...getInvader(game, 1, Math.floor(SPACE_INVADERS_COLUMNS / 2) - 1),
      kind: "diver" as const,
    };
    const shiftedLowerInvader = {
      ...getInvader(game, SPACE_INVADERS_ROWS - 1, laneDiver.column),
      x: laneDiver.x + laneDiver.width + 8,
    };
    const advanced = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShotCooldownTicks: 1_000,
        invaders: game.invaders.map((invader) => {
          if (invader.id === laneDiver.id) {
            return laneDiver;
          }

          if (invader.id === shiftedLowerInvader.id) {
            return shiftedLowerInvader;
          }

          return { ...invader, isActive: false };
        }),
      }),
    );
    const movedDiver = advanced.invaders.find((invader) => invader.id === laneDiver.id);
    const movedLowerInvader = advanced.invaders.find(
      (invader) => invader.id === shiftedLowerInvader.id,
    );

    expect(laneDiver.kind).toBe("diver");
    expect(shiftedLowerInvader.column).toBe(laneDiver.column);
    expect(shiftedLowerInvader.x).toBeGreaterThan(laneDiver.x + laneDiver.width);
    expect(movedDiver?.x).toBeCloseTo(laneDiver.x + 3.5);
    expect(movedDiver?.isDiving).toBe(true);
    expect(movedLowerInvader?.x).toBeCloseTo(shiftedLowerInvader.x + 0.8);
    expect(movedLowerInvader?.isDiving).toBe(false);
  });

  it("bounces released divers without dropping or reversing the formation", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const releasedDiver = {
      ...getInvader(game, 1, Math.floor(SPACE_INVADERS_COLUMNS / 2) - 1),
      direction: 1 as const,
      isDiving: true,
      kind: "diver" as const,
      x: SPACE_INVADERS_BOARD_WIDTH - game.invaders[0]!.width - 0.1,
    };
    const lowerInvader = {
      ...getInvader(game, SPACE_INVADERS_ROWS - 1, releasedDiver.column),
      x: SPACE_INVADERS_BOARD_WIDTH - game.invaders[0]!.width - 1,
    };
    const advanced = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShotCooldownTicks: 1_000,
        invaders: game.invaders.map((invader) => {
          if (invader.id === releasedDiver.id) {
            return releasedDiver;
          }

          if (invader.id === lowerInvader.id) {
            return lowerInvader;
          }

          return { ...invader, isActive: false };
        }),
        marchDirection: 1,
      }),
    );
    const droppedDiver = advanced.invaders.find((invader) => invader.id === releasedDiver.id);
    const droppedLowerInvader = advanced.invaders.find(
      (invader) => invader.id === lowerInvader.id,
    );

    expect(releasedDiver.kind).toBe("diver");
    expect(lowerInvader.y).toBeGreaterThan(releasedDiver.y);
    expect(lowerInvader.x).toBeLessThan(releasedDiver.x);
    expect(droppedDiver?.y).toBeCloseTo(releasedDiver.y + 16);
    expect(droppedDiver?.direction).toBe(-1);
    expect(droppedDiver?.isDiving).toBe(true);
    expect(droppedLowerInvader?.x).toBeCloseTo(lowerInvader.x + 0.8);
    expect(droppedLowerInvader?.y).toBeCloseTo(lowerInvader.y);
    expect(advanced.marchDirection).toBe(1);
  });

  it("keeps released divers hard-dropping when the formation itself descends", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const releasedDiver = {
      ...getInvader(game, 1, Math.floor(SPACE_INVADERS_COLUMNS / 2) - 1),
      isDiving: true,
      kind: "diver" as const,
    };
    const lowerInvader = {
      ...getInvader(game, SPACE_INVADERS_ROWS - 1, releasedDiver.column),
      x: releasedDiver.x,
    };
    const edgeInvader = {
      ...getInvader(game, SPACE_INVADERS_ROWS - 1, SPACE_INVADERS_COLUMNS - 1),
      x: SPACE_INVADERS_BOARD_WIDTH - game.invaders[0]!.width - 0.1,
    };
    const advanced = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShotCooldownTicks: 1_000,
        invaders: game.invaders.map((invader) => {
          if (invader.id === releasedDiver.id) {
            return releasedDiver;
          }

          if (invader.id === lowerInvader.id) {
            return lowerInvader;
          }

          if (invader.id === edgeInvader.id) {
            return edgeInvader;
          }

          return { ...invader, isActive: false };
        }),
        marchDirection: 1,
      }),
    );
    const droppedDiver = advanced.invaders.find((invader) => invader.id === releasedDiver.id);
    const droppedLowerInvader = advanced.invaders.find(
      (invader) => invader.id === lowerInvader.id,
    );

    expect(releasedDiver.kind).toBe("diver");
    expect(lowerInvader.y).toBeGreaterThan(releasedDiver.y);
    expect(lowerInvader.x).toBe(releasedDiver.x);
    expect(droppedDiver?.y).toBeCloseTo(releasedDiver.y + 16);
    expect(droppedDiver?.direction).toBe(-1);
    expect(droppedDiver?.isDiving).toBe(true);
    expect(droppedLowerInvader?.y).toBeCloseTo(lowerInvader.y + 4);
    expect(advanced.marchDirection).toBe(-1);
  });

  it("moves exposed divers twice as fast as the previous tuning and hard-drops them on their own edge bounce", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const standardInvader = getInvader(game, SPACE_INVADERS_ROWS - 1, 3);
    const diverInvader = {
      ...getInvader(game, 2, 4),
      direction: 1 as const,
      kind: "diver" as const,
    };
    const exposedInvaders = game.invaders.map((invader) => {
      if (invader.id === diverInvader.id) {
        return { ...diverInvader, isActive: true };
      }

      return {
        ...invader,
        isActive: invader.id === standardInvader.id,
      };
    });
    const afterHorizontalMarch = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShotCooldownTicks: 1_000,
        invaders: exposedInvaders,
      }),
    );
    const movedStandard = afterHorizontalMarch.invaders.find(
      (invader) => invader.id === standardInvader.id,
    )!;
    const movedDiver = afterHorizontalMarch.invaders.find(
      (invader) => invader.id === diverInvader.id,
    )!;
    const edgeGame = createRunningGame({
      invaderShotCooldownTicks: 1_000,
      invaders: game.invaders.map((invader) => {
        if (invader.id === standardInvader.id) {
          return standardInvader;
        }

        if (invader.id === diverInvader.id) {
          return {
            ...diverInvader,
            x: SPACE_INVADERS_BOARD_WIDTH - diverInvader.width - 0.1,
          };
        }

        return { ...invader, isActive: false };
      }),
      marchDirection: 1,
    });
    const afterDrop = advanceSpaceInvadersGame(edgeGame);
    const droppedStandard = afterDrop.invaders.find(
      (invader) => invader.id === standardInvader.id,
    )!;
    const droppedDiver = afterDrop.invaders.find(
      (invader) => invader.id === diverInvader.id,
    )!;

    expect(standardInvader.kind).toBe("standard");
    expect(diverInvader.kind).toBe("diver");
    expect(movedStandard.x - standardInvader.x).toBeCloseTo(0.8);
    expect(movedDiver.x - diverInvader.x).toBeCloseTo(3.5);
    expect(movedDiver.x - diverInvader.x).toBeGreaterThan(1.75);
    expect(droppedStandard.x - standardInvader.x).toBeCloseTo(0.8);
    expect(droppedStandard.y - standardInvader.y).toBeCloseTo(0);
    expect(droppedDiver.y - diverInvader.y).toBeCloseTo(16);
    expect(droppedDiver.direction).toBe(-1);
    expect(afterDrop.marchDirection).toBe(1);
  });

  it("keeps the untouched formation above the base for a playable opening window", () => {
    const ticksForTwoMinutes = Math.floor(120_000 / getSpaceInvadersTickDelay());
    const ticksForThreeMinutes = Math.floor(180_000 / getSpaceInvadersTickDelay());
    let game = createRunningGame({
      invaderShotCooldownTicks: ticksForThreeMinutes + 10,
    });

    for (let tick = 0; tick < ticksForTwoMinutes; tick += 1) {
      game = advanceSpaceInvadersGame(game);
    }

    const lowestActiveInvaderEdge = Math.max(
      ...game.invaders
        .filter((invader) => invader.isActive)
        .map((invader) => invader.y + invader.height),
    );

    expect(game.status).toBe("running");
    expect(lowestActiveInvaderEdge).toBeLessThan(SPACE_INVADERS_BASE_Y);

    for (let tick = ticksForTwoMinutes; tick < ticksForThreeMinutes; tick += 1) {
      game = advanceSpaceInvadersGame(game);
    }

    expect(game.status).toBe("lost");
  });

  it("loses when an active invader reaches the player base", () => {
    const game = createInitialSpaceInvadersGame();
    const targetInvader = {
      ...game.invaders[0]!,
      y: SPACE_INVADERS_BASE_Y - game.invaders[0]!.height + 1,
    };
    const runningGame = withOnlyActiveInvader(
      createRunningGame({
        invaders: game.invaders.map((invader) =>
          invader.id === targetInvader.id ? targetInvader : invader,
        ),
      }),
      targetInvader,
    );
    const advanced = advanceSpaceInvadersGame(runningGame);

    expect(advanced.status).toBe("lost");
    expect(advanced.lives).toBe(0);
  });

  it("wins when the final active invader is cleared", () => {
    const game = createInitialSpaceInvadersGame();
    const targetInvader = game.invaders[0]!;
    const runningGame = withOnlyActiveInvader(
      createRunningGame({
        invaders: game.invaders,
        playerShots: [createPlayerShotAlignedWith(targetInvader)],
        ufo: {
          ...game.ufo,
          isActive: true,
          x: 180,
        },
      }),
      targetInvader,
    );
    const advanced = advanceSpaceInvadersGame(runningGame);

    expect(advanced.status).toBe("won");
    expect(advanced.score).toBe(targetInvader.points);
    expect(advanced.ufo.isActive).toBe(true);
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
