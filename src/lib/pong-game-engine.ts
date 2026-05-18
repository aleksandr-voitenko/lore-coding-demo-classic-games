export type PongStatus = "ready" | "running" | "paused" | "won" | "lost";

export type PongPoint = {
  x: number;
  y: number;
};

export type PongBall = {
  position: PongPoint;
  velocity: PongPoint;
};

export type PongPaddle = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type PongScore = {
  cpu: number;
  player: number;
};

export type PongGameState = {
  ball: PongBall;
  cpuPaddle: PongPaddle;
  playerPaddle: PongPaddle;
  score: PongScore;
  status: PongStatus;
};

export const PONG_BOARD_WIDTH = 420;
export const PONG_BOARD_HEIGHT = 560;
export const PONG_TARGET_SCORE = 5;
export const PONG_TICK_DELAY_MS = 16;

const BALL_RADIUS = 7;
const BALL_SPEED_X = 4.8;
const BALL_SPEED_Y = 2.4;
const CPU_PADDLE_SPEED = 4.2;
const MAX_PADDLE_BOUNCE_Y = 6.4;
const PADDLE_HEIGHT = 88;
const PADDLE_INSET = 28;
const PADDLE_SPEED = 34;
const PADDLE_WIDTH = 12;

type PongScorer = keyof PongScore;

export function createInitialPongGame(): PongGameState {
  return createRoundState({ cpu: 0, player: 0 }, "ready", 1);
}

export function startPongGame(game: PongGameState): PongGameState {
  if (game.status === "running") {
    return game;
  }

  if (game.status === "paused") {
    return {
      ...game,
      status: "running" as const,
    };
  }

  if (game.status === "won" || game.status === "lost") {
    return restartPongGame();
  }

  return {
    ...game,
    status: "running" as const,
  };
}

export function pausePongGame(game: PongGameState): PongGameState {
  if (game.status !== "running") {
    return game;
  }

  return {
    ...game,
    status: "paused" as const,
  };
}

export function restartPongGame(): PongGameState {
  return {
    ...createInitialPongGame(),
    status: "running" as const,
  };
}

export function movePongPlayer(game: PongGameState, deltaY: number): PongGameState {
  if (game.status === "won" || game.status === "lost") {
    return game;
  }

  return {
    ...game,
    playerPaddle: movePaddle(game.playerPaddle, deltaY),
  };
}

export function movePongPlayerUp(game: PongGameState): PongGameState {
  return movePongPlayer(game, -PADDLE_SPEED);
}

export function movePongPlayerDown(game: PongGameState): PongGameState {
  return movePongPlayer(game, PADDLE_SPEED);
}

export function advancePongGame(game: PongGameState): PongGameState {
  if (game.status !== "running") {
    return game;
  }

  const cpuPaddle = moveCpuPaddle(game.cpuPaddle, game.ball);
  const previousBall = game.ball;
  let ball = {
    position: {
      x: previousBall.position.x + previousBall.velocity.x,
      y: previousBall.position.y + previousBall.velocity.y,
    },
    velocity: previousBall.velocity,
  };

  ball = collideWithHorizontalWalls(ball);
  ball = collideWithPaddle(previousBall, ball, game.playerPaddle, "player");
  ball = collideWithPaddle(previousBall, ball, cpuPaddle, "cpu");

  if (ball.position.x + BALL_RADIUS < 0) {
    return scorePongPoint(game, "cpu");
  }

  if (ball.position.x - BALL_RADIUS > PONG_BOARD_WIDTH) {
    return scorePongPoint(game, "player");
  }

  return {
    ...game,
    ball,
    cpuPaddle,
  };
}

export function getPongTickDelay() {
  return PONG_TICK_DELAY_MS;
}

export function getPongBallRadius() {
  return BALL_RADIUS;
}

export function getPongPlayerSpeed() {
  return PADDLE_SPEED;
}

function createRoundState(
  score: PongScore,
  status: PongStatus,
  serveDirection: -1 | 1,
): PongGameState {
  return {
    ball: createCenteredBall(serveDirection),
    cpuPaddle: createPaddle("cpu"),
    playerPaddle: createPaddle("player"),
    score,
    status,
  };
}

