export type BreakoutStatus = "ready" | "running" | "paused" | "lost" | "won";

export type BreakoutPoint = {
  x: number;
  y: number;
};

export type BreakoutBall = {
  position: BreakoutPoint;
  velocity: BreakoutPoint;
};

export type BreakoutPaddle = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type BreakoutBrick = {
  column: number;
  height: number;
  id: string;
  isActive: boolean;
  points: number;
  row: number;
  width: number;
  x: number;
  y: number;
};

export type BreakoutGameState = {
  ball: BreakoutBall;
  boardHeight: number;
  boardWidth: number;
  bricks: BreakoutBrick[];
  lives: number;
  paddle: BreakoutPaddle;
  score: number;
  startingLives: number;
  status: BreakoutStatus;
};

export type CreateBreakoutGameOptions = {
  boardHeight?: number;
  boardWidth?: number;
  lives?: number;
};

export const BREAKOUT_BOARD_WIDTH = 420;
export const BREAKOUT_BOARD_HEIGHT = 560;
export const BREAKOUT_BRICK_COLUMNS = 10;
export const BREAKOUT_BRICK_ROWS = 5;
export const BREAKOUT_STARTING_LIVES = 3;
export const BREAKOUT_TICK_DELAY_MS = 16;
export const BREAKOUT_BOARD_SIZE_OPTIONS = [
  { height: 480, label: "360 x 480", width: 360 },
  { height: 560, label: "420 x 560", width: 420 },
  { height: 640, label: "480 x 640", width: 480 },
] as const;
export const BREAKOUT_LIVES_OPTIONS = [2, 3, 5] as const;

const BALL_RADIUS = 6;
const BRICK_GAP = 6;
const BRICK_HEIGHT = 20;
const BRICK_HORIZONTAL_PADDING = 24;
const BRICK_TOP = 56;
const INITIAL_BALL_VELOCITY: BreakoutPoint = { x: 3.2, y: -5.2 };
const MAX_PADDLE_BOUNCE_X = 5.8;
const PADDLE_HEIGHT = 12;
const PADDLE_SPEED = 7;
const PADDLE_WIDTH = 92;

export function createBreakoutBricks(boardWidth = BREAKOUT_BOARD_WIDTH) {
  const brickWidth =
    (boardWidth - BRICK_HORIZONTAL_PADDING * 2 - BRICK_GAP * (BREAKOUT_BRICK_COLUMNS - 1)) /
    BREAKOUT_BRICK_COLUMNS;

  return Array.from({ length: BREAKOUT_BRICK_ROWS }, (_, row) =>
    Array.from({ length: BREAKOUT_BRICK_COLUMNS }, (_, column): BreakoutBrick => {
      const x = BRICK_HORIZONTAL_PADDING + column * (brickWidth + BRICK_GAP);
      const y = BRICK_TOP + row * (BRICK_HEIGHT + BRICK_GAP);

      return {
        column,
        height: BRICK_HEIGHT,
        id: `${row}:${column}`,
        isActive: true,
        points: (BREAKOUT_BRICK_ROWS - row) * 10,
        row,
        width: brickWidth,
        x,
        y,
      };
    }),
  ).flat();
}

export function createInitialBreakoutGame({
  boardHeight = BREAKOUT_BOARD_HEIGHT,
  boardWidth = BREAKOUT_BOARD_WIDTH,
  lives = BREAKOUT_STARTING_LIVES,
}: CreateBreakoutGameOptions = {}): BreakoutGameState {
  const normalizedBoardWidth = normalizeBreakoutDimension(boardWidth, BREAKOUT_BOARD_WIDTH, 240);
  const normalizedBoardHeight = normalizeBreakoutDimension(boardHeight, BREAKOUT_BOARD_HEIGHT, 320);
  const normalizedLives = normalizeBreakoutLives(lives);
  const paddle = createCenteredPaddle(normalizedBoardWidth, normalizedBoardHeight);

  return {
    ball: createBallForPaddle(paddle),
    boardHeight: normalizedBoardHeight,
    boardWidth: normalizedBoardWidth,
    bricks: createBreakoutBricks(normalizedBoardWidth),
    lives: normalizedLives,
    paddle,
    score: 0,
    startingLives: normalizedLives,
    status: "ready",
  };
}

