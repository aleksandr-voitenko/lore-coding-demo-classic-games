export type SpaceInvadersStatus = "ready" | "running" | "paused" | "lost" | "won";

export type SpaceInvadersDirection = -1 | 1;

export type SpaceInvadersPlayer = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type SpaceInvader = {
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

export type SpaceInvadersShot = {
  height: number;
  velocityY: number;
  width: number;
  x: number;
  y: number;
};

export type SpaceInvadersGameState = {
  invaders: SpaceInvader[];
  lives: number;
  marchDirection: SpaceInvadersDirection;
  player: SpaceInvadersPlayer;
  playerShot: SpaceInvadersShot | null;
  score: number;
  status: SpaceInvadersStatus;
};

export const SPACE_INVADERS_BOARD_WIDTH = 420;
export const SPACE_INVADERS_BOARD_HEIGHT = 560;
export const SPACE_INVADERS_COLUMNS = 11;
export const SPACE_INVADERS_ROWS = 5;
export const SPACE_INVADERS_STARTING_LIVES = 3;
export const SPACE_INVADERS_BASE_Y = 492;
export const SPACE_INVADERS_TICK_DELAY_MS = 85;

const INVADER_DROP_Y = 4;
const INVADER_GAP_X = 12;
const INVADER_GAP_Y = 18;
const INVADER_HEIGHT = 18;
const INVADER_STEP_X = 2;
const INVADER_TOP = 64;
const INVADER_WIDTH = 22;
const INVADER_X = 38;
const PLAYER_HEIGHT = 16;
const PLAYER_SPEED = 24;
const PLAYER_WIDTH = 42;
const PLAYER_Y = SPACE_INVADERS_BOARD_HEIGHT - 46;
const SHOT_HEIGHT = 14;
const SHOT_SPEED = -16;
const SHOT_WIDTH = 4;

export function createInitialSpaceInvadersGame(): SpaceInvadersGameState {
  return {
    invaders: createSpaceInvadersFormation(),
    lives: SPACE_INVADERS_STARTING_LIVES,
    marchDirection: 1,
    player: createCenteredPlayer(),
    playerShot: null,
    score: 0,
    status: "ready",
  };
}

export function createSpaceInvadersFormation() {
  return Array.from({ length: SPACE_INVADERS_ROWS }, (_, row) =>
    Array.from({ length: SPACE_INVADERS_COLUMNS }, (_, column): SpaceInvader => {
      const x = INVADER_X + column * (INVADER_WIDTH + INVADER_GAP_X);
      const y = INVADER_TOP + row * (INVADER_HEIGHT + INVADER_GAP_Y);

      return {
        column,
        height: INVADER_HEIGHT,
        id: `${row}:${column}`,
        isActive: true,
        points: getInvaderPoints(row),
        row,
        width: INVADER_WIDTH,
        x,
        y,
      };
    }),
  ).flat();
}

export function startSpaceInvadersGame(
  game: SpaceInvadersGameState,
): SpaceInvadersGameState {
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
    return restartSpaceInvadersGame();
  }

  return {
    ...game,
    status: "running" as const,
  };
}

export function pauseSpaceInvadersGame(
  game: SpaceInvadersGameState,
): SpaceInvadersGameState {
  if (game.status !== "running") {
    return game;
  }

  return {
    ...game,
    status: "paused" as const,
  };
}

export function restartSpaceInvadersGame(): SpaceInvadersGameState {
  return {
    ...createInitialSpaceInvadersGame(),
    status: "running" as const,
  };
}

export function moveSpaceInvadersPlayer(
  game: SpaceInvadersGameState,
  deltaX: number,
): SpaceInvadersGameState {
  if (game.status === "lost" || game.status === "won") {
    return game;
  }

  return {
    ...game,
    player: {
      ...game.player,
      x: clamp(game.player.x + deltaX, 0, SPACE_INVADERS_BOARD_WIDTH - game.player.width),
    },
  };
}

export function moveSpaceInvadersPlayerLeft(game: SpaceInvadersGameState) {
  return moveSpaceInvadersPlayer(game, -PLAYER_SPEED);
}

export function moveSpaceInvadersPlayerRight(game: SpaceInvadersGameState) {
  return moveSpaceInvadersPlayer(game, PLAYER_SPEED);
}

