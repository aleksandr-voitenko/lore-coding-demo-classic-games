import {
  BREAKOUT_BOARD_HEIGHT,
  BREAKOUT_BOARD_WIDTH,
  BREAKOUT_STARTING_LIVES,
} from "./breakout-parameters";

export {
  BREAKOUT_BOARD_HEIGHT,
  BREAKOUT_BOARD_SIZE_OPTIONS,
  BREAKOUT_BOARD_WIDTH,
  BREAKOUT_LIVES_OPTIONS,
  BREAKOUT_STARTING_LIVES,
} from "./breakout-parameters";

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

export type AdvanceBreakoutGameOptions = {
  random?: BreakoutRandomSource;
};

type BreakoutRandomSource = () => number;
type BreakoutVelocitySign = "negative" | "positive";

export const BREAKOUT_BRICK_COLUMNS = 10;
export const BREAKOUT_BRICK_ROWS = 5;
export const BREAKOUT_TICK_DELAY_MS = 16;

const BALL_RADIUS = 6;
const BALL_HIT_ANGLE_JITTER_RADIANS = Math.PI / 60;
const BALL_HIT_SPEED_MULTIPLIER = 1.002;
const BRICK_GAP = 6;
const BRICK_HEIGHT = 20;
const BRICK_HORIZONTAL_PADDING = 24;
const BRICK_TOP = 56;
const INITIAL_BALL_VELOCITY: BreakoutPoint = { x: 1.68, y: -2.73 };
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
  return createInitialBreakoutGame({
    boardHeight: game.boardHeight,
    boardWidth: game.boardWidth,
    lives: game.startingLives,
  });
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

