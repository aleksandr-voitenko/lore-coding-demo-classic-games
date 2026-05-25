import { describe, expect, it } from "vitest";

import {
  advancePongGame,
  createInitialPongGame,
  decrementPongRemainingScore,
  getPongBallRadius,
  getPongMaximumScore,
  getPongPlayerSpeed,
  getPongScoreTickDelay,
  isPongBetweenRounds,
  isPongMatchInProgress,
  isPongScoreCountingDown,
  movePongPlayer,
  pausePongGame,
  PONG_BOARD_HEIGHT,
  PONG_BOARD_WIDTH,
  PONG_TARGET_SCORE,
  restartPongGame,
  startPongGame,
  type PongGameState,
} from "./pong-game-engine";

function createRunningGame(overrides: Partial<PongGameState> = {}): PongGameState {
  return {
    ...createInitialPongGame(),
    status: "running",
    ...overrides,
  };
}

describe("pong game engine", () => {
  it("creates a ready game with centered paddles, centered ball, and maximum score", () => {
    const game = createInitialPongGame();

    expect(game.status).toBe("ready");
    expect(game.score).toEqual({ cpu: 0, player: 0 });
    expect(game.remainingScore).toBe(getPongMaximumScore(PONG_TARGET_SCORE));
    expect(game.ball.position).toEqual({
      x: PONG_BOARD_WIDTH / 2,
      y: PONG_BOARD_HEIGHT / 2,
    });
    expect(game.playerPaddle.y + game.playerPaddle.height / 2).toBe(PONG_BOARD_HEIGHT / 2);
    expect(game.cpuPaddle.y + game.cpuPaddle.height / 2).toBe(PONG_BOARD_HEIGHT / 2);
    expect(game.playerPaddle.x).toBeLessThan(game.cpuPaddle.x);
  });

  it("creates configurable board sizes and target scores", () => {
    const game = createInitialPongGame({
      boardHeight: 640,
      boardWidth: 480,
      targetScore: 7,
    });
    const restarted = restartPongGame(game);

    expect(game.boardHeight).toBe(640);
    expect(game.boardWidth).toBe(480);
    expect(game.targetScore).toBe(7);
    expect(game.remainingScore).toBe(1_400);
    expect(game.ball.position).toEqual({ x: 240, y: 320 });
    expect(game.playerPaddle.y + game.playerPaddle.height / 2).toBe(320);
    expect(restarted.boardHeight).toBe(640);
    expect(restarted.boardWidth).toBe(480);
    expect(restarted.targetScore).toBe(7);
    expect(restarted.remainingScore).toBe(1_400);
    expect(restarted.status).toBe("running");
  });

  it("starts, pauses, and resumes without replacing the active rally", () => {
    const readyGame = createInitialPongGame();
    const runningGame = startPongGame(readyGame);
    const pausedGame = pausePongGame(runningGame);
    const resumedGame = startPongGame(pausedGame);

    expect(runningGame.status).toBe("running");
    expect(pausedGame.status).toBe("paused");
    expect(resumedGame.status).toBe("running");
    expect(resumedGame.ball).toBe(pausedGame.ball);
  });

  it("counts the remaining score down once per active match second", () => {
    const initialGame = createInitialPongGame();
    const runningGame = startPongGame(initialGame);
    const decrementedRunningGame = decrementPongRemainingScore(runningGame);
    const pausedGame = pausePongGame(decrementedRunningGame);

    expect(getPongScoreTickDelay()).toBe(1_000);
    expect(isPongScoreCountingDown(initialGame)).toBe(false);
    expect(isPongScoreCountingDown(runningGame)).toBe(true);
    expect(isPongScoreCountingDown(pausedGame)).toBe(false);
    expect(decrementedRunningGame.remainingScore).toBe(initialGame.remainingScore - 5);
    expect(decrementPongRemainingScore(initialGame)).toBe(initialGame);
    expect(decrementPongRemainingScore(pausedGame)).toBe(pausedGame);
  });

  it("moves the player paddle within the top and bottom walls", () => {
    const game = createInitialPongGame();
    const movedToTop = movePongPlayer(game, -1_000);
    const movedToBottom = movePongPlayer(movedToTop, 1_000);

    expect(movedToTop.playerPaddle.y).toBe(0);
    expect(movedToBottom.playerPaddle.y).toBe(
      PONG_BOARD_HEIGHT - movedToBottom.playerPaddle.height,
    );
    expect(getPongPlayerSpeed()).toBeGreaterThan(0);
  });

  it("bounces the ball off the top and bottom walls", () => {
    const ballRadius = getPongBallRadius();
    const topWallGame = createRunningGame({
      ball: {
        position: { x: 200, y: ballRadius + 1 },
        velocity: { x: 2, y: -5 },
      },
    });
    const bottomWallGame = createRunningGame({
      ball: {
        position: { x: 200, y: PONG_BOARD_HEIGHT - ballRadius - 1 },
        velocity: { x: 2, y: 5 },
      },
    });

    expect(advancePongGame(topWallGame).ball.velocity.y).toBeGreaterThan(0);
    expect(advancePongGame(bottomWallGame).ball.velocity.y).toBeLessThan(0);
  });

  it("bounces the ball from the player paddle when it crosses the paddle face", () => {
    const game = createInitialPongGame();
    const ballRadius = getPongBallRadius();
    const runningGame = createRunningGame({
      ball: {
        position: {
          x: game.playerPaddle.x + game.playerPaddle.width + ballRadius + 1,
          y: game.playerPaddle.y + game.playerPaddle.height / 2,
        },
        velocity: { x: -5, y: 0 },
      },
      playerPaddle: game.playerPaddle,
    });
    const advanced = advancePongGame(runningGame);

    expect(advanced.ball.position.x).toBe(
      game.playerPaddle.x + game.playerPaddle.width + ballRadius,
    );
    expect(advanced.ball.velocity.x).toBeGreaterThan(0);
  });

  it("bounces the ball from the CPU paddle when it crosses the paddle face", () => {
    const game = createInitialPongGame();
    const ballRadius = getPongBallRadius();
    const runningGame = createRunningGame({
      ball: {
        position: {
          x: game.cpuPaddle.x - ballRadius - 1,
          y: game.cpuPaddle.y + game.cpuPaddle.height / 2,
        },
        velocity: { x: 5, y: 0 },
      },
      cpuPaddle: game.cpuPaddle,
    });
    const advanced = advancePongGame(runningGame);

    expect(advanced.ball.position.x).toBe(game.cpuPaddle.x - ballRadius);
    expect(advanced.ball.velocity.x).toBeLessThan(0);
  });

  it("moves the CPU paddle toward the ball during a running rally", () => {
    const game = createInitialPongGame();
    const runningGame = createRunningGame({
      ball: {
        position: { x: PONG_BOARD_WIDTH / 2, y: game.cpuPaddle.y + game.cpuPaddle.height },
        velocity: { x: 3, y: 0 },
      },
      cpuPaddle: game.cpuPaddle,
    });
    const advanced = advancePongGame(runningGame);

    expect(advanced.cpuPaddle.y).toBeGreaterThan(game.cpuPaddle.y);
  });

  it("scores for the player, resets the rally, and keeps the match ready", () => {
    const ballRadius = getPongBallRadius();
    const runningGame = createRunningGame({
      ball: {
        position: { x: PONG_BOARD_WIDTH + ballRadius + 1, y: PONG_BOARD_HEIGHT / 2 },
        velocity: { x: 5, y: 0 },
      },
      score: { cpu: 1, player: 2 },
    });
    const advanced = advancePongGame(runningGame);

    expect(advanced.status).toBe("ready");
    expect(advanced.score).toEqual({ cpu: 1, player: 3 });
    expect(advanced.remainingScore).toBe(runningGame.remainingScore);
    expect(advanced.ball.position).toEqual({
      x: PONG_BOARD_WIDTH / 2,
      y: PONG_BOARD_HEIGHT / 2,
    });
    expect(advanced.ball.velocity.x).toBeGreaterThan(0);
  });

  it("subtracts points when the computer wins a rally", () => {
    const ballRadius = getPongBallRadius();
    const runningGame = createRunningGame({
      ball: {
        position: { x: -ballRadius - 1, y: PONG_BOARD_HEIGHT / 2 },
        velocity: { x: -5, y: 0 },
      },
      remainingScore: 750,
      score: { cpu: 1, player: 2 },
    });
    const advanced = advancePongGame(runningGame);

    expect(advanced.status).toBe("ready");
    expect(advanced.score).toEqual({ cpu: 2, player: 2 });
    expect(advanced.remainingScore).toBe(650);
  });

  it("pauses remaining score between rallies and clamps running countdown at zero", () => {
    const ballRadius = getPongBallRadius();
    const betweenRoundsGame = advancePongGame(
      createRunningGame({
        ball: {
          position: { x: PONG_BOARD_WIDTH + ballRadius + 1, y: PONG_BOARD_HEIGHT / 2 },
          velocity: { x: 5, y: 0 },
        },
        remainingScore: 1,
      }),
    );
    const attemptedBetweenRoundsDecrement = decrementPongRemainingScore(betweenRoundsGame);
    const resumedGame = startPongGame(attemptedBetweenRoundsDecrement);
    const zeroScoreGame = decrementPongRemainingScore(resumedGame);
    const clampedZeroScoreGame = decrementPongRemainingScore(zeroScoreGame);

    expect(isPongBetweenRounds(betweenRoundsGame)).toBe(true);
    expect(isPongScoreCountingDown(betweenRoundsGame)).toBe(false);
    expect(attemptedBetweenRoundsDecrement).toBe(betweenRoundsGame);
    expect(zeroScoreGame.remainingScore).toBe(0);
    expect(clampedZeroScoreGame.remainingScore).toBe(0);
  });

  it("distinguishes pre-match ready state from between-round ready state", () => {
    const ballRadius = getPongBallRadius();
    const initialGame = createInitialPongGame();
    const runningGame = startPongGame(initialGame);
    const pausedGame = pausePongGame(runningGame);
    const betweenRoundsGame = advancePongGame(
      createRunningGame({
        ball: {
          position: { x: PONG_BOARD_WIDTH + ballRadius + 1, y: PONG_BOARD_HEIGHT / 2 },
          velocity: { x: 5, y: 0 },
        },
      }),
    );
    const endedGame = advancePongGame(
      createRunningGame({
        ball: {
          position: { x: PONG_BOARD_WIDTH + ballRadius + 1, y: PONG_BOARD_HEIGHT / 2 },
          velocity: { x: 5, y: 0 },
        },
        score: { cpu: 0, player: PONG_TARGET_SCORE - 1 },
      }),
    );

    expect(isPongBetweenRounds(initialGame)).toBe(false);
    expect(isPongBetweenRounds(betweenRoundsGame)).toBe(true);
    expect(isPongBetweenRounds(endedGame)).toBe(false);
    expect(isPongMatchInProgress(initialGame)).toBe(false);
    expect(isPongMatchInProgress(runningGame)).toBe(true);
    expect(isPongMatchInProgress(pausedGame)).toBe(true);
    expect(isPongMatchInProgress(betweenRoundsGame)).toBe(true);
    expect(isPongMatchInProgress(endedGame)).toBe(false);
    expect(isPongScoreCountingDown(betweenRoundsGame)).toBe(false);
    expect(isPongScoreCountingDown(endedGame)).toBe(false);
  });

  it("ends the match when either side reaches the target score", () => {
    const ballRadius = getPongBallRadius();
    const playerWin = advancePongGame(
      createRunningGame({
        ball: {
          position: { x: PONG_BOARD_WIDTH + ballRadius + 1, y: PONG_BOARD_HEIGHT / 2 },
          velocity: { x: 5, y: 0 },
        },
        score: { cpu: 2, player: PONG_TARGET_SCORE - 1 },
      }),
    );
    const cpuWin = advancePongGame(
      createRunningGame({
        ball: {
          position: { x: -ballRadius - 1, y: PONG_BOARD_HEIGHT / 2 },
          velocity: { x: -5, y: 0 },
        },
        score: { cpu: PONG_TARGET_SCORE - 1, player: 2 },
      }),
    );

    expect(playerWin.status).toBe("won");
    expect(playerWin.score.player).toBe(PONG_TARGET_SCORE);
    expect(playerWin.remainingScore).toBe(getPongMaximumScore(PONG_TARGET_SCORE));
    expect(cpuWin.status).toBe("lost");
    expect(cpuWin.score.cpu).toBe(PONG_TARGET_SCORE);
    expect(cpuWin.remainingScore).toBe(
      getPongMaximumScore(PONG_TARGET_SCORE) - 100,
    );
  });

  it("restarts from an ended match with a fresh running game", () => {
    const endedGame = createRunningGame({
      score: { cpu: PONG_TARGET_SCORE, player: 1 },
      status: "lost",
    });
    const restartedGame = startPongGame(endedGame);

    expect(restartedGame.status).toBe("running");
    expect(restartedGame.score).toEqual({ cpu: 0, player: 0 });
    expect(restartedGame.remainingScore).toBe(getPongMaximumScore(PONG_TARGET_SCORE));
    expect(restartedGame.ball.position).toEqual({
      x: PONG_BOARD_WIDTH / 2,
      y: PONG_BOARD_HEIGHT / 2,
    });
  });
});