export function fireSpaceInvadersShot(game: SpaceInvadersGameState): SpaceInvadersGameState {
  if (game.status !== "running" || game.playerShot !== null) {
    return game;
  }

  return {
    ...game,
    playerShot: createPlayerShot(game.player),
  };
}

export function advanceSpaceInvadersGame(
  game: SpaceInvadersGameState,
): SpaceInvadersGameState {
  if (game.status !== "running") {
    return game;
  }

  const gameAfterShot = advancePlayerShot(game);

  if (gameAfterShot.status === "won") {
    return gameAfterShot;
  }

  const marchedGame = marchInvaders(gameAfterShot);

  if (hasInvaderReachedBase(marchedGame)) {
    return {
      ...marchedGame,
      lives: 0,
      status: "lost" as const,
    };
  }

  return marchedGame;
}

export function getSpaceInvadersTickDelay() {
  return SPACE_INVADERS_TICK_DELAY_MS;
}

export function getSpaceInvadersPlayerSpeed() {
  return PLAYER_SPEED;
}

function advancePlayerShot(game: SpaceInvadersGameState): SpaceInvadersGameState {
  if (game.playerShot === null) {
    return game;
  }

  const movedShot = {
    ...game.playerShot,
    y: game.playerShot.y + game.playerShot.velocityY,
  };

  if (movedShot.y + movedShot.height < 0) {
    return {
      ...game,
      playerShot: null,
    };
  }

  const hitInvader = game.invaders.find(
    (invader) => invader.isActive && rectanglesIntersect(movedShot, invader),
  );

  if (hitInvader === undefined) {
    return {
      ...game,
      playerShot: movedShot,
    };
  }

  const invaders = game.invaders.map((invader) =>
    invader.id === hitInvader.id ? { ...invader, isActive: false } : invader,
  );
  const score = game.score + hitInvader.points;
  const activeInvaderCount = invaders.filter((invader) => invader.isActive).length;

  return {
    ...game,
    invaders,
    playerShot: null,
    score,
    status: activeInvaderCount === 0 ? "won" : game.status,
  };
}

function marchInvaders(game: SpaceInvadersGameState): SpaceInvadersGameState {
  const activeInvaders = game.invaders.filter((invader) => invader.isActive);

  if (activeInvaders.length === 0) {
    return game;
  }

  const wouldHitWall = activeInvaders.some((invader) => {
    const nextX = invader.x + game.marchDirection * INVADER_STEP_X;

    return nextX < 0 || nextX + invader.width > SPACE_INVADERS_BOARD_WIDTH;
  });

  if (wouldHitWall) {
    return {
      ...game,
      invaders: game.invaders.map((invader) =>
        invader.isActive ? { ...invader, y: invader.y + INVADER_DROP_Y } : invader,
      ),
      marchDirection: (game.marchDirection * -1) as SpaceInvadersDirection,
    };
  }

  return {
    ...game,
    invaders: game.invaders.map((invader) =>
      invader.isActive
        ? { ...invader, x: invader.x + game.marchDirection * INVADER_STEP_X }
        : invader,
    ),
  };
}

function hasInvaderReachedBase(game: SpaceInvadersGameState) {
  return game.invaders.some(
    (invader) => invader.isActive && invader.y + invader.height >= SPACE_INVADERS_BASE_Y,
  );
}

function createCenteredPlayer(): SpaceInvadersPlayer {
  return {
    height: PLAYER_HEIGHT,
    width: PLAYER_WIDTH,
    x: (SPACE_INVADERS_BOARD_WIDTH - PLAYER_WIDTH) / 2,
    y: PLAYER_Y,
  };
}

function createPlayerShot(player: SpaceInvadersPlayer): SpaceInvadersShot {
  return {
    height: SHOT_HEIGHT,
    velocityY: SHOT_SPEED,
    width: SHOT_WIDTH,
    x: player.x + player.width / 2 - SHOT_WIDTH / 2,
    y: player.y - SHOT_HEIGHT - 2,
  };
}

function getInvaderPoints(row: number) {
  if (row === 0) {
    return 30;
  }

  if (row <= 2) {
    return 20;
  }

  return 10;
}

function rectanglesIntersect(
  first: { height: number; width: number; x: number; y: number },
  second: { height: number; width: number; x: number; y: number },
) {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
