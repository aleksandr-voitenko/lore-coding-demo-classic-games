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
  type SpaceInvadersGameState,
  type SpaceInvadersInvaderShot,
} from "./space-invaders-game-engine";

function createRunningGame(
  overrides: Partial<SpaceInvadersGameState> = {},
): SpaceInvadersGameState {
  return {
    ...createInitialSpaceInvadersGame(),
    status: "running",
    ...overrides,
  };
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
    height: 20,
    id: "invader-shot-test",
    sourceColumn: 0,
    sourceInvaderId: "4:0",
    velocityY: 3.2,
    width: 5,
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

describe("space invaders game engine", () => {
  it("creates a ready formation with a centered player cannon", () => {
    const game = createInitialSpaceInvadersGame();

    expect(game.status).toBe("ready");
    expect(game.score).toBe(0);
    expect(game.lives).toBe(SPACE_INVADERS_STARTING_LIVES);
    expect(game.player.x + game.player.width / 2).toBe(SPACE_INVADERS_BOARD_WIDTH / 2);
    expect(game.playerShot).toBeNull();
    expect(game.invaderShots).toEqual([]);
    expect(game.invaderShotCooldownTicks).toBeGreaterThan(0);
    expect(game.nextInvaderShotId).toBe(0);
    expect(game.marchDirection).toBe(1);
    expect(game.invaders).toHaveLength(SPACE_INVADERS_COLUMNS * SPACE_INVADERS_ROWS);
    expect(game.invaders.every((invader) => invader.isActive)).toBe(true);
    expect(game.invaders[0]).toMatchObject({
      column: 0,
      points: 30,
      row: 0,
    });
    expect(game.invaders.at(-1)).toMatchObject({
      column: SPACE_INVADERS_COLUMNS - 1,
      points: 10,
      row: SPACE_INVADERS_ROWS - 1,
    });
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

  it("fires invader shots from the lowest active invader in the nearest column", () => {
    const game = createInitialSpaceInvadersGame();
    const shooter = getInvader(game, SPACE_INVADERS_ROWS - 1, 5);
    const coveredInvader = getInvader(game, 0, shooter.column);
    const runningGame = createRunningGame({
      invaderShotCooldownTicks: 0,
      player: centerPlayerUnderInvader(game, shooter),
    });
    const advanced = advanceSpaceInvadersGame(runningGame);
    const shot = advanced.invaderShots[0]!;

    expect(advanced.invaderShots).toHaveLength(1);
    expect(shot).toMatchObject({
      id: "invader-shot-0",
      sourceColumn: shooter.column,
      sourceInvaderId: shooter.id,
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
    const advanced = advanceSpaceInvadersGame(runningGame);

    expect(advanced.invaderShots[0]).toMatchObject({
      sourceColumn: nextShooter.column,
      sourceInvaderId: nextShooter.id,
    });
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

  it("loses a life and clears active shots when an invader shot hits the player", () => {
    const game = createInitialSpaceInvadersGame();
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
    const advanced = advanceSpaceInvadersGame(runningGame);

    expect(advanced.status).toBe("running");
    expect(advanced.lives).toBe(SPACE_INVADERS_STARTING_LIVES - 1);
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
    const advanced = advanceSpaceInvadersGame(runningGame);

    expect(advanced.status).toBe("lost");
    expect(advanced.lives).toBe(0);
    expect(advanced.invaderShots).toEqual([]);
  });

  it("removes a hit invader, clears the shot, and adds the invader score", () => {
    const game = createInitialSpaceInvadersGame();
    const targetInvader = game.invaders[0]!;
    const shot = fireSpaceInvadersShot(createRunningGame()).playerShot!;
    const runningGame = createRunningGame({
      invaders: game.invaders,
      playerShot: {
        ...shot,
        x: targetInvader.x + targetInvader.width / 2 - shot.width / 2,
        y: targetInvader.y + targetInvader.height + 2,
      },
    });
    const advanced = advanceSpaceInvadersGame(runningGame);
    const hitInvader = advanced.invaders.find((invader) => invader.id === targetInvader.id);

    expect(hitInvader?.isActive).toBe(false);
    expect(advanced.playerShot).toBeNull();
    expect(advanced.score).toBe(targetInvader.points);
  });

  it("marches invaders horizontally until they hit an edge, then drops and reverses", () => {
    const game = createInitialSpaceInvadersGame();
    const targetInvader = {
      ...game.invaders[0]!,
      x: SPACE_INVADERS_BOARD_WIDTH - game.invaders[0]!.width - 0.1,
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
    const shot = fireSpaceInvadersShot(createRunningGame()).playerShot!;
    const runningGame = withOnlyActiveInvader(
      createRunningGame({
        invaders: game.invaders,
        playerShot: {
          ...shot,
          x: targetInvader.x + targetInvader.width / 2 - shot.width / 2,
          y: targetInvader.y + targetInvader.height + 2,
        },
      }),
      targetInvader,
    );
    const advanced = advanceSpaceInvadersGame(runningGame);

    expect(advanced.status).toBe("won");
    expect(advanced.score).toBe(targetInvader.points);
  });

  it("restarts from game over with a fresh running formation", () => {
    const lostGame = {
      ...createInitialSpaceInvadersGame(),
      invaders: [],
      invaderShotCooldownTicks: 0,
      invaderShots: [createInvaderShotFixture()],
      lives: 0,
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
    };
    const restarted = startSpaceInvadersGame(lostGame);

    expect(restarted.status).toBe("running");
    expect(restarted.score).toBe(0);
    expect(restarted.lives).toBe(SPACE_INVADERS_STARTING_LIVES);
    expect(restarted.playerShot).toBeNull();
    expect(restarted.invaderShots).toEqual([]);
    expect(restarted.invaders).toHaveLength(SPACE_INVADERS_COLUMNS * SPACE_INVADERS_ROWS);
    expect(restarted.invaders.every((invader) => invader.isActive)).toBe(true);
  });
});
