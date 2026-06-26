import {
  PONG_BOARD_HEIGHT,
  PONG_BOARD_WIDTH,
  PONG_TARGET_SCORE,
} from "./pong-parameters";

export {
  PONG_BOARD_HEIGHT,
  PONG_BOARD_SIZE_OPTIONS,
  PONG_BOARD_WIDTH,
  PONG_TARGET_SCORE,
  PONG_TARGET_SCORE_OPTIONS,
} from "./pong-parameters";

export type PongStatus = "ready" | "running" | "paused" | "won" | "lost";

export type PongSide = "left" | "right";

export type PongPaddleMoveDirection = "up" | "down";

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
  remainingScore: number;
  score: PongScore;
  serveSide: PongSide;
  status: PongStatus;
  targetScore: number;
};

export type CreatePongGameOptions = {
  boardHeight?: number;
  initialServeSide?: PongSide;
  random?: () => number;
  boardWidth?: number;
  targetScore?: number;
};

export type PongGameStartEvent = {
  type: "start";
};

export type PongGameAdvanceEvent = {
  type: "advance";
};

export type PongGameScoreTickEvent = {
  type: "scoreTick";
};

export type PongGameMoveEvent = {
  direction: PongPaddleMoveDirection;
  side: PongSide;
  type: "move";
};

export type PongGameEvent =
  | PongGameAdvanceEvent
  | PongGameMoveEvent
  | PongGameScoreTickEvent
  | PongGameStartEvent;

export const PONG_TICK_DELAY_MS = 16;
export const PONG_SCORE_TICK_DELAY_MS = 1_000;

const BALL_RADIUS = 7;
const BALL_COLLISION_SPEED_MULTIPLIER = 1.01;
const BALL_SPEED_X = 4.8;
const CPU_PADDLE_SPEED = 4.2;
const MAX_PADDLE_BOUNCE_Y = 6.4;
const PADDLE_HEIGHT = 88;
const PADDLE_INSET = 28;
const PADDLE_SPEED = 7;
const PADDLE_WIDTH = 12;
const POINTS_PER_TARGET = 200;
const SCORE_SECOND_PENALTY = 5;
const OPPONENT_RALLY_PENALTY = 100;

type PongScorer = keyof PongScore;

type CreatePongRoundStateOptions = {
  boardHeight?: number;
  boardWidth?: number;
  remainingScore?: number;
  score: PongScore;
  serveSide: PongSide;
  status: PongStatus;
  targetScore?: number;
};

export function createInitialPongGame({
  boardHeight = PONG_BOARD_HEIGHT,
  initialServeSide,
  random = Math.random,
  boardWidth = PONG_BOARD_WIDTH,
  targetScore = PONG_TARGET_SCORE,
}: CreatePongGameOptions = {}): PongGameState {
  const normalizedBoardWidth = normalizePongDimension(boardWidth, PONG_BOARD_WIDTH, 240);
  const normalizedBoardHeight = normalizePongDimension(boardHeight, PONG_BOARD_HEIGHT, 320);
  const normalizedTargetScore = normalizePongTargetScore(targetScore);

  return createRoundState({
    boardHeight: normalizedBoardHeight,
    boardWidth: normalizedBoardWidth,
    remainingScore: getPongMaximumScore(normalizedTargetScore),
    score: { cpu: 0, player: 0 },
    serveSide: initialServeSide ?? pickRandomPongServeSide(random),
    status: "ready",
    targetScore: normalizedTargetScore,
  });
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
    ball: createServedBall(game.ball, game.serveSide),
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
  return createInitialPongGame({
    boardHeight: game.boardHeight,
    boardWidth: game.boardWidth,
    targetScore: game.targetScore,
  });
}

export function movePongPaddle(
  game: PongGameState,
  side: PongSide,
  deltaY: number,
): PongGameState {
  if (game.status === "won" || game.status === "lost") {
    return game;
  }

  const paddleKey = side === "left" ? "playerPaddle" : "cpuPaddle";
  const paddle = movePaddle(game[paddleKey], deltaY, game.boardHeight);

  return {
    ...game,
    ball:
      game.status === "ready" && game.serveSide === side
        ? createBallForPaddle(paddle, side, game.ball.velocity)
        : game.ball,
    [paddleKey]: paddle,
  };
}

export function movePongPaddleUp(game: PongGameState, side: PongSide): PongGameState {
  return movePongPaddle(game, side, -PADDLE_SPEED);
}

export function movePongPaddleDown(game: PongGameState, side: PongSide): PongGameState {
  return movePongPaddle(game, side, PADDLE_SPEED);
}

export function movePongPlayer(game: PongGameState, deltaY: number): PongGameState {
  return movePongPaddle(game, "left", deltaY);
}

export function movePongPlayerUp(game: PongGameState): PongGameState {
  return movePongPaddleUp(game, "left");
}

export function movePongPlayerDown(game: PongGameState): PongGameState {
  return movePongPaddleDown(game, "left");
}

export function isPongBetweenRounds(game: Pick<PongGameState, "score" | "status">) {
  return game.status === "ready" && hasScoredPongPoint(game.score);
}

export function isPongMatchInProgress(game: Pick<PongGameState, "score" | "status">) {
  return game.status === "running" || game.status === "paused" || isPongBetweenRounds(game);
}

export function isPongScoreCountingDown(game: Pick<PongGameState, "status">) {
  return game.status === "running";
}

export function advancePongGame(game: PongGameState): PongGameState {
  if (game.status !== "running") {
    return game;
  }

  const cpuPaddle = moveCpuPaddle(game.cpuPaddle, game.ball, game.boardHeight);

  return advancePongRally(game, cpuPaddle);
}