export function advanceBreakoutGame(
  game: BreakoutGameState,
  { random = getNeutralRandomValue }: AdvanceBreakoutGameOptions = {},
): BreakoutGameState {
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

  ball = collideWithWalls(ball, game.boardWidth, random);

  if (ball.position.y - BALL_RADIUS > game.boardHeight) {
    return loseBreakoutLife(game);
  }

  ball = collideWithPaddle(previousBall, ball, game.paddle, random);

  const brickCollision = getFirstBrickCollision(previousBall, ball, game.bricks, random);

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

export function getBreakoutBallSpeed(velocity: BreakoutPoint) {
  return Math.hypot(velocity.x, velocity.y);
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

function collideWithWalls(
  ball: BreakoutBall,
  boardWidth: number,
  random: BreakoutRandomSource,
): BreakoutBall {
  let nextBall = ball;

  if (nextBall.position.x - BALL_RADIUS <= 0) {
    nextBall = {
      position: {
        ...nextBall.position,
        x: BALL_RADIUS,
      },
      velocity: increaseBallSpeed(
        {
          ...nextBall.velocity,
          x: Math.abs(nextBall.velocity.x),
        },
        random,
        { x: "positive" },
      ),
    };
  }

  if (nextBall.position.x + BALL_RADIUS >= boardWidth) {
    nextBall = {
      position: {
        ...nextBall.position,
        x: boardWidth - BALL_RADIUS,
      },
      velocity: increaseBallSpeed(
        {
          ...nextBall.velocity,
          x: -Math.abs(nextBall.velocity.x),
        },
        random,
        { x: "negative" },
      ),
    };
  }

  if (nextBall.position.y - BALL_RADIUS <= 0) {
    nextBall = {
      position: {
        ...nextBall.position,
        y: BALL_RADIUS,
      },
      velocity: increaseBallSpeed(
        {
          ...nextBall.velocity,
          y: Math.abs(nextBall.velocity.y),
        },
        random,
        { y: "positive" },
      ),
    };
  }

  return nextBall;
}

function collideWithPaddle(
  previousBall: BreakoutBall,
  ball: BreakoutBall,
  paddle: BreakoutPaddle,
  random: BreakoutRandomSource,
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

  const velocity = jitterAndNormalizeVelocity(
    {
      x: clamp(hitOffset, -1, 1) * MAX_PADDLE_BOUNCE_X,
      y: -Math.abs(ball.velocity.y),
    },
    getBreakoutBallSpeed(ball.velocity) * BALL_HIT_SPEED_MULTIPLIER,
    random,
    { y: "negative" },
  );

  return {
    position: {
      ...ball.position,
      y: paddle.y - BALL_RADIUS,
    },
    velocity,
  };
}

function getFirstBrickCollision(
  previousBall: BreakoutBall,
  ball: BreakoutBall,
  bricks: BreakoutBrick[],
  random: BreakoutRandomSource,
) {
  const brick = bricks.find((candidate) => candidate.isActive && ballIntersectsBrick(ball, candidate));

  if (brick === undefined) {
    return null;
  }

  return {
    ball: bounceOffBrick(previousBall, ball, brick, random),
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
  random: BreakoutRandomSource,
): BreakoutBall {
  const cameFromAbove = previousBall.position.y + BALL_RADIUS <= brick.y;
  const cameFromBelow = previousBall.position.y - BALL_RADIUS >= brick.y + brick.height;
  const nextVelocity = { ...ball.velocity };
  let enforcedSign: { x?: BreakoutVelocitySign; y?: BreakoutVelocitySign };

  if (cameFromAbove) {
    nextVelocity.y = -Math.abs(ball.velocity.y);
    enforcedSign = { y: "negative" };
  } else if (cameFromBelow) {
    nextVelocity.y = Math.abs(ball.velocity.y);
    enforcedSign = { y: "positive" };
  } else {
    nextVelocity.x = -ball.velocity.x;
    enforcedSign = { x: nextVelocity.x < 0 ? "negative" : "positive" };
  }

  return {
    ...ball,
    velocity: increaseBallSpeed(nextVelocity, random, enforcedSign),
  };
}

function increaseBallSpeed(
  velocity: BreakoutPoint,
  random: BreakoutRandomSource,
  enforcedSign: { x?: BreakoutVelocitySign; y?: BreakoutVelocitySign } = {},
): BreakoutPoint {
  return jitterAndNormalizeVelocity(
    velocity,
    getBreakoutBallSpeed(velocity) * BALL_HIT_SPEED_MULTIPLIER,
    random,
    enforcedSign,
  );
}

function jitterAndNormalizeVelocity(
  velocity: BreakoutPoint,
  targetSpeed: number,
  random: BreakoutRandomSource,
  enforcedSign: { x?: BreakoutVelocitySign; y?: BreakoutVelocitySign },
): BreakoutPoint {
  const jitteredVelocity = rotateVelocity(velocity, getBreakoutAngleJitter(random));

  return normalizeVelocityToSpeed(
    {
      x: enforceVelocitySign(jitteredVelocity.x, enforcedSign.x),
      y: enforceVelocitySign(jitteredVelocity.y, enforcedSign.y),
    },
    targetSpeed,
  );
}

function normalizeVelocityToSpeed(velocity: BreakoutPoint, targetSpeed: number): BreakoutPoint {
  const currentSpeed = getBreakoutBallSpeed(velocity);

  if (currentSpeed === 0) {
    return velocity;
  }

  return scaleVelocity(velocity, targetSpeed / currentSpeed);
}

function scaleVelocity(velocity: BreakoutPoint, multiplier: number): BreakoutPoint {
  return {
    x: velocity.x * multiplier,
    y: velocity.y * multiplier,
  };
}

function rotateVelocity(velocity: BreakoutPoint, radians: number): BreakoutPoint {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: velocity.x * cos - velocity.y * sin,
    y: velocity.x * sin + velocity.y * cos,
  };
}

function enforceVelocitySign(value: number, sign: BreakoutVelocitySign | undefined) {
  if (sign === "positive") {
    return Math.abs(value);
  }

  if (sign === "negative") {
    return -Math.abs(value);
  }

  return value;
}

function getBreakoutAngleJitter(random: BreakoutRandomSource) {
  const randomValue = random();

  if (!Number.isFinite(randomValue)) {
    return 0;
  }

  return (clamp(randomValue, 0, 1) * 2 - 1) * BALL_HIT_ANGLE_JITTER_RADIANS;
}

function getNeutralRandomValue() {
  return 0.5;
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
