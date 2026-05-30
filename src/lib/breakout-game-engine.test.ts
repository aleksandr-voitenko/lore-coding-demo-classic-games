import { describe, expect, it } from "vitest";

import {
  advanceBreakoutGame,
  BREAKOUT_BOARD_HEIGHT,
  BREAKOUT_BOARD_WIDTH,
  BREAKOUT_BRICK_COLUMNS,
  BREAKOUT_BRICK_ROWS,
  BREAKOUT_STARTING_LIVES,
  createInitialBreakoutGame,
  getBreakoutBallRadius,
  getBreakoutBallSpeed,
  moveBreakoutPaddle,
  pauseBreakoutGame,
  restartBreakoutGame,
  startBreakoutGame,
  type BreakoutGameState,
} from "./breakout-game-engine";

function createRunningGame(overrides: Partial<BreakoutGameState> = {}): BreakoutGameState {
  return {
    ...createInitialBreakoutGame(),
    status: "running",
    ...overrides,
  };
}

const HIT_SPEED_MULTIPLIER = 1.002;
const PREVIOUS_INITIAL_BALL_SPEED = Math.hypot(3.2, 5.2);
const STARTING_SPEED_MULTIPLIER = 0.525;

describe("breakout game engine", () => {
  it("creates a ready board with a centered paddle, staged ball, and classic brick wall", () => {
    const game = createInitialBreakoutGame();
    const ballRadius = getBreakoutBallRadius();

    expect(game.status).toBe("ready");
    expect(game.score).toBe(0);
    expect(game.lives).toBe(BREAKOUT_STARTING_LIVES);
    expect(game.bricks).toHaveLength(BREAKOUT_BRICK_COLUMNS * BREAKOUT_BRICK_ROWS);
    expect(game.bricks.every((brick) => brick.isActive)).toBe(true);
    expect(game.bricks[0]).toMatchObject({
      column: 0,
      points: 50,
      row: 0,
    });
    expect(game.bricks.at(-1)).toMatchObject({
      column: BREAKOUT_BRICK_COLUMNS - 1,
      points: 10,
      row: BREAKOUT_BRICK_ROWS - 1,
    });
    expect(game.paddle.x + game.paddle.width / 2).toBe(BREAKOUT_BOARD_WIDTH / 2);
    expect(game.ball.position).toEqual({
      x: BREAKOUT_BOARD_WIDTH / 2,
      y: game.paddle.y - ballRadius - 1,
    });
    expect(game.ball.velocity).toEqual({ x: 1.68, y: -2.73 });
    expect(getBreakoutBallSpeed(game.ball.velocity)).toBeCloseTo(
      PREVIOUS_INITIAL_BALL_SPEED * STARTING_SPEED_MULTIPLIER,
    );
  });

  it("creates configurable board sizes and life counts", () => {
    const game = createInitialBreakoutGame({
      boardHeight: 640,
      boardWidth: 480,
      lives: 5,
    });
    const restarted = restartBreakoutGame(game);

    expect(game.boardHeight).toBe(640);
    expect(game.boardWidth).toBe(480);
    expect(game.lives).toBe(5);
    expect(game.startingLives).toBe(5);
    expect(game.paddle.x + game.paddle.width / 2).toBe(240);
    expect(game.ball.position.x).toBe(240);
    expect(restarted.boardHeight).toBe(640);
    expect(restarted.boardWidth).toBe(480);
    expect(restarted.lives).toBe(5);
    expect(restarted.startingLives).toBe(5);
    expect(restarted.status).toBe("running");
  });

  it("starts, pauses, and resumes without replacing the active board", () => {
    const readyGame = createInitialBreakoutGame();
    const runningGame = startBreakoutGame(readyGame);
    const pausedGame = pauseBreakoutGame(runningGame);
    const resumedGame = startBreakoutGame(pausedGame);

    expect(runningGame.status).toBe("running");
    expect(pausedGame.status).toBe("paused");
    expect(resumedGame.status).toBe("running");
    expect(resumedGame.bricks).toBe(pausedGame.bricks);
  });

  it("moves the paddle within the side walls and carries the staged ball while ready", () => {
    const readyGame = createInitialBreakoutGame();
    const movedLeft = moveBreakoutPaddle(readyGame, -1_000);
    const movedRight = moveBreakoutPaddle(movedLeft, 1_000);

    expect(movedLeft.paddle.x).toBe(0);
    expect(movedLeft.ball.position.x).toBe(movedLeft.paddle.width / 2);
    expect(movedRight.paddle.x).toBe(BREAKOUT_BOARD_WIDTH - movedRight.paddle.width);
    expect(movedRight.ball.position.x).toBe(
      BREAKOUT_BOARD_WIDTH - movedRight.paddle.width / 2,
    );
  });

  it("bounces the ball off the left wall and the top wall", () => {
    const ballRadius = getBreakoutBallRadius();
    const leftWallGame = createRunningGame({
      ball: {
        position: { x: ballRadius + 1, y: 120 },
        velocity: { x: -4, y: 1 },
      },
    });
    const topWallGame = createRunningGame({
      ball: {
        position: { x: 120, y: ballRadius + 1 },
        velocity: { x: 1, y: -4 },
      },
    });

    const leftWallAdvanced = advanceBreakoutGame(leftWallGame);
    const topWallAdvanced = advanceBreakoutGame(topWallGame);

    expect(leftWallAdvanced.ball.velocity.x).toBeGreaterThan(0);
    expect(topWallAdvanced.ball.velocity.y).toBeGreaterThan(0);
    expect(getBreakoutBallSpeed(leftWallAdvanced.ball.velocity)).toBeCloseTo(
      getBreakoutBallSpeed(leftWallGame.ball.velocity) * HIT_SPEED_MULTIPLIER,
    );
    expect(getBreakoutBallSpeed(topWallAdvanced.ball.velocity)).toBeCloseTo(
      getBreakoutBallSpeed(topWallGame.ball.velocity) * HIT_SPEED_MULTIPLIER,
    );
  });

  it("adds slight random angle jitter to wall rebounds", () => {
    const ballRadius = getBreakoutBallRadius();
    const topWallGame = createRunningGame({
      ball: {
        position: { x: 120, y: ballRadius + 1 },
        velocity: { x: 1, y: -4 },
      },
    });
    const neutralAdvanced = advanceBreakoutGame(topWallGame);
    const jitteredAdvanced = advanceBreakoutGame(topWallGame, { random: () => 1 });

    expect(jitteredAdvanced.ball.velocity.y).toBeGreaterThan(0);
    expect(jitteredAdvanced.ball.velocity.x).not.toBeCloseTo(neutralAdvanced.ball.velocity.x);
    expect(getBreakoutBallSpeed(jitteredAdvanced.ball.velocity)).toBeCloseTo(
      getBreakoutBallSpeed(topWallGame.ball.velocity) * HIT_SPEED_MULTIPLIER,
    );
  });

  it("bounces the ball from the paddle when descending onto it", () => {
    const game = createInitialBreakoutGame();
    const ballRadius = getBreakoutBallRadius();
    const runningGame = createRunningGame({
      ball: {
        position: {
          x: game.paddle.x + game.paddle.width / 2,
          y: game.paddle.y - ballRadius - 1,
        },
        velocity: { x: 0, y: 5 },
      },
      paddle: game.paddle,
    });
    const advanced = advanceBreakoutGame(runningGame);

    expect(advanced.ball.position.y).toBe(game.paddle.y - ballRadius);
    expect(advanced.ball.velocity.y).toBeLessThan(0);
    expect(getBreakoutBallSpeed(advanced.ball.velocity)).toBeCloseTo(
      getBreakoutBallSpeed(runningGame.ball.velocity) * HIT_SPEED_MULTIPLIER,
    );
  });

  it("adds slight random angle jitter to paddle rebounds", () => {
    const game = createInitialBreakoutGame();
    const ballRadius = getBreakoutBallRadius();
    const runningGame = createRunningGame({
      ball: {
        position: {
          x: game.paddle.x + game.paddle.width / 2,
          y: game.paddle.y - ballRadius - 1,
        },
        velocity: { x: 0, y: 5 },
      },
      paddle: game.paddle,
    });
    const neutralAdvanced = advanceBreakoutGame(runningGame);
    const jitteredAdvanced = advanceBreakoutGame(runningGame, { random: () => 1 });

    expect(neutralAdvanced.ball.velocity.x).toBe(0);
    expect(jitteredAdvanced.ball.velocity.x).toBeGreaterThan(0);
    expect(jitteredAdvanced.ball.velocity.y).toBeLessThan(0);
    expect(getBreakoutBallSpeed(jitteredAdvanced.ball.velocity)).toBeCloseTo(
      getBreakoutBallSpeed(runningGame.ball.velocity) * HIT_SPEED_MULTIPLIER,
    );
  });

  it("removes the first hit brick, bounces the ball, and adds the brick score", () => {
    const game = createInitialBreakoutGame();
    const targetBrick = game.bricks[0]!;
    const ballRadius = getBreakoutBallRadius();
    const runningGame = createRunningGame({
      ball: {
        position: {
          x: targetBrick.x + targetBrick.width / 2,
          y: targetBrick.y - ballRadius - 1,
        },
        velocity: { x: 0, y: 2 },
      },
      bricks: game.bricks,
    });
    const advanced = advanceBreakoutGame(runningGame);
    const hitBrick = advanced.bricks.find((brick) => brick.id === targetBrick.id);

    expect(hitBrick?.isActive).toBe(false);
    expect(advanced.score).toBe(targetBrick.points);
    expect(advanced.ball.velocity.y).toBeLessThan(0);
    expect(getBreakoutBallSpeed(advanced.ball.velocity)).toBeCloseTo(
      getBreakoutBallSpeed(runningGame.ball.velocity) * HIT_SPEED_MULTIPLIER,
    );
  });

  it("adds slight random angle jitter to brick rebounds", () => {
    const game = createInitialBreakoutGame();
    const targetBrick = game.bricks[0]!;
    const ballRadius = getBreakoutBallRadius();
    const runningGame = createRunningGame({
      ball: {
        position: {
          x: targetBrick.x + targetBrick.width / 2,
          y: targetBrick.y - ballRadius - 1,
        },
        velocity: { x: 0, y: 2 },
      },
      bricks: game.bricks,
    });
    const neutralAdvanced = advanceBreakoutGame(runningGame);
    const jitteredAdvanced = advanceBreakoutGame(runningGame, { random: () => 1 });

    expect(jitteredAdvanced.ball.velocity.y).toBeLessThan(0);
    expect(jitteredAdvanced.ball.velocity.x).not.toBeCloseTo(neutralAdvanced.ball.velocity.x);
    expect(getBreakoutBallSpeed(jitteredAdvanced.ball.velocity)).toBeCloseTo(
      getBreakoutBallSpeed(runningGame.ball.velocity) * HIT_SPEED_MULTIPLIER,
    );
  });

  it("wins when the last active brick is cleared", () => {
    const game = createInitialBreakoutGame();
    const targetBrick = game.bricks[0]!;
    const ballRadius = getBreakoutBallRadius();
    const runningGame = createRunningGame({
      ball: {
        position: {
          x: targetBrick.x + targetBrick.width / 2,
          y: targetBrick.y - ballRadius - 1,
        },
        velocity: { x: 0, y: 2 },
      },
      bricks: game.bricks.map((brick) => ({
        ...brick,
        isActive: brick.id === targetBrick.id,
      })),
    });
    const advanced = advanceBreakoutGame(runningGame);

    expect(advanced.status).toBe("won");
    expect(advanced.score).toBe(targetBrick.points);
  });

  it("resets after a miss with lives remaining and restarts from game over", () => {
    const game = createInitialBreakoutGame();
    const missedGame = createRunningGame({
      ball: {
        position: { x: 100, y: BREAKOUT_BOARD_HEIGHT + getBreakoutBallRadius() + 1 },
        velocity: { x: 0, y: 2 },
      },
      lives: 2,
      score: 70,
    });
    const readyAfterMiss = advanceBreakoutGame(missedGame);
    const lostGame = advanceBreakoutGame({
      ...missedGame,
      lives: 1,
    });
    const restartedGame = startBreakoutGame(lostGame);

    expect(readyAfterMiss.status).toBe("ready");
    expect(readyAfterMiss.lives).toBe(1);
    expect(readyAfterMiss.score).toBe(70);
    expect(readyAfterMiss.ball.position.x).toBe(BREAKOUT_BOARD_WIDTH / 2);
    expect(getBreakoutBallSpeed(readyAfterMiss.ball.velocity)).toBeCloseTo(
      PREVIOUS_INITIAL_BALL_SPEED * STARTING_SPEED_MULTIPLIER,
    );
    expect(lostGame.status).toBe("lost");
    expect(restartedGame.status).toBe("running");
    expect(restartedGame.lives).toBe(BREAKOUT_STARTING_LIVES);
    expect(restartedGame.score).toBe(0);
    expect(restartedGame.bricks).toHaveLength(game.bricks.length);
    expect(restartedGame.bricks.every((brick) => brick.isActive)).toBe(true);
  });
});
