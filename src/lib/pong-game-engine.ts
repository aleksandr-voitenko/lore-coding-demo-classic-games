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
  boardHeight: number;
  boardWidth: number;
  cpuPaddle: PongPaddle;
  playerPaddle: PongPaddle;
  score: PongScore;
  status: PongStatus;
  targetScore: number;
};

export type CreatePongGameOptions = {
  boardHeight?: number;
  boardWidth?: number;
  targetScore?: number;
};

export const PONG_BOARD_WIDTH = 420;
export const PONG_BOARD_HEIGHT = 560;
export const PONG_TARGET_SCORE = 5;
export const PONG_TICK_DELAY_MS = 16;
export const PONG_BOARD_SIZE_OPTIONS = [
  { height: 480, label: "360 x 480", width: 360 },
  { height: 560, label: "420 x 560", width: 420 },
  { height: 640, label: "480 x 640", width: 480 },
] as const;
export const PONG_TARGET_SCORE_OPTIONS = [3, 5, 7] as const;

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

export function createInitialPongGame({
  boardHeight = PONG_BOARD_HEIGHT,
  boardWidth = PONG_BOARD_WIDTH,
  targetScore = PONG_TARGET_SCORE,
}: CreatePongGameOptions = {}): PongGameState {
  const normalizedBoardWidth = normalizePongDimension(boardWidth, PONG_BOARD_WIDTH, 240);
  const normalizedBoardHeight = normalizePongDimension(boardHeight, PONG_BOARD_HEIGHT, 320);
  const normalizedTargetScore = normalizePongTargetScore(targetScore);

  return createRoundState(
    { cpu: 0, player: 0 },
    "ready",
    1,
    normalizedBoardWidth,
    normalizedBoardHeight,
    normalizedTargetScore,
  );
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
    return restartPongGame(game);
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

export function restartPongGame(
  game: Pick<PongGameState, "boardHeight" | "boardWidth" | "targetScore"> = {
    boardHeight: PONG_BOARD_HEIGHT,
    boardWidth: PONG_BOARD_WIDTH,
    targetScore: PONG_TARGET_SCORE,
  },
): PongGameState {
  return {
    ...createInitialPongGame({
      boardHeight: game.boardHeight,
      boardWidth: game.boardWidth,
      targetScore: game.targetScore,
    }),
    status: "running" as const,
  };
}

export function movePongPlayer(game: PongGameState, deltaY: number): PongGameState {
  if (game.status === "won" || game.status === "lost") {
    return game;
  }

  return {
    ...game,
    playerPaddle: movePaddle(game.playerPaddle, deltaY, game.boardHeight),
  };
}

export function movePongPlayerUp(game: PongGameState): PongGameState {
  return movePongPlayer(game, -PADDLE_SPEED);
}

export function movePongPlayerDown(game: PongGameState): PongGameState {
  return movePongPlayer(game, PADDLE_SPEED);
}

export function isPongBetweenRounds(game: Pick<PongGameState, "score" | "status">) {
  return game.status === "ready" && hasScoredPongPoint(game.score);
}

export function isPongMatchInProgress(game: Pick<PongGameState, "score" | "status">) {
  return game.status === "running" || game.status === "paused" || isPongBetweenRounds(game);
}

export function advancePongGame(game: PongGameState): PongGameState {
  if (game.status !== "running") {
    return game;
  }

  const cpuPaddle = moveCpuPaddle(game.cpuPaddle, game.ball, game.boardHeight);
  const previousBall = game.ball;
  let ball = {
    position: {
      x: previousBall.position.x + previousBall.velocity.x,
      y: previousBall.position.y + previousBall.velocity.y,
    },
    velocity: previousBall.velocity,
  };

  ball = collideWithHorizontalWalls(ball, game.boardHeight);
  ball = collideWithPaddle(previousBall, ball, game.playerPaddle, "player");
  ball = collideWithPaddle(previousBall, ball, cpuPaddle, "cpu");

  if (ball.position.x + BALL_RADIUS < 0) {
    return scorePongPoint(game, "cpu");
  }

  if (ball.position.x - BALL_RADIUS > game.boardWidth) {
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
  boardWidth = PONG_BOARD_WIDTH,
  boardHeight = PONG_BOARD_HEIGHT,
  targetScore = PONG_TARGET_SCORE,
): PongGameState {
  return {
    ball: createCenteredBall(serveDirection, boardWidth, boardHeight),
    boardHeight,
    boardWidth,
    cpuPaddle: createPaddle("cpu", boardWidth, boardHeight),
    playerPaddle: createPaddle("player", boardWidth, boardHeight),
    score,
    status,
    targetScore,
  };
}

function createCenteredBall(
  serveDirection: -1 | 1,
  boardWidth = PONG_BOARD_WIDTH,
  boardHeight = PONG_BOARD_HEIGHT,
): PongBall {
  return {
    position: {
      x: boardWidth / 2,
      y: boardHeight / 2,
    },
    velocity: {
      x: BALL_SPEED_X * serveDirection,
      y: -BALL_SPEED_Y,
    },
  };
}

function createPaddle(
  owner: "cpu" | "player",
  boardWidth = PONG_BOARD_WIDTH,
  boardHeight = PONG_BOARD_HEIGHT,
): PongPaddle {
  return {
    height: PADDLE_HEIGHT,
    width: PADDLE_WIDTH,
    x: owner === "player" ? PADDLE_INSET : boardWidth - PADDLE_INSET - PADDLE_WIDTH,
    y: (boardHeight - PADDLE_HEIGHT) / 2,
  };
}

function movePaddle(
  paddle: PongPaddle,
  deltaY: number,
  boardHeight = PONG_BOARD_HEIGHT,
): PongPaddle {
  return {
    ...paddle,
    y: clamp(paddle.y + deltaY, 0, boardHeight - paddle.height),
  };
}

function hasScoredPongPoint(score: PongScore) {
  return score.player > 0 || score.cpu > 0;
}

function moveCpuPaddle(
  paddle: PongPaddle,
  ball: PongBall,
  boardHeight = PONG_BOARD_HEIGHT,
): PongPaddle {
  const paddleCenter = paddle.y + paddle.height / 2;
  const deltaY = clamp(ball.position.y - paddleCenter, -CPU_PADDLE_SPEED, CPU_PADDLE_SPEED);

  return movePaddle(paddle, deltaY, boardHeight);
}

function collideWithHorizontalWalls(ball: PongBall, boardHeight = PONG_BOARD_HEIGHT): PongBall {
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

  if (ball.position.y + BALL_RADIUS >= boardHeight) {
    return {
      position: {
        ...ball.position,
        y: boardHeight - BALL_RADIUS,
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

  if (score.player >= game.targetScore) {
    return {
      ...createRoundState(
        score,
        "won",
        -1,
        game.boardWidth,
        game.boardHeight,
        game.targetScore,
      ),
      score,
    };
  }

  if (score.cpu >= game.targetScore) {
    return {
      ...createRoundState(
        score,
        "lost",
        1,
        game.boardWidth,
        game.boardHeight,
        game.targetScore,
      ),
      score,
    };
  }

  return createRoundState(
    score,
    "ready",
    scorer === "player" ? 1 : -1,
    game.boardWidth,
    game.boardHeight,
    game.targetScore,
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizePongDimension(value: number, fallback: number, minimum: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(minimum, Math.floor(value));
}

function normalizePongTargetScore(targetScore: number) {
  if (!Number.isFinite(targetScore)) {
    return PONG_TARGET_SCORE;
  }

  return Math.max(1, Math.floor(targetScore));
}