export function startBreakoutGame(game: BreakoutGameState): BreakoutGameState {
  if (game.status === "running") {
    return game;
  }

  if (game.status === "paused") {
    return {
      ...game,
      status: "running" as const,
    };
  }

  if (game.status === "lost" || game.status === "won") {
    return restartBreakoutGame(game);
  }

  return {
    ...game,
    status: "running" as const,
  };
}

export function pauseBreakoutGame(game: BreakoutGameState): BreakoutGameState {
  if (game.status !== "running") {
    return game;
  }

  return {
    ...game,
    status: "paused" as const,
  };
}

export function restartBreakoutGame(
  game: Pick<BreakoutGameState, "boardHeight" | "boardWidth" | "startingLives"> = {
    boardHeight: BREAKOUT_BOARD_HEIGHT,
    boardWidth: BREAKOUT_BOARD_WIDTH,
    startingLives: BREAKOUT_STARTING_LIVES,
  },
): BreakoutGameState {
  return {
    ...createInitialBreakoutGame({
      boardHeight: game.boardHeight,
      boardWidth: game.boardWidth,
      lives: game.startingLives,
    }),
    status: "running" as const,
  };
}

export function moveBreakoutPaddle(
  game: BreakoutGameState,
  deltaX: number,
): BreakoutGameState {
  if (game.status === "lost" || game.status === "won") {
    return game;
  }

  const paddle = {
    ...game.paddle,
    x: clamp(game.paddle.x + deltaX, 0, game.boardWidth - game.paddle.width),
  };

  return {
    ...game,
    ball: game.status === "ready" ? createBallForPaddle(paddle, game.ball.velocity) : game.ball,
    paddle,
  };
}

export function moveBreakoutPaddleLeft(game: BreakoutGameState): BreakoutGameState {
  return moveBreakoutPaddle(game, -PADDLE_SPEED);
}

export function moveBreakoutPaddleRight(game: BreakoutGameState): BreakoutGameState {
  return moveBreakoutPaddle(game, PADDLE_SPEED);
}

export function advanceBreakoutGame(game: BreakoutGameState): BreakoutGameState {
  if (game.status !== "running") {
    return game;
  }

  const previousBall = game.ball;
  let ball: BreakoutBall = {
    position: {
      x: previousBall.position.x + previousBall.velocity.x,
      y: previousBall.position.y + previousBall.velocity.y,
    },
    velocity: previousBall.velocity,
  };

  ball = collideWithWalls(ball, game.boardWidth);

  if (ball.position.y - BALL_RADIUS > game.boardHeight) {
    return loseBreakoutLife(game);
  }

  ball = collideWithPaddle(previousBall, ball, game.paddle);

  const brickCollision = getFirstBrickCollision(previousBall, ball, game.bricks);

  if (brickCollision === null) {
    return {
      ...game,
      ball,
    };
  }

  const bricks = game.bricks.map((brick) =>
    brick.id === brickCollision.brick.id ? { ...brick, isActive: false } : brick,
  );
  const score = game.score + brickCollision.brick.points;
  const activeBricks = bricks.filter((brick) => brick.isActive);

  return {
    ...game,
    ball: brickCollision.ball,
    bricks,
    score,
    status: activeBricks.length === 0 ? "won" : game.status,
  };
}

export function getBreakoutTickDelay() {
  return BREAKOUT_TICK_DELAY_MS;
}

export function getBreakoutBallRadius() {
  return BALL_RADIUS;
}

function createCenteredPaddle(
  boardWidth = BREAKOUT_BOARD_WIDTH,
  boardHeight = BREAKOUT_BOARD_HEIGHT,
): BreakoutPaddle {
  return {
    height: PADDLE_HEIGHT,
    width: PADDLE_WIDTH,
    x: (boardWidth - PADDLE_WIDTH) / 2,
    y: boardHeight - 40,
  };
}

function createBallForPaddle(
  paddle: BreakoutPaddle,
  velocity: BreakoutPoint = INITIAL_BALL_VELOCITY,
): BreakoutBall {
  return {
    position: {
      x: paddle.x + paddle.width / 2,
      y: paddle.y - BALL_RADIUS - 1,
    },
    velocity,
  };
}