function createCenteredBall(serveDirection: -1 | 1): PongBall {
  return {
    position: {
      x: PONG_BOARD_WIDTH / 2,
      y: PONG_BOARD_HEIGHT / 2,
    },
    velocity: {
      x: BALL_SPEED_X * serveDirection,
      y: -BALL_SPEED_Y,
    },
  };
}

function createPaddle(owner: "cpu" | "player"): PongPaddle {
  return {
    height: PADDLE_HEIGHT,
    width: PADDLE_WIDTH,
    x: owner === "player" ? PADDLE_INSET : PONG_BOARD_WIDTH - PADDLE_INSET - PADDLE_WIDTH,
    y: (PONG_BOARD_HEIGHT - PADDLE_HEIGHT) / 2,
  };
}

function movePaddle(paddle: PongPaddle, deltaY: number): PongPaddle {
  return {
    ...paddle,
    y: clamp(paddle.y + deltaY, 0, PONG_BOARD_HEIGHT - paddle.height),
  };
}

function moveCpuPaddle(paddle: PongPaddle, ball: PongBall): PongPaddle {
  const paddleCenter = paddle.y + paddle.height / 2;
  const deltaY = clamp(ball.position.y - paddleCenter, -CPU_PADDLE_SPEED, CPU_PADDLE_SPEED);

  return movePaddle(paddle, deltaY);
}

function collideWithHorizontalWalls(ball: PongBall): PongBall {
  if (ball.position.y - BALL_RADIUS <= 0) {
    return {
      position: {
        ...ball.position,
        y: BALL_RADIUS,
      },
      velocity: {
        ...ball.velocity,
        y: Math.abs(ball.velocity.y),
      },
    };
  }

  if (ball.position.y + BALL_RADIUS >= PONG_BOARD_HEIGHT) {
    return {
      position: {
        ...ball.position,
        y: PONG_BOARD_HEIGHT - BALL_RADIUS,
      },
      velocity: {
        ...ball.velocity,
        y: -Math.abs(ball.velocity.y),
      },
    };
  }

  return ball;
}

function collideWithPaddle(
  previousBall: PongBall,
  ball: PongBall,
  paddle: PongPaddle,
  side: "cpu" | "player",
): PongBall {
  const isPlayerPaddle = side === "player";
  const paddleFaceX = isPlayerPaddle ? paddle.x + paddle.width : paddle.x;
  const wasBeforePaddleFace = isPlayerPaddle
    ? previousBall.position.x - BALL_RADIUS >= paddleFaceX
    : previousBall.position.x + BALL_RADIUS <= paddleFaceX;
  const crossedPaddleFace = isPlayerPaddle
    ? ball.position.x - BALL_RADIUS <= paddleFaceX
    : ball.position.x + BALL_RADIUS >= paddleFaceX;
  const movingTowardPaddle = isPlayerPaddle ? ball.velocity.x < 0 : ball.velocity.x > 0;
  const withinPaddleHeight =
    ball.position.y + BALL_RADIUS >= paddle.y &&
    ball.position.y - BALL_RADIUS <= paddle.y + paddle.height;

  if (!wasBeforePaddleFace || !crossedPaddleFace || !movingTowardPaddle || !withinPaddleHeight) {
    return ball;
  }

  const hitOffset = (ball.position.y - (paddle.y + paddle.height / 2)) / (paddle.height / 2);

  return {
    position: {
      x: isPlayerPaddle ? paddleFaceX + BALL_RADIUS : paddleFaceX - BALL_RADIUS,
      y: ball.position.y,
    },
    velocity: {
      x: isPlayerPaddle ? Math.abs(ball.velocity.x) : -Math.abs(ball.velocity.x),
      y: clamp(hitOffset, -1, 1) * MAX_PADDLE_BOUNCE_Y,
    },
  };
}

function scorePongPoint(game: PongGameState, scorer: PongScorer): PongGameState {
  const score = {
    ...game.score,
    [scorer]: game.score[scorer] + 1,
  };

  if (score.player >= PONG_TARGET_SCORE) {
    return {
      ...createRoundState(score, "won", -1),
      score,
    };
  }

  if (score.cpu >= PONG_TARGET_SCORE) {
    return {
      ...createRoundState(score, "lost", 1),
      score,
    };
  }

  return createRoundState(score, "ready", scorer === "player" ? 1 : -1);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
