import { describe, expect, it } from "vitest";

import {
  advanceSpaceInvadersGame,
  createInitialSpaceInvadersGame,
  fireSpaceInvadersShot,
  getSpaceInvadersPlayerSpeed,
  getSpaceInvadersTickDelay,
  moveSpaceInvadersPlayer,
  pauseSpaceInvadersGame,
  restartSpaceInvadersGame,
  SPACE_INVADERS_BASE_Y,
  SPACE_INVADERS_BOARD_WIDTH,
  SPACE_INVADERS_COLUMNS,
  SPACE_INVADERS_ROWS,
  SPACE_INVADERS_STARTING_LIVES,
  startSpaceInvadersGame,
  type SpaceInvader,
  type SpaceInvadersExplosion,
  type SpaceInvadersGameState,
  type SpaceInvadersInvaderShot,
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
  const shot = fireSpaceInvadersShot(game).playerShot!;

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

describe("space invaders game engine", () => {
  it("creates a ready formation with a centered player cannon", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const diverInvaders = game.invaders.filter((invader) => invader.kind === "diver");
    const bottomRowInvaders = game.invaders.filter(
      (invader) => invader.row === SPACE_INVADERS_ROWS - 1,
    );

    expect(game.status).toBe("ready");
    expect(game.score).toBe(0);
    expect(game.lives).toBe(SPACE_INVADERS_STARTING_LIVES);
    expect(game.player.x + game.player.width / 2).toBe(SPACE_INVADERS_BOARD_WIDTH / 2);
    expect(game.playerShot).toBeNull();
    expect(game.explosions).toEqual([]);
    expect(game.invaderShots).toEqual([]);
    expect(game.invaderShotCooldownTicks).toBeGreaterThan(0);
    expect(game.nextExplosionId).toBe(0);
    expect(game.nextInvaderShotId).toBe(0);
    expect(game.marchDirection).toBe(1);
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
      kind: "standard",
      points: 20,
    });
    expect(game.invaders.at(-1)).toMatchObject({
      column: SPACE_INVADERS_COLUMNS - 1,
      kind: "standard",
      points: 10,
      row: SPACE_INVADERS_ROWS - 1,
    });
  });

  it("uses the random source to choose ten divers from non-bottom rows", () => {
    const firstSelection = createInitialSpaceInvadersGame({ random: () => 0 });
    const lastSelection = createInitialSpaceInvadersGame({ random: () => 1 });
    const firstDiverIds = getDiverIds(firstSelection);
    const lastDiverIds = getDiverIds(lastSelection);
    const firstDivers = firstSelection.invaders.filter((invader) => invader.kind === "diver");
    const lastDivers = lastSelection.invaders.filter((invader) => invader.kind === "diver");
    const firstBottomRowInvaders = firstSelection.invaders.filter(
      (invader) => invader.row === SPACE_INVADERS_ROWS - 1,
    );
    const lastBottomRowInvaders = lastSelection.invaders.filter(
      (invader) => invader.row === SPACE_INVADERS_ROWS - 1,
    );

    expect(firstDiverIds).toHaveLength(10);
    expect(lastDiverIds).toHaveLength(10);
    expect(firstDiverIds).not.toEqual(lastDiverIds);
    expect(firstDivers.every((invader) => invader.row < SPACE_INVADERS_ROWS - 1)).toBe(true);
    expect(lastDivers.every((invader) => invader.row < SPACE_INVADERS_ROWS - 1)).toBe(true);
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

    expect(game.alienCount).toBe(24);
    expect(game.boardHeight).toBe(640);
    expect(game.boardWidth).toBe(480);
    expect(game.baseY).toBe(572);
    expect(game.invaders).toHaveLength(24);
    expect(game.player.x + game.player.width / 2).toBe(240);
    expect(restarted.alienCount).toBe(24);
    expect(restarted.boardHeight).toBe(640);
    expect(restarted.boardWidth).toBe(480);
    expect(restarted.invaders).toHaveLength(24);
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

    expect(firedGame.playerShot).not.toBeNull();
    expect(firedGame.playerShot).toMatchObject({
      velocityY: expect.any(Number),
    });
    expect(firedGame.playerShot?.x).toBe(
      firedGame.player.x + firedGame.player.width / 2 - firedGame.playerShot!.width / 2,
    );
    expect(firedGame.playerShot?.y).toBeLessThan(firedGame.player.y);
    expect(secondFireGame.playerShot).toBe(firedGame.playerShot);
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
    const zigzag = fireFromOnlyInvader(1).advanced;
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
    expect(zigzag.invaderShots[0]).toMatchObject({
      height: 18,
      kind: "zigzag",
      sourceRow: 1,
      velocityX: 1.15,
      velocityY: 3,
      width: 7,
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

  it("moves the player shot upward and clears it after it leaves the board", () => {
    const movingShotGame = fireSpaceInvadersShot(createRunningGame());
    const movingShot = movingShotGame.playerShot!;
    const clearedShotGame = createRunningGame({
      playerShot: {
        ...movingShot,
        y: -movingShot.height + movingShot.velocityY - 1,
      },
    });

    expect(advanceSpaceInvadersGame(movingShotGame).playerShot?.y).toBeCloseTo(
      movingShot.y + movingShot.velocityY,
    );
    expect(advanceSpaceInvadersGame(clearedShotGame).playerShot).toBeNull();
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

  it("moves commander, zig-zag, and scatter shots with their row behavior", () => {
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
    const zigzagRight = createInvaderShotFixture({
      id: "zigzag-right",
      kind: "zigzag",
      sourceColumn: 0,
      sourceRow: 1,
      velocityX: 1.15,
      velocityY: 3,
      x: 160,
      y: 120,
    });
    const zigzagLeft = createInvaderShotFixture({
      ageTicks: 12,
      id: "zigzag-left",
      kind: "zigzag",
      sourceColumn: 0,
      sourceRow: 1,
      velocityX: 1.15,
      velocityY: 3,
      x: 200,
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
        invaderShots: [commander, zigzagRight, zigzagLeft, expiredScatter],
        player: {
          ...game.player,
          x: 260,
        },
      }),
    );
    const movedCommander = advanced.invaderShots.find(
      (shot) => shot.id === commander.id,
    );
    const movedZigzagRight = advanced.invaderShots.find(
      (shot) => shot.id === zigzagRight.id,
    );
    const movedZigzagLeft = advanced.invaderShots.find(
      (shot) => shot.id === zigzagLeft.id,
    );

    expect(movedCommander?.velocityX).toBeGreaterThan(0);
    expect(movedCommander?.x).toBeGreaterThan(commander.x);
    expect(movedCommander?.y).toBeCloseTo(commander.y + commander.velocityY);
    expect(movedZigzagRight?.x).toBeGreaterThan(zigzagRight.x);
    expect(movedZigzagLeft?.x).toBeLessThan(zigzagLeft.x);
    expect(advanced.invaderShots.find((shot) => shot.id === expiredScatter.id)).toBe(
      undefined,
    );
  });

  it("loses a life and clears active shots when an invader shot hits the player", () => {
    const game = createInitialSpaceInvadersGame();
    const hitPlayer = game.player;
    const playerShot = fireSpaceInvadersShot(createRunningGame()).playerShot!;
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
      playerShot,
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
    expect(advanced.invaderShots).toEqual([]);
    expect(advanced.playerShot).toBeNull();
    expect(advanced.player.x + advanced.player.width / 2).toBe(
      SPACE_INVADERS_BOARD_WIDTH / 2,
    );
    expect(advanced.invaderShotCooldownTicks).toBeGreaterThan(0);
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
      playerShot: createPlayerShotAlignedWith(targetInvader),
    });
    const advanced = advanceSpaceInvadersGame(runningGame, () => 0.62);
    const hitInvader = advanced.invaders.find((invader) => invader.id === targetInvader.id);

    expect(hitInvader?.isActive).toBe(false);
    expect(advanced.playerShot).toBeNull();
    expect(advanced.score).toBe(targetInvader.points);
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
      playerShot: createPlayerShotAlignedWith(activeUfo),
      score: 40,
      ufo: activeUfo,
    });
    const advanced = advanceSpaceInvadersGame(runningGame, () => 0.3);

    expect(advanced.score).toBe(140);
    expect(advanced.playerShot).toBeNull();
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

  it("keeps released divers dropping harder while passing lower invaders", () => {
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
    expect(droppedDiver?.isDiving).toBe(true);
    expect(droppedLowerInvader?.y).toBeCloseTo(lowerInvader.y + 4);
    expect(advanced.marchDirection).toBe(-1);
  });

  it("moves exposed divers twice as fast as the previous tuning and drops them harder", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const standardInvader = getInvader(game, SPACE_INVADERS_ROWS - 1, 3);
    const diverInvader = { ...getInvader(game, 2, 4), kind: "diver" as const };
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
          return {
            ...standardInvader,
            x: SPACE_INVADERS_BOARD_WIDTH - standardInvader.width - 0.1,
          };
        }

        if (invader.id === diverInvader.id) {
          return {
            ...diverInvader,
            x: diverInvader.x,
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
    expect(droppedStandard.y - standardInvader.y).toBeCloseTo(4);
    expect(droppedDiver.y - diverInvader.y).toBeCloseTo(16);
    expect(afterDrop.marchDirection).toBe(-1);
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
        playerShot: createPlayerShotAlignedWith(targetInvader),
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
      invaderShotCooldownTicks: 0,
      invaderShots: [createInvaderShotFixture()],
      lives: 0,
      nextExplosionId: 1,
      nextInvaderShotId: 1,
      playerShot: {
        height: 14,
        velocityY: -16,
        width: 4,
        x: 10,
        y: 10,
      },
      score: 120,
      status: "lost" as const,
      ufo: {
        ...createInitialSpaceInvadersGame().ufo,
        cooldownTicks: 0,
        direction: -1 as const,
        isActive: true,
        points: 200,
        x: 100,
      },
    };
    const restarted = startSpaceInvadersGame(lostGame);

    expect(restarted.status).toBe("running");
    expect(restarted.score).toBe(0);
    expect(restarted.lives).toBe(SPACE_INVADERS_STARTING_LIVES);
    expect(restarted.playerShot).toBeNull();
    expect(restarted.explosions).toEqual([]);
    expect(restarted.nextExplosionId).toBe(0);
    expect(restarted.invaderShots).toEqual([]);
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
