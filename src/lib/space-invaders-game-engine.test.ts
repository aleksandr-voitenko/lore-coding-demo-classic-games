import { describe, expect, it } from "vitest";

import {
  advanceSpaceInvadersGame,
  createInitialSpaceInvadersGame,
  fireSpaceInvadersShot,
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

describe("space invaders game engine", () => {
  it("creates a ready formation with a centered player cannon", () => {
    const game = createInitialSpaceInvadersGame();

    expect(game.status).toBe("ready");
    expect(game.score).toBe(0);
    expect(game.lives).toBe(SPACE_INVADERS_STARTING_LIVES);
    expect(game.player.x + game.player.width / 2).toBe(SPACE_INVADERS_BOARD_WIDTH / 2);
    expect(game.playerShot).toBeNull();
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

  it("moves the player shot upward and clears it after it leaves the board", () => {
    const movingShotGame = createRunningGame({
      playerShot: {
        height: 14,
        velocityY: -16,
        width: 4,
        x: 3,
        y: 120,
      },
    });
    const clearedShotGame = createRunningGame({
      playerShot: {
        height: 14,
        velocityY: -16,
        width: 4,
        x: 3,
        y: -15,
      },
    });

    expect(advanceSpaceInvadersGame(movingShotGame).playerShot?.y).toBe(104);
    expect(advanceSpaceInvadersGame(clearedShotGame).playerShot).toBeNull();
  });

  it("removes a hit invader, clears the shot, and adds the invader score", () => {
    const game = createInitialSpaceInvadersGame();
    const targetInvader = game.invaders[0]!;
    const runningGame = createRunningGame({
      invaders: game.invaders,
      playerShot: {
        height: 14,
        velocityY: -16,
        width: 4,
        x: targetInvader.x + targetInvader.width / 2 - 2,
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
      x: SPACE_INVADERS_BOARD_WIDTH - game.invaders[0]!.width - 1,
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
      y: targetInvader.y + 4,
    });
    expect(advanced.marchDirection).toBe(-1);
  });

  it("keeps the untouched formation above the base for a playable opening window", () => {
    const ticksForTwoMinutes = Math.floor(120_000 / getSpaceInvadersTickDelay());
    const ticksForThreeMinutes = Math.floor(180_000 / getSpaceInvadersTickDelay());
    let game = createRunningGame();

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
        playerShot: {
          height: 14,
          velocityY: -16,
          width: 4,
          x: targetInvader.x + targetInvader.width / 2 - 2,
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
      lives: 0,
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
    expect(restarted.invaders).toHaveLength(SPACE_INVADERS_COLUMNS * SPACE_INVADERS_ROWS);
    expect(restarted.invaders.every((invader) => invader.isActive)).toBe(true);
  });
});