export function advancePongDuelGame(game: PongGameState): PongGameState {
  if (game.status !== "running") {
    return game;
  }

  return advancePongRally(game, game.cpuPaddle);
}

function advancePongRally(game: PongGameState, cpuPaddle: PongPaddle): PongGameState {
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

export function getPongScoreTickDelay() {
  return PONG_SCORE_TICK_DELAY_MS;
}

export function getPongBallRadius() {
  return BALL_RADIUS;
}

export function getPongPlayerSpeed() {
  return PADDLE_SPEED;
}

export function pickRandomPongServeSide(random: () => number = Math.random): PongSide {
  const value = random();

  return Number.isFinite(value) && value >= 0.5 ? "right" : "left";
}

export function getPongMaximumScore(targetScore = PONG_TARGET_SCORE) {
  return normalizePongTargetScore(targetScore) * POINTS_PER_TARGET;
}

export function decrementPongRemainingScore(game: PongGameState): PongGameState {
  if (!isPongScoreCountingDown(game)) {
    return game;
  }

  return deductPongRemainingScore(game, SCORE_SECOND_PENALTY);
}

export function applyPongGameEvent(
  game: PongGameState,
  event: PongGameEvent,
): PongGameState {
  switch (event.type) {
    case "advance":
      return advancePongGame(game);
    case "move":
      return event.direction === "up"
        ? movePongPaddleUp(game, event.side)
        : movePongPaddleDown(game, event.side);
    case "scoreTick":
      return decrementPongRemainingScore(game);
    case "start":
      return startPongGame(game);
  }
}

function createRoundState({
  boardHeight = PONG_BOARD_HEIGHT,
  boardWidth = PONG_BOARD_WIDTH,
  targetScore = PONG_TARGET_SCORE,
  remainingScore = getPongMaximumScore(targetScore),
  score,
  serveSide,
  status,
}: CreatePongRoundStateOptions): PongGameState {
  const playerPaddle = createPaddle("player", boardWidth, boardHeight);
  const cpuPaddle = createPaddle("cpu", boardWidth, boardHeight);
  const servingPaddle = serveSide === "left" ? playerPaddle : cpuPaddle;

  return {
    ball: createBallForPaddle(servingPaddle, serveSide),
    boardHeight,
    boardWidth,
    cpuPaddle,
    playerPaddle,
    remainingScore,
    score,
    serveSide,
    status,
    targetScore,
  };
}

function createBallForPaddle(
  paddle: PongPaddle,
  serveSide: PongSide,
  velocity: PongPoint = createServeVelocity(serveSide),
): PongBall {
  const isLeftServe = serveSide === "left";

  return {
    position: {
      x: isLeftServe
        ? paddle.x + paddle.width + BALL_RADIUS + 1
        : paddle.x - BALL_RADIUS - 1,
      y: paddle.y + paddle.height / 2,
    },
    velocity,
  };
}

function createServedBall(ball: PongBall, serveSide: PongSide): PongBall {
  return {
    ...ball,
    velocity: createServeVelocity(serveSide),
  };
}

function createServeVelocity(serveSide: PongSide): PongPoint {
  return {
    x: serveSide === "left" ? BALL_SPEED_X : -BALL_SPEED_X,
    y: 0,
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
      velocity: increaseBallSpeed({
        ...ball.velocity,
        y: Math.abs(ball.velocity.y),
      }),
    };
  }

  if (ball.position.y + BALL_RADIUS >= boardHeight) {
    return {
      position: {
        ...ball.position,
        y: boardHeight - BALL_RADIUS,
      },
      velocity: increaseBallSpeed({
        ...ball.velocity,
        y: -Math.abs(ball.velocity.y),
      }),
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
    velocity: increaseBallSpeed({
      x: isPlayerPaddle ? Math.abs(ball.velocity.x) : -Math.abs(ball.velocity.x),
      y: clamp(hitOffset, -1, 1) * MAX_PADDLE_BOUNCE_Y,
    }),
  };
}

function increaseBallSpeed(velocity: PongPoint): PongPoint {
  return {
    x: velocity.x * BALL_COLLISION_SPEED_MULTIPLIER,
    y: velocity.y * BALL_COLLISION_SPEED_MULTIPLIER,
  };
}

function scorePongPoint(game: PongGameState, scorer: PongScorer): PongGameState {
  const score = {
    ...game.score,
    [scorer]: game.score[scorer] + 1,
  };
  const remainingScore =
    scorer === "cpu"
      ? Math.max(0, game.remainingScore - OPPONENT_RALLY_PENALTY)
      : game.remainingScore;

  if (score.player >= game.targetScore) {
    return createRoundState({
      boardHeight: game.boardHeight,
      boardWidth: game.boardWidth,
      remainingScore,
      score,
      serveSide: "right",
      status: "won",
      targetScore: game.targetScore,
    });
  }

  if (score.cpu >= game.targetScore) {
    return createRoundState({
      boardHeight: game.boardHeight,
      boardWidth: game.boardWidth,
      remainingScore,
      score,
      serveSide: "left",
      status: "lost",
      targetScore: game.targetScore,
    });
  }

  const serveSide = scorer === "player" ? "right" : "left";

  return createRoundState({
    boardHeight: game.boardHeight,
    boardWidth: game.boardWidth,
    remainingScore,
    score,
    serveSide,
    status: "ready",
    targetScore: game.targetScore,
  });
}

function deductPongRemainingScore(game: PongGameState, points: number): PongGameState {
  const remainingScore = Math.max(0, game.remainingScore - points);

  if (remainingScore === game.remainingScore) {
    return game;
  }

  return {
    ...game,
    remainingScore,
  };
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