function collideWithWalls(ball: BreakoutBall, boardWidth: number): BreakoutBall {
  let nextBall = ball;

  if (nextBall.position.x - BALL_RADIUS <= 0) {
    nextBall = {
      position: {
        ...nextBall.position,
        x: BALL_RADIUS,
      },
      velocity: {
        ...nextBall.velocity,
        x: Math.abs(nextBall.velocity.x),
      },
    };
  }

  if (nextBall.position.x + BALL_RADIUS >= boardWidth) {
    nextBall = {
      position: {
        ...nextBall.position,
        x: boardWidth - BALL_RADIUS,
      },
      velocity: {
        ...nextBall.velocity,
        x: -Math.abs(nextBall.velocity.x),
      },
    };
  }

  if (nextBall.position.y - BALL_RADIUS <= 0) {
    nextBall = {
      position: {
        ...nextBall.position,
        y: BALL_RADIUS,
      },
      velocity: {
        ...nextBall.velocity,
        y: Math.abs(nextBall.velocity.y),
      },
    };
  }

  return nextBall;
}

function collideWithPaddle(
  previousBall: BreakoutBall,
  ball: BreakoutBall,
  paddle: BreakoutPaddle,
): BreakoutBall {
  const wasAbovePaddle = previousBall.position.y + BALL_RADIUS <= paddle.y;
  const crossedPaddleTop = ball.position.y + BALL_RADIUS >= paddle.y;
  const withinPaddleWidth =
    ball.position.x >= paddle.x - BALL_RADIUS &&
    ball.position.x <= paddle.x + paddle.width + BALL_RADIUS;

  if (!wasAbovePaddle || !crossedPaddleTop || !withinPaddleWidth || ball.velocity.y <= 0) {
    return ball;
  }

  const hitOffset = (ball.position.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);

  return {
    position: {
      ...ball.position,
      y: paddle.y - BALL_RADIUS,
    },
    velocity: {
      x: clamp(hitOffset, -1, 1) * MAX_PADDLE_BOUNCE_X,
      y: -Math.abs(ball.velocity.y),
    },
  };
}

function getFirstBrickCollision(
  previousBall: BreakoutBall,
  ball: BreakoutBall,
  bricks: BreakoutBrick[],
) {
  const brick = bricks.find((candidate) => candidate.isActive && ballIntersectsBrick(ball, candidate));

  if (brick === undefined) {
    return null;
  }

  return {
    ball: bounceOffBrick(previousBall, ball, brick),
    brick,
  };
}

function ballIntersectsBrick(ball: BreakoutBall, brick: BreakoutBrick) {
  const nearestX = clamp(ball.position.x, brick.x, brick.x + brick.width);
  const nearestY = clamp(ball.position.y, brick.y, brick.y + brick.height);
  const distanceX = ball.position.x - nearestX;
  const distanceY = ball.position.y - nearestY;

  return distanceX * distanceX + distanceY * distanceY <= BALL_RADIUS * BALL_RADIUS;
}

function bounceOffBrick(
  previousBall: BreakoutBall,
  ball: BreakoutBall,
  brick: BreakoutBrick,
): BreakoutBall {
  const cameFromAbove = previousBall.position.y + BALL_RADIUS <= brick.y;
  const cameFromBelow = previousBall.position.y - BALL_RADIUS >= brick.y + brick.height;
  const nextVelocity = { ...ball.velocity };

  if (cameFromAbove) {
    nextVelocity.y = -Math.abs(ball.velocity.y);
  } else if (cameFromBelow) {
    nextVelocity.y = Math.abs(ball.velocity.y);
  } else {
    nextVelocity.x = -ball.velocity.x;
  }

  return {
    ...ball,
    velocity: nextVelocity,
  };
}

function loseBreakoutLife(game: BreakoutGameState): BreakoutGameState {
  if (game.lives <= 1) {
    return {
      ...game,
      lives: 0,
      status: "lost",
    };
  }

  const paddle = createCenteredPaddle(game.boardWidth, game.boardHeight);

  return {
    ...game,
    ball: createBallForPaddle(paddle),
    lives: game.lives - 1,
    paddle,
    status: "ready",
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeBreakoutDimension(value: number, fallback: number, minimum: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(minimum, Math.floor(value));
}

function normalizeBreakoutLives(lives: number) {
  if (!Number.isFinite(lives)) {
    return BREAKOUT_STARTING_LIVES;
  }

  return Math.max(1, Math.floor(lives));
}
